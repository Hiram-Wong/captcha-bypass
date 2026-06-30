import { mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';

import { CryptoHasher, file, JSON5, write } from 'bun';
import { InferenceSession, Tensor, env as ortEnv } from 'onnxruntime-web';

import { ROOT_PATH } from '@/utils/path';
import { isPackaged } from '@/utils/systemInfo';
import { isJsonStr } from '@/utils/validate';

import wasmBin from '../../../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.wasm' with { type: 'file' };
import mjsBin from '../../../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.mjs' with { type: 'file' };

type OrtRunResult = {
  output: Tensor;
  outputs: InferenceSession.ReturnType;
  inferenceTime: number;
};

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
      charset = (input as string).split('');
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
    },
  ): string | string[] {
    const { dims, data } = outputTensor;

    // [time_steps=21, batch=1, num_classes=8210]
    const isBatch = dims.length === 3;
    const batchSize = isBatch ? dims[1] : 1;
    const maxTime = isBatch ? dims[0] : dims[0];
    const numClasses = isBatch ? dims[2] : dims[1];

    const { sequenceLength = [], blankIndex, mergeRepeated = true, allowedIndices } = options || {};

    const blankIdx = blankIndex ?? numClasses - 1;
    const results: string[] = [];

    // 计算每帧的步长（classes 维度）
    const frameStride = numClasses;
    const batchStride = isBatch ? maxTime * numClasses : 0;

    for (let b = 0; b < batchSize; b++) {
      const seqLen = sequenceLength[b] ?? maxTime;
      const decodedChars: string[] = [];
      let prevId = blankIdx;

      // 计算该 batch 的起始偏移
      const batchOffset = isBatch ? b * batchStride : 0;

      for (let t = 0; t < seqLen; t++) {
        // 当前帧在 Float32Array 中的起始位置
        const frameOffset = batchOffset + t * frameStride;

        // 在 [frameOffset, frameOffset + numClasses) 范围内找最大值索引
        let maxId = 0;
        let maxVal = -Infinity;

        if (allowedIndices && allowedIndices.size > 0) {
          for (const c of allowedIndices) {
            const val = (data as Float32Array)[frameOffset + c];
            if (val > maxVal) {
              maxVal = val;
              maxId = c;
            }
          }

          const blankVal = (data as Float32Array)[frameOffset + blankIdx];
          if (blankVal > maxVal) {
            maxVal = blankVal;
            maxId = blankIdx;
          }
        } else {
          for (let c = 0; c < numClasses; c++) {
            const val = (data as Float32Array)[frameOffset + c];
            if (val > maxVal) {
              maxVal = val;
              maxId = c;
            }
          }
        }

        // 跳过空白符
        if (maxId === blankIdx) {
          prevId = maxId;
          continue;
        }

        // 跳过重复（CTC 核心规则）
        if (mergeRepeated && maxId === prevId) {
          continue;
        }

        prevId = maxId;

        // 映射到字符
        const char = vocabulary[maxId];
        if (char !== undefined) {
          decodedChars.push(char);
        }
      }

      results.push(decodedChars.join(''));
    }

    return batchSize === 1 ? results[0] : results;
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
