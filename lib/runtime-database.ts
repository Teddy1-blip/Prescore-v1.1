export type RuntimePreparedStatement = {
  bind: (...values: unknown[]) => RuntimePreparedStatement;
  run: () => Promise<unknown>;
  first: <T = unknown>() => Promise<T | null>;
  all: <T = unknown>() => Promise<{ results?: T[] }>;
};

export type RuntimeDatabase = {
  prepare: (query: string) => RuntimePreparedStatement;
  batch: (statements: RuntimePreparedStatement[]) => Promise<Array<{ results: unknown[] }>>;
};
