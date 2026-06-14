import { t } from 'elysia';

export const ImageInput = t.Union([t.String({ minLength: 1 }), t.File({ type: 'image/*' })]);

export const BooleanInput = t
  .Transform(t.Union([t.Boolean(), t.Literal('true'), t.Literal('false')]))
  .Decode((value): boolean => value === true || value === 'true')
  .Encode((value) => value);
