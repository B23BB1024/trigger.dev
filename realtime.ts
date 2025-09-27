import {
  AnyTask,
  ApiClient,
  InferRunTypes,
  RealtimeRun,
  RealtimeRunSkipColumns,
} from "@trigger.dev/core/v3";

export type RealtimeRunOptions = {
  id?: string;
  enabled?: boolean;
  experimental_throttleInMs?: number;
};

export type RealtimeSingleRunOptions<TTask extends AnyTask = AnyTask> = RealtimeRunOptions & {
  /**
   * Callback this is called when the run completes, an error occurs, or the subscription is stopped.
   *
   * @param {RealtimeRun<TTask>} run - The run object
   * @param {Error} [err] - The error that occurred
   */
  onComplete?: (run: RealtimeRun<TTask>, err?: Error) => void;

  /**
   * Whether to stop the subscription when the run completes
   *
   * @default true
   *
   * Set this to false if you are making updates to the run metadata after completion through child runs
   */
  stopOnCompletion?: boolean;

  /**
   * Skip columns from the subscription.
   *
   * @default []
   */
  skipColumns?: RealtimeRunSkipColumns;
};

export type RealtimeRunInstance<TTask extends AnyTask = AnyTask> = {
  run: RealtimeRun<TTask> | undefined;
  error: Error | undefined;
  isComplete: boolean;
  /**
   * Abort the current request immediately.
   */
  stop: () => void;
};

export type StreamResults<TStreams extends Record<string, any>> = {
  [K in keyof TStreams]: Array<TStreams[K]>;
};

export type RealtimeRunWithStreamsInstance<
  TTask extends AnyTask = AnyTask,
  TStreams extends Record<string, any> = Record<string, any>,
> = {
  run: RealtimeRun<TTask> | undefined;
  streams: StreamResults<TStreams>;
  error: Error | undefined;
  isComplete: boolean;
  /**
   * Abort the current request immediately, keep the generated tokens if any.
   */
  stop: () => void;
};

export type RealtimeRunsInstance<TTask extends AnyTask = AnyTask> = {
  runs: RealtimeRun<TTask>[];
  error: Error | undefined;
  /**
   * Abort the current request immediately.
   */
  stop: () => void;
};

export type RealtimeRunsWithTagOptions = RealtimeRunOptions & {
  /**
   * Filter runs by the time they were created. You must specify the duration string like "1h", "10s", "30m", etc.
   *
   * @example
   * "1h" - 1 hour ago
   * "10s" - 10 seconds ago
   * "30m" - 30 minutes ago
   * "1d" - 1 day ago
   * "1w" - 1 week ago
   *
   * The maximum duration is 1 week
   *
   * @note The timestamp will be calculated on the server side when you first subscribe to the runs.
   *
   */
  createdAt?: string;

  /**
   * Skip columns from the subscription.
   *
   * @default []
   */
  skipColumns?: RealtimeRunSkipColumns;
};

/**
 * Subscribe to realtime updates of a task run.
 *
 * @template TTask - The type of the task
 * @param {string} runId - The unique identifier of the run to subscribe to
 * @param {ApiClient} apiClient - The API client instance
 * @param {RealtimeSingleRunOptions} [options] - Configuration options for the subscription
 * @returns {RealtimeRunInstance<TTask>} An object containing the current state of the run, error handling, and control methods
 *
 * @example
 * ```ts
 * import { createRealtimeRun } from '@trigger.dev/sdk/v3/browser';
 * import type { myTask } from './path/to/task';
 * 
 * const { run, error, stop } = createRealtimeRun<typeof myTask>('run-id-123', apiClient);
 * ```
 */
export function createRealtimeRun<TTask extends AnyTask>(
  runId: string,
  apiClient: ApiClient,
  options?: RealtimeSingleRunOptions<TTask>
): RealtimeRunInstance<TTask> {
  let run: RealtimeRun<TTask> | undefined = undefined;
  let error: Error | undefined = undefined;
  let isComplete = false;
  let abortController: AbortController | null = null;
  let hasCalledOnComplete = false;

  const stop = () => {
    if (abortController) {
      abortController.abort();
      abortController = null;
    }
  };

  const start = async () => {
    try {
      if (!runId || !apiClient) {
        return;
      }

      abortController = new AbortController();

      await processRealtimeRun(
        runId,
        { skipColumns: options?.skipColumns },
        apiClient,
        (newRun) => {
          run = newRun;
        },
        (err) => {
          error = err;
        },
        abortController,
        typeof options?.stopOnCompletion === "boolean" ? options.stopOnCompletion : true
      );
    } catch (err) {
      // Ignore abort errors as they are expected.
      if ((err as any).name === "AbortError") {
        abortController = null;
        return;
      }

      error = err as Error;
    } finally {
      if (abortController) {
        abortController = null;
      }

      // Mark the subscription as complete
      isComplete = true;

      // Call onComplete callback if provided
      if (run && options?.onComplete && !hasCalledOnComplete) {
        options.onComplete(run, error);
        hasCalledOnComplete = true;
      }
    }
  };

  // Start the subscription if enabled
  if (typeof options?.enabled !== "boolean" || options.enabled) {
    start().catch(() => {
      // Error handling is done in the start function
    });
  }

  return {
    get run() {
      return run;
    },
    get error() {
      return error;
    },
    get isComplete() {
      return isComplete;
    },
    stop,
  };
}

/**
 * Subscribe to realtime updates of a task run with associated data streams.
 *
 * @template TTask - The type of the task
 * @template TStreams - The type of the streams data
 * @param {string} runId - The unique identifier of the run to subscribe to
 * @param {ApiClient} apiClient - The API client instance
 * @param {RealtimeSingleRunOptions} [options] - Configuration options for the subscription
 * @returns {RealtimeRunWithStreamsInstance<TTask, TStreams>} An object containing the current state of the run, streams data, and error handling
 *
 * @example
 * ```ts
 * import { createRealtimeRunWithStreams } from '@trigger.dev/sdk/v3/browser';
 * import type { myTask } from './path/to/task';
 * 
 * const { run, streams, error, stop } = createRealtimeRunWithStreams<typeof myTask, {
 *   output: string;
 * }>('run-id-123', apiClient);
 * ```
 */
export function createRealtimeRunWithStreams<
  TTask extends AnyTask = AnyTask,
  TStreams extends Record<string, any> = Record<string, any>,
>(
  runId: string,
  apiClient: ApiClient,
  options?: RealtimeSingleRunOptions<TTask>
): RealtimeRunWithStreamsInstance<TTask, TStreams> {
  let run: RealtimeRun<TTask> | undefined = undefined;
  let streams: StreamResults<TStreams> = {} as StreamResults<TStreams>;
  let error: Error | undefined = undefined;
  let isComplete = false;
  let abortController: AbortController | null = null;
  let hasCalledOnComplete = false;

  const stop = () => {
    if (abortController) {
      abortController.abort();
      abortController = null;
    }
  };

  const start = async () => {
    try {
      if (!runId || !apiClient) {
        return;
      }

      abortController = new AbortController();

      await processRealtimeRunWithStreams(
        runId,
        { skipColumns: options?.skipColumns },
        apiClient,
        (newRun) => {
          run = newRun;
        },
        (newStreams) => {
          streams = newStreams;
        },
        () => streams,
        (err) => {
          error = err;
        },
        abortController,
        typeof options?.stopOnCompletion === "boolean" ? options.stopOnCompletion : true,
        options?.experimental_throttleInMs
      );
    } catch (err) {
      // Ignore abort errors as they are expected.
      if ((err as any).name === "AbortError") {
        abortController = null;
        return;
      }

      error = err as Error;
    } finally {
      if (abortController) {
        abortController = null;
      }

      // Mark the subscription as complete
      isComplete = true;

      // Call onComplete callback if provided
      if (run && options?.onComplete && !hasCalledOnComplete) {
        options.onComplete(run, error);
        hasCalledOnComplete = true;
      }
    }
  };

  // Start the subscription if enabled
  if (typeof options?.enabled !== "boolean" || options.enabled) {
    start().catch(() => {
      // Error handling is done in the start function
    });
  }

  return {
    get run() {
      return run;
    },
    get streams() {
      return streams;
    },
    get error() {
      return error;
    },
    get isComplete() {
      return isComplete;
    },
    stop,
  };
}

/**
 * Subscribe to realtime updates of task runs filtered by tag(s).
 *
 * @template TTask - The type of the task
 * @param {string | string[]} tag - The tag or array of tags to filter runs by
 * @param {ApiClient} apiClient - The API client instance
 * @param {RealtimeRunsWithTagOptions} [options] - Configuration options for the subscription
 * @returns {RealtimeRunsInstance<TTask>} An object containing the current state of the runs and any error encountered
 *
 * @example
 * ```ts
 * import { createRealtimeRunsWithTag } from '@trigger.dev/sdk/v3/browser';
 * import type { myTask } from './path/to/task';
 * 
 * const { runs, error, stop } = createRealtimeRunsWithTag<typeof myTask>('my-tag', apiClient);
 * // Or with multiple tags
 * const { runs, error, stop } = createRealtimeRunsWithTag<typeof myTask>(['tag1', 'tag2'], apiClient);
 * // Or with a createdAt filter
 * const { runs, error, stop } = createRealtimeRunsWithTag<typeof myTask>('my-tag', apiClient, { createdAt: '1h' });
 * ```
 */
export function createRealtimeRunsWithTag<TTask extends AnyTask>(
  tag: string | string[],
  apiClient: ApiClient,
  options?: RealtimeRunsWithTagOptions
): RealtimeRunsInstance<TTask> {
  let runs: RealtimeRun<TTask>[] = [];
  let error: Error | undefined = undefined;
  let abortController: AbortController | null = null;

  const stop = () => {
    if (abortController) {
      abortController.abort();
      abortController = null;
    }
  };

  const start = async () => {
    try {
      if (!apiClient) {
        return;
      }

      abortController = new AbortController();

      await processRealtimeRunsWithTag(
        tag,
        { createdAt: options?.createdAt, skipColumns: options?.skipColumns },
        apiClient,
        (newRuns) => {
          runs = newRuns;
        },
        () => runs,
        (err) => {
          error = err;
        },
        abortController
      );
    } catch (err) {
      // Ignore abort errors as they are expected.
      if ((err as any).name === "AbortError") {
        abortController = null;
        return;
      }

      error = err as Error;
    } finally {
      if (abortController) {
        abortController = null;
      }
    }
  };

  // Start the subscription if enabled
  if (typeof options?.enabled !== "boolean" || options.enabled) {
    start().catch(() => {
      // Error handling is done in the start function
    });
  }

  return {
    get runs() {
      return runs;
    },
    get error() {
      return error;
    },
    stop,
  };
}

/**
 * Subscribe to realtime updates of a batch of task runs.
 *
 * @template TTask - The type of the task
 * @param {string} batchId - The unique identifier of the batch to subscribe to
 * @param {ApiClient} apiClient - The API client instance
 * @param {RealtimeRunOptions} [options] - Configuration options for the subscription
 * @returns {RealtimeRunsInstance<TTask>} An object containing the current state of the runs, error handling, and control methods
 *
 * @example
 * ```ts
 * import { createRealtimeBatch } from '@trigger.dev/sdk/v3/browser';
 * import type { myTask } from './path/to/task';
 * 
 * const { runs, error, stop } = createRealtimeBatch<typeof myTask>('batch-id-123', apiClient);
 * ```
 */
export function createRealtimeBatch<TTask extends AnyTask>(
  batchId: string,
  apiClient: ApiClient,
  options?: RealtimeRunOptions
): RealtimeRunsInstance<TTask> {
  let runs: RealtimeRun<TTask>[] = [];
  let error: Error | undefined = undefined;
  let abortController: AbortController | null = null;

  const stop = () => {
    if (abortController) {
      abortController.abort();
      abortController = null;
    }
  };

  const start = async () => {
    try {
      if (!apiClient) {
        return;
      }

      abortController = new AbortController();

      await processRealtimeBatch(
        batchId,
        apiClient,
        (newRuns) => {
          runs = newRuns;
        },
        () => runs,
        (err) => {
          error = err;
        },
        abortController
      );
    } catch (err) {
      // Ignore abort errors as they are expected.
      if ((err as any).name === "AbortError") {
        abortController = null;
        return;
      }

      error = err as Error;
    } finally {
      if (abortController) {
        abortController = null;
      }
    }
  };

  // Start the subscription if enabled
  if (typeof options?.enabled !== "boolean" || options.enabled) {
    start().catch(() => {
      // Error handling is done in the start function
    });
  }

  return {
    get runs() {
      return runs;
    },
    get error() {
      return error;
    },
    stop,
  };
}

// Core processing functions extracted from React hooks

async function processRealtimeBatch<TTask extends AnyTask = AnyTask>(
  batchId: string,
  apiClient: ApiClient,
  mutateRunsData: (runs: RealtimeRun<TTask>[]) => void,
  existingRunsRef: () => RealtimeRun<TTask>[],
  onError: (e: Error) => void,
  abortController: AbortController | null
) {
  const subscription = apiClient.subscribeToBatch<InferRunTypes<TTask>>(batchId, {
    signal: abortController?.signal,
    onFetchError: onError,
  });

  for await (const part of subscription) {
    mutateRunsData(insertRunShapeInOrder(existingRunsRef(), part));
  }
}

// Inserts and then orders by the run createdAt timestamp, and ensures that the run is not duplicated
function insertRunShapeInOrder<TTask extends AnyTask>(
  previousRuns: RealtimeRun<TTask>[],
  run: RealtimeRun<TTask>
) {
  const existingRun = previousRuns.find((r) => r.id === run.id);
  if (existingRun) {
    return previousRuns.map((r) => (r.id === run.id ? run : r));
  }

  const runCreatedAt = run.createdAt;
  const index = previousRuns.findIndex((r) => r.createdAt > runCreatedAt);
  if (index === -1) {
    return [...previousRuns, run];
  }

  return [...previousRuns.slice(0, index), run, ...previousRuns.slice(index)];
}

async function processRealtimeRunsWithTag<TTask extends AnyTask = AnyTask>(
  tag: string | string[],
  filters: { createdAt?: string; skipColumns?: RealtimeRunSkipColumns },
  apiClient: ApiClient,
  mutateRunsData: (runs: RealtimeRun<TTask>[]) => void,
  existingRunsRef: () => RealtimeRun<TTask>[],
  onError: (e: Error) => void,
  abortController: AbortController | null
) {
  const subscription = apiClient.subscribeToRunsWithTag<InferRunTypes<TTask>>(tag, filters, {
    signal: abortController?.signal,
    onFetchError: onError,
  });

  for await (const part of subscription) {
    mutateRunsData(insertRunShape(existingRunsRef(), part));
  }
}

// Replaces or inserts a run shape, ordered by the createdAt timestamp
function insertRunShape<TTask extends AnyTask>(
  previousRuns: RealtimeRun<TTask>[],
  run: RealtimeRun<TTask>
) {
  const existingRun = previousRuns.find((r) => r.id === run.id);
  if (existingRun) {
    return previousRuns.map((r) => (r.id === run.id ? run : r));
  }

  const createdAt = run.createdAt;

  const index = previousRuns.findIndex((r) => r.createdAt > createdAt);

  if (index === -1) {
    return [...previousRuns, run];
  }

  return [...previousRuns.slice(0, index), run, ...previousRuns.slice(index)];
}

async function processRealtimeRunWithStreams<
  TTask extends AnyTask = AnyTask,
  TStreams extends Record<string, any> = Record<string, any>,
>(
  runId: string,
  filters: { skipColumns?: RealtimeRunSkipColumns },
  apiClient: ApiClient,
  mutateRunData: (run: RealtimeRun<TTask>) => void,
  mutateStreamData: (streams: StreamResults<TStreams>) => void,
  existingDataRef: () => StreamResults<TStreams>,
  onError: (e: Error) => void,
  abortController: AbortController | null,
  stopOnCompletion: boolean = true,
  throttleInMs?: number
) {
  const subscription = apiClient.subscribeToRun<InferRunTypes<TTask>>(runId, {
    signal: abortController?.signal,
    closeOnComplete: stopOnCompletion,
    onFetchError: onError,
    skipColumns: filters.skipColumns,
  });

  type StreamUpdate = {
    type: keyof TStreams;
    chunk: any;
  };

  const streamQueue = createThrottledQueue<StreamUpdate>(async (updates) => {
    const nextStreamData = { ...existingDataRef() };

    // Group updates by type
    const updatesByType = updates.reduce(
      (acc, update) => {
        if (!acc[update.type]) {
          acc[update.type] = [];
        }
        acc[update.type].push(update.chunk);
        return acc;
      },
      {} as Record<keyof TStreams, any[]>
    );

    // Apply all updates
    for (const [type, chunks] of Object.entries(updatesByType)) {
      // @ts-ignore
      nextStreamData[type] = [...(existingDataRef()[type] || []), ...chunks];
    }

    mutateStreamData(nextStreamData);
  }, throttleInMs);

  for await (const part of subscription.withStreams<TStreams>()) {
    if (part.type === "run") {
      mutateRunData(part.run);
    } else {
      streamQueue.add({
        type: part.type,
        // @ts-ignore
        chunk: part.chunk,
      });
    }
  }
}

async function processRealtimeRun<TTask extends AnyTask = AnyTask>(
  runId: string,
  filters: { skipColumns?: RealtimeRunSkipColumns },
  apiClient: ApiClient,
  mutateRunData: (run: RealtimeRun<TTask>) => void,
  onError: (e: Error) => void,
  abortController: AbortController | null,
  stopOnCompletion: boolean = true
) {
  const subscription = apiClient.subscribeToRun<InferRunTypes<TTask>>(runId, {
    signal: abortController?.signal,
    closeOnComplete: stopOnCompletion,
    onFetchError: onError,
    skipColumns: filters.skipColumns,
  });

  for await (const part of subscription) {
    mutateRunData(part);
  }
}

// Throttled queue implementation
function createThrottledQueue<T>(
  processor: (items: T[]) => Promise<void>,
  throttleInMs?: number
) {
  let queue: T[] = [];
  let timeoutId: NodeJS.Timeout | null = null;

  const process = async () => {
    if (queue.length === 0) return;

    const items = [...queue];
    queue = [];
    await processor(items);
  };

  const add = (item: T) => {
    queue.push(item);

    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    if (throttleInMs) {
      timeoutId = setTimeout(process, throttleInMs);
    } else {
      process();
    }
  };

  return { add };
}
