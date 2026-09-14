import { assertEquals } from "@std/assert";
import { Pull } from "@/src/processor/pull.ts";
import type { ProbotOctokit } from "probot";

const BASE_SHA = "b".repeat(40);
const HEAD_SHA = "h".repeat(40);

function pr(overrides: Record<string, unknown> = {}) {
  return {
    number: 7,
    state: "open",
    mergeable: true,
    mergeable_state: "clean",
    rebaseable: true,
    user: { login: "pull[bot]" },
    base: {
      ref: "main",
      label: "fork:main",
      sha: BASE_SHA,
      repo: { node_id: "repository-node" },
    },
    head: { ref: "main", label: "upstream:main", sha: HEAD_SHA },
    ...overrides,
  };
}

function setup(comparison: Record<string, unknown>, options: {
  refreshed?: ReturnType<typeof pr>;
  compareError?: Error;
  graphqlError?: Error;
  mergeError?: Error;
} = {}) {
  const calls = {
    compare: [] as unknown[],
    graphql: [] as unknown[],
    merge: [] as unknown[],
  };
  const github = {
    pulls: {
      get: () => Promise.resolve({ data: options.refreshed ?? pr() }),
      merge: (input: unknown) => {
        calls.merge.push(input);
        if (options.mergeError) throw options.mergeError;
        return Promise.resolve({ data: { merged: true } });
      },
    },
    repos: {
      compareCommits: (input: unknown) => {
        calls.compare.push(input);
        if (options.compareError) throw options.compareError;
        return Promise.resolve({ data: comparison });
      },
    },
    graphql: (_query: string, variables: unknown) => {
      calls.graphql.push(variables);
      if (options.graphqlError) throw options.graphqlError;
      return Promise.resolve({});
    },
  };
  const logger = {
    child: () => logger,
    debug: () => {},
    info: () => {},
    error: () => {},
    warn: () => {},
  };
  const pull = new Pull(
    github as unknown as ProbotOctokit,
    { owner: "fork", repo: "project", logger: logger as never },
    {
      version: "1",
      label: ":arrow_heading_down: pull",
      conflictLabel: "merge-conflict",
      rules: [{
        base: "main",
        upstream: "upstream:main",
        mergeMethod: "merge-ff",
        mergeUnstable: false,
        assignees: [],
        reviewers: [],
        conflictReviewers: [],
      }],
    },
  );
  return { pull, calls };
}

async function process(pull: Pull) {
  return await (pull as unknown as {
    processMergeFf(
      number: number,
      incoming: ReturnType<typeof pr>,
    ): Promise<boolean>;
  }).processMergeFf(7, pr());
}

Deno.test("merge-ff atomically resets a destination with zero unique commits", async () => {
  const { pull, calls } = setup({
    status: "behind",
    ahead_by: 0,
    behind_by: 2,
  });
  assertEquals(await process(pull), true);
  assertEquals(calls.compare, [{
    owner: "fork",
    repo: "project",
    base: HEAD_SHA,
    head: BASE_SHA,
    per_page: 1,
  }]);
  assertEquals(calls.merge, []);
  assertEquals(calls.graphql, [{
    input: {
      repositoryId: "repository-node",
      refUpdates: [{
        name: "refs/heads/main",
        beforeOid: BASE_SHA,
        afterOid: HEAD_SHA,
        force: true,
      }],
    },
  }]);
});

Deno.test("merge-ff normally merges diverged histories with an exact head SHA", async () => {
  const { pull, calls } = setup({
    status: "diverged",
    ahead_by: 3,
    behind_by: 2,
  });
  assertEquals(await process(pull), true);
  assertEquals(calls.graphql, []);
  assertEquals(calls.merge, [{
    owner: "fork",
    repo: "project",
    pull_number: 7,
    merge_method: "merge",
    sha: HEAD_SHA,
  }]);
});

for (
  const comparison of [
    { status: "ahead", ahead_by: 2, behind_by: 0 },
    { status: "identical", ahead_by: 0, behind_by: 0 },
    { status: "behind", ahead_by: 1, behind_by: 2 },
    { status: "unknown", ahead_by: 0, behind_by: 2 },
  ]
) {
  Deno.test(`merge-ff fails closed for ${comparison.status} comparison`, async () => {
    const { pull, calls } = setup(comparison);
    assertEquals(await process(pull), false);
    assertEquals(calls.graphql, []);
    assertEquals(calls.merge, []);
  });
}

Deno.test("merge-ff fails closed on compare API errors", async () => {
  const { pull, calls } = setup({}, {
    compareError: new Error("API unavailable"),
  });
  assertEquals(await process(pull), false);
  assertEquals(calls.graphql, []);
  assertEquals(calls.merge, []);
});

Deno.test("merge-ff does not fall back after an atomic update race", async () => {
  const { pull, calls } = setup(
    { status: "behind", ahead_by: 0, behind_by: 2 },
    { graphqlError: new Error("beforeOid mismatch") },
  );
  assertEquals(await process(pull), false);
  assertEquals(calls.graphql.length, 1);
  assertEquals(calls.merge, []);
});

Deno.test("merge-ff does not fall back after a merge API error", async () => {
  const { pull, calls } = setup(
    { status: "diverged", ahead_by: 2, behind_by: 2 },
    { mergeError: new Error("head changed") },
  );
  assertEquals(await process(pull), false);
  assertEquals(calls.graphql, []);
  assertEquals(calls.merge.length, 1);
});

Deno.test("merge-ff rejects a changed PR snapshot before comparison", async () => {
  const changed = pr({
    head: { ref: "main", label: "upstream:main", sha: "c".repeat(40) },
  });
  const { pull, calls } = setup({}, { refreshed: changed });
  assertEquals(await process(pull), false);
  assertEquals(calls.compare, []);
  assertEquals(calls.graphql, []);
  assertEquals(calls.merge, []);
});

Deno.test("merge-ff rejects missing repository identity", async () => {
  const fixture = pr();
  fixture.base.repo = {} as { node_id: string };
  const { pull, calls } = setup({}, { refreshed: fixture });
  assertEquals(
    await (pull as unknown as {
      processMergeFf(
        number: number,
        incoming: ReturnType<typeof pr>,
      ): Promise<boolean>;
    }).processMergeFf(7, fixture),
    false,
  );
  assertEquals(calls.compare, []);
  assertEquals(calls.graphql, []);
  assertEquals(calls.merge, []);
});
