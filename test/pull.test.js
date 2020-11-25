/* eslint-env node, jest */

process.env.LOG_LEVEL = 'fatal'

const { Application } = require('probot')
const Pull = require('../lib/pull')
const helper = require('../lib/helper')

let app
let github

beforeEach(() => {
  app = new Application()

  // Mock out the GitHub API
  github = {
    repos: {
      compareCommits: jest.fn()
    },
    pulls: {
      create: jest.fn(),
      get: jest.fn(),
      createReviewRequest: jest.fn(),
      merge: jest.fn()
    },
    issues: {
      update: jest.fn(),
      listForRepo: jest.fn(),
      createLabel: jest.fn()
    },
    git: {
      updateRef: jest.fn()
    }
  }

  // Mock out GitHub client
  app.auth = () => Promise.resolve(github)

  // TODO
  // app.log = console
})

const goodConfig = {
  version: '1',
  rules: [
    {
      base: 'master',
      upstream: 'upstream:master',
      mergeMethod: 'none',
      assignees: [],
      reviewers: [],
      conflictReviewers: []
    },
    {
      base: 'feature/new-1',
      upstream: 'upstream:dev',
      mergeMethod: 'rebase',
      assignees: ['tom'],
      reviewers: ['jerry', 'org/team-1'],
      conflictReviewers: ['spike']
    },
    {
      base: 'hotfix/bug-1',
      upstream: 'upstream:dev',
      mergeMethod: 'hardreset',
      assignees: ['wei'],
      reviewers: ['wei'],
      conflictReviewers: ['saurabh702']
    }
  ],
  label: 'pull',
  conflictLabel: 'merge-conflict'
}
const getPull = () => new Pull(github, { owner: 'wei', repo: 'fork', logger: app.log }, goodConfig)

describe('pull - routineCheck', () => {
  test('bad config', async () => {
    try {
      new Pull(github, { owner: 'wei', repo: 'fork', logger: app.log })  // eslint-disable-line
      throw Error('Should throw error and go to catch')
    } catch (e) {
      expect(e.message).toEqual('Invalid config')
    }
  })

  test('logger fall back to console', async () => {
    const pull = new Pull(github, { owner: 'wei', repo: 'fork' }, goodConfig)
    expect(pull.logger).toBe(console)
  })

  test('same branch', async () => {
    const configs = [
      { version: '1', rules: [{ base: 'master', upstream: 'master' }] },
      { version: '1', rules: [{ base: 'master', upstream: 'wei:master' }] }
    ]

    for (let i = 0; i < configs.length; i++) {
      const pull = new Pull(github, { owner: 'wei', repo: 'fork', logger: app.log }, configs[i])
      await pull.routineCheck()
      expect(github.repos.compareCommits).not.toHaveBeenCalled()
      expect(github.issues.listForRepo).not.toHaveBeenCalled()
      expect(github.pulls.create).not.toHaveBeenCalled()
      expect(github.issues.update).not.toHaveBeenCalled()
    }
  })

  test('no diff', async () => {
    github.repos.compareCommits.mockResolvedValue({ data: { total_commits: 0 } })

    const pull = getPull()
    await pull.routineCheck()
    expect(github.repos.compareCommits).nthCalledWith(1, {
      owner: 'wei', repo: 'fork', base: 'master', head: 'upstream%3Amaster'
    })
    expect(github.repos.compareCommits).nthCalledWith(3, {
      owner: 'wei', repo: 'fork', base: 'hotfix%2Fbug-1', head: 'upstream%3Adev'
    })
    expect(github.repos.compareCommits).nthCalledWith(2, {
      owner: 'wei', repo: 'fork', base: 'feature%2Fnew-1', head: 'upstream%3Adev'
    })
    expect(github.issues.listForRepo).not.toHaveBeenCalled()
    expect(github.pulls.create).not.toHaveBeenCalled()
    expect(github.issues.update).not.toHaveBeenCalled()
  })

  test('diff too large', async () => {
    github.repos.compareCommits.mockImplementation(() => { throw Error('Server Error: Sorry, this diff is taking too long to generate.') })
    github.issues.listForRepo.mockResolvedValue({ data: [] })
    github.pulls.create.mockResolvedValue({
      data: {
        number: 12,
        base: { ref: 'master' },
        head: { ref: 'master', label: 'upstream:master', sha: 'sha1-placeholder-12' },
        state: 'open',
        user: { login: 'pull[bot]' },
        mergeable: true,
        mergeable_state: 'clean'
      }
    })

    const pull = getPull()
    await pull.routineCheck()
    expect(github.repos.compareCommits.mock.calls.length).toBe(3)
    expect(github.issues.listForRepo).toHaveBeenCalled()
    expect(github.pulls.create).toHaveBeenCalled()
    expect(github.issues.update).toHaveBeenCalled()
  })

  test('diff not found', async () => {
    github.repos.compareCommits.mockImplementation(() => { throw Error('Not Found') })

    const pull = getPull()
    await pull.routineCheck()
    expect(github.repos.compareCommits.mock.calls.length).toBe(3)
    expect(github.issues.listForRepo).not.toHaveBeenCalled()
    expect(github.pulls.create).not.toHaveBeenCalled()
    expect(github.issues.update).not.toHaveBeenCalled()
  })

  test('diff no common ancestor', async () => {
    github.repos.compareCommits.mockImplementation(() => { throw Error('No common ancestor between --- and ---:---') })

    const pull = getPull()
    await pull.routineCheck()
    expect(github.repos.compareCommits.mock.calls.length).toBe(3)
    expect(github.issues.listForRepo).not.toHaveBeenCalled()
    expect(github.pulls.create).not.toHaveBeenCalled()
    expect(github.issues.update).not.toHaveBeenCalled()
  })

  test('diff other error', async () => {
    github.repos.compareCommits.mockImplementation(() => { throw Error('Internal Server Error') })

    const pull = getPull()
    await pull.routineCheck()
    expect(github.repos.compareCommits.mock.calls.length).toBe(3)
    expect(github.issues.listForRepo).not.toHaveBeenCalled()
    expect(github.pulls.create).not.toHaveBeenCalled()
    expect(github.issues.update).not.toHaveBeenCalled()
  })

  test('yes diff, already has PR', async () => {
    github.repos.compareCommits.mockResolvedValue({ data: { total_commits: 1 } })
    github.issues.listForRepo.mockResolvedValue({ data: [{ number: 13 }, { number: 12 }, { number: 14 }] })
    github.pulls.get.mockImplementation(({ pull_number: number }) => {
      switch (number) {
        case 12:
          return {
            data: {
              number: 12,
              base: { ref: 'master', label: 'wei:master' },
              head: { ref: 'master', label: 'upstream:master', sha: 'sha1-placeholder-12' },
              state: 'open',
              user: { login: 'pull[bot]' },
              mergeable: true,
              rebaseable: true,
              mergeable_state: 'clean'
            }
          }
        case 13:
          return {
            data: {
              number: 13,
              base: { ref: 'feature/new-1', label: 'wei:feature/new-1' },
              head: { ref: 'dev', label: 'upstream:dev', sha: 'sha1-placeholder-13' },
              state: 'open',
              user: { login: 'pull[bot]' },
              mergeable: true,
              rebaseable: true,
              mergeable_state: 'clean'
            }
          }
        case 14:
          return {
            data: {
              number: 14,
              base: { ref: 'hotfix/bug-1', label: 'wei:hotfix/bug-1' },
              head: { ref: 'dev', label: 'upstream:dev', sha: 'sha1-placeholder-14' },
              state: 'open',
              user: { login: 'pull[bot]' },
              mergeable: true,
              rebaseable: true,
              mergeable_state: 'clean'
            }
          }
        default:
          return { data: null }
      }
    })

    const pull = getPull()
    await pull.routineCheck()
    expect(github.repos.compareCommits).nthCalledWith(1, {
      owner: 'wei', repo: 'fork', base: 'master', head: 'upstream%3Amaster'
    })
    expect(github.issues.listForRepo).toHaveBeenCalled()
    expect(github.pulls.get).nthCalledWith(1, { owner: 'wei', repo: 'fork', pull_number: 13 })
    expect(github.pulls.get).nthCalledWith(2, { owner: 'wei', repo: 'fork', pull_number: 12 })
    expect(github.pulls.merge).not.toHaveBeenCalledWith()

    expect(github.repos.compareCommits).nthCalledWith(2, {
      owner: 'wei', repo: 'fork', base: 'feature%2Fnew-1', head: 'upstream%3Adev'
    })
    expect(github.issues.listForRepo).toHaveBeenCalled()
    expect(github.pulls.get).nthCalledWith(3, { owner: 'wei', repo: 'fork', pull_number: 13 })
    expect(github.pulls.merge).toHaveBeenCalledWith({ owner: 'wei', repo: 'fork', pull_number: 13, merge_method: 'rebase' })

    expect(github.repos.compareCommits).nthCalledWith(3, {
      owner: 'wei', repo: 'fork', base: 'hotfix%2Fbug-1', head: 'upstream%3Adev'
    })
    expect(github.issues.listForRepo).toHaveBeenCalled()
    expect(github.pulls.get).nthCalledWith(4, { owner: 'wei', repo: 'fork', pull_number: 13 })
    expect(github.pulls.get).nthCalledWith(5, { owner: 'wei', repo: 'fork', pull_number: 12 })
    expect(github.pulls.get).nthCalledWith(6, { owner: 'wei', repo: 'fork', pull_number: 14 })
    expect(github.git.updateRef).toHaveBeenCalledWith(
      { owner: 'wei', repo: 'fork', ref: 'heads/hotfix/bug-1', sha: 'sha1-placeholder-14', force: true }
    )

    expect(github.pulls.create).not.toHaveBeenCalled()
    expect(github.issues.update).not.toHaveBeenCalled()
  })

  test('yes diff, no PR, create PR', async () => {
    github.repos.compareCommits.mockResolvedValue({ data: { total_commits: 1 } })
    github.issues.listForRepo
      .mockResolvedValueOnce({ data: [{ number: 10 }] })
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: [] })
    github.pulls.get.mockResolvedValueOnce({
      data: {
        number: 10,
        base: { ref: 'master', label: 'wei:master' },
        head: { ref: 'master', label: 'upstream:master', sha: 'sha1-placeholder' },
        state: 'open',
        user: { login: 'pull[bot]' },
        mergeable: true,
        rebaseable: true,
        mergeable_state: 'clean'
      }
    })
    github.pulls.create
      .mockResolvedValueOnce({ data: { number: 12 } })
      .mockImplementationOnce(() => { throw Error({ code: 512 }) })

    const pull = getPull()
    await pull.routineCheck()
    expect(github.repos.compareCommits).nthCalledWith(1, {
      owner: 'wei', repo: 'fork', base: 'master', head: 'upstream%3Amaster'
    })
    expect(github.repos.compareCommits).nthCalledWith(2, {
      owner: 'wei', repo: 'fork', base: 'feature%2Fnew-1', head: 'upstream%3Adev'
    })
    expect(github.repos.compareCommits).nthCalledWith(3, {
      owner: 'wei', repo: 'fork', base: 'hotfix%2Fbug-1', head: 'upstream%3Adev'
    })
    expect(github.issues.listForRepo).toHaveBeenCalledTimes(3)
    expect(github.pulls.create).toHaveBeenCalledTimes(2)
    expect(github.pulls.create).nthCalledWith(1, {
      owner: 'wei', repo: 'fork', base: 'feature/new-1', head: 'upstream:dev', maintainer_can_modify: false, title: helper.getPRTitle('feature/new-1', 'upstream:dev'), body: helper.getPRBody('wei/fork')
    })
    expect(github.pulls.create).nthCalledWith(2, {
      owner: 'wei', repo: 'fork', base: 'hotfix/bug-1', head: 'upstream:dev', maintainer_can_modify: false, title: helper.getPRTitle('hotfix/bug-1', 'upstream:dev'), body: helper.getPRBody('wei/fork')
    })
    expect(github.issues.update).toHaveBeenCalledTimes(1)
    expect(github.issues.update).nthCalledWith(1, {
      owner: 'wei', repo: 'fork', issue_number: 12, assignees: ['tom'], labels: ['pull'], body: helper.getPRBody('wei/fork', 12)
    })
    expect(github.pulls.createReviewRequest).toHaveBeenCalledTimes(1)
    expect(github.pulls.createReviewRequest).nthCalledWith(1, {
      owner: 'wei', repo: 'fork', pull_number: 12, reviewers: ['jerry'], team_reviewers: ['team-1']
    })
  })
})

describe('pull - checkAutoMerge', () => {
  test('bad parameters', async () => {
    const pull = getPull()
    expect(await pull.checkAutoMerge()).toBeNull()
  })

  test('should honor autoMerge flag', async () => {
    const pull = getPull()
    await pull.checkAutoMerge({
      number: 10,
      base: { ref: 'master', label: 'wei:master' },
      head: { ref: 'master', label: 'upstream:master' },
      state: 'open',
      user: { login: 'pull[bot]' },
      mergeable: true,
      rebaseable: true,
      mergeable_state: 'clean'
    })
    expect(github.pulls.get).not.toHaveBeenCalled()
    expect(github.git.updateRef).not.toHaveBeenCalled()

    github.pulls.get
      .mockResolvedValueOnce({ data: { mergeable: null, mergeable_state: 'unknown' } })
      .mockResolvedValueOnce({ data: { mergeable: true, mergeable_state: 'clean' } })
    await pull.checkAutoMerge({
      number: 12,
      base: { ref: 'feature/new-1' },
      head: { ref: 'dev', label: 'upstream:dev', sha: 'sha1-placeholder' },
      state: 'open',
      user: { login: 'pull[bot]' },
      mergeable: null,
      rebaseable: false,
      mergeable_state: 'unknown'
    })
    expect(github.pulls.get).toHaveBeenCalledTimes(2)
    expect(github.pulls.get).toHaveBeenCalledWith({ owner: 'wei', repo: 'fork', pull_number: 12 })
    expect(github.pulls.merge).toHaveBeenCalledWith({ owner: 'wei', repo: 'fork', pull_number: 12, merge_method: 'merge' })
    expect(github.git.updateRef).not.toHaveBeenCalled()
  })

  test('should honor autoMerge flag with hardreset', async () => {
    const pull = getPull()
    github.pulls.get = jest.fn()
      .mockResolvedValueOnce({ data: { mergeable: null, mergeable_state: 'unknown' } })
      .mockResolvedValueOnce({ data: { mergeable: true, mergeable_state: 'clean' } })
    github.pulls.merge = jest.fn()
    await pull.checkAutoMerge({
      number: 16,
      base: { ref: 'hotfix/bug-1' },
      head: { ref: 'dev', label: 'upstream:dev', sha: 'sha1-placeholder' },
      state: 'open',
      user: { login: 'pull[bot]' },
      mergeable: null,
      mergeable_state: 'unknown'
    })
    expect(github.pulls.get).toHaveBeenCalledTimes(2)
    expect(github.pulls.get).toHaveBeenCalledWith({ owner: 'wei', repo: 'fork', pull_number: 16 })
    expect(github.pulls.merge).not.toHaveBeenCalled()
    expect(github.git.updateRef).toHaveBeenCalledWith(
      { owner: 'wei', repo: 'fork', ref: 'heads/hotfix/bug-1', sha: 'sha1-placeholder', force: true }
    )
  })

  test('should not merge if mergeablity is null', async () => {
    github.pulls.get.mockResolvedValueOnce({ data: { mergeable: null, mergeable_state: 'unknown' } })

    const pull = getPull()
    await pull.checkAutoMerge({
      number: 12,
      base: { ref: 'feature/new-1' },
      head: { ref: 'dev', label: 'upstream:dev', sha: 'sha1-placeholder' },
      state: 'open',
      user: { login: 'pull[bot]' },
      mergeable: null,
      rebaseable: false,
      mergeable_state: 'unknown'
    }, { isMergeableMaxRetries: 1 })
    expect(github.pulls.get).toHaveBeenCalledTimes(1)
    expect(github.pulls.get).toHaveBeenCalledWith({ owner: 'wei', repo: 'fork', pull_number: 12 })
    expect(github.git.updateRef).not.toHaveBeenCalled()
  })

  test('should assign conflict reviewer if mergeablity is false', async () => {
    github.pulls.get.mockResolvedValueOnce({ data: { mergeable: false } })

    const pull = getPull()
    await pull.checkAutoMerge({
      number: 12,
      base: { ref: 'feature/new-1' },
      head: { ref: 'dev', label: 'upstream:dev', sha: 'sha1-placeholder' },
      state: 'open',
      user: { login: 'pull[bot]' },
      mergeable: false
    }, { conflictReviewers: ['wei', 'saurabh702'] })

    try {
      expect(github.issues.getLabel).toHaveBeenCalledTimes(1)
    } catch (e) {
      expect(pull.addLabel(pull.config.conflictLabel, 'ff0000', 'Resolve conflicts manually')).resolves.not.toBeNull()
    }

    expect(github.issues.update).toHaveBeenCalledTimes(1)
    expect(pull.addReviewers(12, ['wei', 'saurabh702'])).resolves.not.toBeNull()
  })

  test('should not merge if mergeable_status is dirty', async () => {
    github.pulls.get.mockResolvedValueOnce({ data: { mergeable: null, rebaseable: false, mergeable_state: 'unknown' } })
    setTimeout(() => {
      github.pulls.get.mockResolvedValue({ data: { mergeable: false, rebaseable: false, mergeable_state: 'dirty' } })
    }, 500)

    const pull = getPull()
    await pull.checkAutoMerge({
      number: 12,
      base: { ref: 'feature/new-1' },
      head: { ref: 'dev', label: 'upstream:dev', sha: 'sha1-placeholder' },
      state: 'open',
      user: { login: 'pull[bot]' },
      mergeable: null,
      mergeable_state: 'unknown'
    }, { isMergeableMaxRetries: 2 })
    expect(github.pulls.get).toHaveBeenCalledTimes(2)
    expect(github.pulls.get).toHaveBeenCalledWith({ owner: 'wei', repo: 'fork', pull_number: 12 })
    expect(github.git.updateRef).not.toHaveBeenCalled()
  })

  test('should merge if mergeable_status is unstable and mergeUnstable flag is set to true', async () => {
    github.pulls.get.mockResolvedValueOnce({ data: { mergeable: true, rebaseable: false, mergeable_state: 'clean' } })

    const config = { version: '1', rules: [{ base: 'dev', upstream: 'master', mergeMethod: 'merge', mergeUnstable: true }] }
    const pull = new Pull(github, { owner: 'wei', repo: 'fork', logger: app.log }, config)
    await pull.checkAutoMerge({
      number: 12,
      base: { ref: 'dev' },
      head: { ref: 'master', label: 'wei:master', sha: 'sha1-placeholder' },
      state: 'open',
      user: { login: 'pull[bot]' },
      mergeable: true,
      rebaseable: false,
      mergeable_state: 'unstable'
    })
    expect(github.pulls.get).toHaveBeenCalledTimes(0)
    expect(github.pulls.merge).toHaveBeenCalledWith({ owner: 'wei', repo: 'fork', pull_number: 12, merge_method: 'merge' })
    expect(github.git.updateRef).not.toHaveBeenCalled()
  })

  test('hard reset failed', async () => {
    github.pulls.get.mockResolvedValueOnce({ data: { mergeable: true, rebaseable: true, mergeable_state: 'clean' } })
    github.git.updateRef.mockRejectedValue(new Error('Update reference failed'))

    const pull = getPull()
    await pull.checkAutoMerge({
      number: 12,
      base: { ref: 'hotfix/bug-1' },
      head: { ref: 'dev', label: 'upstream:dev', sha: 'sha1-placeholder' },
      state: 'open',
      user: { login: 'pull[bot]' },
      mergeable: null,
      rebaseable: false,
      mergeable_state: 'unknown'
    })
    expect(github.pulls.get).toHaveBeenCalledTimes(1)
    expect(github.pulls.get).toHaveBeenCalledWith({ owner: 'wei', repo: 'fork', pull_number: 12 })
    expect(github.git.updateRef).toHaveBeenCalledWith(
      { owner: 'wei', repo: 'fork', ref: 'heads/hotfix/bug-1', sha: 'sha1-placeholder', force: true }
    )
  })

  test('should handle same repo auto merge with method: merge', async () => {
    github.pulls.get.mockResolvedValueOnce({ data: { mergeable: true, rebaseable: true, mergeable_state: 'clean' } })

    const config = { version: '1', rules: [{ base: 'dev', upstream: 'master', mergeMethod: 'merge' }] }
    const pull = new Pull(github, { owner: 'wei', repo: 'fork', logger: app.log }, config)
    await pull.checkAutoMerge({
      number: 16,
      base: { ref: 'dev' },
      head: { ref: 'master', label: 'wei:master', sha: 'sha1-placeholder' },
      state: 'open',
      user: { login: 'pull[bot]' },
      mergeable: null,
      rebaseable: false,
      mergeable_state: 'unknown'
    })
    expect(github.pulls.get).toHaveBeenCalledTimes(1)
    expect(github.pulls.get).toHaveBeenCalledWith({ owner: 'wei', repo: 'fork', pull_number: 16 })
    expect(github.pulls.merge).toHaveBeenCalledWith({ owner: 'wei', repo: 'fork', pull_number: 16, merge_method: 'merge' })
    expect(github.git.updateRef).not.toHaveBeenCalled()
  })

  test('should handle same repo auto merge with method: squash', async () => {
    github.pulls.get.mockResolvedValueOnce({ data: { mergeable: true, rebaseable: true, mergeable_state: 'clean' } })

    const config = { version: '1', rules: [{ base: 'dev', upstream: 'master', mergeMethod: 'squash' }] }
    const pull = new Pull(github, { owner: 'wei', repo: 'fork', logger: app.log }, config)
    await pull.checkAutoMerge({
      number: 16,
      base: { ref: 'dev' },
      head: { ref: 'master', label: 'wei:master', sha: 'sha1-placeholder' },
      state: 'open',
      user: { login: 'pull[bot]' },
      mergeable: null,
      rebaseable: false,
      mergeable_state: 'unknown'
    })
    expect(github.pulls.get).toHaveBeenCalledTimes(1)
    expect(github.pulls.get).toHaveBeenCalledWith({ owner: 'wei', repo: 'fork', pull_number: 16 })
    expect(github.pulls.merge).toHaveBeenCalledWith({ owner: 'wei', repo: 'fork', pull_number: 16, merge_method: 'squash' })
    expect(github.git.updateRef).not.toHaveBeenCalled()
  })

  test('should handle same repo auto merge with method: rebase', async () => {
    github.pulls.get.mockResolvedValueOnce({ data: { mergeable: true, rebaseable: true, mergeable_state: 'clean' } })

    const config = { version: '1', rules: [{ base: 'dev', upstream: 'master', mergeMethod: 'rebase' }] }
    const pull = new Pull(github, { owner: 'wei', repo: 'fork', logger: app.log }, config)
    await pull.checkAutoMerge({
      number: 16,
      base: { ref: 'dev' },
      head: { ref: 'master', label: 'wei:master', sha: 'sha1-placeholder' },
      state: 'open',
      user: { login: 'pull[bot]' },
      mergeable: null,
      rebaseable: false,
      mergeable_state: 'unknown'
    })
    expect(github.pulls.get).toHaveBeenCalledTimes(1)
    expect(github.pulls.get).toHaveBeenCalledWith({ owner: 'wei', repo: 'fork', pull_number: 16 })
    expect(github.pulls.merge).toHaveBeenCalledWith({ owner: 'wei', repo: 'fork', pull_number: 16, merge_method: 'rebase' })
    expect(github.git.updateRef).not.toHaveBeenCalled()
  })

  test('should handle same repo auto merge with method: rebase failover to merge', async () => {
    github.pulls.get.mockResolvedValueOnce({ data: { mergeable: true, rebaseable: false, mergeable_state: 'clean' } })

    const config = { version: '1', rules: [{ base: 'dev', upstream: 'master', mergeMethod: 'rebase' }] }
    const pull = new Pull(github, { owner: 'wei', repo: 'fork', logger: app.log }, config)
    await pull.checkAutoMerge({
      number: 16,
      base: { ref: 'dev' },
      head: { ref: 'master', label: 'wei:master', sha: 'sha1-placeholder' },
      state: 'open',
      user: { login: 'pull[bot]' },
      mergeable: null,
      rebaseable: false,
      mergeable_state: 'unknown'
    })
    expect(github.pulls.get).toHaveBeenCalledTimes(1)
    expect(github.pulls.get).toHaveBeenCalledWith({ owner: 'wei', repo: 'fork', pull_number: 16 })
    expect(github.pulls.merge).toHaveBeenCalledWith({ owner: 'wei', repo: 'fork', pull_number: 16, merge_method: 'merge' })
    expect(github.git.updateRef).not.toHaveBeenCalled()
  })
})

describe('pull - misc', () => {
  test('functions with bad parameters', async () => {
    github.pulls.get.mockResolvedValueOnce({ data: { mergeable: true, rebaseable: true, mergeable_state: 'clean' } })

    const pull = getPull()
    await pull.isMergeable(12)
    expect(github.pulls.get).toHaveBeenCalledTimes(1)
    await expect(pull.addReviewers()).resolves.toBeNull()
    await expect(pull.addReviewers(12)).resolves.toBeNull()
    await expect(pull.addReviewers(12, [])).resolves.toBeNull()
    await expect(pull.addLabel()).resolves.toBeNull()
    await expect(pull.mergePR()).resolves.toBeNull()
    await expect(pull.mergePR(12)).resolves.not.toBeNull()
    await expect(pull.hardResetCommit()).resolves.toBeNull()
    await expect(pull.hardResetCommit('master')).resolves.toBeNull()
    await expect(pull.hardResetCommit('', 'sha1-placeholder')).resolves.toBeNull()
  })

  test('Deprecated config support: autoMerge and autoMergeHardReset', async () => {
    github.pulls.get.mockResolvedValueOnce({ data: { mergeable: true, rebaseable: true, mergeable_state: 'clean' } })

    const pull = new Pull(github, { owner: 'wei', repo: 'fork', logger: app.log }, {
      version: '1',
      rules: [
        {
          base: 'feature/new-1',
          upstream: 'upstream:dev',
          autoMerge: true,
          assignees: ['tom'],
          reviewers: ['jerry'],
          conflictReviewers: ['spike']
        },
        {
          base: 'hotfix/bug-1',
          upstream: 'upstream:dev',
          autoMerge: true,
          autoMergeHardReset: true,
          assignees: ['wei'],
          reviewers: ['wei'],
          conflictReviewers: ['saurabh702']
        }
      ],
      label: 'pull',
      conflictLabel: 'merge-conflict'
    })

    expect(pull.config.rules[0].mergeMethod).toBe('merge')
    expect(pull.config.rules[1].mergeMethod).toBe('hardreset')
  })
})
