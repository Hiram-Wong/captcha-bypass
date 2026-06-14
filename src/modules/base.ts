import { t, type TSchema } from 'elysia';

export const apiResponse = <T extends TSchema>(data: T) =>
  t.Union([
    t.Object({ status: t.Literal(0), data, msg: t.String() }),
    t.Object({ code: t.Literal(-1), msg: t.String() }),
  ]);
