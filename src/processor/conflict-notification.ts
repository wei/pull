import type { Logger, ProbotOctokit } from "probot";

export const conflictNotificationMarker =
  "<!-- pull:merge-conflict-notification -->";

const notificationGuards = new Map<string, Promise<void>>();

/**
 * Best-effort posts one authenticated merge-conflict notification per pull request.
 *
 * The keyed guard serializes callers in this process. The authenticated marker
 * check handles completed posts across processes, but the GitHub list/create API
 * has no atomic idempotency primitive. Separate processes can therefore still
 * race, and an ambiguous create response can cause a later retry.
 */
export async function postConflictCommentOnce(
  github: ProbotOctokit,
  logger: Pick<Logger, "error">,
  params: {
    owner: string;
    repo: string;
    issueNumber: number;
    comment: string;
    botLogin: string;
  },
): Promise<void> {
  const { owner, repo, issueNumber, comment, botLogin } = params;
  const guardKey = `${owner}/${repo}#${issueNumber}`;
  const previous = notificationGuards.get(guardKey) ?? Promise.resolve();
  let releaseGuard!: () => void;
  const guard = new Promise<void>((resolve) => {
    releaseGuard = resolve;
  });
  notificationGuards.set(guardKey, guard);

  await previous;
  try {
    const comments = await github.paginate(github.issues.listComments, {
      owner,
      repo,
      issue_number: issueNumber,
      per_page: 100,
    });

    if (
      comments.some(({ body, user }) =>
        body?.includes(conflictNotificationMarker) &&
        user?.login === botLogin
      )
    ) {
      return;
    }

    await github.issues.createComment({
      owner,
      repo,
      issue_number: issueNumber,
      body: `${comment}

${conflictNotificationMarker}`,
    });
  } catch (err) {
    // A notification must never stop scheduled conflict handling. In particular,
    // do not post when comment lookup fails: that would risk repeated comments.
    logger.error({ err }, `#${issueNumber} Conflict notification failed`);
  } finally {
    releaseGuard();
    if (notificationGuards.get(guardKey) === guard) {
      notificationGuards.delete(guardKey);
    }
  }
}
