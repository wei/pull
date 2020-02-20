<p align="center">
 <a href="https://github.com/apps/pull">
   <img width="200" height="200" alt="Pull App" src="https://prod.download/pull-svg" />
 </a>
</p>
<h1 align="center">Pull</h1>
<p align="center">
  Keep your forks up-to-date.
</p>
<p align="center">
 <a href="https://github.com/apps/pull">
   <img alt="Managing" src="https://pull.git.ci/badge/managing" />
 </a>
 <a href="https://github.com/apps/pull">
   <img alt="Installations" src="https://pull.git.ci/badge/installed" />
 </a>
 <a href="https://github.com/issues?q=author%3Aapp%2Fpull">
   <img alt="Triggered #" src="https://pull.git.ci/badge/triggered" />
 </a>
</p>

<h2>Table of Contents</h2>
<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->

- [Introduction](#introduction)
- [Features](#features)
  - [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
  - [Basic Setup](#basic-setup)
  - [Advanced Setup (with config)](#advanced-setup-with-config)
    - [Most Common](#most-common)
    - [Advanced usage](#advanced-usage)
- [For Repository Owners](#for-repository-owners)
- [Author](#author)
- [License](#license)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->


## Introduction

[![TravisCI](https://travis-ci.com/wei/pull.svg?branch=master)](https://travis-ci.com/wei/pull)
[![Codecov](https://codecov.io/gh/wei/pull/branch/master/graph/badge.svg)](https://codecov.io/gh/wei/pull)
[![Dependabot Status](https://api.dependabot.com/badges/status?host=github&repo=wei/pull)](https://dependabot.com)
[![Probot](https://pull.git.ci/badge/built_with)](https://probot.github.io/)
[![JavaScript Style Guide](https://pull.git.ci/badge/code_style)](https://standardjs.com)
[![jest](https://facebook.github.io/jest/img/jest-badge.svg)](https://github.com/facebook/jest)
[![MIT License](https://pull.git.ci/badge/license)](https://wei.mit-license.org)

> 🤖 a GitHub App built with [probot](https://github.com/probot/probot) that keeps your forks up-to-date with upstream via automated pull requests.

Incorporate new changes as they happen, not in 6 months. 

Trusted by [![Repository Count](https://pull.git.ci/badge/managing?plain&style=flat)](https://probot.github.io/apps/pull/) repositories, triggered [![Triggered #](https://pull.git.ci/badge/triggered?plain&style=flat)](https://github.com/issues?q=author%3Aapp%2Fpull) times.

Want to support this open source service? [Please star it : )](https://github.com/wei/pull)


## Features

 - Ensure forks are updated.
 - Automatically integrate new changes from upstream.
 - Pull requests are created when upstreams are updated.
 - Automatically merge or hard reset pull requests to match upstream.
 - Add assignees and reviewers to pull requests.
 - Customize pull request label.
 - Honor branch protection rules.
 - Work well with pull request checks and reviews.

### Prerequisites
 - Upstream must be in the same fork network.
 - :warning: _Make a backup if you've made changes._


## Getting Started

### Basic Setup

 - Just install **[<img src="https://prod.download/pull-18h-svg" valign="bottom"/> Pull app](https://github.com/apps/pull)**.

Pull app will automatically watch and pull in upstream's default (master) branch to yours using **hard reset** every couple of hours. You can also manually [trigger](#trigger-manually) it anytime.

### Advanced Setup (with config)

 1. Create a new branch.
 2. Setup the new branch as default branch under repository Settings > Branches.
 3. Add `.github/pull.yml` to your default branch.

#### Most Common
(behaves the same as Basic Setup)
```yaml
version: "1"
rules:
  - base: master
    upstream: wei:master    # change `wei` to the owner of upstream repo
    mergeMethod: hardreset
```

#### Advanced usage
```yaml
version: "1"
rules:                      # Array of rules
  - base: master            # Required. Target branch
    upstream: wei:master    # Required. Must be in the same fork network.
    mergeMethod: hardreset  # Optional, one of [none, merge, squash, rebase, hardreset], Default: none.
    mergeUnstable: false    # Optional, merge pull request even when the mergeable_state is not clean. Default: false
  - base: dev
    upstream: master        # Required. Can be a branch in the same forked repo.
    assignees:              # Optional
      - wei
    reviewers:              # Optional
      - wei
    conflictReviewers:      # Optional, on merge conflict assign a reviewer
      - wei
label: ":arrow_heading_down: pull"  # Optional
```

 4. Go to `https://pull.git.ci/check/${owner}/${repo}` to validate your `.github/pull.yml` (Public repos only).
 5. Install **[![<img src="https://prod.download/pull-18h-svg" valign="bottom"/> Pull](https://prod.download/pull-18h-svg) Pull app](https://github.com/apps/pull)**.

### Trigger manually

Go to `https://pull.git.ci/process/${owner}/${repo}` to manually trigger pull. 
**Note:** Nothing will happen if your branch is already even with upstream.


## For Repository Owners

For the most common use case (a single `master` branch), you can just direct users to install Pull with no configurations.
If you need a more advanced setup (such as a `docs` branch in addition to `master`), consider adding `.github/pull.yml` to your repository pointing to yourself (see example). This will allow forks to install Pull and stay updated automatically.

Example (assuming `owner` is your user or organization name):
```yaml
version: "1"
rules:
  - base: master
    upstream: owner:master
    mergeMethod: hardreset
  - base: docs
    upstream: owner:docs
    mergeMethod: hardreset
```


## Author
[Wei He](https://github.com/wei) _github@weispot.com_


## License
[MIT](LICENSE)
