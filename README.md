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

### Basic setup:
:exclamation:<span style="color:red">**DESTRUCTIVE**</span>:exclamation:
 1. Fork a repository. If you've made changes in the past, make a local backup by running `git clone --mirror <clone_url>` just in case.
 2. (Read 3. first) Install Pull app via https://github.com/apps/pull and select only the repos you wish to pull.
 3. If `.github/pull.yml` file is NOT found, Pull app will automatically watch and pull in upstream's `master` branch to your `master` branch via **hard reset**. :warning:Any current or future changes on your `master` branch will be lost.

_Do NOT make changes in master branch from a fork. If the upstream uses a different default_branch, replace the word `master` above to the respective branch name._


### Recommended setup:
 1. Fork a repository. If you've made changes in the past, make a local backup by running `git clone --mirror <clone_url>` just in case.
 2. Create a new branch
 3. Setup the new branch as Default branch under repository Settings > Branches
 4. Add `.github/pull.yml` to your default branch.

Most common `pull.xml` (Default configuration when `pull.yml` is not found or failed validation):
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
