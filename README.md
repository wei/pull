<!-- deno-fmt-ignore-start -->

<div align="center">

<a href="https://wei.github.io/pull">
  <img src="https://prod.download/pull-social-svg" alt="Pull App">
</a>

</div>

<div align="center">

<a href="https://probot.github.io">
  <img src="https://badgen.net/badge/Probot/Featured/orange?icon=dependabot&cache=86400" alt="Probot Featured">
</a>
<a href="https://github.com/wei/pull">
  <img src="https://badgen.net/github/stars/wei/pull?label=Stars&icon=github&color=pink&cache=300" alt="GitHub Stars">
</a>

</div>

<div align="center">

<a href="https://github.com/apps/pull">
  <img src="https://badgen.net/https/pull.git.ci/badges/repos?color=cyan&cache=600" alt="Repositories">
</a>
<a href="https://github.com/apps/pull">
  <img src="https://badgen.net/https/pull.git.ci/badges/installations?color=blue&cache=600" alt="Installations">
</a>
<a href="https://github.com/issues?q=author:app/pull">
  <img src="https://badgen.net/https/pull.git.ci/badges/triggers?color=purple&cache=600" alt="Triggered #">
</a>

</div>

## Introduction

[![Version][version-badge]][version-url] [![Deno 2.0][deno-badge]][deno-url] [![TypeScript][ts-badge]][ts-url] [![License][license-badge]][license-url]

> 🤖 a GitHub App that keeps your forks up-to-date with upstream via automated
> pull requests.

_Can you help keep this open source service alive? **[💖 Please sponsor : )][pull-sponsor]**_

<!-- deno-fmt-ignore-end -->

## Features

- 🔄 **Automated Synchronization**: Ensures forks are updated by automatically
  creating pull requests to integrate new changes from upstream
- ⚙️ **Flexible Configuration**: Customize sync behavior through
  `.github/pull.yml` configuration to accommodate different merge strategies,
  including merge, squash, rebase, and hard reset
- 🕒 **Scheduled Updates**: Regularly checks for upstream changes periodically
  to ensure forks are always up-to-date
- 👥 **Team Integration**: Facilitates collaboration by automatically adding
  assignees and reviewers to pull requests, honoring branch protection rules and
  working seamlessly with pull request checks and reviews
- 🚀 **Enterprise Ready**: Supports GitHub Enterprise Server, ensuring a smooth
  integration process for enterprise-level projects

### Prerequisites

- Upstream must be in the same fork network.
- ⚠️ _Make a backup if you've made changes._

## Getting Started

**[⭐ Star this project][pull-repo]** (Highly recommended, starred users may
receive priority over other users)

### Basic Setup

- Just install
  **[<img src="https://prod.download/pull-18h-svg" valign="bottom"/> Pull app][pull-app]**.

Pull app will automatically watch and pull in upstream's default (master) branch
to yours using **hard reset** periodically. You can also manually
[trigger](#trigger-manually) it anytime.

### Advanced Configuration (with config file)

1. Create a new branch.
2. Setup the new branch as default branch under repository Settings > Branches.
3. Add `.github/pull.yml` to your default branch.

   #### Most Common
   (behaves the same as Basic Setup)
   ```yaml
   version: "1"
   rules:
     - base: master
       upstream: wei:master # change `wei` to the owner of upstream repo
       mergeMethod: hardreset
       mergeUnstable: true
   ```

   #### Advanced usage
   ```yaml
   version: "1"
   rules: # Array of rules
     - base: master # Required. Target branch
       upstream: wei:master # Required. Must be in the same fork network.
       mergeMethod: hardreset # Optional, one of [none, merge, squash, rebase, hardreset], Default: none.
       mergeUnstable: false # Optional, merge pull request even when the mergeable_state is not clean. Default: false
     - base: dev
       upstream: master # Required. Can be a branch in the same forked repo.
       assignees: # Optional
         - wei
       reviewers: # Optional
         - wei
       conflictReviewers: # Optional, on merge conflict assign a reviewer
         - wei
   label: ":arrow_heading_down: pull" # Optional
   conflictLabel: "merge-conflict" # Optional, on merge conflict assign a custom label, Default: merge-conflict
   ```

4. Go to `https://pull.git.ci/check/${owner}/${repo}` to validate your
   `.github/pull.yml`.
5. Install
   **[<img src="https://prod.download/pull-18h-svg" valign="bottom"/> Pull app][pull-app]**.

### Trigger Manually

You can manually trigger Pull by going to
`https://pull.git.ci/process/${owner}/${repo}`.

### Known limitation: upstream issue timeline events

When Pull copies an upstream commit into a fork, GitHub can add a
cross-repository "referenced this issue" event to an issue named in that commit
message. This can happen even when the issue is already closed and the commit is
already on the upstream default branch. The event is created by GitHub when it
indexes the unchanged commit in another repository; Pull does not create the
issue event itself, but its synchronization can trigger this GitHub behavior.

Pull cannot suppress these events without changing commit messages and therefore
creating different commits. Rewriting commits would also break commit identity
and is incompatible with keeping a fork synchronized with upstream. Pull does
not currently provide an upstream-owner opt-out, and an upstream
`.github/pull.yml` cannot block installations or synchronization in forks.

To avoid these events:

- Fork owners can remove rules that sync the affected upstream branch, or
  uninstall/disable Pull for the fork. A separate, non-default synchronization
  branch can keep automated changes away from the fork's main development
  branch, but it is not a guaranteed way to suppress GitHub timeline events.
- Upstream owners can ask the owner of an affected fork to stop syncing that
  branch. There is currently no setting an upstream owner can add to their own
  repository to opt all forks out.
- Where project policy permits, put issue-closing references in pull request
  descriptions instead of commit messages. Existing commits retain their
  messages when synchronized, so this only helps future commits.

Do not add an empty or invalid `.github/pull.yml` to an upstream repository as
an opt-out mechanism. It is not a supported opt-out; the configuration is
invalid for the repository where it is installed and does not control
configuration in forks. See [issue #639](https://github.com/wei/pull/issues/639)
for context and current status.

### For Upstream Repository Owners

For the most common use case (a single `master` branch), you can just direct
users to install Pull with no configurations. If you need a more advanced setup
(such as a `docs` branch in addition to `master`), consider adding
`.github/pull.yml` to your repository pointing to yourself (see example). This
will allow forks to install Pull and stay updated automatically.

Example (assuming `owner` is your user or organization name):

```yaml
version: "1"
rules:
  - base: master
    upstream: owner:master
    mergeMethod: hardreset
    mergeUnstable: true
  - base: docs
    upstream: owner:docs
    mergeMethod: hardreset
    mergeUnstable: true
```

## Contributing

See [CONTRIBUTING.md](./.github/CONTRIBUTING.md)

## License

[MIT](LICENSE) © [Wei He][pull-sponsor]

## Support

_Can you help keep this open source service alive?
**[💖 Please sponsor : )][pull-sponsor]**_

---

Made with ❤️ by [@wei](https://github.com/wei)

[version-badge]: https://badgen.net/https/pull.git.ci/badges/version?label=Version&color=green&cache=300
[version-url]: https://pull.git.ci/version
[deno-badge]: https://img.shields.io/badge/Deno%202.0-000000?logo=Deno&logoColor=ffffff
[deno-url]: https://deno.com
[ts-badge]: https://badgen.net/badge/_/TypeScript/blue?&label=&icon=typescript&cache=86400
[ts-url]: https://www.typescriptlang.org
[license-badge]: https://badgen.net/badge/License/MIT/black?cache=86400
[license-url]: https://wei.mit-license.org
[pull-app]: https://github.com/apps/pull
[pull-repo]: https://github.com/wei/pull
[pull-sponsor]: https://prod.download/pull-readme-sponsor
