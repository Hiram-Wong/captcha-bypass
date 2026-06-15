export interface UploadedImage {
  mimetype: string;
  buffer: Buffer;
}

export type ImageInput = string | UploadedImage | File;

export interface JsonRpcV2 {
  jsonrpc: '2.0';
  method: string;
  id?: string | number | null;
  params?: Record<string, unknown>;
}