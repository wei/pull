const schema = require('./schema').schemaWithDeprecation
const helper = require('./helper')

module.exports = class Pull {
  constructor (github, { owner, repo, logger = console }, config) {
    this.github = github
    this.logger = logger

    const { error, value } = schema.validate(config)

    if (error) {
      throw new Error('Invalid config')
    }
    this.config = Object.assign({}, value, { owner, repo, repoPath: `${owner}/${repo}` })

    this.config.rules = this.config.rules.map(r => {
      // Handle deprecated config
      if (r.mergeMethod === 'none' && r.autoMerge) {
        r.mergeMethod = r.autoMergeHardReset ? 'hardreset' : 'merge'
      }
      return r
    })
  }

  async routineCheck () {
    this.logger.info(`[${this.config.repoPath}] Routine Check`)
    // this.logger.debug(`[${this.config.repoPath}] Config`, this.config)

    for (let i = 0; i < this.config.rules.length; i++) {
      const rule = this.config.rules[i]
      const { base, upstream, assignees, reviewers } = rule

      if (base.toLowerCase() === upstream.toLowerCase().replace(`${this.config.owner.toLowerCase()}:`, '')) {
        this.logger.debug(`[${this.config.repoPath}] ${base} is same as ${upstream}`)
      } else if (!(await this.hasDiff(base, upstream))) {
        this.logger.debug(`[${this.config.repoPath}] ${base} is in sync with ${upstream}`)
      } else {
        const openPR = await this.getOpenPR(base, upstream) // Get PR opened by pull[bot]
        if (openPR) {
          this.logger.debug(`[${this.config.repoPath}] Found a PR from ${upstream} to ${base}`)
          await this.checkAutoMerge(openPR)
        } else {
          this.logger.info(`[${this.config.repoPath}] Creating PR from ${upstream} to ${base}`)
          await this.checkAutoMerge(await this.createPR(base, upstream, assignees, reviewers))
        }
      }
    }
  }

  async checkAutoMerge (incomingPR, config = {}) {
    if (!incomingPR) return null
    const prNumber = incomingPR.number
    this.logger.debug(`[${this.config.repoPath}]#${prNumber} Checking auto merged pull request`)

    const rule = this.config.rules.filter(r =>
      r.base.toLowerCase() === incomingPR.base.ref.toLowerCase() &&
      (r.upstream.toLowerCase() === incomingPR.head.label.toLowerCase() ||
        r.upstream.toLowerCase() === incomingPR.head.ref.toLowerCase()))[0]

    if (incomingPR.mergeable === false) {
      this.logger.debug(`[${this.config.repoPath}]#${prNumber} mergeable:false`)

      try {
        await this.github.issues.getLabel({
          owner: this.config.owner,
          repo: this.config.repo,
          name: this.config.conflictLabel
        })
      } catch (e) {
        await this.addLabel(this.config.conflictLabel, 'ff0000', 'Resolve conflicts manually')
      }

      await this.github.issues.update({
        owner: this.config.owner,
        repo: this.config.repo,
        issue_number: prNumber,
        labels: [this.config.label, this.config.conflictLabel],
        body: helper.getPRBody(this.config.repoPath, prNumber)
      })

      await this.addReviewers(prNumber, rule.conflictReviewers)
    }

    if (rule && rule.mergeMethod !== 'none' &&
      incomingPR.state === 'open' &&
      incomingPR.user.login === 'pull[bot]' &&
      incomingPR.mergeable !== false // mergeable can be null, in which case we can proceed to wait and retry
    ) {
      const mergeableStatus = (incomingPR.mergeable && (incomingPR.mergeable_state === 'clean' || (incomingPR.mergeable_state === 'unstable' && rule.mergeUnstable)))
        ? {
            mergeable: true,
            mergeable_state: 'clean',
            rebaseable: incomingPR.rebaseable
          }
        : await this.isMergeable(prNumber, { maxRetries: config.isMergeableMaxRetries || undefined })
      this.logger.debug(`[${this.config.repoPath}]#${prNumber} mergeable:${mergeableStatus && mergeableStatus.mergeable}/rebaseable:${mergeableStatus && mergeableStatus.rebaseable}`)

      if (mergeableStatus && mergeableStatus.mergeable) {
        if (rule.mergeMethod === 'hardreset') {
          this.logger.debug(`[${this.config.repoPath}]#${prNumber} Performing hard reset`)
          try {
            await this.hardResetCommit(incomingPR.base.ref, incomingPR.head.sha)
            this.logger.info(`[${this.config.repoPath}]#${prNumber} Hard reset successful`)
            return true
          } catch (e) {
            this.logger.info({ e }, `[${this.config.repoPath}]#${prNumber} Hard reset failed`)
          }
        } else {
          let mergeMethod = rule.mergeMethod
          if (mergeMethod === 'rebase' && !mergeableStatus.rebaseable) {
            mergeMethod = 'merge'
          }
          await this.mergePR(prNumber, mergeMethod)
          this.logger.info(`[${this.config.repoPath}]#${prNumber} Auto merged pull request using ${mergeMethod}`)
          return true
        }
      }
    } else {
      this.logger.debug(`[${this.config.repoPath}]#${prNumber} Skip processing`)
    }
    return false
  }

  async hasDiff (base, upstream) {
    try {
      // TODO Remove encodeURIComponent after upgrading to probot@v10 or octokit/rest@v17 or above
      const comparison = await this.github.repos.compareCommits({
        owner: this.config.owner,
        repo: this.config.repo,
        head: encodeURIComponent(upstream),
        base: encodeURIComponent(base)
      })
      return comparison.data.total_commits > 0
    } catch (e) {
      if (e.message.match(/this diff is taking too long to generate/i)) {
        return true
      } else if (e.message.match(/not found/i)) {
        this.logger.debug(`[${this.config.repoPath}] ${this.config.owner}:${base}...${upstream} Not found`)
        return false
      } else if (e.message.match(/no common ancestor/i)) {
        this.logger.debug(`[${this.config.repoPath}] ${this.config.owner}:${base}...${upstream} No common ancestor`)
        return false
      } else {
        this.logger.warn({
          err: e,
          owner: this.config.owner,
          repo: this.config.repo,
          head: upstream
        }, `[${this.config.repoPath}] Unable to fetch diff`)
        return false
      }
    }
  }

  async getOpenPR (base, head) {
    const res = await this.github.issues.listForRepo({
      owner: this.config.owner,
      repo: this.config.repo,
      creator: 'pull[bot]',
      per_page: 100
    })
    if (res.data.length > 0) {
      for (let i = 0; i < res.data.length; i++) {
        const pr = await this.github.pulls.get({
          owner: this.config.owner,
          repo: this.config.repo,
          pull_number: res.data[i].number
        })
        if (
          pr.data &&
          pr.data.user.login === 'pull[bot]' &&
          pr.data.base.label.replace(`${this.config.owner}:`, '') === base.replace(`${this.config.owner}:`, '') &&
          pr.data.head.label.replace(`${this.config.owner}:`, '') === head.replace(`${this.config.owner}:`, '')
        ) {
          return pr.data
        }
      }
    }
    return null
  }

  async createPR (base, upstream, assignees, reviewers) {
    try {
      const createdPR = await this.github.pulls.create({
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

      await this.github.issues.update({
        owner: this.config.owner,
        repo: this.config.repo,
        issue_number: createdPR.data.number,
        assignees,
        labels: [this.config.label],
        body: helper.getPRBody(this.config.repoPath, prNumber)
      })

      await this.addReviewers(prNumber, reviewers)

      this.logger.debug(`[${this.config.repoPath}]#${prNumber} Updated pull request`)

      const pr = await this.github.pulls.get({
        owner: this.config.owner,
        repo: this.config.repo,
        pull_number: createdPR.data.number
      })
      return pr.data
    } catch (e) {
      this.logger.info(e, `[${this.config.repoPath}] Create PR from ${upstream} failed`)
      return null
    }
  }

  async isMergeable (prNumber, config = {}) {
    const maxRetries = config.maxRetries || 3
    let i = 0
    while (i++ < maxRetries) {
      const createdPR = await this.github.pulls.get({
        owner: this.config.owner,
        repo: this.config.repo,
        pull_number: prNumber
      })
      this.logger.debug(`[${this.config.repoPath}]#${prNumber} Mergeability is ${createdPR.data.mergeable_state}`)
      // Retry if mergeable is null
      if (typeof createdPR.data.mergeable === 'boolean' && createdPR.data.mergeable_state !== 'unknown') {
        return (createdPR.data.mergeable && createdPR.data.mergeable_state === 'clean') && {
          mergeable: true,
          mergeable_state: 'clean',
          rebaseable: createdPR.data.rebaseable
        }
      }
      await helper.timeout(4500)
    }
    return null
  }

  async addReviewers (prNumber, allReviewers) {
    if (!prNumber || !allReviewers || allReviewers.length === 0) return null
    const reviewers = allReviewers.filter(r => !r.includes('/'))
    const teamReviewers = allReviewers.filter(r => r.includes('/')).map(r => r.split('/')[1])
    return this.github.pulls.createReviewRequest({
      owner: this.config.owner,
      repo: this.config.repo,
      pull_number: prNumber,
      team_reviewers: teamReviewers,
      reviewers
    })
  }

  async addLabel (label, color = 'ededed', desc = '') {
    if (!label) return null
    return this.github.issues.createLabel({
      owner: this.config.owner,
      repo: this.config.repo,
      name: label,
      color: color,
      description: desc
    })
  }

  async mergePR (prNumber, merge_method = 'merge') {
    if (!prNumber) return null
    return this.github.pulls.merge({
      owner: this.config.owner,
      repo: this.config.repo,
      merge_method,
      pull_number: prNumber
    })
  }

  async hardResetCommit (baseRef, sha) {
    if (!baseRef || !sha) return null
    return this.github.git.updateRef({
      owner: this.config.owner,
      repo: this.config.repo,
      ref: `heads/${baseRef}`,
      sha,
      force: true
    })
  }
}
