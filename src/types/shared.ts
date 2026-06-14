export interface UploadedImage {
  mimetype: string;
  buffer: Buffer;
}

export type ImageInput = string | UploadedImage | File;
