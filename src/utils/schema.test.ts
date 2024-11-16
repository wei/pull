import { PullConfig, pullConfigSchema } from "@/src/utils/schema.ts";
import { assertEquals } from "@std/assert";

// deno-fmt-ignore
const validConfigs = [
  { version: '1', rules: [{ base: 'master', upstream: 'upstream:master' }] },
  { version: '1', rules: [{ base: 'master', upstream: 'upstream:master', autoMerge: true }], label: 'pull' },
  { version: '1', rules: [{ base: 'master', upstream: 'upstream:master', autoMerge: true }], label: 'pull', conflictLabel: 'merge-conflict' },
  { version: '1', rules: [{ base: 'master', upstream: 'upstream:master', autoMerge: true, assignees: ['wei'] }] },
  { version: '1', rules: [{ base: 'master', upstream: 'upstream:master', autoMerge: false, reviewers: ['wei'] }] },
  { version: '1', rules: [{ base: 'master', upstream: 'upstream:master', autoMerge: false, reviewers: ['wei'], conflictReviewers: ['saurabh702'] }] },
  { version: '1', rules: [{ base: 'master', upstream: 'upstream:master', mergeMethod: 'squash', mergeUnstable: true }] },
  { version: '1', rules: [{ base: 'master', upstream: 'upstream:master', mergeMethod: 'hardreset', assignees: ['wei'] }] },
] as const;

// deno-fmt-ignore
const invalidConfigs = [
  {},
  { rules: {} },
  { version: '' },
  { version: '1' },
  { version: '1', rules: [] },
  { version: '1', rules: [{ base: 'master' }] },
  { version: 1, rules: [{ base: 'master', upstream: 'upstream:master' }] },
  { version: '1', rules: [{ base: 'master', upstream: 'upstream:master' }], label: 1 },
  { version: '1', rules: [{ base: 'master', upstream: 'upstream:master' }], label: 1, conflictLabel: 2 },
  { version: '1', rules: [{ base: 'master', upstream: 'upstream:master' }], label: '', conflictLabel: '' },
  { version: '1', rules: [{ base: 'master', upstream: 'upstream:master' }], label: 'pull', conflictLabel: 1 },
  { version: '1', rules: [{ base: 'master', upstream: 'upstream:master' }], label: 'pull', conflictLabel: '' },
  { version: '1', rules: [{ base: 'master', upstream: 'upstream:master', assignees: '' }] },
  { version: '1', rules: [{ base: 'master', upstream: 'upstream:master', reviewers: '' }] },
  { version: '1', rules: [{ base: 'master', upstream: 'upstream:master', reviewers: '', conflictReviewers: '' }] },
  { version: '1', rules: [{ base: 'master', upstream: '' }] },
  { version: '1', rules: [{ base: 'master', autoMerge: 1 }] },
  { version: '1', rules: [{ base: 'master', autoMerge: '' }] },
  { version: '1', rules: [{ base: 'master', upstream: 'upstream:master', mergeMethod: '' }] },
  { version: '1', rules: [{ base: 'master', upstream: 'upstream:master', mergeMethod: 'invalid' }] },
  { version: '1', rules: [{ base: 'master', upstream: 'upstream:master', mergeMethod: true }] },
  { version: '2', rules: [{ base: 'master', upstream: 'upstream:master', mergeMethod: "hardreset" }] },
] as const;

Deno.test("schema defaults", () => {
  const result = pullConfigSchema.parse({
    version: "1",
    rules: [{ base: "master", upstream: "upstream:master" }],
  });

  const expected = {
    version: "1",
    rules: [
      {
        base: "master",
        upstream: "upstream:master",
        mergeMethod: "none",
        mergeUnstable: false,
        assignees: [],
        reviewers: [],
        conflictReviewers: [],
      },
    ],
    label: ":arrow_heading_down: pull",
    conflictLabel: "merge-conflict",
  } as PullConfig;
  assertEquals(result, expected);
});

for (const config of validConfigs) {
  Deno.test(`Valid config: ${JSON.stringify(config)}`, () => {
    const result = pullConfigSchema.safeParse(config);
    assertEquals(
      result.success,
      true,
      `Expected config to be valid, but got error: ${JSON.stringify(result)}`,
    );
  });
}

for (const config of invalidConfigs) {
  Deno.test(`Invalid config: ${JSON.stringify(config)}`, () => {
    const result = pullConfigSchema.safeParse(config);
    assertEquals(
      result.success,
      false,
      "Expected config to be invalid, but it was valid",
    );
  });
}
