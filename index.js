const SYNCUP_CONFIG = process.env.SYNCUP_CONFIG || 'sync-up.yml'

const getConfig = require('probot-config')
const createScheduler = require('probot-scheduler')
const fetch = require('node-fetch')
const yaml = require('js-yaml')

const SyncUp = require('./lib/sync-up')
const schema = require('./lib/schema')

module.exports = async (robot) => {
  const scheduler = createScheduler(robot)

  robot.on('schedule.repository', routineCheck)
  robot.on('push', handlePush)
  robot.on(['pull_request', 'pull_request_review'], checkPRStatus)

  async function handlePush (context) {
    if (context.payload.commits.filter(c => c.message.indexOf(SYNCUP_CONFIG) > -1).length > 0) {
      await routineCheck(context)
    }
  }

  async function routineCheck (context) {
    const syncUp = await forRepository(context)
    if (syncUp) await syncUp.routineCheck()
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

    const syncUp = await forRepository(context)
    if (syncUp) await syncUp.checkAutoMerge(context.payload.pull_request)
  }

  async function forRepository (context) {
    if (!context.payload.repository.fork) {
      scheduler.stop(context.payload.repository)
      return null
    }

    const config = await getConfig(context, SYNCUP_CONFIG)
    if (!config) {
      scheduler.stop(context.payload.repository)
      return null
    }

    return new SyncUp(context.github, context.repo({ logger: robot.log }), config)
  }

  const app = robot.route('/_')

  app.get('/check/:owner/:repo', (req, res) => {
    fetch(`https://api.github.com/repos/${req.params.owner}/${req.params.repo}/contents/.github/${SYNCUP_CONFIG}`)
      .then(githubRes => githubRes.json())
      .then(json => Buffer.from(json.content, 'base64').toString())
      .then(yml => yaml.safeLoad(yml))
      .then((config) => {
        const { error, value } = schema.validate(config)
        if (error) throw error
        res.end(JSON.stringify(value, null, 2))
      })
      .catch((e) => {
        res.status(400).end(`File not found or invalid`)
      })
  })
}
