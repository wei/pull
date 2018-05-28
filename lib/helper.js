exports.timeout = ms => new Promise((resolve, reject) => setTimeout(resolve, ms))

exports.getPRTitle = (ref, upstream) =>
  `[sync-up] ${ref} from ${upstream}`

exports.getPRBody = (repoPath, prNumber) =>
  (prNumber
    ? `See [Commits](/${repoPath}/pull/${prNumber}/commits) and [Diffs](/${repoPath}/pull/${prNumber}/files) for more details.\n\n-----\nCreated by [sync-up](https://github.com/wei/sync-up)`
    : 'Processing...')
