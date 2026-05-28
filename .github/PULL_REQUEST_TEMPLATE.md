## ✅ PR Completion Checklist

* [ ] PR title follows format: `Prefix: ADAPT-XXXX Brief description`
  > e.g. `Feature: ADAPT-3648 Deprecate legacy plugins` · `Bugfix: ADAPT-2504 Failed import creates rogue course`
* [ ] JIRA ID linked in the Context section below
* [ ] Plugin version updated in `bower.json` (if applicable)
* [ ] `npm run test-e2e-dev-pipeline` executed and passing
* [ ] No new issues reported by SonarLint (attach screenshot if applicable)
* [ ] Own diff reviewed before requesting review
* [ ] At least two reviewers added (Copilot set as default)

---

## Context

#### Resolves / Addresses [ADAPT-XXXX](https://laerdal.atlassian.net/browse/ADAPT-XXXX)

<!--
  WHY is this change being made? Answer from a product or user perspective.
  - What problem does it solve, or what value does it add?
  - Add Figma links or screenshots where the change has visual impact.
  - Reference a test course if demo validation is needed.
-->

---

## Description

<!--
  HOW is this accomplished technically?
  - What specific approach was taken and why?
  - Note any architecture decisions, trade-offs, or alternatives considered.
  - Mention DB changes, config updates, or breaking changes.
-->

---

## Changes in the codebase

<!--
  Per-file breakdown — reviewers should be able to map each diff entry back to this list.
  Add or remove file sections as needed.
-->

### `path/to/file.ext`
-

### `path/to/file.ext`
-

---

<!--
  Optional: add a structured table for config values, size mappings, API fields, etc.

| | Column A | Column B | Column C |
|---|---|---|---|
| Row 1 | | | |
-->

---

<!-- Reference links — full JIRA URLs so shorthand links in the body above resolve correctly -->
[ADAPT-XXXX]: https://laerdal.atlassian.net/browse/ADAPT-XXXX
