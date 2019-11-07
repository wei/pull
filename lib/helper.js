exports.timeout = ms => new Promise((resolve, reject) => setTimeout(resolve, ms))

exports.getPRTitle = (ref, upstream) =>
  `[pull] ${ref} from ${upstream}`

exports.getPRBody = (repoPath, prNumber) =>
  'See ' +
  (prNumber
    ? '[Commits](/${repoPath}/pull/${prNumber}/commits) and [Changes](/${repoPath}/pull/${prNumber}/files)'
    : 'Commits and Changes') +
  ' for more details.' +
  '\n\n-----\n' + 
  'If you miss a commit, click https://pull.git.ci/process/${repoPath} to manually trigger a pull. **Note:** Nothing will happen if your branch is already even with upstream.' + 
  '\n\n-----\n' + 
  'Created by [<img src="https://prod.download/pull-18h-svg" valign="bottom"/> **pull[bot]**](https://github.com/wei/pull)' +
  '. Want to support this open source service? [Please star it : )](https://github.com/wei/pull)'
