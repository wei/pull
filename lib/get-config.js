const getConfig = require('probot-config')

async function getDefaultConfig (context) {
  context.log.debug(`[${context.payload.repository.full_name}] Fetching default config`)

  const repoInfo = await context.github.repos.get({
    owner: context.payload.repository.owner.login,
    repo: context.payload.repository.name
  })

  if (repoInfo.data && repoInfo.data.fork && repoInfo.data.parent) {
    const upstreamOwner = repoInfo.data.parent.owner && repoInfo.data.parent.owner.login
    const defaultBranch = repoInfo.data.parent.default_branch

    if (upstreamOwner && defaultBranch) {
      context.log.debug(`[${context.payload.repository.full_name}] Using default config ${defaultBranch}...${upstreamOwner}:${defaultBranch}`)
      return {
        version: '1',
        rules: [
          {
            base: `${defaultBranch}`,
            upstream: `${upstreamOwner}:${defaultBranch}`,
            mergeMethod: 'hardreset'
          }
        ]
      }
    }
  }
  return null
}

module.exports = {
  getLiveConfig: async (context, CONFIG_FILENAME) => {
    return getConfig(context, CONFIG_FILENAME)
  },
  getDefaultConfig
}
