import { t, type TSchema } from 'elysia';

export const schema = <T extends TSchema>(data: T) =>
  t.Union([
    t.Object({ code: t.Literal(0), data, msg: t.String() }),
    t.Object({ code: t.Literal(-1), data: t.Null(), msg: t.String() }),
  ]);

export const success = <T>(data: T, message: string = 'success') => {
  return { code: 0 as const, msg: message, data };
};

export const fail = (message: string) => {
  return { code: -1 as const, msg: message, data: null };
};
