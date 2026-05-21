# vswrite CLI Implementation Plan

> **Status:** Geplant, nicht implementiert. Eintragsdatum: 2026-05-20.
>
> **Strategischer Kontext:** Im 2026er Stand der MCP-vs-CLI-Debatte verbrauchen MCP-Server mit 52 Tools wie unserer aktuell ~3-5k Tokens / Session allein für Tool-Definitions-Schemas. Benchmark-Daten aus dem Feld zeigen Faktor 4-32× Token-Mehrkosten gegenüber CLI bei vergleichbaren Workloads; multi-step Reasoning bricht oft nach 3-4 MCP-Tool-Calls zusammen weil das Context-Window in den Tail-Bereich gerät. Anthropics eigener „Code Execution with MCP"-Ansatz (Nov 2025) zeigt 98,7 % Token-Reduktion. Claude Code hat Bash builtin; Claude Desktop kann via Shell-MCP-Companion gleichziehen. CLI ist der Weg den die Industrie geht.
>
> **Audience:** vswrite-Pro-User die Claude Desktop ODER Claude Code ODER ein anderes MCP-fähiges Tool nutzen. Plan ist optimiert für „ein Binary, drei Transports": MCP-Server (existing), CLI (neu), und beides bundlebar in einer `.mcpb` für Claude Desktop.

---

## Was geliefert wird

Ein **Dual-Mode-Binary** das je nach Argv-Dispatch entweder MCP-Server oder CLI ist, plus ein **First-Run-Setup-Flow** der drei Companions in einem Schritt installiert: `.mcpb` (für strukturierte Operationen), CLI auf PATH, und ein Shell-MCP damit Claude Desktop die CLI tatsächlich aufrufen kann.

| # | Komponente | Ergebnis | Layer |
|---|------------|----------|-------|
| 1 | **Dual-Mode-Entry** | Argv-Check entscheidet MCP vs CLI; gleiche Tool-Logik | `src/mcp/server.ts` |
| 2 | **Named-Function-Refactor** | Alle 52 Tool-Bodies aus `server.tool(...)` Closures herausziehen | `src/mcp/server.ts` |
| 3 | **CLI-Dispatcher** | commander.js, hierarchische Commands, --json-Flag, --project-dir-Flag | `src/mcp/cli.ts` (neu) |
| 4 | **Project-Auto-Discovery** | `.vswrite/`-Walk-Up wie git, `--project-dir` als Override | `src/mcp/cli.ts` |
| 5 | **Output-Formatter** | Plain-Text default für Menschen, `--json` für Scripts | `src/mcp/cli.ts` |
| 6 | **First-Run-Setup-Modal** | Drei Checkboxes (vswrite.mcpb / vswrite-CLI / Shell-MCP), ein Klick installiert alles | `src/renderer/components/McpSetupWizard.svelte` |
| 7 | **Shell-MCP-Companion** | Bundled oder via Smithery, ALLOW_COMMANDS auf `vswrite,typst,git,ls,cat,grep,find` limitiert | `src/main/mcpSetup.ts` |
| 8 | **CLI-Skill-Prompt** | Sechster Skill: erklärt Claude wann CLI vs MCP zu nutzen ist | `src/shared/skillTemplates.ts` |
| 9 | **Doku-Refresh** | handbuch/handbook/mcp-server/CLAUDE.md/status um CLI-Surface erweitert | `documentation/` |

**Out of scope** (separate Iterationen):
- Watch-Mode (`vswrite compile --watch`) — neue Funktionalität, nicht 1:1 zu MCP-Tools
- Shell-Completion (`vswrite completion bash`) — nice-to-have, 1-2h zusätzlich
- Windows + Linux CLI-Support — aktuell ist vswrite arm64-mac-only
- Homebrew-Formula — kommt mit der Distribution-Welle, nicht jetzt
- TTY-Color-Detection + Pager — Polish, später

---

## Architektur-Kerndecisions

### Eine Binary, drei Modi

Das Bun-compiled `vswrite-mcp` Binary entscheidet per argv:

```
vswrite-mcp                          → MCP-Server-Modus (stdio) — Bestandscode
vswrite-mcp <command> [opts]         → CLI-Modus (argv → tool → stdout)
vswrite-mcp --version                → Version + Build-Info
```

Kein zweites Build-Artefakt, kein zweiter Compile-Step. Build-Script bleibt `scripts/build-mcp-binary.mjs` unverändert.

Für die User-facing Installation wird das Binary als `vswrite` Symlink/Copy auf PATH gelegt (siehe Install-Flow unten). Aufruf wird dann `vswrite compile` statt `vswrite-mcp compile` — kosmetisch, aber wichtig für die UX.

### Tool-Body-Refactor: vorher → nachher

```typescript
// vorher (in server.ts):
server.tool(
  'vswrite_set_project',
  'Sets the active project directory...',
  { projectDir: z.string() },
  async ({ projectDir }) => {
    const absDir = path.resolve(projectDir);
    if (!fs.existsSync(absDir)) {
      return { content: [{ type: 'text', text: `Error: …` }], isError: true };
    }
    state.projectDir = absDir;
    // ... rest of body
    return { content: [{ type: 'text', text: 'Project set...' }] };
  },
);

// nachher:
export async function vswriteSetProject(args: { projectDir: string }) {
  const absDir = path.resolve(args.projectDir);
  if (!fs.existsSync(absDir)) {
    return { content: [{ type: 'text', text: `Error: …` }], isError: true };
  }
  state.projectDir = absDir;
  // ... rest of body
  return { content: [{ type: 'text', text: 'Project set...' }] };
}

server.tool(
  'vswrite_set_project',
  'Sets the active project directory...',
  { projectDir: z.string() },
  vswriteSetProject,   // ← jetzt referenziert
);
```

52× zu wiederholen, **rein mechanisch**. Kein Logik-Eingriff. Die Tool-Funktionen returnen weiterhin das MCP-Response-Shape (`{ content: [{type: 'text', text}], isError? }`). Der CLI-Output-Formatter extrahiert dann nur `content[0].text` oder serialisiert die ganze Response als JSON.

### CLI-Command-Hierarchie

Statt 52 flacher Commands gibt's Subcommands gruppiert nach Domain:

```
vswrite project set <dir>
vswrite project info
vswrite project search <query> [--whole-word] [--regex]

vswrite document open <file>
vswrite document compile
vswrite document export pdf <output>
vswrite document export docx <output>

vswrite design list-elements
vswrite design list-themes
vswrite design list-layouts
vswrite design apply-palette <preset>
vswrite design apply-theme <id>
vswrite design apply-layout <id>
vswrite design insert <element-id> [--param key=value ...]

vswrite chapter list
vswrite chapter add <name>
vswrite chapter reorder <id1> <id2> ...

vswrite version save -m "message"
vswrite version list
vswrite version show <id>
vswrite version restore <id>

vswrite comment add --anchor "..." -m "message"
vswrite comment list [--file <path>]
vswrite comment resolve <id>

vswrite ref insert <label> --anchor "..."
vswrite footnote add --anchor "..." -m "body"

vswrite citation list
vswrite citation add <bibtex-snippet>
vswrite citation find-source <citekey>

vswrite git status / commit / push   (optional — bleibt nur falls vswrite-spezifischer Mehrwert)
```

Das ergibt natürliches CLI-Vokabular für Claude im Bash-Mode. Argument-Parsing mit `commander.js` (~50KB, well-known, MIT, ESM-tauglich für Bun).

### Project-Auto-Discovery

CLI-Invocations sind stateless. Statt jedes Mal `--project-dir` zu erzwingen:

```typescript
function discoverProject(): string {
  // 1. --project-dir flag wins
  if (cliOpts.projectDir) return path.resolve(cliOpts.projectDir);
  
  // 2. VSWRITE_PROJECT env var
  if (process.env.VSWRITE_PROJECT) return process.env.VSWRITE_PROJECT;
  
  // 3. Walk up from CWD looking for .vswrite/ (like git's .git/)
  let dir = process.cwd();
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, '.vswrite'))) return dir;
    dir = path.dirname(dir);
  }
  
  throw new Error('No project found. Use --project-dir or cd into a vswrite project.');
}
```

Resultat: `cd ~/Documents/my-thesis && vswrite compile` funktioniert ohne weiteres Setup. Wie `git` aus jedem Subdirectory einer Working-Copy heraus funktioniert.

### Output-Formatter

```typescript
function printResult(result: McpToolResult, asJson: boolean) {
  if (asJson) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  
  // human-friendly: extract the text field
  for (const part of result.content) {
    if (part.type === 'text') console.log(part.text);
  }
  
  if (result.isError) process.exit(1);
}
```

Plain-Text-Default reicht für 90% der Calls. `--json` für Scripts und für Fälle wo Claude strukturiert weiterverarbeiten will (z.B. compile-errors mit file/line). Future: `--quiet` für nur exit-codes, `--watch` für live re-runs.

### Shell-MCP Bundling — die User-Anforderung

Damit Claude Desktop die CLI nutzen kann braucht es einen Shell-MCP. Drei Pfade:

**A — Bundled-Binary-Approach:** vswrite ships `mcp-shell-server` (Python-based) ODER `bash-mcp` (Node-based) im .app, schreibt beim Setup zwei MCP-Einträge in Claude-Config.

| Pro | Con |
|---|---|
| Echte One-Click-UX | vswrite haftet für Sicherheit eines fremden Binarys |
| Funktioniert offline | Code-Signing-Komplexität verdoppelt |
| | Apple-Notarization muss zweites Binary mit-zertifizieren |

**B — Smithery-Guided-Install:** Modal-Button löst `npx -y @smithery/cli install mcp-shell-server --client claude` aus. Smithery verwaltet Binary + Upgrades.

| Pro | Con |
|---|---|
| Trust-Burden bei Smithery | Internet beim ersten Setup nötig |
| Updates wandern automatisch | Smithery als zusätzliche Dependency-Vendor |
| Klare Verantwortlichkeitstrennung | Drei Klicks statt einer |

**C — Eigenes Mini-Shell-MCP bauen:** wir schreiben einen 200-Zeilen-Wrapper der NUR `vswrite`-CLI plus minimal Filesystem (`ls`, `cat` in `<project>/`) durchlässt.

| Pro | Con |
|---|---|
| Voll kontrollierte Surface | Mehr Code zu maintainen |
| Striktes Sandboxing möglich (nur project-dir + CLI) | Doppelt Arbeit |
| Branded „vswrite-shell" | |

**Empfehlung: B (Smithery) als Default mit Option-A-Fallback** für offline-installs (Enterprise-Kontext, air-gapped Macs). Smithery ist 2026 etablierter Distribution-Channel; ALLOW_COMMANDS-Restriktion auf `vswrite,typst,git,ls,cat,grep,find,head,tail,wc` gibt vernünftige Sicherheits-Surface ohne den Nutzer zu sehr einzuschränken.

### Install-Flow

CLI-Binary muss auf PATH. Default:
- macOS: `/usr/local/bin/vswrite` (braucht Admin-Escalation via `osascript -e 'do shell script ... with administrator privileges'`)
- Fallback ohne Admin: `~/.local/bin/vswrite` + Hinweis „add to PATH"
- Langfristig: Homebrew-Formula

Beim ersten App-Launch (oder Help-Menu → „Setup Claude Desktop Integration") öffnet sich Modal:

```
┌─────────────────────────────────────────────┐
│ Setup vswrite for Claude Desktop            │
├─────────────────────────────────────────────┤
│                                             │
│ vswrite works best when Claude can talk     │
│ to it directly. Set up these three:         │
│                                             │
│ [x] vswrite extension (.mcpb)               │
│     For structured tool calls               │
│                                             │
│ [x] vswrite CLI                             │
│     Installs `vswrite` to /usr/local/bin    │
│     (requires admin password)               │
│                                             │
│ [x] Shell access companion                  │
│     Lets Claude run terminal commands       │
│     (installs mcp-shell-server via Smithery)│
│                                             │
│ Your Pro license is already activated.      │
│                                             │
│         [ Skip ]      [ Set Up ]            │
└─────────────────────────────────────────────┘
```

Drei Checkboxes individuell deaktivierbar für Power-User die schon was eingerichtet haben. Modal kann im Help-Menü („Re-run Claude Desktop Setup…") jederzeit wieder aufgerufen werden.

---

## Implementierungsphasen

Reihenfolge ist nach **Risiko-Cluster** organisiert: zuerst das Mechanische (Refactor), dann das Strukturelle (Dispatcher), dann das Vertikale-MVP, dann die Companions, dann der Long-Tail.

### Phase 1 — Mechanischer Tool-Body-Refactor (~3-4 h)

Alle 52 `server.tool(name, desc, schema, async (args) => {...})` Aufrufe so umstrukturieren dass die Arrow-Function durch eine benannte exportierte Funktion ersetzt wird. Kein Logik-Eingriff. Nach jedem ~10er-Batch: `npm run build` + `svelte-check` + ein MCP-Smoke-Test (initialize + tools/list + ein Tool-Call) gegen das Sample-Projekt.

Output: `src/mcp/server.ts` mit 52 exportierten `vswriteXxx(args)` Funktionen die identisch wie vorher funktionieren, plus einer separaten `TOOL_HANDLERS` Registry-Map damit der CLI-Dispatcher sie nach Tool-Name aufrufen kann ohne sie einzeln zu importieren.

### Phase 2 — Argv-Dispatcher + CLI-Skelett (~2 h)

`commander.js` als devDep. `src/mcp/cli.ts` mit `runCli(argv)` Funktion die alle Commands registriert. Top-Level-Argv-Check in `main()`:

```typescript
async function main() {
  parseArgs();
  
  const firstArg = process.argv[2];
  if (firstArg && !firstArg.startsWith('-')) {
    await runCli(process.argv.slice(2));
    return;
  }
  
  // existing MCP server flow
}
```

Output: das Binary nimmt jetzt Subcommands an, aber nur ein einziger funktioniert (`vswrite version` für Build-Info). Refactor- und Dispatcher-Skelett verifiziert.

### Phase 3 — 8-Command-MVP (~3-4 h)

Die acht wichtigsten Commands implementieren, alle gegen das Sample-Projekt durchspielen:

```
vswrite project set <dir>
vswrite project info
vswrite document compile
vswrite design list-elements
vswrite design apply-palette <preset>
vswrite design apply-theme <id>
vswrite design insert <element> [params]
vswrite version save -m <msg>
```

Damit kann man **einen kompletten Design-Workflow** in der Shell durchspielen. Outcome: weißt ob das CLI-Surface gut sitzt bevor du die restlichen 44 nachziehst.

### Phase 4 — First-Run-Modal + Shell-MCP-Setup (~4-5 h)

`McpSetupWizard.svelte` erweitern um drei Checkboxes statt nur „vswrite installieren". Backend in `mcpSetup.ts`:

- `installVswriteCli()` — kopiert Binary nach `/usr/local/bin/vswrite` mit Admin-Escalation
- `installShellMcp()` — startet Smithery-CLI via `child_process.spawn`, wartet auf success, schreibt eigenen MCP-Entry falls noch nicht da
- Bestehender `setupMcpServer()` für die `.mcpb` bleibt

Ein Hilfe-Menü-Item „Re-run Claude Desktop Setup…" damit User später nachinstallieren können.

### Phase 5 — Restliche 44 Commands (~6-8 h)

Mechanisch die übrigen Tools als CLI-Commands wrappen. Pro Command:
1. commander.js-Registrierung mit den Zod-Schemas als Quelle für Argument-Typen
2. Aufruf der entsprechenden `vswriteXxx`-Funktion
3. Output durch `printResult()` schicken
4. Smoke-Test mit echtem Aufruf

Können in Batches von 10 commitet werden, jeweils mit Build-Verify.

### Phase 6 — CLI-Skill-Prompt (~2 h)

Sechster Skill in `src/shared/skillTemplates.ts`: `CLI_USAGE_SKILL` der erklärt:

- Wann `vswrite <command>` (CLI) statt `vswrite_xxx` (MCP) zu nutzen ist
- Project-Auto-Discovery: cd statt --project-dir
- `--json` Output für strukturierte Weiterverarbeitung
- Composability: `vswrite design list-elements --json | jq '.[].id'`
- Konkrete Example-Workflows die Bash + vswrite-CLI kombinieren

Per `ensureClaudeSkills` deployed; MCP-Server bekommt sechsten Prompt-Eintrag `cli-usage`.

### Phase 7 — Decision-Point: MCP trimmen oder behalten? (post-test)

Nach 2-3 Wochen produktiver Test-Nutzung (du + ggf. Beta-User) basierend auf realen Daten entscheiden:

**Option A — Status quo behalten:** beide vollwertig nebeneinander. Maximale Flexibilität, maximale Surface, doppelte Pflege.

**Option B — MCP auf strukturierte Tools trimmen:** Filesystem + Git + simple Compile aus dem MCP rauswerfen weil CLI + shell-MCP sie ersetzt. Bleiben ~30-35 wirklich strukturierte Tools (Design, Anchor-basierte Inserts, Cross-Refs, Comments). Context-Ersparnis: ~1.5-3k Tokens.

**Option C — MCP komplett entfernen:** CLI plus shell-MCP ersetzen alles. Kleinste möglicher Footprint, aber Anchor-basierte Inserts via CLI sind klobig (`--anchor "..."` mit langen Verbatim-Strings).

Mein Bauchgefühl: **B** wird die richtige Antwort sein, aber ohne Daten ist's nur Bauchgefühl.

### Phase 8 — Doku (~2 h)

- handbuch.md / handbook.md: neuer Abschnitt „CLI" mit Setup + Commands + Examples
- mcp-server.md: cross-link zur CLI-Doku
- CLAUDE.md: Dual-Mode-Binary-Architektur, Tool-Body-Refactor-Pattern
- project_status.md: Session-Eintrag
- next-steps.md: CLI-Phase abhaken

---

## Cross-cutting concerns

### Lizenz-Validation in CLI-Mode

Aktuell zwingt `validateProLicense()` einen Polar-API-Call beim MCP-Startup. Für eine CLI ist das **inakzeptabel** — jeder `vswrite compile` würde 200-500ms warten plus Internet brauchen.

Lösung: CLI-Mode cached den Validation-Erfolg in `~/Library/Application Support/vswrite/cli-license-cache.json` mit Ablauf nach 7 Tagen. Wenn cache valid → direkt durch. Wenn expired ODER fehlend → Polar-Call mit `--no-license-check` als escape hatch für offline. Bei wiederholtem Polar-Fail (statt offline-grace die wir heute haben) → fail mit klarer Message.

### Concurrent Tool-State-Race aus dem MCP-Test

Erinnerung: beim MCP-Smoke-Test fanden wir dass `vswrite_open_file` + `vswrite_compile` ohne Sleep dazwischen race-conditioned weil das MCP-SDK Tools concurrent abarbeitet. Im CLI-Mode ist das nicht relevant — jede Invocation ist ein frischer Prozess. State wird nicht über mehrere Calls gehalten (außer im Filesystem via `.vswrite/`). Die Tool-Funktionen müssen idempotent + standalone aufrufbar sein — das sind sie schon, aber wir sollten beim Refactor darauf achten dass jede Funktion ihre Voraussetzungen (z.B. `state.projectDir` gesetzt) selbst überprüft.

### Binary-Size & Distribution

CLI-Mode erhöht die Binary-Größe um ~200 KB (commander.js + minimal helpers). Vernachlässigbar bei den 62 MB Bun-Runtime.

Distribution: das `vswrite.mcpb` enthält das gleiche Binary das auch als CLI dient. User die `.mcpb` installieren bekommen die CLI mit, müssen aber nochmal aktiv den `vswrite` Symlink/Copy auf PATH legen lassen — das macht der Setup-Wizard.

### Backward Compatibility

MCP-Mode bleibt 100% kompatibel. Keine Tool-Schemas ändern sich, keine Response-Shapes. Bestandsuser die nur die `.mcpb` installiert haben merken nichts vom CLI-Code.

---

## Verifikation pro Phase

Pro Commit eines neuen Commands ODER Refactor-Batches:

1. `unset ELECTRON_RUN_AS_NODE && npm run build` — Build muss durch
2. `npx svelte-check --threshold error` — 0 errors (1525 files baseline)
3. `npm run build:mcp-binary` — Bun-Compile muss durch
4. MCP-Smoke-Test: handshake + tools/list + ein representativer Tool-Call gegen Sample-Projekt
5. CLI-Smoke-Test (für neue CLI-Commands): `./dist/mcp/bin/vswrite-mcp <command>` mit echten Args, exit-code 0
6. Commit mit fokussierter Message

Am Ende der Phase 5 (MVP + alle 52 Commands):
- E2E-Walkthrough: Sample-Projekt von Scratch designen via Bash-only-Workflow
- `.mcpb` rebuild + Smoke-Test gegen die rebuilte Bundle (Stabilitätscheck dass kein MCP-Tool kaputt ging)
- Echte Test-Session in Claude Code (oder Cursor) mit dem CLI als einziger Anbindung

---

## Open questions (während Implementation zu lösen)

1. **Welcher Shell-MCP konkret bundlen?** `mcp-shell-server` (Python, robuster) vs `bash-mcp` (Node, leichter, vermutlich passender weil unser Binary auch Bun ist). Eigenes Mini-Wrapper schreiben wäre cleanste Lösung, kostet aber 1-2 Tage extra. Vorzugsentscheidung: **Smithery + `mcp-shell-server`** weil das die etablierte Distribution-Pipeline ist.

2. **ALLOW_COMMANDS-Whitelist-Scope:** wie restriktiv? Minimal-Set `vswrite,typst,git,ls,cat,grep,find,head,tail,wc` deckt 90% der vswrite-Workflows. Sollten wir `npm,node,pip,brew` zulassen? Default lieber konservativ, Power-User können erweitern.

3. **CLI-Subcommand-Tiefe:** flach (`vswrite design-apply-palette`) vs nested (`vswrite design apply-palette`)? Nested ist idiomatischer und gibt natürliche `vswrite design --help`-Discoverability. Tendenz: **nested**.

4. **`--project-dir` als globales Flag oder pro Command?** Global (`vswrite --project-dir /path compile`) ist konsistenter aber zwingt User vor `compile` davor. Auto-Discovery via `.vswrite/`-Walk-Up macht globales Flag in 99% der Fälle unnötig — also: **global, aber Auto-Discovery als primary path**.

5. **CLI-Binary-Name:** `vswrite` (kollidiert nicht mit nichts), `vswrite-cli` (expliziter), `vsw` (kürzer)? **`vswrite`** — die App heißt so, der CLI auch.

6. **Wo wird der CLI-Binary installiert?** `/usr/local/bin/vswrite` braucht sudo. Apple's neuer Standard ist `~/.local/bin/`. Hybrid: try `/usr/local/bin/`, fallback `~/.local/bin/` mit PATH-Hinweis.

7. **Soll's einen `vswrite serve` Command geben** der den MCP-Server explizit startet? Praktisch für custom Setups. **Ja**, low cost, gibt's quasi schon (nur ohne explizites Subcommand).

---

## Effort estimate

| Phase | Aufwand | Risiko |
|---|---|---|
| 1: Tool-Body-Refactor | 3-4 h | Niedrig (mechanisch) |
| 2: Argv-Dispatcher | 2 h | Niedrig |
| 3: 8-Command-MVP | 3-4 h | Mittel (UX-Validierung) |
| 4: Setup-Modal + Shell-MCP | 4-5 h | Mittel (Smithery-Integration, Admin-Escalation) |
| 5: Restliche 44 Commands | 6-8 h | Niedrig (mechanisch + Tests) |
| 6: CLI-Skill-Prompt | 2 h | Niedrig |
| 7: Decision-Point | (passive) | (Daten sammeln) |
| 8: Doku | 2 h | Niedrig |

**Total: 22-27 Stunden = ~3-4 vollständige Arbeitstage** für End-to-End-Lieferung. MVP-Stopp nach Phase 3 wäre **~8-10 Stunden** und liefert ein evaluierbares Resultat.

---

## Done criteria

- [ ] `vswrite-mcp` Binary kann beide Modi (MCP-stdio und CLI-argv)
- [ ] Alle 52 Tool-Bodies sind benannte Funktionen, sowohl MCP- als auch CLI-aufrufbar
- [ ] CLI-Commands für mindestens die 52 MCP-Tools verfügbar; project-auto-discovery funktioniert
- [ ] `--json` Flag liefert das volle MCP-Response-Shape; ohne Flag plain-text
- [ ] First-Run-Modal installiert `.mcpb` + CLI + Shell-MCP in einem Schritt
- [ ] `vswrite` ist nach Setup auf PATH; `vswrite --version` funktioniert ohne weiteres Setup
- [ ] Shell-MCP ist via Smithery installiert, mit ALLOW_COMMANDS-Whitelist
- [ ] CLI-Skill-Prompt deployed und MCP exposed
- [ ] Doku (handbuch/handbook/mcp-server/CLAUDE.md/status/next-steps) ist aktuell
- [ ] E2E-Test: Sample-Projekt komplett über CLI im Terminal modifizieren funktioniert
- [ ] E2E-Test in Claude Desktop: Claude nutzt CLI via Shell-MCP statt MCP-Tools direkt — Token-Verbrauch messbar niedriger

---

## Strategischer Ausblick

Sobald CLI + Shell-MCP-Companion live sind, hat vswrite **drei orthogonale Distribution-Pfade** für Drittclients:

1. **Claude Desktop**: `.mcpb` für strukturierte Tools + Shell-MCP für die CLI (beide via Setup-Modal)
2. **Claude Code**: nur CLI-Binary, plus Skill-Doku — Bash builtin macht den Rest
3. **Cursor / Cline / Codex / VS Code**: CLI-Binary plus optional `.mcpb` über deren MCP-Configs

Plus die App selbst als WYSIWYG-Editor für Menschen die nicht agentic arbeiten.

Damit wäre vswrite die **erste Typst-Surface die client-agnostic von jedem ernsthaften AI-Agent-Tool angesteuert werden kann**. Das ist die Position aus der heraus sich auch andere Things sinnvoll verkaufen lassen (ai-magazine-designer, kommende Tools, etc.).
