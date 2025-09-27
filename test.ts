/**
 * Simple test to verify the vanilla JS Realtime API works correctly
 */

import { ApiClient } from "@trigger.dev/core/v3";
import {
  createRealtimeRun,
  createRealtimeRunWithStreams,
  createRealtimeRunsWithTag,
  createRealtimeBatch,
} from "./realtime.js";

// Mock API client for testing
class MockApiClient {
  baseUrl = "https://api.trigger.dev";
  accessToken = "test-token";

  async subscribeToRun() {
    // Mock implementation
    return {
      [Symbol.asyncIterator]: async function* () {
        yield {
          id: "test-run-123",
          taskIdentifier: "test-task",
          status: "COMPLETED",
          createdAt: new Date(),
          updatedAt: new Date(),
          durationMs: 1000,
          costInCents: 0,
          baseCostInCents: 0,
          tags: [],
          isTest: false,
          isQueued: false,
          isExecuting: false,
          isWaiting: false,
          isCompleted: true,
          isFailed: false,
          isSuccess: true,
          isCancelled: false,
        };
      },
      withStreams: () => ({
        [Symbol.asyncIterator]: async function* () {
          yield {
            type: "run",
            run: {
              id: "test-run-123",
              taskIdentifier: "test-task",
              status: "COMPLETED",
              createdAt: new Date(),
              updatedAt: new Date(),
              durationMs: 1000,
              costInCents: 0,
              baseCostInCents: 0,
              tags: [],
              isTest: false,
              isQueued: false,
              isExecuting: false,
              isWaiting: false,
              isCompleted: true,
              isFailed: false,
              isSuccess: true,
              isCancelled: false,
            },
          };
        },
      }),
    };
  }

  async subscribeToRunsWithTag() {
    return {
      [Symbol.asyncIterator]: async function* () {
        yield {
          id: "test-run-456",
          taskIdentifier: "test-task",
          status: "COMPLETED",
          createdAt: new Date(),
          updatedAt: new Date(),
          durationMs: 2000,
          costInCents: 0,
          baseCostInCents: 0,
          tags: ["test-tag"],
          isTest: false,
          isQueued: false,
          isExecuting: false,
          isWaiting: false,
          isCompleted: true,
          isFailed: false,
          isSuccess: true,
          isCancelled: false,
        };
      },
    };
  }

  async subscribeToBatch() {
    return {
      [Symbol.asyncIterator]: async function* () {
        yield {
          id: "test-run-789",
          taskIdentifier: "test-task",
          status: "COMPLETED",
          createdAt: new Date(),
          updatedAt: new Date(),
          durationMs: 3000,
          costInCents: 0,
          baseCostInCents: 0,
          tags: [],
          isTest: false,
          isQueued: false,
          isExecuting: false,
          isWaiting: false,
          isCompleted: true,
          isFailed: false,
          isSuccess: true,
          isCancelled: false,
        };
      },
    };
  }
}

// Test functions
export function testCreateRealtimeRun() {
  console.log("Testing createRealtimeRun...");
  
  const mockApiClient = new MockApiClient() as any;
  const subscription = createRealtimeRun("test-run-123", mockApiClient, {
    onComplete: (run, error) => {
      console.log("Run completed:", run?.id, error ? `Error: ${error.message}` : "Success");
    },
  });

  // Test getters
  console.log("Initial run:", subscription.run);
  console.log("Initial error:", subscription.error);
  console.log("Initial isComplete:", subscription.isComplete);

  // Test stop
  subscription.stop();
  console.log("Subscription stopped");

  return subscription;
}

export function testCreateRealtimeRunWithStreams() {
  console.log("Testing createRealtimeRunWithStreams...");
  
  const mockApiClient = new MockApiClient() as any;
  const subscription = createRealtimeRunWithStreams<
    any,
    { output: string; logs: string[] }
  >("test-run-123", mockApiClient, {
    onComplete: (run, error) => {
      console.log("Run with streams completed:", run?.id, error ? `Error: ${error.message}` : "Success");
    },
  });

  // Test getters
  console.log("Initial run:", subscription.run);
  console.log("Initial streams:", subscription.streams);
  console.log("Initial error:", subscription.error);
  console.log("Initial isComplete:", subscription.isComplete);

  // Test stop
  subscription.stop();
  console.log("Subscription with streams stopped");

  return subscription;
}

export function testCreateRealtimeRunsWithTag() {
  console.log("Testing createRealtimeRunsWithTag...");
  
  const mockApiClient = new MockApiClient() as any;
  const subscription = createRealtimeRunsWithTag("test-tag", mockApiClient, {
    createdAt: "1h",
    skipColumns: ["payload"],
  });

  // Test getters
  console.log("Initial runs:", subscription.runs);
  console.log("Initial error:", subscription.error);

  // Test stop
  subscription.stop();
  console.log("Runs with tag subscription stopped");

  return subscription;
}

export function testCreateRealtimeBatch() {
  console.log("Testing createRealtimeBatch...");
  
  const mockApiClient = new MockApiClient() as any;
  const subscription = createRealtimeBatch("test-batch-123", mockApiClient, {
    enabled: true,
  });

  // Test getters
  console.log("Initial runs:", subscription.runs);
  console.log("Initial error:", subscription.error);

  // Test stop
  subscription.stop();
  console.log("Batch subscription stopped");

  return subscription;
}

// Run all tests
export function runAllTests() {
  console.log("Running all vanilla JS Realtime API tests...\n");
  
  testCreateRealtimeRun();
  console.log();
  
  testCreateRealtimeRunWithStreams();
  console.log();
  
  testCreateRealtimeRunsWithTag();
  console.log();
  
  testCreateRealtimeBatch();
  console.log();
  
  console.log("All tests completed!");
}

// Export for use in other test files
export { MockApiClient };
