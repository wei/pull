/* eslint-env node, jest */

const schema = require('../lib/schema')

const validConfigs = [
  [{ version: '1', rules: [{ base: 'master', upstream: 'upstream:master' }] }],
  [{ version: '1', rules: [{ base: 'master', upstream: 'upstream:master', autoMerge: true }], label: 'pull' }],
  [{ version: '1', rules: [{ base: 'master', upstream: 'upstream:master', autoMerge: true, assignees: ['wei'] }] }],
  [{ version: '1', rules: [{ base: 'master', upstream: 'upstream:master', autoMerge: false, reviewers: ['wei'] }] }],
  [{
    version: '1',
    rules: [
      { base: 'master', upstream: 'upstream:master', autoMerge: true },
      { base: 'development', upstream: 'upstream:development', autoMerge: false, autoMergeHardReset: true }
    ]
  }],
  [{
    version: '1',
    rules: [
      { base: 'master', upstream: 'upstream:master', autoMerge: true, autoMergeHardReset: true, assignees: ['wei'] },
      { base: 'development', upstream: 'upstream:development', autoMerge: false, autoMergeHardReset: true, reviewers: ['wei'] }
    ],
    label: 'pull'
  }]
]

const invalidConfigs = [
  [{ }, '"version" is required'],
  [{ rules: {} }, '"version" is required'],
  [{ version: '' }, '"version" is not allowed to be empty'],
  [{ version: '1' }, '"rules" is required'],
  [{ version: '1', rules: [] }, '"rules" does not contain 1 required value(s)'],
  [{ version: '1', rules: [{ base: 'master' }] }, '"rules" does not contain 1 required value(s)'],
  [{ version: 1, rules: [{ base: 'master', upstream: 'upstream:master' }] }, '"version" must be a string'],
  [{ version: '1', rules: [{ base: 'master', upstream: 'upstream:master' }], label: 1 }, '"label" must be a string'],
  [{ version: '1', rules: [{ base: 'master', upstream: 'upstream:master' }], label: '' }, '"label" is not allowed to be empty'],
  [{ version: '1', rules: [{ base: 'master', upstream: 'upstream:master', assignees: '' }] }, '"rules" does not contain 1 required value(s)'],
  [{ version: '1', rules: [{ base: 'master', upstream: 'upstream:master', reviewers: '' }] }, '"rules" does not contain 1 required value(s)'],
  [{ version: '1', rules: [{ base: 'master', upstream: '' }] }, '"rules" does not contain 1 required value(s)'],
  [{ version: '1', rules: [{ base: 'master', autoMerge: 1 }] }, '"rules" does not contain 1 required value(s)'],
  [{ version: '1', rules: [{ base: 'master', autoMerge: '' }] }, '"rules" does not contain 1 required value(s)'],
  [{
    version: '1',
    rules: [{ base: 'master', upstream: 'upstream:master', autoMerge: true, autoMergeHardReset: 1 }]
  }, '"rules" does not contain 1 required value'],
  [{
    version: '1',
    rules: [{ base: 'master', upstream: 'upstream:master', autoMerge: true, autoMergeHardReset: '' }]
  }, '"rules" does not contain 1 required value']
]

describe('schema', () => {
  test('defaults', async () => {
    expect(schema.validate({ version: '1', rules: [{ base: 'master', upstream: 'upstream:master' }] }).value).toEqual({
      version: '1',
      rules: [
        {
          base: 'master',
          upstream: 'upstream:master',
          autoMerge: false,
          autoMergeHardReset: false,
          assignees: [],
          reviewers: []
        }
      ],
      label: 'pull :arrow_down:'
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
