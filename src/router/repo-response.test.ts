import { assertEquals } from "@std/assert";
import express from "express";
import type { Probot } from "probot";
import type { createSchedulerService } from "@wei/probot-scheduler";
import createRouter from "@/src/router/index.ts";

Deno.test("GET /check/:owner/:repo returns 404 when repository is not registered", async () => {
  const serverApp = express();
  const log = {
    info() {},
    warn() {},
    error() {},
  };
  const probot = { log } as unknown as Probot;
  const schedulerService = {} as ReturnType<typeof createSchedulerService>;

  serverApp.use(createRouter(probot, schedulerService, {
    findRepository: () => Promise.resolve(null),
  }));

  const server = serverApp.listen(0);
  try {
    await new Promise<void>((resolve, reject) => {
      server.once("listening", resolve);
      server.once("error", reject);
    });
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("Expected the test server to listen on a TCP port");
    }

    const response = await fetch(
      `http://127.0.0.1:${address.port}/check/dockur/zima`,
    );

    assertEquals(response.status, 404);
    assertEquals(await response.json(), {
      status: "error",
      message:
        "Repository 'dockur/zima' is not registered. Install the Pull GitHub App on this repository before checking its configuration.",
    });
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => error ? reject(error) : resolve())
    );
  }
});
