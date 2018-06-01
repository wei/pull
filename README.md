<a href="https://github.com/apps/pull"><img align="right" width="120" height="120" src="https://user-images.githubusercontent.com/5880908/40619990-2deb6502-6265-11e8-88c3-f2bcbac74a42.png" /></a>

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

### Basic setup (without config):

:warning:**WARNING**

_Make sure you have not made and will not make any changes your fork's default (master) branch. Changes to other branches will not be touched._

 1. Fork a repository.
 2. Make a local backup using `git clone --mirror`.
 3. Install [Pull app](https://github.com/apps/pull) and select only the repos you wish to pull.
 4. With zero-configuration, Pull app will automatically watch and pull in upstream's default (master) branch to yours with **hard reset**.

:bulb:_Do NOT touch default (master) branch in any forked repo, always create new branches to work on._


### Recommended setup (with config):

 1. Fork a repository.
 2. Make a local backup using `git clone --mirror`.
 3. Create a new branch.
 4. Setup the new branch as Default branch under repository Settings > Branches.
 5. Add `.github/pull.yml` to your default branch.

#### Most common
(Basic setup default)

```yaml
version: "1"
rules:
  - head: master
    upstream: wei:master        # change wei to the owner of upstream repo
    autoMerge: true
    autoMergeHardReset: true
```

#### Advanced usage
```yaml
version: "1"
rules:                           # Array of rules
  - head: master                 # Required. Target branch
    upstream: wei:master         # Required. Must be in the same fork network.
    autoMerge: true              # Optional, Default: false
    autoMergeHardReset: true     # Optional, Default: false DANGEROUS Wipes target branch changes and reset ref to match upstream
  - head: dev
    upstream: master
    assignees:                   # Optional
      - wei
    reviewers:                   # Optional
      - wei
label: "pull :arrow_down:"       # Optional
```

 6. Go to `https://pull.now.sh/check/:owner/:repo` to validate your `.github/pull.yml`.
 7. Install [Pull app](https://github.com/apps/pull) and select only the repos you wish to pull.


## For Repository Owners

If you have a popular repo with a fork network, consider adding `.github/pull.yml` to your repository pointing to yourself (see example). This will allow forks to install Pull and stay updated with zero-configuration.

Example (assuming `owner` is your user or organization name):
```yaml
version: "1"
rules:
  - head: master
    upstream: owner:master
    autoMerge: true
    autoMergeHardReset: true
  - head: docs
    upstream: owner:docs
    autoMerge: true
    autoMergeHardReset: true
```


## Author
[Wei He](https://github.com/wei) _github@weispot.com_


## License
[MIT](https://wei.mit-license.org)
