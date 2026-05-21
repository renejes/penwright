# Handoff: vswrite CLI Implementation

> Drop this into a fresh Claude Code chat to start the CLI implementation work. The reader is a Claude with no memory of previous sessions — give it enough context to act, then point it at the plan.

---

## What you're working on

vswrite Desktop is a project-first WYSIWYG editor for Typst documents (Electron 41 + Svelte 5 + TipTap, MCP server). The current Pro-feature distribution path for Claude Desktop is the **`.mcpb` bundle** we shipped in May 2026 — drag-and-drop install, all 52 MCP tools, bundled Typst CLI + 24 Typst packages + 7 OFL font families, ~48 MB compressed, end-to-end smoke-tested.

Your job in this new chat is to **add a second transport** to the same binary: a `vswrite` CLI command on PATH. Plus a **first-run setup modal** that installs three companions in one step: the `.mcpb`, the CLI, and a shell-MCP companion (so Claude Desktop can actually invoke the CLI via shell access).

The full design lives in [cli-implementation-plan.md](cli-implementation-plan.md). This handoff is the orientation doc; the plan is the spec you implement from.

---

## Read these documents, in this order

1. **[cli-implementation-plan.md](cli-implementation-plan.md)** — your spec. 8 implementation phases, per-phase scope + effort, full architectural decisions (single binary dual-mode, project auto-discovery, shell-MCP companion via Smithery, license-cache for CLI). The 7 open questions at the bottom are decisions to make during implementation, not before.
2. **[../CLAUDE.md](../CLAUDE.md)** — codebase architecture. Focus on the **MCP server packaging** section (Session 18) and the **MCP server** bullet (52 tools across 13 categories). The Style persistence layer at line 140 gives you the design-tool surface that the CLI commands need to mirror.
3. **[project_status.md](project_status.md)** — Sessions 22 (Design-Editor + 9 MCP design tools), 23 / 23.1 / 23.2 (Magazine-Polish-Pack, Lifestyle quick-wins, per-chapter running heads), and the .mcpb migration session are the relevant recent context.
4. **[mcp-server.md](mcp-server.md)** — all 52 current MCP tools with descriptions. Skim once so you know what's there; in Phase 5 you'll wrap each as a CLI subcommand.
5. **[../src/mcp/server.ts](../src/mcp/server.ts)** — the actual MCP server (~2540 lines). This is what you'll refactor. Look especially at `parseArgs()` (where the argv-dispatch hook will go), `typstBinary()` / `typstCompileArgs()` (the env-var pattern that already works for both transports), and `validateProLicense()` (which you'll wrap with a cache for the CLI mode).
6. **[../src/mcp/manifest.template.json](../src/mcp/manifest.template.json)** — the .mcpb manifest. Reference for how user_config + env wiring works today.
7. **[../scripts/build-mcpb.mjs](../scripts/build-mcpb.mjs)** + **[../scripts/build-mcp-binary.mjs](../scripts/build-mcp-binary.mjs)** — the existing build pipeline you'll extend.

**Skip unless relevant to a specific question:**
- `handbuch.md` / `handbook.md` — end-user docs, only relevant for Phase 8
- `done/` — archived plans, not active

---

## What was just shipped (so you don't re-do)

### .mcpb Bundle (May 2026)
- `dist/mcpb/vswrite-0.7.1.mcpb` (48 MB compressed, 113 MB unpacked, arm64-only) builds via `npm run build:mcpb`
- Bundle structure: `manifest.json` + `server/bin/vswrite-mcp` + `server/typst/typst` + `server/typst-packages/` + `server/fonts/`
- E2E-verified: `vswrite_set_project` + `vswrite_open_file` + `vswrite_compile` against the sample project — compiles 432 KB PDF using only bundle resources, no system Typst, no network
- License-check uses Polar API with offline-grace via `catch` branch in `validateProLicense()` — if Polar is unreachable AND the key has the `VSWRITE_PRO` prefix, the server accepts it locally
- Wizard-based install (`src/main/mcpSetup.ts`) and the .mcpb are **both still active** in parallel. The decision to retire the wizard is parked until after a real install test in Claude Desktop

### Magazine + Lifestyle design rounds (May 2026)
- Design-element library: 6 → **19 elements**
- Layout presets: 6 → **7** (added `magazine-editorial` with per-chapter running head)
- Per-chapter running heads via `{chapter}` / `{section}` placeholders in `pageHeader` / `pageFooter`
- 5 skill prompts deployed (`design-conventions` added)
- Style.typ now exports `style-colors`, `style-fonts`, `figure-caption-credit()`, `chapter-name()`, `section-name()` at module level

### Key insight from the MCP-vs-CLI research
- 52 MCP tools cost ~3-5k tokens/session in Claude Desktop just for definitions
- The .mcpb is the right Claude-Desktop install UX **but** routing all 52 calls through MCP-tool-call is context-expensive
- The CLI is the way to claw that back — `vswrite design apply-palette earth-tones` is ~50 tokens vs `vswrite_apply_palette({presetId: "earth-tones"})` plus its tool-schema overhead. Plus the entire shell-MCP-companion architecture lets Claude Desktop reach the CLI

---

## Critical conventions

Most of these come from earlier sessions, written up properly in CLAUDE.md. The ones most relevant to your work:

### Tool-body refactor pattern

```typescript
// before: anonymous arrow in server.tool(...)
server.tool('vswrite_set_project', 'desc', schema, async (args) => { /* body */ });

// after: named export + reference
export async function vswriteSetProject(args: { projectDir: string }) { /* body */ }
server.tool('vswrite_set_project', 'desc', schema, vswriteSetProject);
```

52× to repeat. **No logic change.** This is mechanical work that should be reviewable as a single diff. The functions return the standard MCP shape `{ content: [{type: 'text', text}], isError? }` — the CLI's output formatter extracts `content[0].text` for plain output or serialises the full object for `--json`.

### Bun-binary build is the same

`scripts/build-mcp-binary.mjs` produces a single Bun-compiled standalone Mach-O. The CLI dispatch is just a top-of-`main()` argv check — no new build artefact, no new compile pipeline. The same binary that runs as MCP-server-on-stdio also runs as CLI-on-argv.

### Project auto-discovery

CLI invocations are stateless. Implement walk-up from `process.cwd()` looking for `.vswrite/` (like git's `.git/`). `--project-dir` flag and `VSWRITE_PROJECT` env var as overrides. **Document this in the CLI skill** so Claude knows it can just `cd` into a project rather than passing `--project-dir` every call.

### License-check in CLI mode

`validateProLicense()` does a Polar API call. For a CLI that runs hundreds of times per day, that's a 200ms tax per invocation. Add `~/Library/Application Support/vswrite/cli-license-cache.json` with 7-day TTL. Cache valid → skip Polar. Cache stale → revalidate. Cache fail + offline → fall through the existing `catch` branch (Pro-prefix gets benefit of doubt). **Don't break MCP mode** — the cache is CLI-only.

### Shell-MCP companion

The user-facing modal installs **three things** in one step: `.mcpb`, CLI (to `/usr/local/bin/vswrite` with admin escalation), and shell-MCP (recommended: `mcp-shell-server` via Smithery — `npx -y @smithery/cli install mcp-shell-server --client claude`). Shell-MCP gets a conservative ALLOW_COMMANDS whitelist (`vswrite,typst,git,ls,cat,grep,find,head,tail,wc`). The user can opt out of each individually.

### Tests / build

- No test framework. Verify with `unset ELECTRON_RUN_AS_NODE && npm run build` + `npx svelte-check --threshold error`
- Baseline: 1525 files, 0 errors, 29 warnings — don't add errors
- For the Bun-compiled binary: `node scripts/build-mcp-binary.mjs` (host arch) or `--all` for both Darwin arches
- For the .mcpb: `npm run build:mcpb` — should still pass `mcpb validate` after your changes
- E2E-smoke-test per phase: pipe a JSON-RPC initialize + a real tool call into the binary, verify the response, OR (for CLI) run `./dist/mcp/bin/vswrite-mcp <command>` against the sample project

### Git workflow

- Worktree branch is `claude/<id>`, tracks `origin/main`. Push directly: `git push origin HEAD:main`
- Recent commit style: imperative, no Conventional-Commits prefix, single concise headline + paragraph body explaining the why. See `git log --oneline -20` for examples
- **One commit per phase** (8 commits + 1 wrap-up). Don't bundle.

---

## Implementation order

The plan recommends this — risk-clustered so the mechanical work happens first and the UX-sensitive decisions get validated mid-way:

1. **Phase 1** (3-4h) — refactor all 52 tool bodies into named exported functions; build a `TOOL_HANDLERS` registry-map so CLI can dispatch by name
2. **Phase 2** (2h) — argv-dispatcher + commander.js skeleton + `vswrite --version` as the first working CLI command
3. **Phase 3** (3-4h) — **8-command MVP** (project set/info, document compile, design list-elements / apply-palette / apply-theme / insert, version save) — stop here and evaluate with the user
4. **Phase 4** (4-5h) — first-run modal with three checkboxes, Smithery integration for shell-MCP, admin-escalation for CLI install
5. **Phase 5** (6-8h) — remaining 44 commands; batch by 10 with commits + build-verify
6. **Phase 6** (2h) — `CLI_USAGE_SKILL` as the 6th skill prompt
7. **Phase 7** (passive) — collect usage data for 2-3 weeks, then decide whether to trim or remove the MCP server
8. **Phase 8** (2h) — docs (handbuch / handbook / mcp-server / CLAUDE.md / status / next-steps)

After Phase 3 the user has explicitly asked to **stop and check in** before going further. They want to feel the MVP CLI in real use before committing to phases 4-8.

---

## How to verify each commit

1. **Build**: `unset ELECTRON_RUN_AS_NODE && npm run build` exits 0
2. **Type-check**: `npx svelte-check --threshold error` ends "0 ERRORS"
3. **MCP-mode regression**: pipe `{"jsonrpc":"2.0","id":1,"method":"initialize",...}` + `tools/list` into the binary, verify all 52 tools still appear with their schemas
4. **CLI-mode (Phases 3+)**: run the new command via `./dist/mcp/bin/vswrite-mcp <command>` against `resources/sample-project/`; check exit code, stdout, --json output
5. **For Phase 4**: actually drag the rebuilt `.mcpb` into your local Claude Desktop and run the modal end-to-end (only the user can do this last step — they'll test, you wait)
6. **Commit**: focused message, paragraph body explaining the why

---

## When you're done

Verify before declaring the full implementation done:

- [ ] All 52 MCP tools have CLI equivalents — `vswrite --help` lists them all
- [ ] `vswrite` is on PATH after running the setup modal; `vswrite --version` works from any cwd
- [ ] Project auto-discovery walks up to `.vswrite/`; `cd` into a project works
- [ ] `--json` flag returns the full MCP-response object on every command
- [ ] License-cache prevents repeated Polar calls in CLI mode
- [ ] Shell-MCP is installed via Smithery and configured in Claude Desktop's config
- [ ] First-run modal shows 3 checkboxes; each can be skipped individually
- [ ] CLI skill prompt is deployed and exposed via MCP `prompts/list`
- [ ] All 5 docs (handbuch / handbook / mcp-server / CLAUDE.md / project_status) reflect the dual-mode binary + setup-modal-with-3-companions
- [ ] E2E walkthrough: build a full magazine project using only the CLI from a terminal
- [ ] E2E walkthrough in Claude Code: agent uses bash to call `vswrite` CLI; works without the .mcpb
- [ ] Final push to `origin/main`

After that, **stop and check in with the user**. The user explicitly wants Phase 3 (MVP) as a checkpoint and Phase 5/6/7/8 as a separate go/no-go decision based on the MVP feel.

Good luck.
