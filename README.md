<p align="center">
  <a href="https://github.com/apps/pull">
    <img alt="Pull App" src="https://prod.download/pull-social-svg" />
  </a>
</p>
<p align="center">
  <a href="https://probot.github.io">
    <img alt="Probot Featured" src="https://badgen.net/badge/probot/featured/orange?icon=dependabot&cache=86400" />
  </a>
  <a href="https://github.com/wei/pull">
    <img alt="GitHub Stars" src="https://badgen.net/github/stars/wei/pull?icon=github" />
  </a>
  <br/>
  <a href="https://github.com/apps/pull">
    <img alt="Managing" src="https://badgen.net/https/raw.githack.com/pull-app/stats/master/badges/managing.json" />
  </a>
  <a href="https://github.com/apps/pull">
    <img alt="Installations" src="https://badgen.net/https/raw.githack.com/pull-app/stats/master/badges/installed.json" />
  </a>
  <a href="https://github.com/issues?q=author%3Aapp%2Fpull">
    <img alt="Triggered #" src="https://badgen.net/runkit/pull-triggered-badge-5e55hqhkhmid" />
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

[![GitHub Status](https://badgen.net/github/status/wei/pull?icon=github)](https://github.com/wei/pull)
[![TravisCI](https://badgen.net/travis/wei/pull?icon=travis&label=build)](https://travis-ci.com/wei/pull)
[![Codecov](https://badgen.net/codecov/c/github/wei/pull?icon=codecov)](https://codecov.io/gh/wei/pull)
[![Probot](https://badgen.net/badge/built%20with/probot/orange?icon=dependabot&cache=86400)](https://probot.github.io/)
[![JavaScript Style Guide](https://badgen.net/badge/code%20style/standard/f2a?cache=86400)](https://standardjs.com)
[![jest](https://facebook.github.io/jest/img/jest-badge.svg)](https://github.com/facebook/jest)
[![MIT License](https://badgen.net/badge/license/MIT/blue?cache=86400)](https://wei.mit-license.org)

> 🤖 a GitHub App built with [probot](https://github.com/probot/probot) that keeps your forks up-to-date with upstream via automated pull requests.

Trusted by [![Repository Count](https://badgen.net/https/raw.githack.com/pull-app/stats/master/badges/managing.plain.json?style=flat)](https://probot.github.io/apps/pull/) repositories, triggered [![Triggered #](https://badgen.net/runkit/pull-triggered-badge-5e55hqhkhmid?style=flat&label=)](https://github.com/issues?q=author%3Aapp%2Fpull).

_Can you help keep this open source service alive? **[💖 Please sponsor : )](https://prod.download/pull-readme-sponsor)**_


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

**[⭐ Star this project](https://github.com/wei/pull)** (Highly recommended, starred users may receive priority over regular users)

### Basic Setup

 - Just install **[<img src="https://prod.download/pull-18h-svg" valign="bottom"/> Pull app](https://github.com/apps/pull)**.

Pull app will automatically watch and pull in upstream's default (master) branch to yours using **hard reset** every few hours. You can also manually [trigger](#trigger-manually) it anytime.

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
    conflictLabel: "merge-conflict"     # Optional, on merge conflict assign a custom label, Default: merge-conflict
    ```

 4. Go to `https://pull.git.ci/check/${owner}/${repo}` to validate your `.github/pull.yml` (Public repos only). See [#234](https://github.com/wei/pull/issues/234) for another way to validate it.
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
