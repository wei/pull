/* eslint-env node, jest */

const schema = require('../lib/schema').schemaWithDeprecation

const validConfigs = [
  [{ version: '1', rules: [{ base: 'master', upstream: 'upstream:master' }] }],
  [{ version: '1', rules: [{ base: 'master', upstream: 'upstream:master', autoMerge: true }], label: 'pull' }],
  [{ version: '1', rules: [{ base: 'master', upstream: 'upstream:master', autoMerge: true, assignees: ['wei'] }] }],
  [{ version: '1', rules: [{ base: 'master', upstream: 'upstream:master', autoMerge: false, reviewers: ['wei'] }] }],
  [{ version: '1', rules: [{ base: 'master', upstream: 'upstream:master', mergeMethod: 'squash', mergeUnstable: true }] }],
  [{ version: '1', rules: [{ base: 'master', upstream: 'upstream:master', mergeMethod: 'hardreset', assignees: ['wei'] }] }],
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
  { },
  { rules: {} },
  { version: '' },
  { version: '1' },
  { version: '1', rules: [] },
  { version: '1', rules: [{ base: 'master' }] },
  { version: 1, rules: [{ base: 'master', upstream: 'upstream:master' }] },
  { version: '1', rules: [{ base: 'master', upstream: 'upstream:master' }], label: 1 },
  { version: '1', rules: [{ base: 'master', upstream: 'upstream:master' }], label: '' },
  { version: '1', rules: [{ base: 'master', upstream: 'upstream:master', assignees: '' }] },
  { version: '1', rules: [{ base: 'master', upstream: 'upstream:master', reviewers: '' }] },
  { version: '1', rules: [{ base: 'master', upstream: '' }] },
  { version: '1', rules: [{ base: 'master', autoMerge: 1 }] },
  { version: '1', rules: [{ base: 'master', autoMerge: '' }] },
  [{ version: '1', rules: [{ base: 'master', upstream: 'upstream:master', mergeMethod: '' }] }],
  [{ version: '1', rules: [{ base: 'master', upstream: 'upstream:master', mergeMethod: 'invalid' }] }],
  [{ version: '1', rules: [{ base: 'master', upstream: 'upstream:master', mergeMethod: true }] }],
  {
    version: '1',
    rules: [{ base: 'master', upstream: 'upstream:master', autoMerge: true, autoMergeHardReset: 1 }]
  },
  {
    version: '1',
    rules: [{ base: 'master', upstream: 'upstream:master', autoMerge: true, autoMergeHardReset: '' }]
  }
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
          mergeMethod: 'none',
          mergeUnstable: false,
          assignees: [],
          reviewers: []
        }
      ],
      label: ':arrow_heading_down: pull'
    })
  })

  validConfigs.forEach(([example, expected = example]) => {
    test(`${JSON.stringify(example)} is valid`, () => {
      const { error, value } = schema.validate(example)
      expect(error).toBe(null)
      expect(value).toMatchObject(expected)
    })
  })

  invalidConfigs.forEach((example) => {
    test(`${JSON.stringify(example)} is invalid`, () => {
      const { error } = schema.validate(example)
      expect(error && error.toString()).toMatchSnapshot()
    })
  })
})
