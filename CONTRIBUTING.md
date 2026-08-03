# Contributing to Penwright

Thank you for wanting to help. Penwright is built by one person, and the kinds
of help that move it forward are probably not the ones you expect — so this
document is mostly about **what is genuinely useful**, and one thing that is not
accepted and why.

Please read the short version first; it covers most cases.

---

## The short version

| | |
|---|---|
| 🥇 **A `.typ` file that Penwright damages** | The single most valuable thing you can send. See [below](#1-documents-that-break-the-round-trip-most-valuable). |
| 🐛 **Bug reports** | Yes, please. |
| 🌍 **Translations and wording fixes** | Yes, please — German and English. |
| 📖 **Documentation corrections** | Yes, please. |
| 💡 **Feature ideas** | Yes, as an issue. No promises. |
| 🚫 **Pull requests containing code** | **Not accepted.** Not because they are unwelcome as work — see [why](#why-no-code-pull-requests). |

---

## What helps most

### 1. Documents that break the round trip (most valuable)

Penwright's hardest promise is this: **you can open an existing `.typ` file,
edit it visually, save it, and get back a file that means the same thing.**
Every real content-destroying bug found so far was found by running a real
document through it — never by a synthetic test.

So the most valuable contribution to this project is **a Typst file that comes
out different from how it went in.**

To report one:

1. Open the file in Penwright, make a trivial edit (add a space, remove it
   again), save.
2. `git diff` — or compare against a copy you made first.
3. Open an issue with **the smallest file that still shows the problem**, the
   before and after, and your Typst version.

If you can reduce it to a few lines, that is close to a finished fix. If you
cannot, send it anyway — a large file that reproduces beats a small one that
does not.

**Do not send anything confidential.** Client documents, unpublished
manuscripts, anything under NDA — strip it down to the construct that breaks,
or describe it and send a reconstruction. If the construct only occurs in
material you cannot share, say so in the issue and it can be worked through
without the file.

### 2. Bug reports

Useful reports contain: what you did, what happened, what you expected, your OS
and Penwright version, and — if the app misbehaved rather than crashed — the
`.typ` involved.

Penwright writes local crash reports (Help ▸ crash dialog, or
`<userData>/crash-reports/`). They are **plain text, scrubbed of your username,
and never transmitted anywhere unless you explicitly send them.** Attaching one
to an issue helps a lot; read it first and remove anything you would rather not
publish.

### 3. Translations and wording

The UI is fully bilingual (English and German). English is the source of truth
for message *shape*; German is typed against it, so a missing or misshaped key
is a compile error rather than a silent gap.

- Message files live in `src/shared/i18n/<locale>/<namespace>.ts`.
- Wording fixes, awkward phrasing, wrong terminology: open an issue quoting the
  current string and your suggestion. That is enough — no PR needed.
- A whole new language is a larger conversation; open an issue first.

### 4. Documentation

The user handbook ships **inside the application**
(`documentation/handbook.md` for English, `handbuch.md` for German). If
something in it is wrong, unclear, or describes behaviour that no longer
exists, an issue quoting the passage is very welcome.

### 5. Feature ideas

Open an issue and describe **the problem you hit**, not the feature you want.
The problem survives; the proposed solution usually gets replaced by a better
one once the problem is understood.

Penwright says no to a lot, on purpose. A "no" is not a judgement of the idea.

---

## Why no code pull requests

This is the part that deserves an honest explanation rather than a rule.

Penwright is **source-available, not open source** (see [`LICENSE.md`](LICENSE.md)).
It is free for personal, academic and hobby use, and commercial use is paid.
That model only stays possible while **one person holds the copyright to the
entire codebase.**

The moment an outside contribution is merged, that stops being true — and the
consequence is not theoretical:

- **A DCO sign-off grants no relicensing rights.** It attests that you had the
  right to submit the code; it does not let anyone change its licence later.
- Without a signed CLA from every contributor, changing the licence — including
  **opening it up further**, which is a real possibility here — needs
  *unanimous* agreement from all of them.
- Retrofitting a CLA after the fact essentially never succeeds. Every project
  that has managed a licence change (MongoDB, HashiCorp, Elastic, Redis,
  Sentry, Grafana) had one in place before the first outside commit.

So the alternative to "no code PRs" is not "code PRs" — it is **"code PRs plus a
CLA you have to sign"**, which is more paperwork for you and more administration
for a one-person project, to solve a problem that declining code contributions
solves for free.

It is a trade-off, and it is chosen deliberately. If that changes, this file
changes with it.

**What this is not:** it is not a judgement of your code, and it does not mean
your finding is unwelcome. A precise issue with a reproduction is worth more
here than a patch — genuinely, not as consolation. The fix is usually the easy
part; knowing exactly which document shape breaks is the hard part.

If you have already written a fix, please still open an issue and **describe the
cause and your approach in prose.** That is enormously useful and carries no
copyright question. Please do not paste the diff.

---

## Security issues

**Do not open a public issue for a security problem.**

Email **feedback@penwright.online** with a description and, if possible, a
reproduction. You will get an acknowledgement, and credit in the release notes
if you want it.

Penwright is a local desktop application with no accounts and no server-side
component, so the interesting surface is: the Electron IPC boundary and its
path validation, the `penwright-asset://` protocol, the MCP server's file
access, and anything that lets a crafted `.typ` or project folder reach outside
the project directory.

---

## Working on the code yourself

You are welcome to build and run Penwright from source for your own use — that
is a large part of why the source is public, and [`LICENSE.md`](LICENSE.md) §4
grants it explicitly. What you may not do is pass it on or reuse the code: the
licence grants everything for a non-commercial purpose **except distributing
the software and making changes or new works based on it** ([`LICENSE.md`](LICENSE.md) §3).

```bash
npm install
npm run fetch:typst && npm run fetch:packages && npm run fetch:fonts
npm run dev
```

`npm test` runs the full gate — type check, unit suites, the round-trip corpus
and the pixel-comparison compile suites. It takes roughly two minutes and needs
the bundled Typst, which the fetch scripts above install.

The architecture, its invariants, and the traps that have already cost someone a
day are documented in [`CLAUDE.md`](CLAUDE.md). It is written for an AI
assistant working on the codebase, but it is the most accurate description of
how Penwright actually works, and it is worth reading before you change anything.

---

## Code of conduct

Be decent. Assume the other person is trying. That is the whole policy, and it
will grow only if it has to.
