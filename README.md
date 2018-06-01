<img align="right" width="120" height="120" src="https://user-images.githubusercontent.com/5880908/40619990-2deb6502-6265-11e8-88c3-f2bcbac74a42.png" />

# Pull

[![TravisCI](https://travis-ci.com/wei/pull.svg?branch=master)](https://travis-ci.com/wei/pull)
[![Codecov](https://codecov.io/gh/wei/pull/branch/master/graph/badge.svg)](https://codecov.io/gh/wei/pull)
[![Depfu](https://badges.depfu.com/badges/4a6fdae34a957e6c1ac11a83f6491162/overview.svg)](https://depfu.com/github/wei/pull)
<br/>
[![Probot](https://img.shields.io/badge/built%20with-probot-orange.svg)](https://probot.github.io/)
[![JavaScript Style Guide](https://img.shields.io/badge/code_style-standard-brightgreen.svg)](https://standardjs.com)
[![jest](https://facebook.github.io/jest/img/jest-badge.svg)](https://github.com/facebook/jest)
[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](https://wei.mit-license.org)

> 🤖 a GitHub App built with [probot](https://github.com/probot/probot) that keeps your repository up-to-date with upstream changes via automated pull requests.


## Features

 1. A pull request is created when an upstream is updated (checks periodically).
 2. Pull requests can be automatically merged or hard reset to match upstream.

_Upstream must be in the same fork network_


## Setup

Recommended setup:
 1. Fork a repository
 2. Create a new branch
 3. Setup the new branch as Default branch under repository Settings > Branches
 4. Add `.github/pull.yml` to your default branch.

Most common `pull.xml`:
```yaml
version: "1"
rules:
  - head: master
    upstream: wei:master
    autoMerge: true
    autoMergeHardReset: true
```

Explained:
```yaml
version: "1"
rules:                           # Array of branches to pull
  - head: master                 # Required. Target local branch
    upstream: wei:master         # Required. Must be in the same fork network.
    autoMerge: true              # Optional, Default: false
    autoMergeHardReset: true     # Optional, Default: false DESTRUCTIVE!! Remove merge commits along with any changes to the target local branch
  - head: dev
    upstream: master
    assignees:                   # Optional
      - wei
    reviewers:                   # Optional
      - wei
label: "pull :arrow_down:" # Optional
```

 5. Go to `https://pull.now.sh/check/:owner/:repo` to validate your `pull.yml`.
 6. Install Pull app via https://github.com/apps/pull and select only the repos you wish to pull.


## Author
[Wei He](https://github.com/wei) _github@weispot.com_


## License
[MIT](https://wei.mit-license.org)
