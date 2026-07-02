import { mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';

import { CryptoHasher, file, JSON5, write } from 'bun';
import { InferenceSession, Tensor, env as ortEnv } from 'onnxruntime-web';

import { log } from '@/utils/logger';
import { ROOT_PATH } from '@/utils/path';
import { isPackaged } from '@/utils/systemInfo';
import { isJsonStr } from '@/utils/validate';

import wasmBin from '../../../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.wasm' with { type: 'file' };
import mjsBin from '../../../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.mjs' with { type: 'file' };

const logger = log.withContext('MODULE<ort>');

type OrtRunResult = {
  output: Tensor;
  outputs: InferenceSession.ReturnType;
  inferenceTime: number;
};

interface HungarianPair {
  row: number;
  col: number;
  cost: number;
}

interface HungarianResult {
  cost: number;
  assignment: number[];
  pairs: HungarianPair[];
}

const FILES = [
  {
    name: 'ort-wasm-simd-threaded.wasm',
    source: wasmBin,
    hash: 'd1ab1b94b16a65b29d710d0b587b29e7bed336827577623913479b8afe8113e6',
  },
  {
    name: 'ort-wasm-simd-threaded.mjs',
    source: mjsBin,
    hash: '0a1e718d99c41b22c21f2520ff4f9e883a6b5533856e398d21816ee8eb8185d3',
  },
] as const;

class OrtWasmManager {
  private static instance: OrtWasmManager | null = null;
  private isMountWasm: boolean = false;
  private releaseDir: string = resolve(ROOT_PATH, 'ort-wasm/');

  static getInstance(): OrtWasmManager {
    if (!OrtWasmManager.instance) {
      OrtWasmManager.instance = new OrtWasmManager();
    }
    return OrtWasmManager.instance;
  }

  async releaseWasm(): Promise<void> {
    if (this.isMountWasm === true) return;

    const baseFile = file(this.releaseDir);
    try {
      const stats = await baseFile.stat();
      if (!stats.isDirectory()) {
        await rm(this.releaseDir, { recursive: true, force: true });
        await mkdir(this.releaseDir, { recursive: true });
      }
    } catch {
      await mkdir(this.releaseDir, { recursive: true });
    }

    for (const { name, source, hash } of FILES) {
      const dest = resolve(this.releaseDir, name);
      const destFile = Bun.file(dest);

      if (await destFile.exists()) {
        const destHash = new CryptoHasher('sha256').update(await destFile.bytes()).digest('hex');
        if (destHash === hash) continue;
      }

      await write(dest, await file(source).bytes());
    }

    this.isMountWasm = true;
  }

  async init(): Promise<void> {
    if (isPackaged) {
      await this.releaseWasm();
      ortEnv.wasm.wasmPaths = {
        mjs: resolve(this.releaseDir, FILES[1].name),
        wasm: resolve(this.releaseDir, FILES[0].name),
      };
    }
  }
}

export class BaseOrtservice {
  private session: InferenceSession | null = null;
  charset: string[] = [];

  constructor(private readonly options: InferenceSession.SessionOptions = {}) {}

  get instance(): InferenceSession {
    if (!this.session) {
      throw new Error('ONNX model not loaded');
    }
    return this.session;
  }

  get inputName(): string {
    const [name] = this.instance.inputNames;
    if (!name) throw new Error('ONNX model has no input');
    return name;
  }

  get outputName(): string {
    const [name] = this.instance.outputNames;
    if (!name) throw new Error('ONNX model has no output');
    return name;
  }

  async loadModel(model: ArrayBufferLike | Uint8Array | string): Promise<void> {
    await OrtWasmManager.getInstance().init();

    const options: InferenceSession.SessionOptions = {
      executionProviders: this.options.executionProviders ?? ['wasm'],
      logSeverityLevel: isPackaged ? 3 : 2,
      ...this.options,
    };

    this.session = await InferenceSession.create(model as any, options);
  }

  loadCharset(input: string): void {
    if (!input) throw new Error('Charset is empty');

    let charset: string[] = [];
    if (isJsonStr(input)) {
      const raw = JSON5.parse(input);
      if (!Array.isArray(raw)) throw new Error('Invalid charset format');
      charset = raw;
    } else {
      charset = (input as string).includes('\n') ? (input as string).split('\n') : [...(input as string)];
    }

    if (!charset.length) throw new Error('Charset is empty');

    this.charset = charset[0] === '' ? charset : [''].concat(charset);
  }

  async run(input: Tensor): Promise<OrtRunResult> {
    const start = performance.now();
    const outputs = await this.instance.run({ [this.inputName]: input });
    const inferenceTime = performance.now() - start;
    const output = outputs[this.outputName] ?? Object.values(outputs)[0];

    if (!output || !('data' in output) || !('dims' in output)) {
      throw new Error('ONNX model did not return a tensor output');
    }

    return { output, outputs, inferenceTime };
  }

  async dispose(): Promise<void> {
    if (!this.session) return;

    await this.session.release();
    this.session = null;
  }

  // CTC贪心解码(Greedy Decoding)
  ctcGreedyDecode(
    outputTensor: Tensor,
    vocabulary: string[],
    options?: {
      sequenceLength?: number[];
      blankIndex?: number;
      mergeRepeated?: boolean;
      allowedIndices?: Set<number>;
      layout?: 'tnc' | 'ntc';
    },
  ): string | string[] {
    const { dims, data } = outputTensor;

    const { sequenceLength = [], blankIndex = 0, mergeRepeated = true, allowedIndices, layout = 'tnc' } = options || {};

    const isBatch = dims.length === 3;

    let batchSize: number;
    let maxTime: number;
    let numClasses: number;

    if (!isBatch) {
      [maxTime, numClasses] = dims; // [T,C]
      batchSize = 1;
    } else if (layout === 'tnc') {
      [maxTime, batchSize, numClasses] = dims; // [T,N,C]
    } else {
      [batchSize, maxTime, numClasses] = dims; // [N,T,C]
    }

    if (blankIndex < 0 || blankIndex >= numClasses) {
      throw new Error(`invalid blankIndex: ${blankIndex}`);
    }

    const results: string[] = [];
    const values = data as Float32Array;
    const vocabSize = vocabulary.length;

    for (let b = 0; b < batchSize; b++) {
      const seqLen = Math.min(sequenceLength[b] ?? maxTime, maxTime);

      const decodedChars: string[] = [];

      let prevId = blankIndex;
      let vocabOverflow = false;

      for (let t = 0; t < seqLen; t++) {
        let frameOffset: number;

        if (!isBatch) {
          frameOffset = t * numClasses; // [T,C]
        } else if (layout === 'tnc') {
          frameOffset = t * batchSize * numClasses + b * numClasses; // [T,N,C]
        } else {
          frameOffset = b * maxTime * numClasses + t * numClasses; // [N,T,C]
        }

        let maxId = 0;
        let maxVal = -Infinity;

        if (!!allowedIndices?.size) {
          for (const c of allowedIndices) {
            const val = values[frameOffset + c];

            if (val > maxVal) {
              maxVal = val;
              maxId = c;
            }
          }

          if (!allowedIndices.has(blankIndex)) {
            const blankVal = values[frameOffset + blankIndex];

            if (blankVal > maxVal) {
              maxVal = blankVal;
              maxId = blankIndex;
            }
          }
        } else {
          for (let c = 0; c < numClasses; c++) {
            const val = values[frameOffset + c];

            if (val > maxVal) {
              maxVal = val;
              maxId = c;
            }
          }
        }

        if (maxId !== blankIndex && (!mergeRepeated || maxId !== prevId)) {
          if (maxId < vocabSize) {
            decodedChars.push(vocabulary[maxId]);
          } else if (!vocabOverflow) {
            vocabOverflow = true;
            logger.debug(`ctc greedy decode: index ${maxId} out of vocab range (size ${vocabulary.length})`);
          }
        }

        prevId = maxId;
      }

      results.push(decodedChars.join(''));
    }

    return batchSize === 1 ? results[0] : results;
  }

  // 匈牙利算法(Hungarian)
  hungarian(costMatrix: number[][]): HungarianResult {
    const rows = costMatrix.length;
    if (rows === 0) {
      return {
        cost: 0,
        assignment: [],
        pairs: [],
      };
    }

    const cols = costMatrix[0].length;
    const n = Math.max(rows, cols);
    const INF = 1e18;

    // 补成方阵
    const cost = Array.from({ length: n }, (_, i) =>
      Array.from({ length: n }, (_, j) => {
        if (i < rows && j < cols) {
          return costMatrix[i][j];
        }
        return INF;
      }),
    );

    const u = new Array(n + 1).fill(0);
    const v = new Array(n + 1).fill(0);
    const p = new Array(n + 1).fill(0);
    const way = new Array(n + 1).fill(0);

    for (let i = 1; i <= n; i++) {
      p[0] = i;

      const minv = new Array(n + 1).fill(INF);
      const used = new Array(n + 1).fill(false);

      let j0 = 0;

      while (true) {
        used[j0] = true;

        const i0 = p[j0];

        let delta = INF;
        let j1 = 0;

        for (let j = 1; j <= n; j++) {
          if (used[j]) continue;

          const cur = cost[i0 - 1][j - 1] - u[i0] - v[j];

          if (cur < minv[j]) {
            minv[j] = cur;
            way[j] = j0;
          }

          if (minv[j] < delta) {
            delta = minv[j];
            j1 = j;
          }
        }

        for (let j = 0; j <= n; j++) {
          if (used[j]) {
            u[p[j]] += delta;
            v[j] -= delta;
          } else {
            minv[j] -= delta;
          }
        }

        j0 = j1;

        if (p[j0] === 0) break;
      }

      while (true) {
        const j1 = way[j0];
        p[j0] = p[j1];
        j0 = j1;
        if (j0 === 0) break;
      }
    }

    const assignment = new Array(rows).fill(-1);
    const pairs = [];
    let totalCost = 0;

    for (let j = 1; j <= n; j++) {
      const i = p[j];

      if (i === 0) continue;

      const row = i - 1;
      const col = j - 1;

      if (row < rows && col < cols) {
        assignment[row] = col;
        totalCost += costMatrix[row][col];

        pairs.push({
          row,
          col,
          cost: costMatrix[row][col],
        });
      }
    }

    return {
      cost: totalCost,
      assignment,
      pairs,
    };
  }

  // 计算维度张量
  argMax(tensor: Tensor, axis: number = -1): { data: Int32Array; dims: number[] } {
    const { data, dims } = tensor;
    const floatData = data as Float32Array;

    const rank = dims.length;
    const normAxis = axis < 0 ? rank + axis : axis;

    if (normAxis < 0 || normAxis >= rank) {
      throw new Error(`Axis ${axis} out of bounds for rank ${rank}`);
    }

    // 计算各维度大小
    const axisSize = dims[normAxis];
    const outerSize = dims.slice(0, normAxis).reduce((a, b) => a * b, 1) || 1;
    const innerSize = dims.slice(normAxis + 1).reduce((a, b) => a * b, 1) || 1;

    // 输出形状 = 输入形状去掉 axis 维度
    const outputDims = dims.filter((_, i) => i !== normAxis);
    const outputSize = outputDims.reduce((a, b) => a * b, 1) || 1;
    const result = new Int32Array(outputSize);

    let resIdx = 0;

    // 外层: 所有 outer 组合
    for (let outer = 0; outer < outerSize; outer++) {
      // 中层: 沿 axis 维度遍历找最大值
      for (let inner = 0; inner < innerSize; inner++) {
        let maxVal = -Infinity;
        let maxIdx = 0;

        // 内层: 在 axis 维度上扫描
        for (let a = 0; a < axisSize; a++) {
          // 一维索引计算: ((outer * axisSize) + a) * innerSize + inner
          const flatIdx = (outer * axisSize + a) * innerSize + inner;
          const val = floatData[flatIdx];

          if (val > maxVal) {
            maxVal = val;
            maxIdx = a;
          }
        }

        result[resIdx++] = maxIdx;
      }
    }

    return { data: result, dims: outputDims };
  }
}
