# Third-party methods

Keel's phase guides carry a working method to a visiting agent. Most of that
method is not ours. This file says whose it is, under what licence, and what we
changed.

## What was adapted, and into what

| Phase | Source | Licence |
|---|---|---|
| 0 Intake | superpowers `brainstorming` — context exploration, scope assessment | MIT |
| 1 Interrogate | superpowers `brainstorming` | MIT |
| 2 Research | **written for Keel** — from this repository's own `docs/BRIEF-FOR-REVIEW.md` | — |
| 3 Decide | superpowers `brainstorming` (approaches, isolation and clarity) + the Architecture Decision Record format | MIT + public |
| 4 Plan | superpowers `writing-plans` | MIT |
| 5 Critique | superpowers `requesting-code-review`, `receiving-code-review`, and brainstorming's spec self-review | MIT |
| 6 Ship | superpowers `verification-before-completion`, `executing-plans` | MIT |

Each guide also names its source in the text the agent receives, so the
attribution travels with the method rather than sitting only in this file.

## These are adaptations, not copies

The source skills are written for a Claude Code harness. Verbatim, they instruct
an agent to announce skill invocations, create git worktrees, dispatch
subagents, and save files to `docs/superpowers/plans/`. A browser agent has none
of that.

**The page is the harness now.** State replaces files, gates replace checklists,
and a human's click replaces a subagent's review. What is preserved is the
method — one question at a time, options with trade-offs, rejected alternatives
recorded, tasks that carry their own acceptance check, evidence before
assertions. What is removed is every instruction that assumes a filesystem, a
git repository, or a subagent.

Phase 2 has no public source. There is no tested open-source research skill in
the set we drew from, so that guide was written here.

## superpowers

Copyright (c) 2025 Jesse Vincent. Licensed MIT.
<https://github.com/obra/superpowers>

```
MIT License

Copyright (c) 2025 Jesse Vincent

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Typefaces

Archivo Narrow and IBM Plex Mono, both SIL Open Font License 1.1, served from
Google Fonts. The page is legible with neither loaded.
