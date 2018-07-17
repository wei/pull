const PULL_CONFIG = process.env.PULL_CONFIG || 'pull.yml'

const getConfig = require('probot-config')
const createScheduler = require('probot-scheduler')
const fetch = require('node-fetch')
const yaml = require('js-yaml')
const bsyslog = require('bunyan-syslog-udp')

const Pull = require('./lib/pull')
const schema = require('./lib/schema')

const managedAccounts = []
const managedRepos = []

module.exports = async (app) => {
  const papertrailHost = process.env.PAPERTRAIL_HOST
  const papertrailPort = parseInt(process.env.PAPERTRAIL_PORT, 10)
  if (papertrailHost && papertrailPort) {
    app.log.target.addStream({
      type: 'raw',
      level: process.env.LOG_LEVEL || 'trace',
      stream: bsyslog.createBunyanStream({
        name: 'pull',
        host: papertrailHost,
        port: papertrailPort
      })
    })
  }

  const scheduler = createScheduler(app, {
    delay: !process.env.DISABLE_DELAY,
    interval: (parseInt(process.env.PULL_INTERVAL, 10) || 3600) * 1000
  })

  app.on('schedule.repository', routineCheck)
  app.on('push', handlePush)
  app.on(['pull_request', 'pull_request_review'], checkPRStatus)

  async function handlePush (context) {
    if (context.payload.commits.filter(c => c.message.indexOf(PULL_CONFIG) > -1).length > 0) {
      await routineCheck(context)
    }
  }

  async function routineCheck (context) {
    const pull = await forRepository(context)
    if (pull) await pull.routineCheck()
  }

  async function checkPRStatus (context) {
    switch (context.event) {
      case 'pull_request':
        if (context.payload.action !== 'opened') {
          return
        }
        break
      case 'pull_request_review':
        if (context.payload.action !== 'submitted' || context.payload.review.state !== 'approved') {
          return
        }
        break
      default:
        return
    }

    const pull = await forRepository(context)
    if (pull) await pull.checkAutoMerge(context.payload.pull_request)
  }

  async function forRepository (context) {
    if (managedAccounts.indexOf(context.payload.repository.owner.name) === -1) {
      managedAccounts.push(context.payload.repository.owner.name)
    }
    if (managedRepos.indexOf(context.payload.repository.full_name) === -1) {
      managedRepos.push(context.payload.repository.full_name)
    }

    if (!context.payload.repository.fork) {
      app.log.info(`[${context.payload.repository.full_name}] Not a fork, unscheduled`)
      scheduler.stop(context.payload.repository)
      return null
    }

    const config = await getConfig(context, PULL_CONFIG) ||
      await getDefaultConfig(context.github, context.repo({ logger: app.log }))
    if (!config) {
      app.log.info(`[${context.payload.repository.full_name}] Unable to fetch config, unscheduled`)
      scheduler.stop(context.payload.repository)
      return null
    }

    return new Pull(context.github, context.repo({ logger: app.log }), config)
  }

  async function getDefaultConfig (github, { owner, repo, logger }) {
    logger.debug(`[${owner}/${repo}] Fetching default config`)
    const repoInfo = await github.repos.get({
      owner,
      repo
    })

    if (repoInfo && repoInfo.data && repoInfo.data.fork && repoInfo.data.parent) {
      const upstreamOwner = repoInfo.data.parent.owner && repoInfo.data.parent.owner.login
      const defaultBranch = repoInfo.data.parent.default_branch

      if (upstreamOwner && defaultBranch) {
        logger.info(`[${owner}/${repo}] Using default config ${defaultBranch}...${upstreamOwner}:${defaultBranch}`)
        return {
          version: '1',
          rules: [
            {
              base: `${defaultBranch}`,
              upstream: `${upstreamOwner}:${defaultBranch}`,
              autoMerge: true,
              autoMergeHardReset: true
            }
          ]
        }
      }
    }
    return null
  }

  const routes = app.route()

  routes.get('/', (req, res) => res.redirect('https://github.com/wei/pull#readme'))

  routes.get('/installations', async (req, res) => {
    res.json({
      installations: managedAccounts.length,
      repos: managedRepos.length
    })
  })

  routes.get('/check/:owner/:repo', (req, res) => {
    app.log.info(`[${req.params.owner}/${req.params.repo}] Checking ${PULL_CONFIG}`)
    fetch(`https://api.github.com/repos/${req.params.owner}/${req.params.repo}/contents/.github/${PULL_CONFIG}`)
      .then(githubRes => githubRes.json())
      .then(json => Buffer.from(json.content, 'base64').toString())
      .then(yml => yaml.safeLoad(yml))
      .then((config) => {
        const { error, value } = schema.validate(config)
        if (error) throw error

        const reqs = value.rules.map(r => new Promise((resolve, reject) => {
          fetch(`https://api.github.com/repos/${req.params.owner}/${req.params.repo}/compare/${r.base}...${r.upstream}`)
            .then(githubRes => (githubRes.ok ? resolve() : reject(Error(`${r.base}...${r.upstream}`))))
            .catch(e => reject(e))
        }))

        Promise.all(reqs)
          .then(() => res.end(JSON.stringify(value, null, 2)))
          .catch(e => res.status(400).end(`Cannot compare ${e.message}`))
      })
      .catch(e => res.status(400).end(`.github/${PULL_CONFIG} file was either not found or failed validation`))
  })
}
