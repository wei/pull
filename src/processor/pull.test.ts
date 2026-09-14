import { assertEquals, assertRejects } from "@std/assert";
import { Pull } from "@/src/processor/pull.ts";

type CompareStatus = "ahead" | "behind" | "diverged" | "identical";

function makePull(
  status: CompareStatus,
  options: { compareError?: Error; updateError?: Error } = {},
) {
  const compareCalls: unknown[] = [];
  const graphqlCalls: unknown[] = [];
  const github = {
    repos: {
      compareCommits: (args: unknown) => {
        compareCalls.push(args);
        if (options.compareError) throw options.compareError;
        return Promise.resolve({
          data: {
            status,
            ahead_by: status === "ahead" || status === "diverged" ? 1 : 0,
          },
        });
      },
    },
    graphql: (query: string, variables: unknown) => {
      graphqlCalls.push({ query, variables });
      if (options.updateError) throw options.updateError;
      return Promise.resolve({ updateRefs: { clientMutationId: null } });
    },
  };
  const logger = {
    child: () => logger,
    debug: () => undefined,
    info: () => undefined,
    error: () => undefined,
  };
  const pull = new Pull(
    github as never,
    { owner: "fork", repo: "repo", logger: logger as never },
    {
      version: "1",
      rules: [{
        base: "main",
        upstream: "source:main",
        mergeMethod: "hardreset",
        mergeUnstable: false,
        assignees: [],
        reviewers: [],
        conflictReviewers: [],
      }],
      label: "pull",
      conflictLabel: "conflict",
    },
  );
  const hardReset = (pull as unknown as {
    hardResetCommit(
      baseRef: string,
      expectedBaseSha: string,
      upstreamSha: string,
      repositoryId: string,
      force?: boolean,
    ): Promise<void>;
  }).hardResetCommit.bind(pull);
  return { hardReset, compareCalls, graphqlCalls };
}

Deno.test("safe hardreset atomically advances a behind destination", async () => {
  const { hardReset, compareCalls, graphqlCalls } = makePull("behind");
  await hardReset("main", "destination-sha", "upstream-sha", "repository-id");

  assertEquals(compareCalls, [{
    owner: "fork",
    repo: "repo",
    base: "upstream-sha",
    head: "destination-sha",
    per_page: 1,
  }]);
  assertEquals(graphqlCalls.length, 1);
  const call = graphqlCalls[0] as {
    query: string;
    variables: Record<string, unknown>;
  };
  assertEquals(call.variables, {
    repositoryId: "repository-id",
    refName: "refs/heads/main",
    beforeOid: "destination-sha",
    afterOid: "upstream-sha",
    force: true,
  });
  assertEquals(call.query.includes("beforeOid: $beforeOid"), true);
});

Deno.test("safe hardreset is a no-op for identical commits", async () => {
  const { hardReset, graphqlCalls } = makePull("identical");
  await hardReset("main", "same-sha", "same-sha", "repository-id");
  assertEquals(graphqlCalls, []);
});

for (const status of ["ahead", "diverged"] as const) {
  Deno.test(`safe hardreset rejects a ${status} destination`, async () => {
    const { hardReset, graphqlCalls } = makePull(status);
    await assertRejects(
      () =>
        hardReset("main", "destination-sha", "upstream-sha", "repository-id"),
      Error,
      "unique commits",
    );
    assertEquals(graphqlCalls, []);
  });
}

Deno.test("safe hardreset fails closed when compare fails", async () => {
  const { hardReset, graphqlCalls } = makePull("behind", {
    compareError: new Error("compare unavailable"),
  });
  await assertRejects(
    () => hardReset("main", "destination-sha", "upstream-sha", "repository-id"),
    Error,
    "compare unavailable",
  );
  assertEquals(graphqlCalls, []);
});

Deno.test("safe hardreset fails when destination changes after compare", async () => {
  const { hardReset, graphqlCalls } = makePull("behind", {
    updateError: new Error("beforeOid does not match the current ref"),
  });
  await assertRejects(
    () => hardReset("main", "destination-sha", "upstream-sha", "repository-id"),
    Error,
    "beforeOid",
  );
  assertEquals(graphqlCalls.length, 1);
});

Deno.test("forcehardreset explicitly bypasses compare but retains the SHA lease", async () => {
  const { hardReset, compareCalls, graphqlCalls } = makePull("diverged");
  await hardReset(
    "main",
    "destination-sha",
    "upstream-sha",
    "repository-id",
    true,
  );
  assertEquals(compareCalls, []);
  assertEquals(graphqlCalls.length, 1);
});

function makeDispatchPull(mergeMethod: "hardreset" | "forcehardreset") {
  const graphqlCalls: unknown[] = [];
  const mergeabilityCalls: unknown[] = [];
  const conflictCalls: unknown[] = [];
  const github = {
    repos: {
      compareCommits: (args: unknown) => {
        mergeabilityCalls.push(args);
        return Promise.resolve({ data: { status: "behind", ahead_by: 0 } });
      },
    },
    pulls: {
      get: (args: unknown) => {
        mergeabilityCalls.push(args);
        return Promise.resolve({
          data: { mergeable: false, mergeable_state: "dirty" },
        });
      },
      requestReviewers: (args: unknown) => {
        conflictCalls.push(args);
        return Promise.resolve();
      },
    },
    issues: {
      getLabel: (args: unknown) => {
        conflictCalls.push(args);
        return Promise.resolve();
      },
      update: (args: unknown) => {
        conflictCalls.push(args);
        return Promise.resolve();
      },
      createLabel: (args: unknown) => {
        conflictCalls.push(args);
        return Promise.resolve();
      },
    },
    graphql: (query: string, variables: unknown) => {
      graphqlCalls.push({ query, variables });
      return Promise.resolve({ updateRefs: { clientMutationId: null } });
    },
  };
  const logger = {
    child: () => logger,
    debug: () => undefined,
    info: () => undefined,
    error: () => undefined,
  };
  const pull = new Pull(
    github as never,
    { owner: "fork", repo: "repo", logger: logger as never },
    {
      version: "1",
      rules: [{
        base: "main",
        upstream: "source:main",
        mergeMethod,
        mergeUnstable: false,
        assignees: [],
        reviewers: [],
        conflictReviewers: ["reviewer"],
      }],
      label: "pull",
      conflictLabel: "conflict",
    },
  );
  const checkAutoMerge = (pull as unknown as {
    checkAutoMerge(incomingPR: unknown): Promise<boolean>;
  }).checkAutoMerge.bind(pull);
  const incomingPR = {
    number: 42,
    state: "open",
    mergeable: false as boolean | null,
    mergeable_state: "dirty",
    user: { login: "pull[bot]" },
    base: {
      ref: "main",
      sha: "destination-sha",
      repo: { node_id: "repository-id" },
    },
    head: {
      ref: "main",
      label: "source:main",
      sha: "upstream-sha",
    },
  };
  return {
    checkAutoMerge,
    incomingPR,
    graphqlCalls,
    mergeabilityCalls,
    conflictCalls,
  };
}

for (const mergeable of [false, null]) {
  Deno.test(
    `forcehardreset dispatches a bot PR with mergeable:${mergeable}`,
    async () => {
      const {
        checkAutoMerge,
        incomingPR,
        graphqlCalls,
        mergeabilityCalls,
        conflictCalls,
      } = makeDispatchPull("forcehardreset");

      const merged = await checkAutoMerge({ ...incomingPR, mergeable });

      assertEquals(merged, true);
      assertEquals(mergeabilityCalls, []);
      assertEquals(conflictCalls, []);
      assertEquals(graphqlCalls.length, 1);
      const call = graphqlCalls[0] as {
        variables: Record<string, unknown>;
      };
      assertEquals(call.variables.beforeOid, "destination-sha");
      assertEquals(call.variables.afterOid, "upstream-sha");
    },
  );
}

for (
  const override of [
    { state: "closed" },
    { user: { login: "someone-else" } },
  ]
) {
  Deno.test(
    `forcehardreset rejects an unauthorized PR: ${JSON.stringify(override)}`,
    async () => {
      const { checkAutoMerge, incomingPR, graphqlCalls, conflictCalls } =
        makeDispatchPull("forcehardreset");

      const merged = await checkAutoMerge({ ...incomingPR, ...override });

      assertEquals(merged, false);
      assertEquals(graphqlCalls, []);
      assertEquals(conflictCalls, []);
    },
  );
}

Deno.test("hardreset retains conflict handling", async () => {
  const { checkAutoMerge, incomingPR, graphqlCalls, conflictCalls } =
    makeDispatchPull("hardreset");

  const merged = await checkAutoMerge(incomingPR);

  assertEquals(merged, false);
  assertEquals(graphqlCalls, []);
  assertEquals(conflictCalls.length, 3);
});
