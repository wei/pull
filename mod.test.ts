import { assertEquals, assertStrictEquals } from "@std/assert";
import createPullApp, {
  createPullApp as namedCreatePullApp,
  DEFAULT_PROCESSING_TIMEOUT_MS,
  getPullConfig,
  getRepoProcessor,
  processRepository,
  Pull,
  pullConfigSchema,
} from "./mod.ts";

Deno.test("root library entry point exposes the supported interface", () => {
  assertStrictEquals(createPullApp, namedCreatePullApp);
  assertEquals(typeof createPullApp, "function");
  assertEquals(typeof getRepoProcessor, "function");
  assertEquals(typeof processRepository, "function");
  assertEquals(typeof getPullConfig, "function");
  assertEquals(typeof Pull, "function");
  assertEquals(typeof pullConfigSchema.safeParse, "function");
  assertEquals(DEFAULT_PROCESSING_TIMEOUT_MS, 60_000);
});

Deno.test("repository processor reports its configured timeout", async () => {
  const warnings: string[] = [];
  const failures: unknown[][] = [];
  const logger = {
    child: () => logger,
    info: () => {},
    debug: () => {},
    warn: (message: string) => warnings.push(message),
    error: (...args: unknown[]) => failures.push(args),
  };
  const octokit = {
    rest: {
      repos: {
        get: () => Promise.resolve({ data: { archived: false, fork: true } }),
      },
    },
    config: { get: () => new Promise(() => {}) },
  };
  const probot = {
    log: logger,
    auth: () => Promise.resolve(octokit),
  };
  const processor = getRepoProcessor(
    probot as unknown as Parameters<typeof getRepoProcessor>[0],
    { timeoutMs: 7 },
  );

  await processor(
    {
      id: "timeout-test",
      data: { owner: "wei", repo: "pull", installation_id: 1 },
    } as unknown as Parameters<typeof processor>[0],
  );

  assertEquals(warnings, ["⏰ Job timed out after 7 ms"]);
  assertEquals(failures.length, 1);
  assertEquals((failures[0][0] as Error).message, "Job timed out after 7 ms");
});

Deno.test("documented subpath exports resolve", async () => {
  const [app, processor, pull, schema] = await Promise.all([
    import("./src/app.ts"),
    import("./src/processor/index.ts"),
    import("./src/processor/pull.ts"),
    import("./src/utils/schema.ts"),
  ]);
  assertEquals(typeof app.createPullApp, "function");
  assertEquals(typeof processor.getRepoProcessor, "function");
  assertEquals(typeof pull.Pull, "function");
  assertEquals(typeof schema.pullConfigSchema.safeParse, "function");
});
