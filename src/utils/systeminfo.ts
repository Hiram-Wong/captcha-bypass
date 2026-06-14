export const isPackaged = typeof Bun !== 'undefined' && Bun.embeddedFiles?.length > 0;
