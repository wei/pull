export interface GracefulShutdownDependencies {
  disconnectMongoDB: () => Promise<unknown>;
  quitRedis: () => Promise<unknown>;
  exit: (code: number) => void;
  logInfo: (message: string) => void;
  logError: (message: string, error: unknown) => void;
}

export function createGracefulShutdown(
  dependencies: GracefulShutdownDependencies,
): (signal: string) => Promise<void> {
  let shutdownPromise: Promise<void> | undefined;

  return (signal: string) => {
    if (shutdownPromise) {
      return shutdownPromise;
    }

    shutdownPromise = (async () => {
      dependencies.logInfo(
        `[${signal}] Signal received: closing MongoDB and Redis connections`,
      );

      const results = await Promise.allSettled([
        Promise.resolve().then(dependencies.disconnectMongoDB),
        Promise.resolve().then(dependencies.quitRedis),
      ]);
      const connectionNames = ["MongoDB", "Redis"];

      results.forEach((result, index) => {
        if (result.status === "rejected") {
          dependencies.logError(
            `[${
              connectionNames[index]
            }] Failed to close connection during app termination`,
            result.reason,
          );
        }
      });

      dependencies.logInfo("[App] Connection cleanup complete; exiting");
      dependencies.exit(0);
    })();

    return shutdownPromise;
  };
}
