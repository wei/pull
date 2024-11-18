import {
  JobPriority,
  type RepositoryMetadataSchemaType,
  type RepositorySchemaType,
} from "@wei/probot-scheduler";
import { getRandomCronSchedule } from "@/src/utils/helpers.ts";

// deno-lint-ignore require-await
export async function getRepositorySchedule(
  repository: RepositorySchemaType,
  currentMetadata?: RepositoryMetadataSchemaType,
) {
  return {
    repository_id: repository.id,
    cron: currentMetadata?.cron ?? getRandomCronSchedule(),
    job_priority: currentMetadata?.job_priority ?? JobPriority.Normal,
  };
}
