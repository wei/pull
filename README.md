<img align="right" width="120" height="120" src="https://user-images.githubusercontent.com/5880908/40619990-2deb6502-6265-11e8-88c3-f2bcbac74a42.png" />

# Sync Up

[![TravisCI](https://travis-ci.com/wei/sync-up.svg?branch=master)](https://travis-ci.com/wei/sync-up)
[![Codecov](https://codecov.io/gh/wei/sync-up/branch/master/graph/badge.svg)](https://codecov.io/gh/wei/sync-up)
[![Depfu](https://img.shields.io/depfu/wei/sync-up.svg)](https://depfu.com/github/wei/sync-up)
<br/>
[![Probot](https://img.shields.io/badge/built%20with-probot-orange.svg)](https://probot.github.io/)
[![JavaScript Style Guide](https://img.shields.io/badge/code_style-standard-brightgreen.svg)](https://standardjs.com)
[![jest](https://facebook.github.io/jest/img/jest-badge.svg)](https://github.com/facebook/jest)
[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](https://wei.mit-license.org)

> a GitHub App built with [probot](https://github.com/probot/probot) that keeps your repository up-to-date with upstream changes via automatic pull requests.


## Features

 1. A pull request is created when a specified upstream is updated (checking periodically).
 2. The pull request can be automatically merged.
_Upstream must be in the same fork network_

## Setup

Recommended setup:
 1. Fork a repository
 2. Create a new branch
 3. Setup the new branch as Default branch under repository Settings > Branches
 4. Add `.github/sync-up.yml` to your default branch.

```yaml
version: "1"
rules: # Array of branches to sync
  master:
    upstream: wei:master # Required. Must be in the same fork network
    autoMerge: true # Optional, Default: false
    autoMergeHardReset: true # Optional, Default: false. Dangerous!! Remove merge commits along with any changes to the specified branch
  dev:
    upstream: master
label: "sync-up :arrow_up_down:" # Optional
assignees: # Optional
  - wei
reviewers: # Optional
  - wei
```

 5. Install Sync Up app via https://github.com/apps/sync-up and select only the repos you wish to sync up.

## Author
[Wei He](https://github.com/wei) _github@weispot.com_

## License
[MIT](https://wei.mit-license.org)
