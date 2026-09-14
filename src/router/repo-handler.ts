import type { Request, Response } from "express";
import type { Probot } from "probot";
import { appConfig } from "@/src/configs/app-config.ts";
import { getPullConfig } from "@/src/utils/get-pull-config.ts";
import { missingRepositoryResponse } from "@/src/router/repo-response.ts";
import {
  createSchedulerService,
  JobPriority,
  RepositoryModel,
} from "@wei/probot-scheduler";

interface RepositoryRecord {
  installation_id: number;
  id: number;
  owner: { login: string };
  name: string;
}

export interface RepoHandlerDependencies {
  findRepository: (
    filter: { full_name: string },
  ) => Promise<RepositoryRecord | null>;
}

function getRepoHandlers(
  app: Probot,
  schedulerService: ReturnType<typeof createSchedulerService>,
  dependencies: RepoHandlerDependencies = {
    findRepository: async (filter) => await RepositoryModel.findOne(filter),
  },
) {
  async function checkHandler(req: Request, res: Response) {
    const full_name = `${req.params.owner}/${req.params.repo}`;
    app.log.info({ full_name }, `Checking ${appConfig.configFilename}`);

    try {
      // Get Octokit
      const repoRecord = await dependencies.findRepository({ full_name });

      if (!repoRecord) {
        app.log.warn({ full_name }, "Repository is not registered");
        const response = missingRepositoryResponse(full_name);
        return res.status(response.statusCode).json(response.body);
      }

      const {
        installation_id,
        id: repository_id,
        owner: { login: owner },
        name: repo,
      } = repoRecord;

      const octokit = await app.auth(installation_id);
      const config = await getPullConfig(octokit, app.log, {
        installation_id,
        owner,
        repo,
        repository_id,
        metadata: {
          cron: "",
          job_priority: JobPriority.Normal,
          repository_id,
        },
      });

      if (!config) {
        return res.status(404).json({
          status: "error",
          message: `Configuration file '${appConfig.configFilename}' not found`,
        });
      }

      res.json(config);
    } catch (error) {
      app.log.error(error);
      res.status(500).json({
        status: "error",
        message: error instanceof Error
          ? error.message
          : "Unknown error occurred",
      });
    }
  }

  async function processHandler(req: Request, res: Response) {
    const full_name = `${req.params.owner}/${req.params.repo}`;
    app.log.info({ full_name }, `Processing`);

    try {
      await schedulerService.processRepository({ fullName: full_name }, true);

      res.json({ status: "queued" });
    } catch (error) {
      app.log.error(error);
      res.status(500).json({
        status: "error",
        message: error instanceof Error
          ? error.message
          : "Unknown error occurred",
      });
    }
  }

  return {
    checkHandler,
    processHandler,
  };
}

export default getRepoHandlers;
