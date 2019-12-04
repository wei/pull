const Joi = require('joi')

const fields = {

  version: Joi.string()
    .description('Version number (string)'),

  branch: Joi.string()
    .description('Destination local branch'),

  upstream: Joi.string()
    .description('Upstream owner:branch'),

  autoMerge: Joi.boolean()
    .description('Deprecated: Set to true to auto merge pull requests (defaults to false)'),

  autoMergeHardReset: Joi.boolean()
    .description('Deprecated: Attempt to hard reset to upstream\'s latest commit'),

  mergeMethod: Joi.string().valid('none', 'merge', 'squash', 'rebase', 'hardreset')
    .description('Auto merge pull request using this merge method. one of [none, merge, squash, rebase, hardreset], Default: none'),

  assignees: Joi.array().items(Joi.string())
    .description('Assignees for the pull requests'),

  reviewers: Joi.array().items(Joi.string())
    .description('Reviewers for the pull requests'),

  conflictReviewers: Joi.array().items(Joi.string())
    .description('Merge Conflict Reviewers for the the pull requests'),

  label: Joi.string()
    .description('Label for the pull requests')
}

const ruleSchemaWithDeprecation = Joi.object().keys({
  base: fields.branch.required(),
  upstream: fields.upstream.required(),
  autoMerge: fields.autoMerge.default(false), // Deprecated, use mergeMethod
  autoMergeHardReset: fields.autoMerge.default(false), // Deprecated, use mergeMethod
  mergeMethod: fields.mergeMethod.default('none'),
  assignees: fields.assignees.default([]),
  reviewers: fields.assignees.default([]),
  conflictReviewers: fields.assignees.default([])
}).options({ stripUnknown: true }).required()

const schemaWithDeprecation = Joi.object().keys({
  version: fields.version.required(),
  rules: Joi.array().items(ruleSchemaWithDeprecation).min(1).unique().required(),
  label: fields.label.default(':arrow_heading_down: pull')
}).options({ stripUnknown: true }).required()

const ruleSchema = Joi.object().keys({
  base: fields.branch.required(),
  upstream: fields.upstream.required(),
  mergeMethod: fields.mergeMethod.default('none'),
  assignees: fields.assignees.default([]),
  reviewers: fields.assignees.default([]),
  conflictReviewers: fields.assignees.default([])
}).options({ stripUnknown: true }).required()

const schema = Joi.object().keys({
  version: fields.version.required(),
  rules: Joi.array().items(ruleSchema).min(1).unique().required(),
  label: fields.label.default(':arrow_heading_down: pull')
}).options({ stripUnknown: true }).required()

module.exports = {
  schema,
  schemaWithDeprecation
}
