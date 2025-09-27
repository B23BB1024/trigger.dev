/**
 * Example usage of the vanilla JS Realtime API
 * 
 * This file demonstrates how to use the new vanilla JS Realtime functionality
 * without React dependencies.
 */

import { ApiClient } from "@trigger.dev/core/v3";
import {
  createRealtimeRun,
  createRealtimeRunWithStreams,
  createRealtimeRunsWithTag,
  createRealtimeBatch,
} from "./realtime.js";

// Example: Subscribe to a single run
export function subscribeToRun(apiClient: ApiClient, runId: string) {
  const subscription = createRealtimeRun(runId, apiClient, {
    onComplete: (run, error) => {
      if (error) {
        console.error("Run failed:", error);
      } else {
        console.log("Run completed:", run);
      }
    },
    stopOnCompletion: true,
  });

  // The subscription object provides reactive access to the run state
  console.log("Current run:", subscription.run);
  console.log("Has error:", subscription.error);
  console.log("Is complete:", subscription.isComplete);

  // Stop the subscription when done
  // subscription.stop();

  return subscription;
}

// Example: Subscribe to a run with streams
export function subscribeToRunWithStreams(apiClient: ApiClient, runId: string) {
  const subscription = createRealtimeRunWithStreams<
    any, // Task type
    { output: string; logs: string[] } // Stream types
  >(runId, apiClient, {
    onComplete: (run, error) => {
      if (error) {
        console.error("Run with streams failed:", error);
      } else {
        console.log("Run with streams completed:", run);
        console.log("Stream data:", subscription.streams);
      }
    },
    experimental_throttleInMs: 100, // Throttle stream updates
  });

  // Access run and stream data reactively
  console.log("Current run:", subscription.run);
  console.log("Stream data:", subscription.streams);
  console.log("Output chunks:", subscription.streams.output);
  console.log("Log chunks:", subscription.streams.logs);

  return subscription;
}

// Example: Subscribe to runs by tag
export function subscribeToRunsByTag(apiClient: ApiClient, tag: string) {
  const subscription = createRealtimeRunsWithTag(tag, apiClient, {
    createdAt: "1h", // Only runs from the last hour
    skipColumns: ["payload", "output"], // Skip heavy columns
  });

  // Access the runs array reactively
  console.log("Current runs:", subscription.runs);
  console.log("Number of runs:", subscription.runs.length);

  // Filter runs by status
  const completedRuns = subscription.runs.filter(run => run.isCompleted);
  console.log("Completed runs:", completedRuns);

  return subscription;
}

// Example: Subscribe to runs in a batch
export function subscribeToBatch(apiClient: ApiClient, batchId: string) {
  const subscription = createRealtimeBatch(batchId, apiClient, {
    enabled: true, // Explicitly enable the subscription
  });

  // Access the runs array reactively
  console.log("Batch runs:", subscription.runs);
  
  // Calculate batch progress
  const totalRuns = subscription.runs.length;
  const completedRuns = subscription.runs.filter(run => run.isCompleted).length;
  const progress = totalRuns > 0 ? (completedRuns / totalRuns) * 100 : 0;
  console.log(`Batch progress: ${progress.toFixed(1)}%`);

  return subscription;
}

// Example: Using with a framework like Vue, Svelte, or vanilla JS
export function createReactiveSubscription(apiClient: ApiClient, runId: string) {
  const subscription = createRealtimeRun(runId, apiClient);
  
  // Create a simple reactive system
  const listeners = new Set<() => void>();
  
  const notify = () => {
    listeners.forEach(listener => listener());
  };
  
  // Override the getters to notify listeners
  const originalRun = subscription.run;
  const originalError = subscription.error;
  const originalIsComplete = subscription.isComplete;
  
  Object.defineProperty(subscription, 'run', {
    get: () => {
      notify();
      return originalRun;
    }
  });
  
  Object.defineProperty(subscription, 'error', {
    get: () => {
      notify();
      return originalError;
    }
  });
  
  Object.defineProperty(subscription, 'isComplete', {
    get: () => {
      notify();
      return originalIsComplete;
    }
  });
  
  return {
    ...subscription,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }
  };
}
