import { assertEquals } from "@std/assert";
import type { ProbotOctokit } from "probot";
import { Pull } from "@/src/processor/pull.ts";

const config = {
  version: "1",
  rules: [{
    base: "main",
    upstream: "upstream:main",
    mergeMethod: "merge" as const,
    mergeUnstable: false,
    assignees: [],
    reviewers: [],
    conflictReviewers: [],
  }],
  label: "pull",
  conflictLabel: "merge-conflict",
};

Deno.test("failed API merge updates the locked PR body once", async () => {
  const updates: Array<Record<string, unknown>> = [];
  const github = {
    pulls: { merge: () => Promise.reject(new Error("sensitive API response")) },
    issues: {
      update: (request: Record<string, unknown>) => {
        updates.push(request);
        return Promise.resolve({ data: {} });
      },
    },
  } as unknown as ProbotOctokit;
  const pull = new Pull(github, { owner: "owner", repo: "repo" }, config);
  const processMerge = pull as unknown as {
    processMerge: (
      number: number,
      incoming: Record<string, unknown>,
      rule: typeof config.rules[number],
      options: Record<string, unknown>,
    ) => Promise<boolean>;
  };

  const merged = await processMerge.processMerge(
    42,
    {
      mergeable: true,
      mergeable_state: "clean",
      rebaseable: true,
    },
    config.rules[0],
    {},
  );

  assertEquals(merged, false);
  assertEquals(updates.length, 1);
  const body = String(updates[0].body);
  assertEquals(body.includes("branch protection"), true);
  assertEquals(body.includes("sensitive API response"), false);
});

Deno.test("rebase fallback failure reports the resolved merge operation", async () => {
  const mergeRequests: Array<Record<string, unknown>> = [];
  const updates: Array<Record<string, unknown>> = [];
  const github = {
    pulls: {
      merge: (request: Record<string, unknown>) => {
        mergeRequests.push(request);
        return Promise.reject(new Error("merge denied"));
      },
    },
    issues: {
      update: (request: Record<string, unknown>) => {
        updates.push(request);
        return Promise.resolve({ data: {} });
      },
    },
  } as unknown as ProbotOctokit;
  const rebaseConfig = {
    ...config,
    rules: [{ ...config.rules[0], mergeMethod: "rebase" as const }],
  };
  const pull = new Pull(github, { owner: "owner", repo: "repo" }, rebaseConfig);
  const processMerge = pull as unknown as {
    processMerge: (
      number: number,
      incoming: Record<string, unknown>,
      rule: typeof rebaseConfig.rules[number],
      options: Record<string, unknown>,
    ) => Promise<boolean>;
  };

  assertEquals(
    await processMerge.processMerge(
      42,
      {
        mergeable: true,
        mergeable_state: "clean",
        rebaseable: false,
      },
      rebaseConfig.rules[0],
      {},
    ),
    false,
  );
  assertEquals(mergeRequests[0].merge_method, "merge");
  assertEquals(updates.length, 1);
  const body = String(updates[0].body);
  assertEquals(body.includes("**merge**"), true);
  assertEquals(body.includes("**rebase**"), false);
});

Deno.test("failure reporting errors are non-fatal", async () => {
  const github = {
    pulls: { merge: () => Promise.reject(new Error("merge denied")) },
    issues: { update: () => Promise.reject(new Error("PR update denied")) },
  } as unknown as ProbotOctokit;
  const pull = new Pull(github, { owner: "owner", repo: "repo" }, config);
  const processMerge = pull as unknown as {
    processMerge: (
      number: number,
      incoming: Record<string, unknown>,
      rule: typeof config.rules[number],
      options: Record<string, unknown>,
    ) => Promise<boolean>;
  };

  assertEquals(
    await processMerge.processMerge(
      42,
      {
        mergeable: true,
        mergeable_state: "clean",
        rebaseable: true,
      },
      config.rules[0],
      {},
    ),
    false,
  );
});

Deno.test("failed hardreset API operation updates the locked PR body", async () => {
  const updates: Array<Record<string, unknown>> = [];
  const github = {
    git: {
      updateRef: () => Promise.reject(new Error("protected ref details")),
    },
    issues: {
      update: (request: Record<string, unknown>) => {
        updates.push(request);
        return Promise.resolve({ data: {} });
      },
    },
  } as unknown as ProbotOctokit;
  const hardresetConfig = {
    ...config,
    rules: [{ ...config.rules[0], mergeMethod: "hardreset" as const }],
  };
  const pull = new Pull(
    github,
    { owner: "owner", repo: "repo" },
    hardresetConfig,
  );
  const processMerge = pull as unknown as {
    processMerge: (
      number: number,
      incoming: Record<string, unknown>,
      rule: typeof hardresetConfig.rules[number],
      options: Record<string, unknown>,
    ) => Promise<boolean>;
  };

  assertEquals(
    await processMerge.processMerge(
      42,
      {
        mergeable: true,
        mergeable_state: "clean",
        rebaseable: true,
        base: { ref: "main" },
        head: { sha: "abc123" },
      },
      hardresetConfig.rules[0],
      {},
    ),
    false,
  );
  assertEquals(updates.length, 1);
  const body = String(updates[0].body);
  assertEquals(body.includes("**hardreset**"), true);
  assertEquals(body.includes("protected ref details"), false);
});
