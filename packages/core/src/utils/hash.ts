import { CryptoHasher } from 'bun';

import type { BunFile, SupportedCryptoAlgorithms } from 'bun';

/**
 * 流式计算文件哈希，避免将整个文件读入内存
 * @param algorithm 哈希算法
 * @param file BunFile 实例
 * @returns 小写 hex 摘要
 */
export const hash = async (algorithm: SupportedCryptoAlgorithms, file: BunFile): Promise<string> => {
  const hasher = new CryptoHasher(algorithm);
  for await (const chunk of file.stream()) {
    hasher.update(chunk);
  }

  return hasher.digest('hex');
};

export const sha256 = (file: BunFile): Promise<string> => hash('sha256', file);

export const md5 = (file: BunFile): Promise<string> => hash('md5', file);
