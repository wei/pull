exports.timeout = ms => new Promise((resolve, reject) => setTimeout(resolve, ms))

exports.getPRTitle = (ref, upstream) =>
  `[pull] ${ref} from ${upstream}`

exports.getPRBody = (repoPath, prNumber) =>
  (prNumber
    ? `See [Commits](/${repoPath}/pull/${prNumber}/commits) and [Diffs](/${repoPath}/pull/${prNumber}/files) for more details.\n\n-----\nCreated by [pull](https://github.com/wei/pull)`
    : 'Processing...')
