/** Supported library interface for embedding Pull in a Probot application. */
export { createPullApp, default } from "@/src/app.ts";
export type { PullAppOptions } from "@/src/app.ts";

export {
  DEFAULT_PROCESSING_TIMEOUT_MS,
  getRepoProcessor,
  processRepository,
} from "@/src/processor/index.ts";
export type {
  RepositoryJobProcessor,
  RepositoryProcessorOptions,
} from "@/src/processor/index.ts";
export { Pull } from "@/src/processor/pull.ts";
export type { PullOptions } from "@/src/processor/pull.ts";
export { getPullConfig } from "@/src/utils/get-pull-config.ts";
export type { PullConfigOptions } from "@/src/utils/get-pull-config.ts";
export {
  type PullConfig,
  pullConfigSchema,
  type PullMergeMethod,
  type PullRule,
} from "@/src/utils/schema.ts";
export type { SchedulerJobData } from "@wei/probot-scheduler";
