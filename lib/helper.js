exports.timeout = ms => new Promise((resolve, reject) => setTimeout(resolve, ms))

exports.getPRTitle = (ref, upstream) =>
  `[pull] ${ref} from ${upstream}`

exports.getPRBody = (repoPath, prNumber) =>
  (prNumber
    ? `See [Commits](/${repoPath}/pull/${prNumber}/commits) and [Changes](/${repoPath}/pull/${prNumber}/files) for more details.\n\n-----\nCreated by [<img src="https://prod.download/pull-18h-svg" valign="bottom"/> **pull[bot]**](https://github.com/wei/pull)`
    : 'See Commits and Changes for more details.\n\n-----\nCreated by [<img src="https://prod.download/pull-18h-svg" valign="bottom"/> **pull[bot]**](https://github.com/wei/pull)') +
  '. Want to support this open source service? [Please star it : )](https://github.com/wei/pull)'
