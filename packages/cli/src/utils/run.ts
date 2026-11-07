import { fail, success } from '@captcha-bypass/core/utils/response';

export const run = async (label: string, solver: () => Promise<unknown>): Promise<void> => {
  try {
    const result = await solver();
    console.log(JSON.stringify(success(result), null, 2));
  } catch (err) {
    console.log(JSON.stringify(fail(err instanceof Error ? err.message || `${label}失败` : `${label}失败`), null, 2));
  }
};
