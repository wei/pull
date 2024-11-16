import { z } from "zod";

const pullMergeMethodEnum = z.enum([
  "none",
  "merge",
  "squash",
  "rebase",
  "hardreset",
]);

const pullRuleSchema = z.object({
  base: z.string().min(1).describe("Destination local branch"),
  upstream: z.string().min(1).describe("Upstream owner:branch"),
  mergeMethod: pullMergeMethodEnum.default("none").describe(
    "Auto merge pull request using this merge method. one of [none, merge, squash, rebase, hardreset], Default: none",
  ),
  mergeUnstable: z.boolean().default(false).describe(
    "Merge pull request even when the mergeable state is not clean",
  ),
  assignees: z.array(z.string()).default([]).describe(
    "Assignees for the pull requests",
  ),
  reviewers: z.array(z.string()).default([]).describe(
    "Reviewers for the pull requests",
  ),
  conflictReviewers: z.array(z.string()).default([]).describe(
    "Merge Conflict Reviewers for the pull requests",
  ),
});

const pullConfigSchema = z.object({
  version: z.string().regex(/^1$/).describe(
    'Version number (string), must be "1"',
  ),
  rules: z.array(pullRuleSchema).min(1).describe("Rules for pull requests"),
  label: z.string().min(1).default(":arrow_heading_down: pull").describe(
    "Label for the pull requests",
  ),
  conflictLabel: z.string().min(1).default("merge-conflict").describe(
    "Label for merge conflicts",
  ),
});

// Export types derived from the schema
type PullConfig = z.infer<typeof pullConfigSchema>;
type PullRule = z.infer<typeof pullRuleSchema>;
type PullMergeMethod = z.infer<typeof pullMergeMethodEnum>;

export {
  type PullConfig,
  pullConfigSchema,
  type PullMergeMethod,
  type PullRule,
};
