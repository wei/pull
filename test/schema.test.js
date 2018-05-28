/* eslint-env node, jest */

const schema = require('../lib/schema')

const validConfigs = [
  [{ version: '1', rules: {} }],
  [{ version: '1', rules: { master: { upstream: 'upstream:master' } } }],
  [{ version: '1', rules: { master: { upstream: 'upstream:master', autoMerge: true } }, label: 'sync-up' }],
  [{ version: '1', rules: { master: { upstream: 'upstream:master', autoMerge: true } }, assignees: ['wei'] }],
  [{ version: '1', rules: { master: { upstream: 'upstream:master', autoMerge: false } }, reviewers: ['wei'] }],
  [{ version: '1', rules: { master: { upstream: 'upstream:master', autoMerge: true }, development: { upstream: 'upstream:development', autoMerge: false, autoMergeHardReset: true } } }],
  [{
    version: '1',
    rules: {
      master: { upstream: 'upstream:master', autoMerge: true, autoMergeHardReset: true },
      development: { upstream: 'upstream:development', autoMerge: false, autoMergeHardReset: true }
    },
    assignees: ['wei'],
    reviewers: ['wei'],
    label: 'sync-up'
  }]
]

const invalidConfigs = [
  [{ }, '"version" is required'],
  [{ rules: {} }, '"version" is required'],
  [{ version: 1 }, '"version" must be a string'],
  [{ version: '' }, '"version" is not allowed to be empty'],
  [{ version: '1' }, '"rules" is required'],
  [{ version: '1', rules: { }, label: 1 }, '"label" must be a string'],
  [{ version: '1', rules: { }, label: '' }, '"label" is not allowed to be empty'],
  [{ version: '1', rules: { }, assignees: '' }, '"assignees" must be an array'],
  [{ version: '1', rules: { }, reviewers: '' }, '"reviewers" must be an array'],
  [{ version: '1', rules: { master: {} } }, '"upstream" is required'],
  [{ version: '1', rules: { master: { upstream: '' } } }, '"upstream" is not allowed to be empty'],
  [{ version: '1', rules: { master: { upstream: 'upstream:master' }, development: { } } }, '"upstream" is required'],
  [{ version: '1', rules: { master: { upstream: 'upstream:master' }, development: { upstream: '' } } }, '"upstream" is not allowed to be empty'],
  [{ version: '1', rules: { master: { upstream: 'upstream:master', autoMerge: 1 } } }, '"autoMerge" must be a boolean'],
  [{ version: '1', rules: { master: { upstream: 'upstream:master', autoMerge: '' } } }, '"autoMerge" must be a boolean'],
  [{ version: '1', rules: { master: { upstream: 'upstream:master', autoMerge: true }, development: { upstream: 'upstream:development', autoMerge: 1, autoMergeHardReset: true } } }, '"autoMerge" must be a boolean'],
  [{ version: '1', rules: { master: { upstream: 'upstream:master', autoMerge: true }, development: { upstream: 'upstream:development', autoMerge: false, autoMergeHardReset: '' } } }, '"autoMergeHardReset" must be a boolean'],
  [{ version: '1', rules: { master: { upstream: 'upstream:master', autoMerge: true, autoMergeHardReset: 1 } } }, '"autoMergeHardReset" must be a boolean'],
  [{ version: '1', rules: { master: { upstream: 'upstream:master', autoMerge: true, autoMergeHardReset: '' } } }, '"autoMergeHardReset" must be a boolean']
]

describe('schema', () => {
  test('defaults', async () => {
    expect(schema.validate({ version: '1', rules: { master: { upstream: 'upstream:master' } } }).value).toEqual({
      version: '1',
      rules: {
        master: {
          upstream: 'upstream:master',
          autoMerge: false,
          autoMergeHardReset: false
        }
      },
      label: 'sync-up :arrow_up_down:',
      assignees: [],
      reviewers: []
    })
  })

  validConfigs.forEach(([example, expected = example]) => {
    test(`${JSON.stringify(example)} is valid`, () => {
      const { error, value } = schema.validate(example)
      expect(error).toBe(null)
      expect(value).toMatchObject(expected)
    })
  })

  invalidConfigs.forEach(([example, message]) => {
    test(`${JSON.stringify(example)} is invalid`, () => {
      const { error } = schema.validate(example)
      expect(error && error.toString()).toMatch(message)
    })
  })
})
