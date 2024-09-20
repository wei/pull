const getConfig = require('probot-config')
const configCache = {}
const defaultConfigCache = {}

function cacheConfig (context, config) {
  configCache[context.payload.repository.full_name] = {
    data: config,
    expiration: new Date().getTime() + 24 * 3600 * 1000
  }
}

function getCachedConfig (context) {
  const cacheKey = context.payload.repository.full_name
  if (cacheKey in configCache) {
    if (configCache[cacheKey].expiration > new Date().getTime()) {
      return configCache[cacheKey].data
    } else {
      delete configCache[cacheKey]
    }
  }
  return undefined
}

function cacheDefaultConfig (context, config) {
  defaultConfigCache[context.payload.repository.full_name] = {
    data: config,
    expiration: new Date().getTime() + 24 * 3600 * 1000
  }
}

function getDefaultCachedConfig (context) {
  const cacheKey = context.payload.repository.full_name
  if (cacheKey in defaultConfigCache) {
    if (defaultConfigCache[cacheKey].expiration > new Date().getTime()) {
      return defaultConfigCache[cacheKey].data
    } else {
      delete defaultConfigCache[cacheKey]
    }
  }
  return undefined
}

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
            mergeMethod: process.env.DEFAULT_MERGE_METHOD || 'hardreset'
          }
        ]
      }
    }
  }
  return null
}

module.exports = {
  getLiveConfig: async (context, CONFIG_FILENAME, opts = {}) => {
    if (!opts.noCache) {
      const cachedConfig = getCachedConfig(context)
      if (cachedConfig !== undefined) return cachedConfig
    }
    const c = await getConfig(context, CONFIG_FILENAME)
    cacheConfig(context, c)
    return c
  },
  getDefaultConfig: async (context, opts = {}) => {
    if (!opts.noCache) {
      const cachedConfig = getDefaultCachedConfig(context)
      if (cachedConfig !== undefined) return cachedConfig
    }
    const c = await getDefaultConfig(context)
    cacheDefaultConfig(context, c)
    return c
  },
  clearConfig: (cacheKey) => {
    if (cacheKey && cacheKey in configCache) {
      delete configCache[cacheKey]
    }
  }
}
