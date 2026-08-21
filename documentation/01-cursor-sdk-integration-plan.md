# Cursor-SDK — In-App-Chat in Penwright

**Status:** Gebaut und im Dev-Lauf bestätigt (Host, IPC, ChatPanel, Settings → Cursor, „In Chat einfügen“, Chatverwaltung: Tabs / History / +). Phase 3 (Usage-Bilder, Lizenzen, packaged Spike / Native-Binaries im Notar-Build) offen.
**Stand:** 2026-08-21 · SDK `@cursor/sdk` (public beta) · Penwright **0.12.0** · MCP **66 Tools** · `MCP_SETUP_VERSION` **0.43.0**
**Quellen:** [Cursor TypeScript SDK](https://cursor.com/docs/sdk/typescript), [Auth](https://cursor.com/docs/sdk/typescript.md#cursorauth), [MCP im SDK](https://cursor.com/docs/sdk/typescript.md#mcp-servers), [Cookbook](https://github.com/cursor/cookbook), Forum (Electron-Sandbox, ToS), Code: `mcpRegistration.ts`, `mcpSetup.ts`, `sessionState.ts`, `server.ts`.

---

## 0. Die drei Antworten, vorneweg

1. **Funktioniert die Idee?** → **Ja, mit einer festen Form.** Local-Agent im Electron-Main-Prozess, `cwd` = geöffnetes Projekt, MCP **inline** auf dasselbe Binary, das heute Cursor/Claude bekommen (`buildServerDefinition()`). Der Agent schreibt über die bestehenden 66 Tools; der Editor aktualisiert sich über den Watcher wie bei jeder anderen Host-KI. Abrechnung läuft über das Cursor-Konto der nutzenden Person, nicht über eine Penwright-API.

2. **Stimmt das mentale Modell?** → **In der Richtung ja, in drei Punkten nicht.** (a) „Local“ heißt *Dateien bleiben auf der Maschine*, nicht *das Modell läuft lokal* — Inferenz geht immer durch Cursor-Hosted-Models. (b) Der Agent ist ein Coding-Agent mit Shell/Edit/Write. Ohne Tool-Restriktion umgeht er Snapshots, Style-Guard und Safe-Apply. (c) Ein Login in der Cursor-IDE reicht nicht; Penwright hat ein eigenes Settings-Login (`Cursor.auth.login()`, 90-Tage-Key).

3. **Wann bauen?** → **Nach dem Launch, Spike zuerst.** Die Kernschleife der App ist zu ([next-steps.md](next-steps.md)). Das SDK ist public beta, die Electron-Einbettung hat bekannte Native-Binary-Fallen, und ohne den Spike in §10 wissen wir nicht, ob der Import im Main-Prozess überhaupt startet. Kill-Kriterium in §12.

> Die *ob*-Entscheidung ist Renés. Der Plan unten ist die Form, in der es nicht die Parität zerstört, die Sessions 41–48 teuer erkauft haben.

### 0.1 Die Kernschleife (Produktentscheidung)

**Eine App.** Penwright auf, anmelden, Projekt anlegen oder öffnen, im Chat sagen was man braucht — der Agent arbeitet los, inkl. Design. Keine Cursor-IDE, kein Claude-Desktop-Handoff, kein Prompt kopieren. Dieselbe Geste wie jetzt im Cursor-Chat: Satz schreiben, Senden, zusehen.

1. Penwright öffnen.
2. Einmal unter **Einstellungen → Cursor** anmelden und ein Modell wählen (bleibt, bis der 90-Tage-Key abläuft).
3. Projekt über den Start-Screen **neu anlegen oder öffnen** (Ordnerwahl = Mensch).
4. Chat: „Cover dunkler“, „Kapitel Methoden dazu“, „das liest sich steif“, „mach daraus ein Magazin“. Der Agent wählt die MCP-Tools selbst (`render_page`, Design-Tokens, Schreiben, Snapshots) — kein Werkzeug-Menü, das der Mensch bedienen muss.
5. Optional präziser: Text markieren → Rechtsklick **In Chat einfügen** (einziger KI-Eintrag) → im Composer beschreiben, was an *dieser* Stelle soll.

**✨ Design with AI** im Rechtsklick **fällt weg.** Der Copy-Prompt- / Open-Claude-Handoff (`DesignAiPopover`) ebenfalls. Die Anker-Erfassung darunter (`selection.json`, `penwright_get_selection`) bleibt als Maschine hinter „In Chat einfügen“.

Was **nicht** wegfällt, und warum das kein Widerspruch zur „nur eine App“-Regel ist:

| Braucht weiter einen Menschen | Warum |
|---|---|
| Ordner für *Neues Projekt* / *Öffnen* | Ein Modell darf nicht irgendwohin auf die Platte schreiben. Danach gehört das Projekt dem Chat. |
| Internet | Inferenz ist Cursor-hosted, auch im Local-Agent. |
| Ein Cursor-Abo | Penwright stellt kein Modell. Ohne Konto bleibt die App eine WYSIWYG-App ohne In-App-Chat. |

Die MCP-Registrierung in Cursor/Claude (Hilfe → MCP-Verbindung) bleibt für Leute, die die IDE *weiterhin* nutzen wollen. Sie ist nicht mehr der Weg, den die UI anbietet. Onboarding, Kontextmenü und Design-Tab zeigen nicht mehr auf Claude.

---

---

## 1. Was das Cursor SDK wirklich ist

`@cursor/sdk` (npm, TypeScript; Pendant `cursor-sdk` für Python) steuert denselben Agenten, der in der Cursor-IDE, der CLI und der Web-App läuft. Public beta. Gemeinsames Modell:

| Begriff | Bedeutung |
|---|---|
| **Agent** | Langlebiger Container: Gespräch, Workspace, Settings. Überlebt mehrere Prompts. |
| **Run** | Ein abgeschicktes Prompt. Hat Stream, Status, Ergebnis, Cancel. |
| **Runtime local** | Agent-Loop + Dateizugriff auf der aufrufenden Maschine gegen `cwd`. |
| **Runtime cloud** | Cursor-VM, frisch geklontes Repo. |

Es gibt drei Aufrufformen. Für einen Chat in Penwright ist nur eine richtig:

1. `Agent.prompt(...)` — one-shot, kein Follow-up. Falsch für Chat.
2. **`Agent.create(...)` + `agent.send(...)`** — Streaming, Multi-Turn, Cancel. **Das ist die Form.**
3. `Agent.resume(id)` — denselben Agenten nach App-Neustart wieder aufnehmen. Brauchen wir für Gesprächs-Persistenz.

Docs: [cursor.com/docs/sdk/typescript](https://cursor.com/docs/sdk/typescript). Skill im Cursor-Tree: `sdk` (`Agent.create` / `send` / `resume`).

### 1.1 Local ≠ lokales Modell

Wörtlich aus den Docs:

> "Local" describes where the agent loop and filesystem access run, not where the model runs. All inference goes through Cursor's hosted models in both modes.

Dateien bleiben auf der Platte. Tokens, Prompts und Tool-Ergebnisse gehen an Cursor. Privacy Mode folgt dem Konto der eingeloggten Person, nicht einer Penwright-Einstellung.

Cloud-Runtime ist für Penwright **falsch:** das Projekt liegt lokal, oft ohne GitHub-Remote, und der MCP-Server muss an genau diesen Ordner und an `session.json` / `active-project.json`. Eine Cursor-VM sieht das nicht. `cloud: { repos: [] }` (no-repo) wäre Recherche ohne Dateien — nicht der Schreib-Chat.

### 1.2 Auth und Abrechnung — das, was die Idee trägt

Zwei Wege, beide belasten das **Cursor-Abo der nutzenden Person**, nicht Penwright:

| Weg | Wie | Rechnung |
|---|---|---|
| User API Key | Dashboard → API Keys, oder `CURSOR_API_KEY` | Plan dieser Person |
| `Cursor.auth.login()` | Browser-Login auf cursor.com, mint Key, Default-Store `~/.cursor/sdk/auth.json`, TTL **90 Tage** | dieselbe Person |
| Team Service Account | Team Settings | Team-Pool (Enterprise) |

Team-Admin-Keys sind explizit **nicht** unterstützt.

Auflösungsreihenfolge überall im SDK: explizites `apiKey` → `CURSOR_API_KEY` → gespeicherter Login. **Der gespeicherte Login liest nicht die Cursor-IDE.** Wer in Cursor eingeloggt ist, ist in Penwright trotzdem nicht eingeloggt, bis `login()` (oder ein Key) einmal gelaufen ist.

`openBrowser` akzeptiert eine Funktion — in Electron: `shell.openExternal`. `onLoginUrl` liefert die URL, falls der Browser nicht aufgeht. `store` ist austauschbar (`FileCredentialStore` / `InMemoryCredentialStore`); Penwright legt den Key nach `userData` (`…/cursor-sdk/`), nicht nach `~/.cursor/sdk/`, damit Logout in Penwright die IDE nicht mitnimmt.

**Login und Modellwahl leben in den Einstellungen**, nicht versteckt im Chat. Der Chat-Leerzustand darf denselben IPC-Login anbieten (Shortcut), Wahrheit ist eine Settings-Sektion **Cursor** in [`SettingsPanel.svelte`](../src/editor/components/SettingsPanel.svelte):

- Status: ausgeloggt / eingeloggt (`Cursor.me()` → E-Mail) / Key läuft in *n* Tagen ab.
- Buttons Anmelden / Abmelden. Anmelden = `Cursor.auth.login({ openBrowser: url => shell.openExternal(url) })`.
- Modell-Dropdown aus `Cursor.models.list()` (account-spezifisch, nicht hardcoden). Auswahl global in electron-store (`chatModelId`), nicht projekt-lokal — das Konto ist geräteweit. Jeder `Agent.create` / `send` liest diesen Wert.
- Ein Satz Disclaimer: Nutzung geht aufs Cursor-Abo; Penwright bleibt kostenlos.

Die Settings-Dialoge brauchen heute ein offenes Projekt (Dokument-Sprache, Bibliographie, Preview). Die Cursor-Sektion ist **app-global**. Deshalb: derselbe Dialog vom Start-Screen erreichbar (Menü **Penwright → Einstellungen** / `Cmd+,` auch ohne Projekt), und die Dokument-Sektionen bleiben ausgegraut bzw. versteckt bis ein Projekt offen ist. Interface-Sprache sitzt schon in diesem Dialog und gewinnt denselben Start-Screen-Zugang nebenbei.

Advanced, eingeklappt: API-Key einfügen, für Leute die keinen Browser-Login wollen. Nicht der Default.

Billing (Docs, verifiziert):

- Dieselben Preise, Request-Pools und Privacy-Mode-Regeln wie IDE und Cloud Agents.
- Spend erscheint im Usage-Dashboard unter dem Tag **SDK**.
- `result.usage` / Stream-Event `"usage"` = Token-Zähler einer Run.
- `agent.getUsage()` = abgerechneter Record plus `chargedCents`. `chargedCents === 0` bei Plan-inklusive, BYOK und Credit-Grants.

Das ist genau das Versprechen: **kein OpenAI-/Anthropic-Key in Penwright, kein Token-Weiterverkauf.** Penwright bleibt kostenlos; KI ist Bring-your-own-Cursor.

Cursor-Mitarbeiter im Forum (ToS-Thread, sinngemäß): SDK als Backend in *eigenem* Produkt ist intended use. Verboten ist, Cursor selbst weiterzuverkaufen oder Nutzung unter *unserem* Konto an Dritte zu geben. Wir dürfen also nicht einen Penwright-Service-Account für alle Nutzer:innen teilen — jede Person loggt sich selbst ein. Das passt zum Produkt.

### 1.3 MCP im SDK — der Stecker, den wir schon haben

Local-Agents laden MCP-Server aus bis zu fünf Quellen. Ohne `local.settingSources` gelten **nur inline**-Server. Das ist die richtige Voreinstellung:

```ts
mcpServers: {
  penwright: {
    type: 'stdio',
    command: def.command,   // ensureInstalledBinary()
    args: def.args,         // []
    env: def.env,           // TYPST_BIN / PACKAGE_PATH / FONT_PATH / PRESETS / DOCS
    cwd: projectDir,
  },
}
```

`buildServerDefinition()` in [`mcpRegistration.ts`](../src/main/mcpRegistration.ts) ist genau diese Definition. Cursor-IDE, Claude Code und der In-App-Agent müssen **dasselbe Binary + dasselbe Env** sehen. Nicht neu bauen, nicht einen zweiten Server erfinden.

Wichtige SDK-Fallen, alle dokumentiert:

- Inline-`mcpServers` auf `send()` **ersetzen** die von `create()` vollständig, sie mergen nicht.
- Nach `Agent.resume()` sind inline-Server **weg** — beim Resume wieder mitgeben.
- `settingSources: ["user"]` würde `~/.cursor/mcp.json` laden. Penwright schreibt sich dort schon beim Boot hin → **doppelter Penwright-MCP**, plus fremde Server der IDE. Default bleibt `settingSources` leer / ungesetzt.
- Sandbox (`local.sandboxOptions.enabled: true`) blockt MCP-Tool-Calls im Headless-Modus ohne Approval-Callback. Forum: bekannte Lücke, Workaround „Sandbox aus + inline MCP“. Für v1 **Sandbox aus**, Schutz über Tool-Allowlist (§3.1), nicht über `cursorsandbox`.

### 1.4 Tool-Restriktion — ohne die ist die Idee falsch

Default: der Local-Agent führt Shell, Edit, Write **ohne Nachfrage** aus. Docs: *„there's no human-in-the-loop prompt in headless mode.“*

Wenn der Agent `edit`/`write` auf `kapitel.typ` hat, schreibt er an `penwright_write_file` / `safeApply` / Snapshots / Style-Guard vorbei. Das ist ein P4-Bruch (siehe [app-mcp-parity.md](app-mcp-parity.md) und CLAUDE.md → Parity).

SDK-API dafür existiert und ist local-only:

```ts
tools: ['mcp', 'read', 'grep', 'glob', 'ls'],
disallowedTools: ['shell', 'task'],
```

- `tools` = Allowlist der Built-ins. `[]` = gar keine Built-ins, nur Text.
- Capability-Gruppen: `"mcp"` und `"shell"`. `"mcp"` wegnehmen entfernt auch Custom Tools.
- Deny gewinnt. Unbekannte Namen werfen `ConfigurationError` schon bei `create()`.
- Die Restriktion hängt **nicht** am Agenten: bei jedem `resume()` wieder setzen.

Lesen über `read`/`grep` ist P2-kompatibel (die KI darf sehen, was auf der Platte liegt). **Schreiben nur über MCP.** `webSearch` ist eine Produktfrage (Recherche vs. reines Dokument); v1 weglassen, später optional.

`local.customTools` (In-Process-Funktionen, SDK ≥ 1.0.16) sind **nicht** der Weg für die 66 Dokument-Tools. Sie würden die MCP-Schicht duplizieren und Cloud unmöglich machen. Optional später für UI-Glue, das MCP bewusst nicht hat: „scroll Preview to page N“. Die Markierung selbst ist kein Custom Tool — sie geht über den bestehenden Pin (§4.4).

### 1.5 Streaming, Persistenz, Modus

- `run.stream()` liefert `SDKMessage` (`assistant`, `thinking`, `tool_call`, `usage`, …). `onDelta` gibt Token-Deltas (`text-delta`, `tool-call-started`, …). **Immer** `await run.wait()` — sonst leakt der Run.
- `await using agent = await Agent.create(...)` bzw. `try/finally` + `asyncDispose`. Pflicht in einem langlebigen Electron-Prozess.
- Store: SQLite wenn verfügbar, sonst JSONL. In einem gebündelten Node/Electron-App fällt SQLite oft weg → JSONL einplanen. Ort: `<project>/.penwright/cursor-agent/` (projekt-first, schon in `GITIGNORE_REQUIRED_LINES`). App-global nur der Login-Key in `userData`.
- `mode: "agent" | "plan"` — Plan = vorschlagen, Agent = bauen. Als Toggle im Chat sinnvoll, nicht als Default-Rätsel.
- Model: `Cursor.models.list()` am Login, nicht hardcoden. Docs-Default für Integrationen: `composer-2.5`. `{ id: "auto" }` lässt den Server wählen.

### 1.6 Runtime-Anforderungen

- Node **≥ 22.13**. Electron 41 liefert **Node 24.14.0** — Versionsfloor ist kein Blocker.
- Native Helper: `@cursor/sdk-<plat>-<arch>` (Sandbox-Binary `cursorsandbox`, ripgrep). Liegen nicht im JS-Bundle. Ohne sie fällt Search auf `rg` in `PATH` zurück; Sandbox enabled wirft `ConfigurationError`.
- `@cursor/sdk/bundled` existiert für Single-File-esbuild/Bun-Compile. Penwrights Main wird von electron-vite gebündelt, **Dependencies aber über `externalizeDepsPlugin` externalisiert** ([`electron.vite.config.mts`](../electron.vite.config.mts)). `@cursor/sdk` also als echte `dependency` belassen, nicht inlinen — und die Native-Pakete aus dem asar holen (§7).
- Cookbook-Issue [#42](https://github.com/cursor/cookbook/issues/42): in Electron zeigt `process.argv[1]` auf die App, nicht auf `node_modules`; Walk-up findet `cursorsandbox` nicht, asar kann Native nicht ausführen. **Spike-Item.** Für v1 brauchen wir die Helper nur, wenn Sandbox oder eingebautes rg Pflicht werden. Mit Allowlist ohne Shell ist Sandbox nicht nötig; Grep kann das MCP-`penwright_search_project` übernehmen.

---

## 2. Abgleich mit Penwright — was schon da ist

Die App ist für genau diese Form gebaut, nur der Host saß bisher *neben* der App.

| Baustein | Heute | Rolle im In-App-Chat |
|---|---|---|
| MCP-Binary | Bun-Compile, Kopie nach `~/Library/Application Support/Penwright/mcp-server/` | SDK spawnt **dieselbe** Datei per stdio |
| `buildServerDefinition()` / `buildMcpEnv()` | Cursor + Claude Code + Desktop | dritte:in ist der In-App-Agent |
| `SERVER_INSTRUCTIONS` in [`server.ts`](../src/mcp/server.ts) | < 2 KB, sieht das Dokument, Tokens, Anchors, Snapshots | kommt über MCP-initialize beim Agent an — kein zweiter Systemprompt nötig |
| Skill-Prompts | fünf `SKILL.md` + MCP-Prompts | Agent kann sie listen/lesen wie in Cursor; Spike prüft, ob SDK-Agents MCP-Prompts wirklich ziehen |
| `session.json` / `active-project.json` | App schreibt, MCP liest | In-App-Agent erbt „welche Datei, dirty, lastCompileOk“ ohne neue IPC-Wahrheit |
| `agent-activity.json` | MCP → App, display-only | Chat kann denselben Feed zeigen; nicht steuern |
| Watcher + Write-Provenance | Chokidar, Content-Hash | MCP-Writes erscheinen im Editor wie bisher |
| Safe-Apply, Style-Guard, Snapshots | shared planner, beide Prozesse | bleiben die einzige Schreibschiene, **wenn** Built-in-Write weg ist |
| Design-with-AI-Pin | `selection.json`, Popover „Copy prompt / Open Claude“ | Popover und Rechtsklick-Eintrag **entfernen**. Dieselbe Anker-Zählung treibt „In Chat einfügen“; `penwright_get_selection` bleibt das MCP-Auge |
| `HistoryDialog` / `ai:undoLast` | KI-Änderungen sichtbar | gilt für In-App-Writes automatisch, weil MCP dieselben Snapshots schreibt |

Was **nicht** existiert und auch nicht gebaut werden muss: ein zweiter Tool-Katalog, eine Penwright-eigene Inferenz, IPC zwischen App und MCP. Die Paritätsregel bleibt: *die beiden Prozesse teilen nur den Projektordner.* Der Chat ist ein neuer MCP-**Host**, der zufällig im selben OS-Prozessbaum wie die App lebt. Quitting Penwright tötet Agent + MCP-Child — das ist hier gewollt (anders als Claude Desktop, das entkoppelt bleiben muss).

### 2.1 Dirty Buffer — der eine Vorteil gegenüber der IDE

Heute warnt jedes Schreib-Tool: „Datei ist in Penwright offen und ungespeichert.“ Der In-App-Chat kann das schließen, das die IDE nicht kann: **vor `send()` speichern**, damit Platte = Editor. Dann sieht der Agent, was der Mensch sieht (P2), und der Watcher kämpft nicht gegen einen dirty Buffer. Das ist kein kleines UX-Detail, das ist der Grund, warum der Chat *in* der App besser ist als „Cursor daneben“.

---

## 3. Architektur

```
┌─────────────────────────────────────────────────────────────────────┐
│ Penwright                                                           │
│                                                                     │
│  Renderer                         Main                              │
│  ┌──────────────┐   IPC           ┌──────────────────────────────┐  │
│  │ ChatPanel    │◄───────────────►│ cursorAgentHost.ts           │  │
│  │ (App.svelte  │  send/stream/   │  Cursor.auth.login()         │  │
│  │  Level,      │  cancel/status  │  Agent.create / resume / send│  │
│  │  nicht Sidebar-Tab)            │  tools: [mcp, read, …]       │  │
│  └──────────────┘                 └────────────┬─────────────────┘  │
│                                                │ stdio              │
│                                                ▼                    │
│                                   ┌────────────────────────────┐    │
│                                   │ penwright-mcp (installiert)│    │
│                                   │ env: TYPST_* wie alle Hosts│    │
│                                   └────────────┬───────────────┘    │
│                                                │ Dateien            │
│  Editor ←── chokidar ── .typ / style.json / session.json            │
│  Preview ←── compile (unverändert: save / watcher / Refresh)        │
└─────────────────────────────────────────────────────────────────────┘
                    ▲
                    │ HTTPS, Inferenz + Billing
                    │ Cursor.auth Key (userData, 90 Tage)
                    ▼
              Cursor-hosted models
```

### 3.1 Host-Modul (Main)

Neues Blattmodul, analog zu `mcpRegistration.ts` — **kein** Import von Projektmodulen in `appState.ts`.

Verantwortlichkeiten:

- Login/Logout/Status (`Cursor.auth.*`, eigener `FileCredentialStore` unter `app.getPath('userData')/cursor-sdk/`).
- Gewähltes Modell aus electron-store (`chatModelId`), gesetzt in Settings, gelesen bei jedem `create`/`send`. Ungültige IDs (Konto hat das Modell nicht mehr) fallen auf `composer-2.5` bzw. den ersten Eintrag von `Cursor.models.list()` zurück und schreiben den Fallback zurück.
- Ein Agent **pro geöffnetem Projekt.** `cwd = projectDir`. Close-Project → `dispose`. Open-Project → `resume` wenn Store-ID da, sonst `create`.
- Jeder `create`/`resume`/`send` trägt `mcpServers` (aus `buildServerDefinition()`) und die Tool-Allowlist. Kein Pfad, der das vergisst.
- Stream-Events als `penwright`-Push an den Renderer (gleiches Muster wie `compiledPdf` / `backupCreated`). Kein Invoke, der den Main-Thread auf `wait()` blockt — `send` startet, Events fließen, `wait()` intern.
- Vor `send()`: Renderer-Save abwarten (oder Main zwingt `saveFile`), dann erst Agent. Markierungs-Chips aus dem Renderer werden in die User-Message und nach `selection.json` gelegt (§4.4).
- Cancel: `run.supports("cancel")` → `run.cancel()`.
- Fehler: `CursorAgentError` (startete nie: Auth, Netz) vs. `result.status === "error"` (Run lief und scheiterte). UI unterscheidet das.

IPC (neu, alle auf die Preload-Whitelist):

| Kanal | Richtung | Zweck |
|---|---|---|
| `chat:status` | invoke | `{ loggedIn, email?, expiresAt, projectBound, modelId }` |
| `chat:login` | invoke | startet Browser-Login, wartet |
| `chat:logout` | invoke | Key weg, Agent dispose |
| `chat:setModel` | invoke | persistiert `chatModelId`, gilt ab dem nächsten `send` |
| `chat:send` | invoke | `{ text, mode?, anchors?: SelectionPin[] }` → `{ runId, agentId }` |
| `chat:cancel` | invoke | aktive Run |
| `chat:history` | invoke | gespeicherte Turns fürs Panel |
| `chat:models` | invoke | `Cursor.models.list()` gecacht |
| `chat:event` | on (über `Penwright`) | Stream-Deltas, tool_call, usage, done, error |

Renderer importiert **nicht** `@cursor/sdk`. Nur Main. Das SDK ist Node-first, native, und darf nicht in die Chromium-Isolationswelt.

### 3.2 Was der Agent darf und was nicht

| Darf | Darf nicht (v1) |
|---|---|
| MCP-Tools (66, inkl. `render_page`, Design, Snapshots) | Shell |
| `read` / `grep` / `glob` / `ls` im `cwd` | `edit` / `write` (Built-in) |
| Multi-Turn im Projekt-Store | Subagents (`task`) |
| Plan-Modus | Cloud-Runtime |
| — | `settingSources: "user"` / `"all"` |
| — | Custom Tools als Ersatz für MCP |

`local.cwd` ist der Projektordner. `isPathWithin` im MCP bleibt die Sandbox für Writes. Built-in `read` sieht theoretisch alles, was der Prozess sehen kann — Spike prüft, ob `cwd` das wirklich begrenzt; falls nicht, `read` aus der Allowlist nehmen und nur MCP-Reads lassen.

### 3.3 Lebenszyklus gegen die bestehende Projekt-API

`closeProject()` / `openProject()` bleiben die einzigen Teardown/Setup-Pfade. Der Chat-Host hängt sich dort ein (dispose / bind), nicht an `appState`-Felder direkt. Kein Agent ohne `projectDir`. Am Start Screen: Panel sichtbar, aber nur Login + Hinweis „Projekt öffnen“, kein `send`.

Zwei MCP-Prozesse sind möglich (In-App-Agent *und* Cursor-IDE, wenn jemand beides offen hat). Co-Presence (`isForeignEditor`) behandelt denselben User auf derselben Maschine schon als kein Konflikt. Races auf derselben Datei bleiben möglich — das ist dasselbe Risiko wie heute Cursor + Penwright. Nicht neu lösen.

---

## 4. UI

### 4.1 Wo es sitzt

Nicht als Sidebar-Tab. Die Tabs (`files | outline | includes | git | comments | design`) **unmounten** bei jedem Wechsel — im Code extra kommentiert. Ein Chat, der unmountet, verliert den Draft und die Scrollposition und müsste den Stream neu abonnieren.

Vorschlag: **ChatPanel auf `App.svelte`-Ebene**, togglebar, analog `ProjectSearchPanel` (Slide-in) oder als vierte Spalte links der Preview. Die Preview bleibt sichtbar — der Killer-Use-Case ist „auf dieser Seite läuft der Text über, mach die Margins größer“ mit PDF im Blick.

- Toggle: Icon in der Toolbar- oder Preview-Leiste + Menü **Ansicht → Chat** + Shortcut (Vorschlag: `Cmd+L` ist oft „Chat“; bei uns ist `Cmd+Alt+L` schon Reference-Picker — also eher `Cmd+Shift+L` oder `Cmd+J`). Endgültig beim Bau, nicht jetzt festnageln.
- Login und Modell: **Einstellungen → Cursor** (§1.2), nicht als zweite Wahrheit im Panel.
- Persistenz der Panel-Sichtbarkeit: `panelState` / electron-store, wie Sidebar/Preview.
- i18n: neues Namespace `chat` (`en` + `de`), Registrierung in beiden Index-Dateien. Strings erst beim Bau, nicht in diesem Plan.

### 4.2 Was das Panel zeigt

1. **Nicht eingeloggt:** kurzer Screen, Button „Anmelden“ (derselbe IPC wie Einstellungen → Cursor) plus Link „Einstellungen öffnen“. Kein zweites Key-Feld, kein zweites Modell-Dropdown — das gehört in Settings.
2. **Eingeloggt, kein Projekt:** Hinweis, Start-Screen-Karten bleiben der Weg zu Öffnen / Neu.
3. **Gespräch:** User-Bubbles, Assistant-Markdown (kein TipTap — einfaches Markdown reicht), Tool-Chips (`penwright_render_page` → Mini-Preview der zurückgegebenen PNG, `penwright_update_style` → Name des Tools + ok/rollback). Thinking einklappbar. Usage dezent am Run-Ende. Header zeigt das in Settings gewählte Modell als Label, Klick öffnet Settings (kein paralleles Dropdown, das aus dem Tritt gerät).
4. **Composer:** Textarea, Senden, Abbrechen, Mode-Toggle Plan/Agent. Über der Textarea: optionale **Markierungs-Chips** (§4.4). Freitext ist der Default — Chips sind Präzision, kein Pflichtschritt.

Die Messlatte ist der Cursor-Composer, nicht ein Assistenten-Wizard. Wer „gestalte das Cover neu, erster Eindruck zu kühl“ schreibt, ohne etwas zu markieren, muss ein vollständiger, legitimer Turn sein: Agent rendert Seiten, liest Style, ändert Tokens oder setzt Elemente. Markieren ist die schärfere Variante desselben Chats, nicht ein zweiter Modus.

### 4.3 Was das Panel nicht ist

Kein Agent-Dashboard, keine Run-Liste über Projekte, kein Canvas. Ein Gespräch am offenen Projekt. `Agent.list()` / Multi-Agent ist später.

### 4.4 Markierung → „In Chat einfügen“ (ersetzt Design with AI)

**Produktentscheidung:** der Rechtsklick-Eintrag **✨ Design with AI** in [`index.ts`](../src/main/index.ts) wird **entfernt**. `DesignAiPopover` (Copy-Prompt / Open Claude) und das native `designSelection`-Event entfallen mit. Einziger KI-Eintrag bei einer Selektion: **In Chat einfügen**.

```
Markieren → Rechtsklick „In Chat einfügen“ → Chat öffnet,
Chip mit dem Ausschnitt liegt im Composer (noch nicht gesendet) →
Nutzer tippt „mach das zum Pull-Quote“ / „kürzer“ / „diese Stelle umbrechen“ → Senden.
```

Freitext ohne Markierung bleibt der Hauptweg (§4.2). Der Chip ist die Präzision „genau dieser Absatz“, nicht die Voraussetzung dafür, dass Design passiert.

Zwei Schichten, beide nötig:

| Schicht | Was | Warum |
|---|---|---|
| **Sichtbar** | Chip/Zitat im Composer, klickbar zum Entfernen, mehrere Chips erlaubt | Der Mensch sieht, *worüber* geredet wird. |
| **Maschinell** | Dieselbe Anker-Erfassung, die `pinSelectionForDesign()` heute hat (`anchorText`, `occurrence`, Datei, `nodeType`) — Funktion umbenennen (`captureSelectionForChat`). Beim Senden: (1) `selection.json` schreiben, damit `penwright_get_selection` und die Anker-Tools treffen; (2) den Ausschnitt plus `occurrence` in die User-Message legen | MCP sitzt in einem anderen Prozess und sieht die Editor-Selektion nicht. Der Pin ist die Brücke, kein UI mehr. |

Kein neues MCP-Tool. `insert_design_element`, `add_footnote`, `add_image`, `add_comment`, `insert_reference` nehmen alle schon `afterText` + `occurrence`.

Mit entfernen, in derselben Phase:

- Kontextmenü-Label und `designSelection`-Dispatch.
- `DesignAiPopover.svelte` + Mount in `App.svelte`.
- Onboarding-Satz, der den Rechtsklick als Claude-Handoff erklärt (`onboarding.ts` / `designAi.ts`).
- Native-Menü, falls dort noch „Design with AI“ steht.

`penwright_get_selection` und `DESIGN_SKILL` („Designing on Request“) umbiegen: Pin kommt vom Chat-Chip, nicht vom Rechtsklick-Handoff. Tool-Beschreibung und Skill-Text in derselben Phase anpassen (MCP-Binary-Bump `MCP_SETUP_VERSION`).

Grenzen, ehrlich:

- Die Markierung ist **Editor-Text**, nicht eine PDF-Seite. „Auf Seite 3, der Kasten links“ bleibt ein Satz im Chat plus `penwright_render_page`. Wer im Editor den Absatz markiert, zielt präzise.
- Rohblöcke / Karten: `nodeType` fährt mit. Ein ganzer `typstRawBlock` als Chip ist erlaubt.
- Leere Selektion: Eintrag aus.
- Vor Senden speichern (§2.1), sonst zeigt `get_selection` Platte und der Chip zeigt den Buffer.

Phase 2, zusammen mit dem Panel. Ohne den Eintrag gibt es keine Stelle-Geste; ohne ihn *und* ohne Freitext-Design wäre der Chat tot. Beides muss in v1 sitzen.

---

## 5. Produkt, Lizenz, Privacy

**Positionierung.** Penwright bleibt kostenlos. Der In-App-Chat ist optional und braucht ein Cursor-Konto. Wer keins hat, schreibt und gestaltet weiter von Hand — die App gated nichts. Externe MCP-Hosts (Cursor-IDE, Claude) bleiben technisch registrierbar, sind aber nicht mehr Teil der angebotenen KI-Schleife.

**Abhängigkeit.** Public beta, proprietär (Anysphere, ToS). Wir bundlen `@cursor/sdk` + Native-Helper in die App. Das muss in `THIRD_PARTY_LICENSES.md` / Acknowledgments und in die Datenschutzerklärung, *bevor* es in einem öffentlichen Build landet. PolyForm Strict betrifft unseren Code; das SDK bleibt deren Lizenz.

**ToS-Linie, an der wir uns messen:** jede Person authentifiziert sich selbst; wir verkaufen keinen Cursor-Zugang; wir trainieren nichts auf den Outputs. Schriftlich gegenlesen, sobald der Spike steht — Forum-Antworten sind keine Rechtsberatung.

**Privacy, ehrlich:**

- Dateien bleiben lokal. Prompts, Tool-Args und -Ergebnisse (also Dokument-Ausschnitte) gehen an Cursor.
- `@cursor/sdk` hängt `@statsig/js-client` — das SDK hat eigene Telemetrie. Penwright wirbt mit „keine Telemetrie“. Entweder im Spike klären, ob sich das abschalten lässt, oder den Chat-Disclaimer um „Cursor erhebt Nutzungsdaten gemäß deren Privacy Policy“ ergänzen. Nicht unter den Teppich.
- Key in `userData`, 90-Tage-TTL, re-login bei Ablauf. Kein Key ins Projekt, nicht in Git, nicht in Crash-Reports (Scrubber analog Username).

**zod.** Penwright hat `zod` ^4, das SDK ^3. Externalisiert leben beide. Nicht die SDK-Kopie hoisten.

---

## 6. Packaging (Electron)

Bekannte harte Kanten, alle vor dem ersten `package:mac` zu beweisen:

1. **asar.** Fuse `onlyLoadAppFromAsar: true`. Native SDK-Binaries und alles, was das SDK per Walk-up sucht, gehören nach `extraResources` (wie `typst-*` und `penwright-mcp-*`) oder `asarUnpack`. Cookbook #42 sagt, Walk-up von `process.argv[1]` findet in Electron nichts. Spike muss den tatsächlichen Suchpfad loggen.
2. **Nicht** `@cursor/sdk/bundled` in den Main-Bundle zwingen, solange `externalizeDepsPlugin` die Dependency draußen hält. Falls electron-vite sie trotzdem inlined: `external: ['@cursor/sdk']` explizit.
3. **HTTP/2.** Docs: hinter Proxies / auf Fetch-Stacks ohne HTTP/2 `Cursor.configure({ local: { useHttp1ForAgent: true } })`. Bun defaultet darauf. Electron/Chromium-fetch im Spike testen; im Zweifel HTTP/1.1 erzwingen.
4. **Signatur.** Native Helper neben Typst/MCP in `afterPack-sign-mcp.mjs` aufnehmen, sonst bricht Notarization oder Gatekeeper den Spawn.
5. **Dev vs Prod.** Dev: `node_modules/@cursor/sdk*` vom Repo. Prod: extraResources-Kopie. Ein Resolver, analog `getTypstPath()` / `getBundledBinaryPath()`.
6. **Windows/Linux.** Erst wenn macOS-Spike und macOS-Paket grün sind. Windows-MCP ist selbst noch unverifiziert ([next-steps.md](next-steps.md) §2).

---

## 7. Was schiefgehen würde, wenn wir raten

| # | Naiver Griff | Was passiert | Stattdessen |
|---|---|---|---|
| G1 | Cloud-Agent, „läuft ja überall“ | Projekt nicht da, MCP in der VM nutzlos, Magazine-Pipeline ohne GitHub tot | Immer `local: { cwd: projectDir }` |
| G2 | Default-Toolset | Agent `write`t `style.typ`, Guard greift nicht, Snapshot-Lücke | Allowlist `mcp` (+ Read-Tools) |
| G3 | `settingSources: "all"` | Doppel-MCP + fremde IDE-Server + User-Rules, die Typst-Projekte als JS-Repos behandeln | `settingSources` leer |
| G4 | Chat als Sidebar-Tab | Unmount, verlorener Stream | `App.svelte`-Panel |
| G5 | SDK im Renderer | Native/Node-APIs, Context-Isolation | nur Main |
| G6 | `customTools` statt MCP | 66 Tools zweimal, Parität tot, Cloud später unmöglich | stdio auf bestehendes Binary |
| G7 | Login = „Cursor ist installiert“ | IDE-Credentials werden nicht gelesen | `Cursor.auth.login()` + eigener Store |
| G8 | Nicht `wait()` / nicht `dispose` | Zombie-Runs, offene Child-Prozesse nach Close-Project | `await using` + Close-Hook |
| G9 | Resume ohne `mcpServers` | Agent ohne Tools, schreibt notfalls mit Built-ins wenn G2 auch fehlt | Server + Allowlist an create **und** resume **und** send |
| G10 | Launch auf diesen Chat warten | Beta-SDK, Packaging unbekannt, Release-Ziel ist nicht-technisch | Spike, dann post-launch |
| G11 | Nur den Text in den Chat kleben, ohne `occurrence` | Zweiter identischer Satz im Kapitel, Tool trifft den falschen | dieselbe Anker-Zählung wie `pinSelectionForDesign` |

---

## 8. Phasen

Keine der Phasen ändert `deserializer.ts` / `serializer.ts`. Web-Export-Regel analog: der Chat ist ein Host, kein Editor.

### Phase 0 — Spike (2–4 Tage, Go/No-Go)

Ziel: eine Antwort mit Evidenz, nicht ein UI.

1. Throwaway-Script (`scripts/cursor-sdk-spike.mts`, nicht im Gate): `Cursor.auth.login()` oder `CURSOR_API_KEY`, `Agent.create({ local: { cwd: <sample oder Korpus-Projekt> }, mcpServers: { penwright: {…} }, tools: ['mcp','read','grep','glob','ls'] })`, Prompt *„Welche Datei ist offen? Rendere Seite 1.“*, Stream nach stdout, `wait()`, `dispose`.
2. Prüfen: ruft er `penwright_get_document` / `penwright_render_page`? Oder fällt er auf Built-in `read` zurück und ignoriert MCP?
3. Prüfen: schreibt ein Prompt *„ändere die Überschrift“* über MCP (Snapshot entsteht) oder über `write` (dann ist die Allowlist undicht)?
4. Denselben Import **im Electron-Main** (dev, nicht packaged). Startet `Agent.create`? HTTP/2? Walk-up Native?
5. Ein `package:mac`-Versuch, der nur den Import + `Cursor.auth.status()` im packaged Main macht — ohne UI. Asar/Helper.

**Exit 0 des Spike:** (a) MCP-Tools werden genutzt, (b) Direct-Write findet nicht statt, (c) Login im Browser aus Electron, (d) packaged Import stirbt nicht sofort.

**Exit 1:** einer von a–d nein, und kein Workaround unter einem Tag. Dann Plan-Modus, nicht weiterbauen.

### Phase 1 — Host ohne UI (3–5 Tage)

`cursorAgentHost.ts`, IPC, Preload-Whitelist, Close-Project-Hook, Credential-Store, Allowlist-Invariante in einem kleinen Test (die *Konfiguration* asserten, nicht das SDK mocken — Quelltext-Assertions sind in diesem Repo verbrannt). Handbuch/check:mcp unberührt, weil keine neuen MCP-Tools.

### Phase 2 — ChatPanel + Settings + Markierung (1,5–2 Wochen)

Zusammen, nicht nacheinander — ohne Settings gibt es keinen Login, ohne Markierung ist der Chat nur ein schlechteres Cursor-Fenster.

- `SettingsPanel`: Sektion **Cursor** (Status, Anmelden/Abmelden, Modell-Dropdown). Dialog auch ohne Projekt erreichbar; Dokument-Sektionen dann versteckt.
- ChatPanel: Stream, Leerzustand der auf Settings zeigt, i18n-Namespace `chat`, Menü Ansicht → Chat, Auto-Save vor Send, Cancel, Plan/Agent-Toggle. Freitext-Turns müssen Design und Inhalt ohne Markierung können — das ist die Messlatte, nicht der Chip.
- Kontextmenü: **In Chat einfügen** statt **Design with AI**. `DesignAiPopover` und `designSelection` entfernen. `pinSelectionForDesign` → `captureSelectionForChat`. Skill-Text / `penwright_get_selection`-Beschreibung umbiegen, `MCP_SETUP_VERSION` bump.
- Svelte-Autofixer. Kein Markdown-Overkill.

### Phase 3 — Produktpolitur (nach erstem internen Gebrauch)

Usage-Zeile, `render_page`-Bilder im Thread, Re-Login-Hinweis bei 90-Tage-Expiry, Crash-Report-Scrubbing, THIRD_PARTY_LICENSES, Datenschutzerklärung, Onboarding-Satz. Optional: `webSearch`. Optional: Custom Tool „scroll preview to page“. Optional: Chat am Start-Screen, der `create_from_preset` anbietet, *nachdem* der Mensch den Zielordner gewählt hat.

Nicht in v1: Cloud, Subagents, Multi-Projekt-Inbox, eigener Penwright-Key, MCP-Tool-Reduktion, Windows/Linux-Paket über den macOS-Pfad hinaus, Agent der allein ein Verzeichnis irgendwo anlegt.

---

## 9. Tests

Kein Flake, kein „grün durch Abwesenheit“:

- **Konfigurations-Test** (Node, kein Netz): `buildChatAgentOptions(projectDir, def)` liefert `local.cwd`, inline `mcpServers.penwright` aus `buildServerDefinition()`, `tools` enthält `mcp` und enthält nicht `shell`/`edit`/`write`, `settingSources` fehlt oder ist `[]`. Einmal gegen die entfernte Allowlist laufen lassen — muss rot werden.
- **Spike** bleibt manuell / `--allow-skip` und **nicht** in `npm test`. Ein Netz- und Abo-Test im Gate würde auf jeder Maschine ohne Key „bestehen“, indem er nichts tut.
- Bestehende Suiten (`parity-guards`, `session-handoff`, `style-guard`) müssen weiter gelten: der Chat darf sie nicht umgehen. Wenn Phase 0 Punkt 3 rot ist, ist das der Fund, nicht „der Chat ist halt anders“.

---

## 10. Spike-Checkliste (konkret)

```text
[ ] npm i @cursor/sdk  — nur lokal im Spike-Branch, nicht auf main mergen bevor Phase 1
[ ] scripts/cursor-sdk-spike.mts gegen resources/sample-project (Kopie in tmp)
[ ] MCP-Binary: npm run build:mcp-binary, command = getInstalledBinaryPath()
[ ] Prompt A: "Was ist das für ein Projekt? Welche Datei ist offen?"
[ ] Prompt B: "Rendere Seite 1 und beschreibe das Layout."
[ ] Prompt C: "Benenne die erste Überschrift in X um" — danach: liegt ein ai-snapshot?
[ ] Allowlist-Negativ: tools ohne mcp, Prompt C — muss Direct-Write tun (Beweis, dass C ohne Allowlist rot wäre)
[ ] Electron-dev: Import in einem throwaway-Main-Handler, login mit openBrowser: shell.openExternal
[ ] Cursor.configure({ local: { useHttp1ForAgent: true } }) an/aus messen
[ ] Packaged: Main loggt Cursor.auth.status() ohne zu crashen
```

---

## 11. Offene Fragen, die der Spike beantwortet (nicht der Plan)

1. Nutzt der Agent MCP-Prompts (`penwright-conventions` etc.) von allein, oder brauchen wir einen einmaligen User-Turn / `local.dirs` auf ein gebündeltes Guide-Verzeichnis?
2. Begrenzt `local.cwd` die Built-in-`read`-Tools auf das Projekt?
3. Findet packaged Electron die Native-Helper — und brauchen wir sie überhaupt ohne Sandbox?
4. Statsig: abschaltbar?
5. Zod-3-Duplikat, Bundle-Größe, erster `create()`-Import (Docs: lazy, einmalig teuer).
6. Wie groß wird der JSONL-Store nach einem Magazin-Nachmittag — Retention analog `maxAiSnapshots`?

---

## 12. Kill-Kriterium

Stoppen (und den Chat nicht halb ausliefern), wenn eins gilt:

- Packaged Main kann `@cursor/sdk` nicht laden und der Fix ist nicht extraResources + ein Resolver.
- Der Agent schreibt trotz Allowlist über Built-in `write`/`edit` in `.typ` / `style.typ`.
- Cursor-ToS oder Lizenz verbietet das Bundling in einer Drittanbieter-Desktop-App (schriftlich klären, nicht Forum).
- Login/Billing belastet nicht das Nutzerkonto, sondern würde uns zwingen, Keys zu sammeln.

Ein hässliches Panel mit funktionierender Allowlist ist ein gültiger interner Spike. Ein schönes Panel, das an den Guards vorbeischreibt, ist ein Rückschritt hinter Session 42.

---

## 13. Was dieser Plan bewusst nicht ist

- Kein zweiter Tool-Katalog und keine Penwright-eigene Inferenz. Der Chat ist ein MCP-**Host in der App**; der Server bleibt.
- Kein Penwright-Abo, keine eigene Modellrechnung.
- Kein Verschieben des Launch-Ziels in [next-steps.md](next-steps.md).
- Kein Refactor der 66 Tools. Der Eval hat 0 Fehlgriffe gemessen; der Chat erbt den Katalog.
- Kein Weiterpflegen des Claude-Handoffs (Copy-Prompt, Open Claude, Rechtsklick Design with AI). Wer die IDE trotzdem will, hat noch die MCP-Registrierung — die UI führt nicht mehr hin.

---

## 14. Entscheidungsbedarf vor Phase 1

Erledigt in diesem Dokument: Rechtsklick nur **In Chat einfügen**; neues Projekt legt der Mensch an; Messlatte = Composer in einer App.

Noch offen:

1. **Spike beauftragen** — ja/nein. Ohne Spike keine Schätzung, die eine Woche überlebt.
2. **Post-launch** bestätigen, nicht in die Release-Woche ziehen.
3. Nach Spike: ToS/Privacy-Satz gegenlesen lassen (derselbe Anwaltspfad wie die PolyForm-Frage in next-steps §1).
