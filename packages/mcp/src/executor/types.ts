export type ExecutorInput = { url: string } & Record<string, unknown>;

export type ExecutorOutput<T> = { code: number; msg: string; data: T };

export type Executor = <T = unknown>(input: ExecutorInput) => Promise<T>;
