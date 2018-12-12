<a href="https://github.com/apps/pull"><img align="right" width="120" height="120" src="https://prod.download/pull-svg" /></a>

# Pull

[![TravisCI](https://travis-ci.com/wei/pull.svg?branch=master)](https://travis-ci.com/wei/pull)
[![Codecov](https://codecov.io/gh/wei/pull/branch/master/graph/badge.svg)](https://codecov.io/gh/wei/pull)
[![Depfu](https://badges.depfu.com/badges/4a6fdae34a957e6c1ac11a83f6491162/overview.svg)](https://depfu.com/github/wei/pull)
<br/>
[![Installations](https://pull.now.sh/badge/installed)](https://probot.github.io/apps/pull/)
[![Managing](https://pull.now.sh/badge/managing)](https://probot.github.io/apps/pull/)
[![Triggered #](https://pull.now.sh/badge/triggered)](https://github.com/issues?q=author%3Aapp%2Fpull)
<br/>
[![Probot](https://pull.now.sh/badge/built_with)](https://probot.github.io/)
[![JavaScript Style Guide](https://pull.now.sh/badge/code_style)](https://standardjs.com)
[![jest](https://facebook.github.io/jest/img/jest-badge.svg)](https://github.com/facebook/jest)
[![MIT License](https://pull.now.sh/badge/license)](https://wei.mit-license.org)

> 🤖 a GitHub App built with [probot](https://github.com/probot/probot) that keeps your repository up-to-date with upstream changes via automated pull requests.


## Features

 1. A pull request is created when an upstream is updated (checks periodically).
 2. Pull requests can be automatically merged or hard reset to match upstream.

_Upstream must be in the same fork network_


## Setup

:warning:**Before you start:** _Make a backup if you've made changes._


### Basic setup:

 1. Install **[<img src="https://prod.download/pull-18h-svg" valign="bottom"/> Pull app](https://github.com/apps/pull)**.
 2. **_That's it!_**

Pull app will automatically watch and pull in upstream's default (master) branch to yours with **hard reset**.

:bulb: Best Practice: _Do NOT touch default (master) branch in any forks. Always create new branches to work on._


### Advanced setup (with config):

 1. Create a new branch.
 2. Setup the new branch as default branch under repository Settings > Branches.
 3. Add `.github/pull.yml` to your default branch.

#### Most common
(behaves the same as basic setup)

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

 4. Go to `https://pull.now.sh/check/${owner}/${repo}` to validate your `.github/pull.yml`.
 5. Install **[![<img src="https://prod.download/pull-18h-svg" valign="bottom"/> Pull](https://prod.download/pull-18h-svg) Pull app](https://github.com/apps/pull)**.


## For Repository Owners

For the most common use case (a single `master` branch), you can just direct users to install Pull with no configurations.
If you need a more advanced setup (such as a `docs` branch in addition to `master`), consider adding `.github/pull.yml` to your repository pointing to yourself (see example). This will allow forks to install Pull and stay updated automatically.

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
