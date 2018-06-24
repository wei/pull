<a href="https://github.com/apps/pull"><img align="right" width="120" height="120" src="https://cdn.rawgit.com/wei/40d98877c6ac5f917d78ccfe72a0f928/raw/0f6ee2e8715412295998e68754027505f30d0f91/pull.svg" /></a>

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

:warning:**Before you start:** _Create a new branch if you have made changes to your fork's default (master) branch._


### Basic setup (without config):

 1. Run `git clone --mirror` to make a backup (Recommended if you have made changes).
 2. Install **[![Pull](https://cdn.rawgit.com/wei/40d98877c6ac5f917d78ccfe72a0f928/raw/0f6ee2e8715412295998e68754027505f30d0f91/pull-18h.svg) Pull app](https://github.com/apps/pull)**.
 3. With zero-configuration, Pull app will automatically watch and pull in upstream's default (master) branch to yours with **hard reset**.

:bulb:_Do NOT touch default (master) branch in any forks. Always create new branches to work on._


### Recommended setup (with config):

 1. Run `git clone --mirror` to make a backup (optional).
 2. Create a new branch.
 3. Setup the new branch as default branch under repository Settings > Branches.
 4. Add `.github/pull.yml` to your default branch.

#### Most common
(Basic setup default)

```yaml
version: "1"
rules:
  - base: master
    upstream: wei:master        # change wei to the owner of upstream repo
    autoMerge: true
    autoMergeHardReset: true
```

#### Advanced usage
```yaml
version: "1"
rules:                           # Array of rules
  - base: master                 # Required. Target branch
    upstream: wei:master         # Required. Must be in the same fork network.
    autoMerge: true              # Optional, Default: false
    autoMergeHardReset: true     # Optional, Default: false DANGEROUS Wipes target branch changes and reset ref to match upstream
  - base: dev
    upstream: master
    assignees:                   # Optional
      - wei
    reviewers:                   # Optional
      - wei
label: ":arrow_heading_down: pull"       # Optional
```

 5. Go to `https://pull.now.sh/check/:owner/:repo` to validate your `.github/pull.yml`.
 6. Install **[![Pull](https://cdn.rawgit.com/wei/40d98877c6ac5f917d78ccfe72a0f928/raw/0f6ee2e8715412295998e68754027505f30d0f91/pull-18h.svg) Pull app](https://github.com/apps/pull)**.


## For Repository Owners

If you have a popular repo with a fork network, consider adding `.github/pull.yml` to your repository pointing to yourself (see example). This will allow forks to install Pull and stay updated with zero-configuration.

Example (assuming `owner` is your user or organization name):
```yaml
version: "1"
rules:
  - base: master
    upstream: owner:master
    autoMerge: true
    autoMergeHardReset: true
  - base: docs
    upstream: owner:docs
    autoMerge: true
    autoMergeHardReset: true
```


## Author
[Wei He](https://github.com/wei) _github@weispot.com_


## License
[MIT](https://wei.mit-license.org)
