export declare const assert: {
  ok(value: unknown, message?: string): asserts value
  strictEqual<T>(
    actual: unknown,
    expected: T,
    message?: string,
  ): asserts actual is T
  fail(message?: string): never
}

export declare const it: (name: string, fn: () => void | Promise<void>) => void
