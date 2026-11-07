import { z } from 'zod';

export const success = <T>(data: T, message: string = 'success') => {
  return { code: 0 as const, msg: message, data };
};

export const fail = (message: string) => {
  return { code: -1 as const, msg: message, data: null };
};

export const responseSchema = <T extends z.ZodType>(data: T) =>
  z.union([
    z.object({ code: z.literal(0), data, msg: z.string() }),
    z.object({ code: z.literal(-1), data: z.null(), msg: z.string() }),
  ]);
