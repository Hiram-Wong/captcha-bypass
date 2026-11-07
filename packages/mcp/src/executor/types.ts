export type ExecutorInput = { url: string } & Record<string, unknown>;

export type Executor = <T = unknown>(input: ExecutorInput) => Promise<T>;
