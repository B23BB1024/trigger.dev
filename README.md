# Vanilla JS Realtime API

This package provides vanilla JavaScript support for Trigger.dev's Realtime functionality, allowing you to subscribe to task runs and receive real-time updates without React dependencies.

## Installation

```bash
npm install @trigger.dev/sdk
```

## Usage

### Basic Setup

```typescript
import { ApiClient } from "@trigger.dev/core/v3";
import { createRealtimeRun } from "@trigger.dev/sdk/v3/browser";

// Create an API client
const apiClient = new ApiClient(
  "https://api.trigger.dev",
  "your-access-token"
);

// Subscribe to a run
const subscription = createRealtimeRun("run-id-123", apiClient);
```

### API Reference

#### `createRealtimeRun<TTask>(runId, apiClient, options?)`

Subscribe to realtime updates of a single task run.

**Parameters:**
- `runId: string` - The unique identifier of the run to subscribe to
- `apiClient: ApiClient` - The API client instance
- `options?: RealtimeSingleRunOptions<TTask>` - Configuration options

**Returns:** `RealtimeRunInstance<TTask>`

**Example:**
```typescript
const subscription = createRealtimeRun("run-id-123", apiClient, {
  onComplete: (run, error) => {
    if (error) {
      console.error("Run failed:", error);
    } else {
      console.log("Run completed:", run);
    }
  },
  stopOnCompletion: true,
  skipColumns: ["payload", "output"]
});

// Access the current run state
console.log("Current run:", subscription.run);
console.log("Has error:", subscription.error);
console.log("Is complete:", subscription.isComplete);

// Stop the subscription
subscription.stop();
```

#### `createRealtimeRunWithStreams<TTask, TStreams>(runId, apiClient, options?)`

Subscribe to realtime updates of a task run with associated data streams.

**Parameters:**
- `runId: string` - The unique identifier of the run to subscribe to
- `apiClient: ApiClient` - The API client instance
- `options?: RealtimeSingleRunOptions<TTask>` - Configuration options

**Returns:** `RealtimeRunWithStreamsInstance<TTask, TStreams>`

**Example:**
```typescript
const subscription = createRealtimeRunWithStreams<
  typeof myTask,
  { output: string; logs: string[] }
>("run-id-123", apiClient, {
  experimental_throttleInMs: 100, // Throttle stream updates
  onComplete: (run, error) => {
    console.log("Run completed with streams:", run);
    console.log("Final stream data:", subscription.streams);
  }
});

// Access run and stream data
console.log("Current run:", subscription.run);
console.log("Stream data:", subscription.streams);
console.log("Output chunks:", subscription.streams.output);
console.log("Log chunks:", subscription.streams.logs);
```

#### `createRealtimeRunsWithTag<TTask>(tag, apiClient, options?)`

Subscribe to realtime updates of task runs filtered by tag(s).

**Parameters:**
- `tag: string | string[]` - The tag or array of tags to filter runs by
- `apiClient: ApiClient` - The API client instance
- `options?: RealtimeRunsWithTagOptions` - Configuration options

**Returns:** `RealtimeRunsInstance<TTask>`

**Example:**
```typescript
// Single tag
const subscription = createRealtimeRunsWithTag("my-tag", apiClient, {
  createdAt: "1h", // Only runs from the last hour
  skipColumns: ["payload", "output"]
});

// Multiple tags
const subscription = createRealtimeRunsWithTag(["tag1", "tag2"], apiClient);

// Access the runs array
console.log("Current runs:", subscription.runs);
console.log("Number of runs:", subscription.runs.length);

// Filter runs by status
const completedRuns = subscription.runs.filter(run => run.isCompleted);
```

#### `createRealtimeBatch<TTask>(batchId, apiClient, options?)`

Subscribe to realtime updates of a batch of task runs.

**Parameters:**
- `batchId: string` - The unique identifier of the batch to subscribe to
- `apiClient: ApiClient` - The API client instance
- `options?: RealtimeRunOptions` - Configuration options

**Returns:** `RealtimeRunsInstance<TTask>`

**Example:**
```typescript
const subscription = createRealtimeBatch("batch-id-123", apiClient);

// Access the runs array
console.log("Batch runs:", subscription.runs);

// Calculate batch progress
const totalRuns = subscription.runs.length;
const completedRuns = subscription.runs.filter(run => run.isCompleted).length;
const progress = totalRuns > 0 ? (completedRuns / totalRuns) * 100 : 0;
console.log(`Batch progress: ${progress.toFixed(1)}%`);
```

### Options

#### `RealtimeSingleRunOptions<TTask>`

```typescript
interface RealtimeSingleRunOptions<TTask extends AnyTask = AnyTask> {
  id?: string;                                    // Unique identifier for the subscription
  enabled?: boolean;                              // Whether the subscription is enabled
  experimental_throttleInMs?: number;            // Throttle stream updates (ms)
  onComplete?: (run: RealtimeRun<TTask>, err?: Error) => void; // Completion callback
  stopOnCompletion?: boolean;                    // Stop when run completes (default: true)
  skipColumns?: RealtimeRunSkipColumns;          // Columns to skip from subscription
}
```

#### `RealtimeRunsWithTagOptions`

```typescript
interface RealtimeRunsWithTagOptions extends RealtimeRunOptions {
  createdAt?: string;                            // Filter by creation time (e.g., "1h", "30m")
  skipColumns?: RealtimeRunSkipColumns;          // Columns to skip from subscription
}
```

### Framework Integration

#### Vue.js

```typescript
import { ref, onUnmounted } from 'vue';
import { createRealtimeRun } from '@trigger.dev/sdk/v3/browser';

export function useRealtimeRun(runId: string, apiClient: ApiClient) {
  const subscription = createRealtimeRun(runId, apiClient);
  
  const run = ref(subscription.run);
  const error = ref(subscription.error);
  const isComplete = ref(subscription.isComplete);
  
  // Update reactive refs when subscription state changes
  const updateState = () => {
    run.value = subscription.run;
    error.value = subscription.error;
    isComplete.value = subscription.isComplete;
  };
  
  // Poll for updates (in a real implementation, you'd want a more efficient approach)
  const interval = setInterval(updateState, 100);
  
  onUnmounted(() => {
    clearInterval(interval);
    subscription.stop();
  });
  
  return { run, error, isComplete, stop: subscription.stop };
}
```

#### Svelte

```typescript
import { writable, onDestroy } from 'svelte/store';
import { createRealtimeRun } from '@trigger.dev/sdk/v3/browser';

export function createRealtimeStore(runId: string, apiClient: ApiClient) {
  const subscription = createRealtimeRun(runId, apiClient);
  
  const run = writable(subscription.run);
  const error = writable(subscription.error);
  const isComplete = writable(subscription.isComplete);
  
  const updateState = () => {
    run.set(subscription.run);
    error.set(subscription.error);
    isComplete.set(subscription.isComplete);
  };
  
  const interval = setInterval(updateState, 100);
  
  onDestroy(() => {
    clearInterval(interval);
    subscription.stop();
  });
  
  return { run, error, isComplete, stop: subscription.stop };
}
```

#### Vanilla JavaScript with Custom Reactive System

```typescript
import { createRealtimeRun } from '@trigger.dev/sdk/v3/browser';

class RealtimeSubscription {
  private subscription;
  private listeners = new Set<() => void>();
  
  constructor(runId: string, apiClient: ApiClient) {
    this.subscription = createRealtimeRun(runId, apiClient);
    
    // Poll for updates
    setInterval(() => {
      this.notify();
    }, 100);
  }
  
  get run() {
    return this.subscription.run;
  }
  
  get error() {
    return this.subscription.error;
  }
  
  get isComplete() {
    return this.subscription.isComplete;
  }
  
  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  
  private notify() {
    this.listeners.forEach(listener => listener());
  }
  
  stop() {
    this.subscription.stop();
  }
}
```

### Error Handling

All subscription functions handle errors gracefully:

```typescript
const subscription = createRealtimeRun("run-id-123", apiClient, {
  onComplete: (run, error) => {
    if (error) {
      console.error("Subscription error:", error);
      // Handle error appropriately
    } else {
      console.log("Run completed successfully:", run);
    }
  }
});

// Check for errors
if (subscription.error) {
  console.error("Current error:", subscription.error);
}
```

### Performance Considerations

1. **Throttling**: Use `experimental_throttleInMs` to throttle stream updates and reduce CPU usage
2. **Skip Columns**: Use `skipColumns` to exclude heavy data like payloads and outputs when not needed
3. **Stop on Completion**: Set `stopOnCompletion: false` only when you need to continue receiving updates after completion
4. **Cleanup**: Always call `stop()` when done with subscriptions to prevent memory leaks

### Migration from React Hooks

If you're migrating from the React hooks package:

```typescript
// Before (React)
const { run, error, stop } = useRealtimeRun(runId, options);

// After (Vanilla JS)
const subscription = createRealtimeRun(runId, apiClient, options);
const { run, error, stop } = subscription;
```

The main differences:
- You need to pass the `apiClient` explicitly
- The subscription is returned as an object with getters
- No automatic cleanup - you need to call `stop()` manually
- No React-specific features like `useId()` or `useEffect()`
