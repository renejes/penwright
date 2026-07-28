# Penwright als Web-Anwendung — Machbarkeit, MCP-Erhalt & Markt

> **Zweck:** Theoretischer Verständnis-Bericht (keine Entscheidung, kein Auftrag). Beantwortet zwei Fragen:
> 1. Was müsste getan werden, um Penwright — so wie es ist — als **Web-Anwendung** zu hosten, wobei besonders der **MCP-Server erhalten** bleibt und die App praktisch **dezentral / mehrbenutzerfähig** wird?
> 2. Erschließt Penwright als Web-App einen **größeren Markt** — wenn ja, welchen, und was müssten wir dafür tun?
>
> **Stand:** 15. Juli 2026. **Methode:** Codebase-Analyse (6 parallele Leser über Main-Prozess, Storage/Git, Typst/Compile, MCP-Server, Editor/Shared, Doku) + Web-Recherche (6 Technik- + 5 Markt-Agenten) + Synthese + adversarialer Genauigkeits-Check gegen die Findings. Quellen sind inline verlinkt. Konfidenz-Hinweise am Ende jedes relevanten Abschnitts und in §11.
> **Aufwands-Skala:** S (Tage) · M (1–3 Wochen) · L (1–3 Monate) · XL (eigenes Projekt, Quartale).

---

## 1. Zusammenfassung (TL;DR)

- **Der harte Kern von Penwright ist bereits web-fähig.** Die gesamte Content-Pipeline (`serializer.ts`, `deserializer.ts` — 1706 Zeilen, `reconciler.ts`, `docxSerializer.ts`, `htmlSerializer.ts`, `exportContext.ts`, `styleParser.ts`, `mergeDocument.ts`, i18n) ist bewusst Electron-frei und pur. Ein Web-Port ist überwiegend ein *Repackaging*, kein Logik-Rewrite.
- **Zwei Ökosystem-Fakten kippen die Kostenrechnung:** Typst kompiliert nach WebAssembly (typst.ts/reflexo) und git läuft im Browser (isomorphic-git + OPFS — als lokal-first Single-Writer-Schicht, *kein* Multiplayer-Ersatz). Das teure „Compile-Container-pro-Nutzer"-Problem lässt sich weitgehend vermeiden.
- **Der `appState`-Singleton (`src/main/appState.ts`) ist die größte strukturelle Änderung.** Ein Prozess = ein Projekt = ein Dokument. Das muss zu einem per-Session-Kontext (`userId`+`projectId`) werden. Betrifft jede Main-Handler-Funktion.
- **Der MCP-Server importiert nie Electron** — `src/mcp/server.ts` ist reiner Node-Code (der einzige type-only `BrowserWindow`-Import steckt in einer mitgezogenen Helfer-Datei, `appState.ts`, und verschwindet beim Build). Der Port ist **Transport + per-Request-Kontext + Auth**, kein Tool-Rewrite: stdio→Streamable HTTP, Env-Lizenz→OAuth 2.1, lokales FS→Mandanten-Storage.
- **„Bring your own Agent" bleibt erhalten** — sogar besser: Nutzer verbinden ihr *eigenes* Claude per „Add custom connector" (URL + OAuth-Consent), kein Binary-Install mehr. Das ist ein Distributionskanal, den typst.app/Overleaf strukturell nicht kopieren können.
- **Echtzeit-Kollaboration ist NICHT trivial** und das eigentliche Architektur-Risiko: zwei Wahrheitsquellen (Yjs-CRDT vs. kanonische `.typ`-Datei, auf der Typst/Git/MCP operieren). Aufwand **XL**, verschiebbar.
- **Web erschließt einen echten, größeren, aber teilweise besetzten Markt.** Die großen Pools (Studenten auf Chromebooks, Institutions-Lizenzen, kollaborierende Forschungsgruppen) sind *nur* per Web erreichbar — aber dort steht typst.app (die Typst-Macher selbst).
- **Empfehlung: Hybrid, kein Plattformwechsel.** Desktop als AI-natives, lokales, print-fähiges Studio behalten; Web-Schicht nur dort, wo Desktop strukturell blind ist (teilbare Review-Links + gehostetes Web-Output/Gallery). Vollständige Cloud-IDE nur, wenn Kollaboration wirklich der Zweck wird.

---

## 2. Aktueller technischer Stand

Penwright ist ein **single-user, single-window, single-document, single-project** Electron-Programm „by construction". Der Beweis steht in `src/main/appState.ts`: ein Modul-Level-Objekt hält *das eine* offene Fenster, *den einen* Dateipfad, dessen Inhalt, Dirty-Flag und Projektverzeichnis. Jeder Main-Handler liest/schreibt diesen Ambient-Global.

**Wo die Desktop-Kopplung sitzt (was ersetzt werden muss):**

- **`src/main/index.ts`** — dünner Electron-Bootstrap: ein `BrowserWindow`, Preload-Bridge, zwei Custom-Protokolle (`penwright-asset://`, `penwright-font://`), native Menüleiste, Crashpad.
- **`src/main/ipcHandlers.ts`** — zentraler Router: ein `ipcMain.on('penwright')`-Switch + ~90 `ipcMain.handle(...)`-Endpunkte. In-Process-Funktionsaufrufe über eine vertrauenswürdige lokale Bridge mit *null* Auth und implizitem „aktuellem Projekt" aus dem Singleton.
- **`src/main/fileManager.ts`** — synchrones POSIX-`fs`, 1s-Debounce-Autosave, chokidar-Watcher (3s-Self-Save-Guard) für externe/KI-Edits.
- **`src/main/gitManager.ts`** — `simple-git` shellt zur lokalen git-Binary; `git:saveVersion` macht `git add -A` + Commit des ganzen Working-Trees.
- **`src/main/typstCompiler.ts` / `typstPath.ts`** — `child_process.execFile` auf die gebündelte ~40 MB Typst-Binary, schreibt `.penwright-preview.pdf` neben das Dokument. (Im Repo ist derzeit nur die `typst-arm64-darwin`-Binary eingecheckt — relevant für den Server-Port, s. §6.)
- **`src/main/persistenceManager.ts`** — electron-store (eine JSON-Datei) + safeStorage (OS-Keychain für Lizenz-Blob).
- **`src/main/lockManager.ts`** — `.lock`-Sidecar-Dateien für Dropbox/iCloud. Kein echtes Concurrency-Control.

**Was schon portabel ist (die gute Nachricht):**

- **`src/editor/lib/ipcAdapter.ts`** ist bereits eine Transport-Abstraktion (Electron contextBridge vs. VS-Code postMessage vs. noop). Ein dritter „Web"-Adapter (fetch + WebSocket) fällt hier ein — **die sauberste Naht der ganzen Codebase.**
- **`src/shared/**`** — komplett pur, läuft server-seitig oder im Browser unverändert.
- **Dual-taugliche Handler** (`projectSearch.ts`, `projectLabels.ts`, `citationSources.ts`, `commentManager.ts`) nehmen bereits einen expliziten `projectDir`-Parameter.
- **`src/mcp/server.ts`** reproduziert den Compile-Pfad bereits headless via `TYPST_BIN`/`TYPST_PACKAGE_PATH`-Env — ein funktionierender Beweis des server-seitigen Compile-Pfads.

---

## 3. Zielarchitektur Web

Client-SPA (der Renderer, fast unverändert) → authentifizierte HTTP/WS-API → Auth (JWT mit `tenant_id`) → Objekt-Storage pro Mandant → sandboxed Compile-Worker → optional CRDT-Sync. Overleaf ist der 1:1-Bauplan: stateless Node-Instanzen hinter WebSocket-Load-Balancer + Postgres/Mongo + Redis + S3-kompatibler Storage + lokaler-Disk-Compile-Tier ([Overleaf Horizontal Scaling](https://docs.overleaf.com/on-premises/maintenance/horizontal-scaling)).

| Desktop-Baustein (Datei) | Web-Äquivalent | Aufwand |
|---|---|---|
| `appState.ts` Singleton | Per-Session-Kontext (`userId`+`projectId`), AsyncLocalStorage | **L** (durchzieht alles) |
| `ipcHandlers.ts` (~90 Kanäle) | Auth'd REST/RPC-Routen + per-User WebSocket-Push | **L** |
| `preload-entry.ts` Whitelist | Server-Route-Registry mit authN/authZ | **M** |
| `ipcAdapter.ts` | Dritter „Web"-Adapter (fetch/WS) | **S** ⭐ |
| `fileManager.ts` (fs + chokidar) | Objekt-Storage + Change-Bus (Redis pub/sub) | **L** |
| `typstCompiler.ts` | WASM-Compile im Browser **oder** sandboxed Worker-Pool | **M–L** |
| `gitManager.ts` (simple-git) | isomorphic-git auf Storage / per-Mandant bare-repo | **L** ⚠️ |
| `persistenceManager.ts` (electron-store + Keychain) | Postgres (users/projects/licenses) + KMS | **M** |
| `lockManager.ts` | Löschen → DB-Row-Locks oder CRDT | **S** (Löschen) |
| Native Menu / Dialoge | In-App-HTML-Menü/Command-Palette; Upload/Download | **M** |
| `crashReporter.ts` (Crashpad) | Sentry-style Telemetrie | **S** |
| MCP stdio-Binary | Remote Streamable-HTTP MCP-Endpoint | **L** (s. §4) |
| `penwright-asset://` Protokoll | Auth'd Asset-Route mit signierten URLs, per-Mandant | **M** |

**Bleibt unverändert:** der gesamte `src/shared/`-Kern, die pdf.js-Preview-Komponenten (`PdfPreviewPanel.svelte`, `PdfFileViewer.svelte` — bereits Browser-Code), die TipTap-Editor-Extensions, `messages.ts`.

**Neu:** Auth-Layer (Clerk/Auth0/WorkOS mit `tenant_id`-Claim), Objekt-Storage (bevorzugt **Cloudflare R2 wegen Null-Egress** — bei PDF-lastigem Download-Workload strukturell überlegen: 10 TB/Monat ≈ 15 $ R2 vs. ~891 $ S3, [R2 Pricing](https://developers.cloudflare.com/r2/pricing/)), Job-Queue (BullMQ) für Exports, Postgres mit Row-Level-Security.

---

## 4. Der MCP-Server im Web (der Kernpunkt)

Heute: `src/mcp/server.ts` (~2980 Zeilen, 59 Tools) läuft über **einen** `StdioServerTransport`, ein Prozess pro Nutzer, gespawnt von Claude Desktop/Code. Operiert auf *einem* lokalen Projektordner in einem Modul-Global `state`. Lizenz: `validateAccess()` läuft **einmal** beim Start, liest `PENWRIGHT_LICENSE_KEY`/`PENWRIGHT_TRIAL_UNTIL` aus der Env, `process.exit(1)` bei Fehler. Kein per-Request-Auth.

**Die drei Änderungen für hosted/remote — alle additiv, die Tool-Bodies bleiben:**

**(1) Transport: stdio → Streamable HTTP.** Der alte HTTP+SSE-Transport ist seit Spec 2025-03-26 deprecated; **Streamable HTTP ist der Standard** ([MCP Spec Transports](https://modelcontextprotocol.io/specification/2025-06-18/basic/transports)). Ein einziger HTTPS-Endpunkt `/mcp` (POST+GET). Schnelle Tools antworten mit `application/json`, lange Tools upgraden auf SSE-Stream. Der `MCP-Protocol-Version`-Header ist Pflicht. Session-Isolation über den **`Mcp-Session-Id`-Header** (beim `initialize` ausgestellt) — das ist das Transport-Primitiv, an dem der per-User-Kontext hängt. In `main()` (server.ts:2973) nur den Transport tauschen; die 59 Tool-Registrierungen ändern sich nicht.

**(2) Auth: Env-Var → OAuth 2.1.** Der Server wird OAuth-2.1-Resource-Server ([MCP Authorization](https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization)): RFC-9728 Protected-Resource-Metadata + `WWW-Authenticate`-401, PKCE-Pflicht, RFC-8707 Resource-Binding, Token-Audience-Validierung (kein Token-Passthrough). Der bestehende Polar-Lizenz-Check wandert vom Boot-Gate zu einem **per-User-Entitlement-Lookup** auf dem OAuth-Subject — Polar spricht bereits REST, dieselbe Backend-Logik.

**(3) Daten: lokales FS → Mandanten-Storage.** Die größte Inversion. `resolveInsideProject()`/`safeRealpath()` verlassen sich auf lokalen realpath und `state.projectDir`. Der Root muss auf `/<data>/<userId>/<projectId>` aus der Auth gepinnt werden, **absolute User-Pfade abgelehnt** (sonst Mandanten-Escape). Tools mit absolutem `srcPath`-Ingress (`import_markdown`, `add_image`) und caller-gewähltem `parentDir` (`create_project`) müssen auf Upload-in-Sandbox umgestellt werden.

**Wie „Claude verbindet sich" erhalten bleibt — sogar besser:** Statt Binary zu installieren, öffnet der Nutzer sein eigenes Claude → Settings → Connectors → „Add custom connector" → URL `https://<host>/mcp`, macht den OAuth-Consent einmal. Funktioniert für Claude.ai, Desktop, Code (`claude mcp add --transport http penwright https://<host>/mcp`) und API-Agents ([Claude Custom Connectors](https://support.claude.com/en/articles/11503834-build-custom-connectors-via-remote-mcp-servers)). Anthropic verlangt für den Directory-Eintrag: Streamable HTTP, HTTPS, OAuth-Consent, Callback-Allowlist mit `https://claude.ai/api/mcp/auth_callback`, `readOnlyHint`/`destructiveHint` auf allen Tools, Ergebnisse <25k Tokens, Handler <5 min. **Cloudflare Workers (`McpAgent` + Durable Objects + `workers-oauth-provider`)** gibt Session-per-User + OAuth fast geschenkt ([Cloudflare Remote MCP](https://blog.cloudflare.com/remote-model-context-protocol-servers-mcp/)). Das stdio-Binary bleibt als lokaler/Offline-Pfad; der HTTP-Server ist ein *paralleles* Deployment mit denselben Tool-Definitionen.

**Konkret unsicher:** Die Compile-Tools (`penwright_compile`, `export_pdf`) shellen auf die lokale Typst-Binary — remote brauchen sie Typst+Fonts+Packages server-seitig, und die <5-min/<25k-Token-Caps kollidieren mit unbegrenzten lokalen Exports großer Dokumente.

---

## 5. Mehrbenutzer-Kollaboration

Der komplette Stack ist **MIT-lizenziert und gratis selbst-hostbar**: Yjs (CRDT), y-prosemirror, TipTap-Core, Hocuspocus (Backend) ([Tiptap Discussion #7321](https://github.com/ueberdosis/tiptap/discussions/7321)). CRDT (nicht OT) ist die richtige Wahl für ein lokal-first-Tool mit Offline-Anspruch. Managed-Alternativen: Tiptap Cloud ab 49 $/Monat, Liveblocks ab 30 $/Monat + Usage.

Editor-Integration ist *einfach*: drei Plugins (`@tiptap/extension-collaboration` + y-prosemirror + y-indexeddb). **Aber** y-prosemirror ersetzt prosemirror-history — der bestehende Undo-Stack (inkl. „Undo AI Edit") muss auf die Yjs-UndoManager umziehen, und Undo wird per-Client-scoped.

**Das eigentliche Penwright-Problem: zwei Wahrheitsquellen.** Im Yjs-System ist das Y.Doc-CRDT der lebende Zustand; die `.typ`-Datei ist eine *abgeleitete Projektion*. Aber Penwrights ganzes Ökosystem operiert auf der Datei: Typst kompiliert sie, Git versioniert sie (`git:saveVersion`), MCP/KI-Agenten schreiben sie direkt, chokidar überwacht sie. Mit aktivem Collab fließt ein externer `.typ`-Write (KI-Edit, `git:restoreVersion`) **nicht** automatisch ins Y.Doc — man muss die Datei zurück-importieren, was konkurrierende Live-Edits zu überschreiben droht. Das nächste dokumentierte Muster ist YAOS (Obsidian): stabile Datei-ID + Y.Text, damit „Änderungen aus jeder Quelle — git, Shell-Skripte, Agenten — sauber propagieren". Das funktioniert, ist aber maßgeschneiderte Reconciliation-Logik.

Empfehlung falls Collab: Yjs-Blob im `onStoreDocument`-Hook via bestehende `serializer.ts` → kanonische `.typ` flushen; Git+Typst als durable Layer behalten. Single-Instance Hocuspocus (kein Redis für kleine Teams). Multi-File-Projekte (root + Kapitel via `#include`) brauchen ein Y.Doc pro Datei (Yjs-Subdocuments) — projektweite Suche/Cross-Refs werden dann verteilt. Aufwand-Löwenanteil liegt bei der Datei↔CRDT-Reconciliation, nicht beim Editor-Plumbing.

> **Wichtiger Hinweis zur lokal-first-Schicht:** `isomorphic-git` auf `lightning-fs`/OPFS im Browser ist **Single-Writer** (IndexedDB-Mutex, ein Thread) und bei parallelem Multi-Tab-Zugriff contention-anfällig. Das ist völlig ausreichend für eine *Ein-Nutzer*-Browser-Edition (Phase 3, §8), aber **kein Baustein für echte Mehrbenutzer-Kollaboration** — die läuft über den Yjs/Hocuspocus-Pfad oben, nicht über git-im-Browser.

---

## 6. Typst-Kompilierung im Web

Zwei Modelle, konkret abgewogen:

**A. WASM im Browser (typst.ts/reflexo-typst).** Kompiliert komplett clientseitig ([typst.ts](https://github.com/Myriad-Dreamin/typst.ts)). Vorteile: löscht das gesamte Server-Sandbox/DoS/Multi-Tenant-Compute-Problem, Dokument bleibt auf dem Gerät (echtes Privacy-Argument, passt zu Penwrights „der Ordner besitzt alles"), schiebt die dominante Kosten (Recompile-pro-Tastendruck) aufs Nutzer-Gerät. Nachteile: das WASM-Compiler-Binary ist groß (~22 MB unkomprimiert, ~8–12 MB brotli-komprimiert beim First-Load; aggressiv gestrippt bis ~2,8 MB berichtet), **keine System-Fonts** (müssen eingebettet/gefetcht werden), und Package-Fetching aus der Registry ist „implementiert, aber undokumentiert" — hand-gerollter Registry-Fetch + Cache nötig. Offene Frage: Bewältigt WASM-Typst Penwrights reale Last — die 24 gebündelten Packages (cetz/fletcher/showybox/codly), Custom-Fonts, große Magazin-Dokumente, den Print-Export mit Beschnitt/Schnittmarken?

**B. Server-seitige Worker.** Das bewährte Live-Preview-Modell (typst-preview/tinymist) ist **Server-Compile + WebSocket-Stream von Vektor-IR + Client-WASM-Render** — nicht voller Browser-Compile. comemo-inkrementelle Kompilierung gibt ~26ms-Recompiles ([typst architecture](https://github.com/typst/typst/blob/main/docs/dev/architecture.md)). Penwright bündelt die 24 Packages + Fonts bereits — die fallen unverändert in einen Server-Worker. **Ein Haken:** im Repo ist nur die `typst-arm64-darwin`-Binary (~40 MB) eingecheckt; ein Linux-Server-Worker braucht die derzeit nicht vorhandene `typst-x64-linux`-Binary. Trivial zu beschaffen (offizieller Release), aber ein bewusster Bundling-Schritt, der heute fehlt.

**Sandboxing (kritisch):** Typst ist *sicher by design* — kein Shell-Escape, keine File-Writes, nur Reads im Projekt-Root, Netzwerk nur zur Package-Registry. Die ganze `\write18`/Arbitrary-Write-Angriffsklasse, die Overleaf bekämpft, existiert nicht. **ABER:** kein eingebautes Memory/Time-Limit — dokumentierte OOM/Endlos-Schleifen ([Issue #3150](https://github.com/typst/typst/issues/3150)), und `read()` kann Dateien im Working-Dir exfiltrieren. Mitigation: jeder Compile-Job in isoliertem, ressourcen-gecapptem Sandbox (cgroup Memory+CPU + Wall-Clock-Timeout), kein Egress-Netz (Packages vorbündeln). gVisor-pro-Job reicht wahrscheinlich (Typst ist inhärent sicher); Firecracker-microVMs nur bei wirklich beliebigem Tenant-Code.

**Kosten:** Live-Preview, nicht Storage, ist der Treiber. Server-seitig ~wenige Cents pro aktiver Editier-Stunde/Nutzer (gedämpft durch comemo + Penwrights bestehende 1s-Debounce + manual/auto Preview-Mode-Toggle). Mit WASM-Preview sinkt die Server-Grenzkosten auf ~Storage + gelegentlicher Export.

**Empfehlung: Hybrid** — WASM für Live-Preview (Kosten + Privacy), server-seitig-nativ für autoritativen Export (PDF/DOCX/Print-Bleed) und headless/MCP-Compiles. *Anmerkung (Inferenz, mittlere Konfidenz):* typst.app kompiliert **vermutlich** server-seitig statt per Client-WASM — abgeleitet aus OOM-Bug-Reports (typst/webapp-issues #625), nicht aus publizierter Architektur (typst.app ist closed-source).

---

## 7. Was NICHT trivial ist / echte Risiken

- **Der `appState`-Singleton-Umbau (L).** Betrifft *jede* Main-Handler-Funktion. `getGitDir()` gibt `appState.projectDir` zurück — ein git-Call für Nutzer A könnte Nutzer B's Projekt treffen. Das ist die größte einzelne strukturelle Änderung, nicht rewritebar am Rand.
- **Git server-seitig (L, ⚠️).** `git add -A` + Whole-Tree-`checkout` sind unter Concurrency katastrophal: A's „Save Version" committet B's In-Flight-Edits; restore vernichtet unbestätigte Arbeit. Braucht per-Mandant-Repos auf schnellem lokalem Volume (nie NFS/EBS — Overleaf sagt explizit „not supported for horizontal scaling"), scoped Commits, serialisierte Writes. Overleafs eigener git-bridge ist ein nicht-replizierter Disk-gebundener Singleton — die bekannte Skalierungswand.
- **Datei↔CRDT-Reconciliation (XL)** falls Collab (s. §5).
- **Feature-Parität & Design/Magazine-Pipeline.** Der `magazineSplit`, `typstHero`, `typstGrid`, Print-Export mit Beschnitt/Schnittmarken (`writePrintExportTemp`) sind CPU-schwere, dateisystem-nahe Operationen. Print-Export ist bewusst *nicht* durch `safeApplyDesign` geroutet (schreibt nur Temp-Dateien) — server-seitig werden das Queue-Jobs mit Tenant-Storage.
- **Wettbewerb mit dem Format-Eigentümer.** „Overleaf für Typst" *existiert bereits* und heißt typst.app, betrieben von Typst GmbH, die den Compiler besitzen. Web zu gehen heißt, frontal gegen sie anzutreten — anders als die leere Desktop-Typst-WYSIWYG-Nische heute.
- **Data-Residency.** Manuskripte hosten (unveröffentlichte Forschung, sensibel) triggert regionale Storage-, Verschlüsselungs-, Retention-Anforderungen. Penwrights heutiges „verlässt nie das Gerät" umgeht das komplett — ein Verkaufsargument, das Web strukturell aufgibt.

---

## 8. Migrationspfad (phasenweise)

Front-loaded: niedrig-Risiko/hoher-Hebel zuerst, härteste Änderung (Multiplayer) zuletzt.

1. **`src/shared/` als Workspace-Package extrahieren** (Dual-Build ESM/CJS). Aufwand **S–M**. Bereits pur — ein Repackaging-Job.
2. **Read-only Web-Viewer / gehostete Gallery.** Nutze den bestehenden „Editorial Web Pack"-HTML-Export (`webExport.ts`, `buildWebSite`) für teilbare Review-/Showcase-Links. Kein Backend nötig für statisches Output. Aufwand **S–M**. ⭐ Der billigste, markenkonformste Weg, Link-Viralität und Reviewer-Reach zu erschließen.
3. **Lokal-first Browser-Build** (WASM Typst + OPFS + isomorphic-git, minimales/kein Backend), wie github.dev/vscode.dev. File System Access API (Chromium-only; Safari/Firefox brauchen OPFS-Fallback). *Single-Writer* (s. §5-Hinweis) — validiert die Browser-Schicht billig für einen Nutzer, bevor per-User-Cloud-Compute committed wird. Aufwand **M–L**.
4. **Auth + Objekt-Storage + Postgres-Metadaten** (Kommentare/Versionen/Labels passen in Postgres-Sync-Engine). Hosted MCP (§4). **Enthält den konkreten Bundling-Schritt: `typst-x64-linux`-Binary in den Server-Worker aufnehmen** (heute nur arm64-darwin im Repo). Aufwand **L**.
5. **Yjs-Kollaboration zuletzt** — nur wenn Nachfrage die Concurrency-Komplexität rechtfertigt. Aufwand **XL**.

Jeder Schritt ist unabhängig auslieferbar und reversibel. **Grober Gesamtaufwand:** Phase 1–2 in Wochen (Solo-machbar). Phase 3 einige Monate. Phase 4 mehrere Monate + laufende Ops. Phase 5 ist ein eigenes Projekt (Quartale). Ein vollständiger kollaborativer Cloud-IDE-Port ist ein **Multi-Personen-Jahres-Vorhaben**, kein Wochenendport.

---

## 9. Markt: Erschließt Web einen größeren Markt?

**Ja — aber teilweise besetzt.** Die Segmente, die Dokument-Tools zu großen Geschäften machen, sind *strukturell* web-only:

- **Studenten auf Chromebooks.** ChromeOS hält ~60% des globalen Bildungs-Gerätemarkts, ~38 Mio. K-12-Schüler; eine native `.app`/`.exe` ist dort *nicht installierbar* ([AboutChromebooks](https://www.aboutchromebooks.com/chromebooks-in-schools-statistics/)). Nur per Web erreichbar.
- **Institutions-Lizenzen.** Overleaf-Commons-Modell: eine Uni kauft eine Subscription, SSO/E-Mail-Domain-Auto-Enrollment provisioniert tausende Sitze ([Overleaf Commons](https://docs.overleaf.com/commons)). Eine Desktop-Lizenz hat kein Mechanismus dafür.
- **Kollaborierende Forschungsgruppen & Redaktionsteams.** Echtzeit-Co-Authoring ist die web-only Kern-Fähigkeit; eine Single-Machine-App zwingt zurück ins Datei-Mailen.
- **Enterprise** — blockiert ohne SAML/SSO/Seat-Management ([WorkOS](https://workos.com/blog/enterprise-sso-providers-b2b-saas)).

**Marktgrößen (bottom-up, ehrliche Nische; jede Zahl mit Quelle, aber Report-Spreizung beachten):**

- Überschriften-„AI-Writing"-Markt: 20–37% CAGR, aber die Zahlen (91 Mrd. $ vs. 6,2 Mrd. $) sind 15–40x auseinander ([Precedence Research](https://www.precedenceresearch.com/ai-writing-assistant-software-market)) — als Rückenwind-Narrativ behandeln, nicht als adressierbare Nische.
- **Akademisch/LaTeX-Basis:** Overleaf 25 Mio.+ Nutzer, 6.800+ Institutionen, 400K+ DAU ([Digital Science](https://www.digital-science.com/blog/2025/06/digital-science-launches-new-cutting-edge-ai-writing-tools-for-20-million-overleaf-users/)); ~8,8 Mio. Vollzeit-Forscher weltweit (UNESCO). STM-Publishing selbst wächst aber nur ~3–4%/Jahr.
- **Technische Doku:** ~5–6 Mrd. $, 6–8% CAGR.
- **Self-Publishing:** ~2–4 Mrd. $, 9–17% CAGR, 58% Einzelautoren.
- **Digital-Magazin/Editorial-Design-Software:** ~1–2,5 Mrd. $, **10–15% CAGR** ([Business Research Insights](https://www.businessresearchinsights.com/market-reports/digital-magazine-publishing-software-market-113368)) — Penwrights differenzierteste, am wenigsten umkämpfte Nische. Heute InDesign/Affinity-Territorium (kein AI-Agent, kein Code-Source, kein Web-Output).

**Typst-Substrat wächst schnell (guter Rückenwind):** ~54.900 GitHub-Stars (Jul 2026, +~23% in 11 Monaten), 3.500+ Institutionen, 400+ Packages, Fortune-500-Nutzung (UBS/IABG/Neodyme) — aber das Format gehört einem **5-Personen-bootstrapped Berliner Team** ([Typst Blog „Two years and counting"](https://typst.app/blog/2025/future/)). Chance (steigendes Format) und Abhängigkeitsrisiko (dünn kapitalisierter Engine-Owner) zugleich.

**Wettbewerb:**
- **typst.app** — Code+Preview, *nicht* WYSIWYG (Team hat WYSIWYG „auf 2087" vertagt, [Discussion #2858](https://github.com/typst/typst/discussions/2858)), Pro 7,99 $/Monat, **kein AI/Agent-Pillar**, 5-Personen-bootstrapped. HTML-Export in Preview — überlappt den Editorial Web Pack, kein durabler Moat.
- **Overleaf** — LaTeX-only (anderes Substrat), 25 Mio. Nutzer, Visual-Editor + Writefull (inline-Copilot, kein Agent), Standard ~15 $/Pro ~30 $/Monat.
- **Curvenote/Authorea** — WYSIWYG-scholarly, aber non-Typst-Stacks.
- **Google Docs/Notion** — setzen die Collab/AI-Erwartung, können aber keinen print-präzisen Typst-Output. Ihre Agenten (Copilot Agent Mode in Word GA Apr 2026, Gemini in Docs, Notion Custom Agents) zeigen: „Agent editiert Dokument" ist inzwischen *table stakes*, kein Alleinstellungsmerkmal.

**Penwrights Differenzierung — der unbesetzte Dreiklang:** (1) echtes Round-Trip-WYSIWYG auf Typst (Format-Eigentümer hat es aufgegeben), (2) agent-nativ + **offen/lokal-first** via MCP (die Incumbent-Agenten sind first-party, cloud-locked — man kann *nicht* sein eigenes Claude auf ein Word-Dokument richten wie auf ein Penwright-Projekt), (3) Editorial/Magazin-Design + Print + Ein-Quelle-Print-und-Web. „Wir sprechen MCP" allein ist kein Moat (MCP ist Linux-Foundation-Standard, ~97 Mio. monatliche SDK-Downloads, 10.000+ aktive Server); verteidigbar ist die *Kombination*: vertikale Typesetting-Tiefe × offener BYO-Agent × lokal-first. Der nächste lebende Analog — Obsidian + Community-MCP-Server (1,5 Mio. Nutzer) — beweist die Nachfrage nach „mein Agent editiert meine lokalen Dateien", warnt aber: für *Plain-Markdown* ist das ein Wochenend-MCP-Server. Penwright muss klar über Plain-Text-Wert liegen (Typesetting, Design, Mathe, Multi-Format-Output).

---

## 10. Empfehlung

**Beachhead-Markt: Solo- und Kleinteam-Creator wiederkehrender, design-getriebener Publikationen** (Indie-Magazine, Editorial-Newsletter, design-bewusste Reports/Whitepapers/Zines), die Print + Web aus einer Quelle wollen, AI-getrieben. Hier ist Penwright gleichzeitig 10x besser als *jede* Alternative: vs. InDesign (kein AI/Code/Web), vs. Canva (generisch, keine Print-Präzision), vs. Overleaf/typst.app (code-first, kein Design/Agent), vs. Word (hässlich). Hohe Zahlungsbereitschaft (Client-billing-Prosumer), eingebaute Wachstumsschleife (jede Ausgabe = öffentlicher Showcase + Gallery-Template), Founder-Market-Fit (ai-magazine-designer-Pipeline existiert).

**Ausdrücklich NICHT** der akademische LaTeX-Refugee-Markt als erstes Ziel — überfüllt, preissensibel, LaTeX-lock-in, und Overleaf deckt WYSIWYG+AI+Templates+Site-Licenses bereits. Das ist die erste *Adjazenz*, nicht der Beachhead.

**GTM: Self-serve PLG, nicht Sales-led.**
1. **Öffentliche, SEO-indizierte Template-/Showcase-Gallery** (die Canva/Overleaf-Schleife — Penwrights größte aktuelle Lücke). Programmatisch: Detail-Seite pro Template, Facet-Seite pro Kategorie. Jedes Template rendert ein schönes öffentliches PDF+Web — Ranking-Asset *und* Conversion-Demo.
2. **Claude-Connectors-Directory-Eintrag** als Ein-Klick-Verbindung (das Directory ist noch jung und kuratiert — ein früher Eintrag = Sichtbarkeit) — der einzigartige Kanal, den code-first-Incumbents nicht kopieren können.
3. **Print+Web-Export polieren** (der bezahlte Hook, das sichtbare 10x).
4. **Teilbare Brand-Kits/Section-Styles** (Seat-Expansion).

**Feature-Prioritäten (in Reihenfolge):** Gallery → MCP-Directory-Listing → Export-Politur → geteilte Brand-Kits. **Deprioritär:** Echtzeit-Web-Collab, LaTeX-Import, Enterprise-SSO — spätere Adjazenzen.

**Positionierung: Hybrid, kein Plattformwechsel.** Desktop bleibt das differenzierte, AI-native, privacy-first, print-und-web *Authoring-Studio*. Web-Schicht nur, wo Desktop strukturell blind ist: teilbare Review-Links + publiziertes Web-Output über den bestehenden Editorial Web Pack. Volle Cloud-IDE nur, wenn der Zielnutzer echt kollaborations-gebunden ist (Redaktionsteams, Forschungsgruppen) *und* Appetit auf gehostete SaaS-Ops (Uptime, Support, Compliance, SSO) besteht.

**Preis-/Lizenz-Implikationen:** Validiertes Korridor ~12–19 $/Monat individuell (über Typst-Pro 7,99 $, unter Adobe CC ~23 $; Jenni $12–30, Paperpal $25/$139, Notion-Agents $20). Studenten zahlen bereits ~15–20 $/Monat aus eigener Tasche, kaufen auf *wahrgenommenen Wert* (nicht Preis). Paywall die differenzierte Wertschöpfung (AI-Agent-Nutzung über Trial hinaus, Print-Export mit Bleed, Web-Mini-Site, private Templates, Kollaboration); WYSIWYG-Editing + gecappte Free-Tier offen, um die Gallery/SEO-Schleife zu speisen. Bestehendes 14-Tage-Full-MCP-Trial ist das richtige opt-in-Trial-Muster. Per-FTE-Site-License + Student-Rabatt + Campus-Ambassadors reserviert für Phase 2 (akademische Expansion). Sales-led/Enterprise erst, wenn PLG-Nachfrage zieht.

---

## 11. Offene Fragen / Entscheidungen

1. **Positionierung (kann nicht aufgeschoben werden):** Lokal-first (Obsidian/github.dev — Ordner autoritativ, Hosting opt-in-Add-on) *oder* cloud-first (Figma — Server autoritativ)? Diese Entscheidung diktiert fast jede Downstream-Wahl.
2. **Ist der Zielnutzer wirklich kollaborations-gebunden**, oder ein Solo-Autor, für den lokal-first/offline/privat ein *Verkaufsargument* ist? Der ganze Web-Case hängt hieran.
3. **Browser-Reichweite:** Chromium-only akzeptabel für die lokal-first-Web-Schicht (File System Access API = Chrome/Edge), oder müssen Safari/Firefox ab Tag 1 first-class sein?
4. **WASM-Typst-Treue:** Bewältigt typst.ts die 24 gebündelten Packages, Custom-Fonts, große Magazin-Dokumente, den Print-Bleed-Pfad — oder brauchen Edge-Cases weiter Server-Typst? (Und falls Server-Typst: die `typst-x64-linux`-Binary muss ins Server-Bundle, s. §6/§8-Phase-4.)
5. **Kollaborations-Granularität:** Simultanes Editing wirklich nötig, oder reicht async Multi-User (per-User-Branches + Version-Merge, näher am bestehenden git-Modell)? Ersteres erzwingt CRDT-Rewrite; letzteres wiederverwendet das Meiste.
6. **Will René überhaupt eine gehostete SaaS betreiben** — Uptime, Support, Data-Residency-Compliance, Seat/SSO-Admin, Security-Questionnaires — vs. eine Einmalkauf-/lizenzierte Desktop-App ohne Server-Verpflichtungen?
7. **Kannibalisiert eine Web-Edition Desktop-Lizenzumsatz** oder erweitert sie ihn via Freemium-Funnel? Keine vergleichbaren Produktdaten gefunden.
8. **Wer ist der Authorization-Server** für hosted MCP (self-issue via Cloudflare workers-oauth-provider vs. Auth0/WorkOS/Stytch), und wie wird die bestehende Polar-Lizenz mit OAuth-Identität versöhnt?
9. **Data-Residency/E2EE-Erwartung** der Zielgruppe (Autoren, Magazin-Pipeline) — erwarten sie Obsidian-Sync-artige E2EE, was server-seitige Features (Suche, Export, AI über Inhalt) einschränken würde?

**Konfidenz:** Hoch bei der technischen Portabilitäts-Analyse (direkt aus der Codebase belegt) und den Ökosystem-Fakten (WASM-Typst, isomorphic-git-Single-Writer, MCP-Streamable-HTTP + OAuth 2.1, MIT-Collab-Stack, Typst-Sandbox-Modell). Mittel bei den Marktzahlen — jede trägt eine Quelle, aber die Report-Spreizung ist real (Self-Publishing 8,8% vs. 16,7% CAGR; AI-Writing 6 Mrd. $ vs. 91 Mrd. $) und typst.apps Server-Compile ist Inferenz, nicht bestätigt. Niedrig bei der genauen Größe der Editorial/Magazin-Typst-Nische — plausibel groß genug für ein bootstrapped Indie-Geschäft (Jenni AI ~10 Mio. $ ARR ist der Benchmark), unklar ob venture-scale.
