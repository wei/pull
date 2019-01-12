const badgen = require('badgen')
const requestPromise = require('request-promise')
const yaml = require('js-yaml')

const schema = require('./schema')

const getJSON = uri => requestPromise({
  uri,
  headers: { 'User-Agent': process.env.APP_ID || 'pull[bot]' },
  json: true
})

module.exports = app => {
  const routes = app.route()

  routes.get('/', (req, res) => res.redirect('https://github.com/wei/pull#readme'))

  routes.get('/installations', async (req, res) => {
    const output = {
      installations: app.managedAccounts.length,
      repos: app.managedRepos.length
    }
    if (req.query.key === process.env.WEBHOOK_SECRET) {
      output.managedAccounts = app.managedAccounts.sort()
      output.managedRepos = app.managedRepos.sort()
    }
    res.json(output)
  })

  routes.get('/badge/:type', async (req, res) => {
    let params
    try {
      switch (req.params.type) {
        case 'installed':
          params = ('plain' in req.query) ? {
            subject: '',
            status: `${app.managedAccounts.length}`,
            color: 'blue'
          } : {
            subject: 'installed',
            status: `${app.managedAccounts.length} times`,
            color: 'blue'
          }
          break
        case 'managing':
          params = ('plain' in req.query) ? {
            subject: '',
            status: `${app.managedRepos.length}`,
            color: 'blue'
          } : {
            subject: 'managing',
            status: `${app.managedRepos.length} repos`,
            color: 'blue'
          }
          break
        case 'triggered':
          params = ('plain' in req.query) ? {
            subject: '',
            status: `${(await getJSON(`https://api.github.com/search/issues?q=author:app/pull&per_page=1`)).total_count}`,
            color: 'blue'
          } : {
            subject: 'triggered',
            status: `${(await getJSON(`https://api.github.com/search/issues?q=author:app/pull&per_page=1`)).total_count} times`,
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

      ['subject', 'status', 'color', 'maxAge'].forEach(k => {
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

  routes.get('/check/:owner/:repo', (req, res) => {
    app.log.info(`[${req.params.owner}/${req.params.repo}] Checking ${app.CONFIG_FILENAME}`)
    getJSON(`https://api.github.com/repos/${req.params.owner}/${req.params.repo}/contents/.github/${app.CONFIG_FILENAME}?client_id=${process.env.CLIENT_ID || ''}&client_secret=${process.env.CLIENT_SECRET || ''}`)
      .then(json => Buffer.from(json.content, 'base64').toString())
      .then(yml => yaml.safeLoad(yml))
      .then((config) => {
        const { error, value } = schema.validate(config)
        if (error) throw error
        console.log(value)
        const reqs = value.rules.map(r => new Promise((resolve, reject) => {
          getJSON(`https://api.github.com/repos/${req.params.owner}/${req.params.repo}/compare/${r.base}...${r.upstream}?client_id=${process.env.CLIENT_ID || ''}&client_secret=${process.env.CLIENT_SECRET || ''}`)
            .then(githubRes => resolve())
            .catch(e => reject(e))
        }))

        Promise.all(reqs)
          .then(() => res.end(JSON.stringify(value, null, 2)))
          .catch(e => res.status(400).end(`Cannot compare ${e.message}`))
      })
      .catch(e => {
        console.log(e.message)
        if (e.message.indexOf('API rate limit exceeded') > -1) {
          res.status(400).end(`Github API rate limit exceeded`)
        } else {
          res.status(400).end(`.github/${app.CONFIG_FILENAME} file was either not found or failed validation`)
        }
      })
  })
}
