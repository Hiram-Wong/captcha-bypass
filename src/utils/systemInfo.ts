export const isDev = process.env.NODE_ENV === 'development';
export const isProd = process.env.NODE_ENV === 'production';

export const isPackaged = typeof Bun !== 'undefined' && Bun.embeddedFiles?.length > 0;
