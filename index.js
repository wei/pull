const createScheduler = require('probot-scheduler')

const Pull = require('./lib/pull')
const getConfig = require('./lib/get-config')
const configureLogging = require('./lib/logging')
const configureRoutes = require('./lib/router')

module.exports = async (app) => {
  app.managedAccounts = []
  app.managedRepos = []
  app.CONFIG_FILENAME = process.env.CONFIG_FILENAME || 'pull.yml'

  configureLogging(app)
  configureRoutes(app)

  const scheduler = createScheduler(app, {
    delay: !process.env.DISABLE_DELAY,
    interval: (parseInt(process.env.PULL_INTERVAL, 10) || 3600) * 1000
  })

  app.on('schedule.repository', routineCheck)
  app.on('push', handlePush)
  app.on(['pull_request', 'pull_request_review'], checkPRStatus)

  async function handlePush (context) {
    if (context.payload.commits.filter(c => c.message.indexOf(app.CONFIG_FILENAME) > -1).length > 0) {
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
    if (app.managedAccounts.indexOf(context.payload.repository.owner.login) === -1) {
      app.managedAccounts.push(context.payload.repository.owner.login)
    }
    if (app.managedRepos.indexOf(context.payload.repository.full_name) === -1) {
      app.managedRepos.push(context.payload.repository.full_name)
    }

    if (!context.payload.repository.fork || context.payload.repository.archived) {
      app.log.debug(`[${context.payload.repository.full_name}] Not an active fork, unscheduled`)
      scheduler.stop(context.payload.repository)
      return null
    }

    let config
    try {
      config = await getConfig(context, app.CONFIG_FILENAME)
    } catch (error) {
      if (error && error.code >= 500) {
        app.log.warn({ error }, `[${context.payload.repository.full_name}] Repo access failed with server error ${error.code}`)
      } else {
        app.log.warn({ error }, `[${context.payload.repository.full_name}] Repo is blocked, unscheduled`)
        scheduler.stop(context.payload.repository)
      }
      return null
    }

    if (!config) {
      app.log.warn(`[${context.payload.repository.full_name}] Unable to get config, unscheduled`)
      scheduler.stop(context.payload.repository)
      return null
    }
    return new Pull(context.github, context.repo({ logger: app.log }), config)
  }
}
