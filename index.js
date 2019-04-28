const createScheduler = require('probot-scheduler')
const Bottleneck = require('bottleneck')

const Pull = require('./lib/pull')
const getConfig = require('./lib/get-config')
const configureLogging = require('./lib/logging')
const configureRoutes = require('./lib/router')

module.exports = async (app) => {
  app.CONFIG_FILENAME = process.env.CONFIG_FILENAME || 'pull.yml'

  app.limiter = new Bottleneck({
    maxConcurrent: parseInt(process.env.MAX_CONCURRENT, 10) || 10,
    trackDoneStatus: false
  })

  configureLogging(app)
  configureRoutes(app)

  app.scheduler = createScheduler(app, {
    delay: !process.env.DISABLE_DELAY,
    interval: (parseInt(process.env.PULL_INTERVAL, 10) || 3600) * 1000
  })

  app.on('schedule.repository', routineCheck)
  app.on('push', handlePush)
  app.on('pull_request_review', checkPRStatus)

  async function handlePush (context) {
    if (context.payload.commits.filter(c => c.message.indexOf(app.CONFIG_FILENAME) > -1).length > 0) {
      await routineCheck(context)
    }
  }

  async function routineCheck (context) {
    const jobId = context.payload.repository.full_name
    if (!app.limiter.jobStatus(jobId)) {
      await app.limiter.schedule({
        expiration: 30000,
        id: jobId
      }, () => processRoutineCheck(context))
    }
  }

  async function processRoutineCheck (context) {
    const pull = await forRepository(context)
    if (pull) await pull.routineCheck()
  }

  async function checkPRStatus (context) {
    switch (context.event) {
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
    if (context.payload.repository.archived) {
      app.log.debug(`[${context.payload.repository.full_name}] Not an active repo, unscheduled`)
      app.scheduler.stop(context.payload.repository)
      return null
    }

    let config
    try {
      config = await getConfig.getLiveConfig(context, app.CONFIG_FILENAME)
      if (!context.payload.repository.fork && !config) {
        app.log.debug(`[${context.payload.repository.full_name}] Not a forked repo and has no pull.yml, unscheduled`)
        app.scheduler.stop(context.payload.repository)
        return null
      }
      if (!config) {
        config = await getConfig.getDefaultConfig(context)
      }
    } catch (e) {
      if (e && e.code >= 500) {
        app.log.warn(e, `[${context.payload.repository.full_name}] Repo access failed with server error ${e.code}`)
      } else {
        app.log.debug(e, `[${context.payload.repository.full_name}] Repo is blocked, unscheduled`)
        app.scheduler.stop(context.payload.repository)
      }
      return null
    }

    if (!config) {
      app.log.debug(`[${context.payload.repository.full_name}] Unable to get config, unscheduled`)
      app.scheduler.stop(context.payload.repository)
      return null
    }
    return new Pull(context.github, context.repo({ logger: app.log }), config)
  }
}
