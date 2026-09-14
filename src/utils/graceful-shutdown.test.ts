import { assertEquals } from "@std/assert";
import { createGracefulShutdown } from "@/src/utils/graceful-shutdown.ts";

function deferred() {
  let resolve!: () => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

Deno.test("graceful shutdown waits for MongoDB and Redis before exiting", async () => {
  const mongo = deferred();
  const redis = deferred();
  let exitCalls = 0;
  const shutdown = createGracefulShutdown({
    disconnectMongoDB: () => mongo.promise,
    quitRedis: () => redis.promise,
    exit: () => {
      exitCalls++;
    },
    logInfo: () => {},
    logError: () => {},
  });

  const shutdownPromise = shutdown("SIGTERM");
  await Promise.resolve();
  assertEquals(exitCalls, 0);

  mongo.resolve();
  await Promise.resolve();
  assertEquals(exitCalls, 0);

  redis.resolve();
  await shutdownPromise;
  assertEquals(exitCalls, 1);
});

Deno.test("graceful shutdown is idempotent for repeated signals", async () => {
  const mongo = deferred();
  let mongoCalls = 0;
  let redisCalls = 0;
  let exitCalls = 0;
  const shutdown = createGracefulShutdown({
    disconnectMongoDB: () => {
      mongoCalls++;
      return mongo.promise;
    },
    quitRedis: () => {
      redisCalls++;
      return Promise.resolve();
    },
    exit: () => {
      exitCalls++;
    },
    logInfo: () => {},
    logError: () => {},
  });

  const first = shutdown("SIGINT");
  const second = shutdown("SIGTERM");
  assertEquals(first, second);
  await Promise.resolve();
  assertEquals(mongoCalls, 1);
  assertEquals(redisCalls, 1);

  mongo.resolve();
  await Promise.all([first, second]);
  assertEquals(exitCalls, 1);
});

Deno.test("graceful shutdown exits after reporting rejected cleanup", async () => {
  const errors: unknown[] = [];
  let redisCalls = 0;
  let exitCalls = 0;
  const shutdown = createGracefulShutdown({
    disconnectMongoDB: () => Promise.reject(new Error("mongo failed")),
    quitRedis: () => {
      redisCalls++;
      return Promise.reject(new Error("redis failed"));
    },
    exit: () => {
      exitCalls++;
    },
    logInfo: () => {},
    logError: (_message, error) => errors.push(error),
  });

  await shutdown("SIGTERM");
  assertEquals(redisCalls, 1);
  assertEquals(errors.length, 2);
  assertEquals(exitCalls, 1);
});

Deno.test("graceful shutdown handles synchronous cleanup errors", async () => {
  const errors: unknown[] = [];
  let redisCalls = 0;
  let exitCalls = 0;
  const shutdown = createGracefulShutdown({
    disconnectMongoDB: () => {
      throw new Error("mongo threw");
    },
    quitRedis: () => {
      redisCalls++;
      return Promise.resolve();
    },
    exit: () => {
      exitCalls++;
    },
    logInfo: () => {},
    logError: (_message, error) => errors.push(error),
  });

  await shutdown("SIGINT");
  assertEquals(redisCalls, 1);
  assertEquals(errors.length, 1);
  assertEquals(exitCalls, 1);
});
