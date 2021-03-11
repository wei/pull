const requestPromise = require('request-promise')
const yaml = require('js-yaml')
const { clearConfig } = require('./get-config')

const schema = require('./schema').schema

const GITHUB_CREDENTIALS = (process.env.CLIENT_ID && process.env.CLIENT_SECRET)
  ? `${process.env.CLIENT_ID}:${process.env.CLIENT_SECRET}@`
  : ''
const getJSON = uri => requestPromise({
  uri,
  headers: { 'User-Agent': process.env.APP_ID || 'pull[bot]' },
  json: true
})

module.exports = app => {
  const routes = app.route()

  routes.get('/', (req, res) => res.redirect('https://wei.github.io/pull'))

  routes.get('/installations', async (req, res) => {
    if (req.query.key !== process.env.WEBHOOK_SECRET) {
      return res.status(403).end()
    }
    const repos = Object.assign({}, app.scheduler.repos)
    for (const key in repos) {
      if (repos[key] instanceof Date) {
        repos[key] = (repos[key].getTime() - new Date().getTime()) / 1000
      }
    }
    res.json(repos)
  })

  routes.get('/limiter', async (req, res) => {
    if (req.query.key !== process.env.WEBHOOK_SECRET) {
      return res.status(403).end()
    }
    res.json(app.limiter.counts())
  })

  routes.get('/probot/stats', (req, res) => {
    getJSON('https://raw.githack.com/pull-app/stats/master/stats.json')
      .then(json => {
        res.json(json)
      })
      .catch(e => {
        app.log.error(e, 'Failed to fetch stats.json')
        res.status(404).end()
      })
  })

  const processEndpoint = (req, res) => {
    const fullName = `${req.params.owner}/${req.params.repo}`
    clearConfig(fullName)
    app.log.info(`[${fullName}] Processing`)
    if (fullName in app.scheduler.repos) {
      app.scheduler.process(fullName)
      res.status(200).send('Success')
    } else {
      res.status(404).send('Not found')
    }
  }
  routes.get('/process/:owner/:repo', processEndpoint)
  routes.post('/process/:owner/:repo', processEndpoint)

  routes.get('/check/:owner/:repo', (req, res) => {
    const fullName = `${req.params.owner}/${req.params.repo}`
    clearConfig(fullName)
    app.log.info(`[${fullName}] Checking ${app.CONFIG_FILENAME}`)
    getJSON(`https://${GITHUB_CREDENTIALS}api.github.com/repos/${fullName}/contents/.github/${app.CONFIG_FILENAME}`)
      .then(json => Buffer.from(json.content, 'base64').toString())
      .then(yml => yaml.load(yml))
      .then((config) => {
        const { error, value } = schema.validate(config)
        if (error) throw error
        const reqs = value.rules.map(r => new Promise((resolve, reject) => {
          getJSON(`https://${GITHUB_CREDENTIALS}api.github.com/repos/${fullName}/compare/${r.base}...${r.upstream}`)
            .then(githubRes => resolve())
            .catch(e => reject(e))
        }))

        Promise.all(reqs)
          .then(() => {
            if (fullName in app.scheduler.repos) {
              app.scheduler.process(fullName)
            }
            res.status(200).end(JSON.stringify(value, null, 2))
          })
          .catch(e => res.status(400).end(`Cannot compare ${e.message}`))
      })
      .catch(e => {
        const output = { statusCode: 400, body: `.github/${app.CONFIG_FILENAME} file has failed validation` }
        if (e.message.indexOf('API rate limit exceeded') > -1) {
          output.body = 'Github API rate limit exceeded'
        } else if (e.message.indexOf('404') > -1) {
          output.statusCode = 404
          output.body = 'File not found'
        }
        app.log.debug(e, `[${fullName}] [.github/${app.CONFIG_FILENAME}] ${output.message}`)
        res.status(output.statusCode).end(output.body)
      })
  })
}
