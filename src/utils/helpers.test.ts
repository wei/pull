import { assertEquals, assertStringIncludes } from "@std/assert";
import { getMergeFailureBody } from "@/src/utils/helpers.ts";

Deno.test("getMergeFailureBody provides duplicate-safe, non-sensitive guidance", () => {
  const body = getMergeFailureBody("owner/repo", 42, "hardreset");
  assertStringIncludes(body, "/owner/repo/pull/42/commits");
  assertStringIncludes(body, "<!-- pull-auto-merge-failure -->");
  assertStringIncludes(body, "**hardreset**");
  assertStringIncludes(body, "branch protection");
  assertStringIncludes(body, "workflow permissions");
  assertEquals(body.match(/pull-auto-merge-failure/g)?.length, 1);
});

Deno.test("getMergeFailureBody is deterministic across retry attempts", () => {
  assertEquals(
    getMergeFailureBody("owner/repo", 42, "merge"),
    getMergeFailureBody("owner/repo", 42, "merge"),
  );
});
