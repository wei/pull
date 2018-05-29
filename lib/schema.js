const Joi = require('joi')

const fields = {

  version: Joi.string()
    .description('Version number (string)'),

  branch: Joi.string()
    .description('Destination local branch'),

  upstream: Joi.string()
    .description('Upstream owner:branch'),

  autoMerge: Joi.boolean()
    .description('Set to true to auto merge pull requests (defaults to false)'),

  autoMergeHardReset: Joi.boolean()
    .description('Attempt to hard reset to upstream\'s latest commit'),

  assignees: Joi.array().items(Joi.string())
    .description('Assignees for the pull requests'),

  reviewers: Joi.array().items(Joi.string())
    .description('Reviewers for the pull requests'),

  label: Joi.string()
    .description('Label for the pull requests')
}

const ruleSchema = Joi.object().keys({
  base: fields.branch.required(),
  upstream: fields.upstream.required(),
  autoMerge: fields.autoMerge.default(false),
  autoMergeHardReset: fields.autoMerge.default(false),
  assignees: fields.assignees.default([]),
  reviewers: fields.assignees.default([])
}).options({ stripUnknown: true }).required()

const schema = Joi.object().keys({
  version: fields.version.required(),
  rules: Joi.array().items(ruleSchema).min(1).unique().required(),
  label: fields.label.default('sync-up :arrow_up_down:')
}).options({ stripUnknown: true }).required()

module.exports = schema
