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
    let param
    try {
      switch (req.params.type) {
        case 'installed':
          param = {
            subject: 'installed',
            status: `${app.managedAccounts.length} times`,
            color: 'blue'
          }
          break
        case 'managing':
          param = {
            subject: 'managing',
            status: `${app.managedRepos.length} repos`,
            color: 'blue'
          }
          break
        case 'triggered':
          param = {
            subject: 'triggered',
            status: `${(await getJSON(`https://api.github.com/search/issues?q=author:app/pull&per_page=1`)).total_count} times`,
            color: 'blue'
          }
          break
        case 'code_style':
          param = {
            subject: 'code style',
            status: `standard`,
            color: 'green',
            maxAge: 86400
          }
          break
        case 'built_with':
          param = {
            subject: 'built with',
            status: `probot`,
            color: 'orange',
            maxAge: 86400
          }
          break
        case 'license':
          param = {
            subject: 'license',
            status: `MIT`,
            color: 'blue',
            maxAge: 86400
          }
          break
        default:
          throw Error('Invalid type')
      }

      const svgString = badgen(param).replace(/>\s+</g, '><').trim()

      res.writeHead(200, {
        'Content-Type': 'image/svg+xml;charset=utf-8',
        'Cache-Control': `max-age=${typeof (param.maxAge) === 'number' ? param.maxAge : 600}`
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
    getJSON(`https://api.github.com/repos/${req.params.owner}/${req.params.repo}/contents/.github/${app.CONFIG_FILENAME}`)
      .then(json => Buffer.from(json.content, 'base64').toString())
      .then(yml => yaml.safeLoad(yml))
      .then((config) => {
        const { error, value } = schema.validate(config)
        if (error) throw error
        console.log(value)
        const reqs = value.rules.map(r => new Promise((resolve, reject) => {
          getJSON(`https://api.github.com/repos/${req.params.owner}/${req.params.repo}/compare/${r.base}...${r.upstream}`)
            .then(githubRes => resolve())
            .catch(e => reject(e))
        }))

        Promise.all(reqs)
          .then(() => res.end(JSON.stringify(value, null, 2)))
          .catch(e => res.status(400).end(`Cannot compare ${e.message}`))
      })
      .catch(e => res.status(400).end(`.github/${app.CONFIG_FILENAME} file was either not found or failed validation`))
  })
}
