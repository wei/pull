const schema = require('./schema')
const helper = require('./helper')

module.exports = class Pull {
  constructor (github, { owner, repo, logger = console }, config) {
    this.github = github
    this.logger = logger

    const { error, value } = schema.validate(config)

    if (error) {
      this.logger.warn({ err: new Error(error), owner, repo }, 'Invalid config')
      throw new Error('Invalid config')
    }
    this.config = Object.assign({}, value, { owner, repo, repoPath: `${owner}/${repo}` })
  }

  async routineCheck () {
    this.logger.debug(`[${this.config.repoPath}] Config: ${JSON.stringify(this.config)}`)

    for (let i = 0; i < this.config.rules.length; i++) {
      const rule = this.config.rules[i]
      const { base, upstream, assignees, reviewers } = rule

      if (base.toLowerCase() === upstream.toLowerCase().replace(`${this.config.owner.toLowerCase()}:`, '')) {
        this.logger.debug(`[${this.config.repoPath}] ${base} is same as ${upstream}`)
      } else if (!(await this.hasDiff(base, upstream))) {
        this.logger.info(`[${this.config.repoPath}] ${base} is in sync with ${upstream}`)
      } else if (await this.hasOpenPR(base)) {
        this.logger.info(`[${this.config.repoPath}] Already has PR from ${upstream} to ${base}`)
      } else {
        this.logger.info(`[${this.config.repoPath}] Creating PR from ${upstream} to ${base}`)
        await this.createPR(base, upstream, assignees, reviewers)
      }
    }
  }

  async checkAutoMerge (incomingPR, config = {}) {
    if (!incomingPR) return null
    const prNumber = incomingPR.number
    this.logger.debug(`[${this.config.repoPath}]#${prNumber} Checking auto merged pull request`)

    const rule = this.config.rules.filter(r =>
      r.base === incomingPR.base.ref &&
      (r.upstream === incomingPR.head.label || r.upstream === incomingPR.head.ref))[0]

    if (rule && rule.autoMerge &&
      incomingPR.state === 'open' &&
      incomingPR.user.login === 'pull[bot]' &&
      incomingPR.mergeable !== false
    ) {
      const mergable = incomingPR.mergeable_state === 'clean' ||
        await this.isMergeable(prNumber, { maxRetries: config.isMergableMaxRetries || undefined })
      this.logger.debug(`[${this.config.repoPath}]#${prNumber} Mergability ${mergable}`)
      if (mergable) {
        await this.mergePR(prNumber)
        this.logger.debug(`[${this.config.repoPath}]#${prNumber} Auto merged pull request`)

        if (rule.autoMergeHardReset) {
          this.logger.debug(`[${this.config.repoPath}]#${prNumber} Performing hard reset`)
          try {
            await this.hardResetCommit(incomingPR.base.ref, incomingPR.head.sha)
            this.logger.info(`[${this.config.repoPath}]#${prNumber} Hard reset successful`)
          } catch (_) {
            this.logger.debug(`[${this.config.repoPath}]#${prNumber} Hard reset failed`)
          }
        }
        return true
      }
    } else {
      this.logger.debug(`[${this.config.repoPath}]#${prNumber} Skip processing`)
    }
    return false
  }

  async hasDiff (base, upstream) {
    const comparison = await this.github.repos.compareCommits({
      owner: this.config.owner,
      repo: this.config.repo,
      head: upstream,
      base
    })
    return comparison.data.total_commits > 0
  }

  async hasOpenPR (base) {
    const res = await this.github.search.issues({
      q: `repo:${this.config.repoPath} type:pr is:open base:${base} author:app/pull`,
      per_page: 1, // Cannot be 0 because it will fallback to default: 30
      page: 1
    })
    return res.data.total_count > 0
  }

  async createPR (base, upstream, assignees, reviewers) {
    const createdPR = await this.github.pullRequests.create({
      owner: this.config.owner,
      repo: this.config.repo,
      head: upstream,
      base,
      maintainer_can_modify: false,
      title: helper.getPRTitle(base, upstream),
      body: helper.getPRBody(this.config.repoPath)
    })

    const prNumber = createdPR.data.number

    this.logger.debug(`[${this.config.repoPath}]#${prNumber} Created pull request`)

    await this.github.issues.edit({
      owner: this.config.owner,
      repo: this.config.repo,
      number: createdPR.data.number,
      assignees,
      labels: [this.config.label],
      body: helper.getPRBody(this.config.repoPath, prNumber)
    })

    await this.addReviewers(prNumber, reviewers)

    this.logger.info(`[${this.config.repoPath}]#${prNumber} Updated pull request`)
  }

  async isMergeable (number, config = {}) {
    const maxRetries = config.maxRetries || 5
    let i = 0
    while (i++ < maxRetries) {
      const createdPR = await this.github.pullRequests.get({
        owner: this.config.owner,
        repo: this.config.repo,
        number
      })
      this.logger.debug(`[${this.config.repoPath}]#${number} Mergeability is ${createdPR.data.mergeable_state}`)
      if (typeof createdPR.data.mergeable === 'boolean' && createdPR.data.mergeable_state !== 'unknown') {
        return createdPR.data.mergeable && createdPR.data.mergeable_state === 'clean'
      }
      await helper.timeout(1000 * i * i)
    }
    return null
  }

  async addReviewers (prNumber, reviewers) {
    if (!prNumber || !reviewers || reviewers.length === 0) return null
    return this.github.pullRequests.createReviewRequest({
      owner: this.config.owner,
      repo: this.config.repo,
      number: prNumber,
      reviewers
    })
  }

  async mergePR (number, method) {
    if (!number) return null
    return this.github.pullRequests.merge({
      owner: this.config.owner,
      repo: this.config.repo,
      number,
      merge_method: method
    })
  }

  async hardResetCommit (baseRef, sha) {
    if (!baseRef || !sha) return null
    return this.github.gitdata.updateReference({
      owner: this.config.owner,
      repo: this.config.repo,
      ref: `heads/${baseRef}`,
      sha,
      force: true
    })
  }
}
