const { badgen } = require('badgen')
const requestPromise = require('request-promise')
const yaml = require('js-yaml')

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
    res.json({ repos, limiter: app.limiter.counts() })
  })

  routes.get('/badge/:type', async (req, res) => {
    let params
    try {
      switch (req.params.type) {
        case 'installed': {
          const installCount = Object.keys(app.scheduler.INSTALLATIONS).length
          params = ('plain' in req.query) ? {
            subject: '',
            status: `${installCount}`,
            color: 'blue'
          } : {
            subject: 'installed',
            status: `${installCount} times`,
            color: 'blue'
          }
          break
        }
        case 'managing': {
          const repoCount = Object.keys(app.scheduler.REPOSITORIES).length
          params = ('plain' in req.query) ? {
            subject: '',
            status: `${repoCount}`,
            color: 'blue'
          } : {
            subject: 'managing',
            status: `${repoCount} repos`,
            color: 'blue'
          }
          break
        }
        case 'triggered':
          params = ('plain' in req.query) ? {
            subject: '',
            status: `${(await getJSON(`https://api.github.com/search/issues?q=author:app/pull&per_page=1&${GITHUB_CREDENTIALS}`)).total_count}`,
            color: 'blue'
          } : {
            subject: 'triggered',
            status: `${(await getJSON(`https://api.github.com/search/issues?q=author:app/pull&per_page=1&${GITHUB_CREDENTIALS}`)).total_count} times`,
            color: 'blue'
          }
          break
        case 'code_style':
          params = {
            subject: 'code style',
            status: 'standard',
            color: 'green',
            maxAge: 86400
          }
          break
        case 'built_with':
          params = {
            subject: 'built with',
            status: 'probot',
            color: 'orange',
            maxAge: 86400
          }
          break
        case 'license':
          params = {
            subject: 'license',
            status: 'MIT',
            color: 'blue',
            maxAge: 86400
          }
          break
        default:
          throw Error('Invalid type')
      }

      ['subject', 'status', 'color', 'style', 'maxAge'].forEach(k => {
        if (k in req.query) params[k] = req.query[k]
      })

      const svgString = badgen(params).replace(/>\s+</g, '><')

      res.writeHead(200, {
        'Content-Type': 'image/svg+xml;charset=utf-8',
        'Cache-Control': `max-age=${!Number.isNaN(params.maxAge) ? params.maxAge : 600}`
      })
      res.end(svgString)
    } catch (_) {
      const buf = Buffer.from('4749463839610100010000000021F90401000000002C00000000010001000002', 'hex')
      res.writeHead(200, {
        'Content-Type': 'image/gif',
        'Content-Length': buf.length
      })
      res.end(buf)
    }
  })

  routes.get('/process/:owner/:repo', (req, res) => {
    const fullName = `${req.params.owner}/${req.params.repo}`
    app.log.info(`[${fullName}] Processing`)
    if (fullName in app.scheduler.repos) {
      app.scheduler.process(fullName)
      res.status(200).send('Success')
    } else {
      res.status(404).send('Not found')
    }
  })

  routes.get('/check/:owner/:repo', (req, res) => {
    const fullName = `${req.params.owner}/${req.params.repo}`
    app.log.info(`[${fullName}] Checking ${app.CONFIG_FILENAME}`)
    getJSON(`https://${GITHUB_CREDENTIALS}api.github.com/repos/${fullName}/contents/.github/${app.CONFIG_FILENAME}`)
      .then(json => Buffer.from(json.content, 'base64').toString())
      .then(yml => yaml.safeLoad(yml))
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
