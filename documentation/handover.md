# Penwright — Handover für den nächsten Chat (M8.7: Lizenzmodell)

> **Stand:** 2026-06-04, Ende der Session „Rebrand + Pricing".
> **Branch:** `docx-overhaul` · **letzter Commit:** `164dea5` (`rebrand: vswrite → Penwright`).
> **Dieser Prompt ist der Einstieg.** Lies ihn ganz, dann die Dokumente in der unter §6 genannten Reihenfolge. Danach kannst du direkt mit der Lizenz-Implementierung (§3) loslegen.

---

## 0. TL;DR — wo wir stehen

- Das Produkt hieß **vswrite**, ist jetzt **Penwright** (vollständiger Rebrand **committed**).
- Geschäftsmodell ist **entschieden UND implementiert** (M8.7, diese Session, **noch nicht committed**): Einmalkauf **59 €**, **lokaler 14-Tage-Trial**, danach Sperre (`LicenseGate`) → „Key kaufen". **Ein** Key (`pw_LIC…`) schaltet **alles** frei (inkl. MCP), **keine** Tiers. Offline-Grace **7 Tage**. „Key kaufen" geht direkt zum Polar-Checkout `https://buy.polar.sh/polar_cl_u6Fn7z0pPvGUX6pWvPJE4U9bWSBg80fiNdJw12vbJzm`.
- **M8.7 Status:** ✅ umgesetzt + verifiziert (`electron-vite build` + `esbuild.mcp.mjs` grün, `tsc` clean auf den geänderten Main-Dateien). Umsetzungsdetails siehe **§3** (Checkboxen). **Offen:** nur noch `git`-Commit (auf Ansage) + realer Dev-Run-Test des Gate/Banners.
- **Danach:** der koordinierte Tier-2-Rename (§4) bleibt offen.
- **Wichtig:** Inline-Bilder werden im Chat des Users NICHT angezeigt. Für die Lizenz-Arbeit brauchen wir keine Bilder mehr — reiner Code. (Falls doch mal ein Render nötig ist: PNG ins Repo legen und als Datei-Pfad nennen, nicht inline einbetten.)

---

## 1. Was diese Session gemacht hat

1. **DOCX-Overhaul + Phase E (Per-Chapter Section Styles)** — bereits vor dieser Session committed (`be8d45f` u. a.). Kontext, nicht offen.
2. **LANGSAM-Magazin (Dogfooding)** — ein echtes 9-seitiges Demo-Heft „Die Kunst der ungeteilten Aufmerksamkeit" gebaut, **außerhalb** des Repos unter `~/Desktop/LANGSAM/` (Export: `~/Desktop/LANGSAM/exports/LANGSAM-Ausgabe-01.pdf`). Dabei die Schriften **Spectral** + **Crimson Pro** nach `~/Library/Fonts` installiert (System-weit vorhanden). Diente als Test der Design-/MCP-Features — nichts davon ist Repo-Arbeit.
3. **Markt-/Pricing-Recherche** — Schreib-Apps: Scrivener 60 $ (einmalig), iA Writer ~50 $ (einmalig), Typora 15 $ (einmalig), Ulysses 40 $/Jahr (Abo), Typst.app Pro 7,99 $/Mt. Daraus abgeleitet: **59 € Einmalkauf** für Penwright (KI/MCP-Layer als Alleinstellungsmerkmal).
4. **Rebrand vswrite → Penwright** — **committed (`164dea5`)**. Details siehe §2.
5. **Lizenzmodell + Logo finalisiert** (Logo im Code, Lizenz nur als Entscheidung). Logo siehe §2, Lizenz siehe §3.

---

## 2. Wichtige Fakten & Kontext

### Branding
- **Name:** Penwright (*pen* = Schrift + *-wright* = Handwerker, wie play**wright**/ship**wright** → „Handwerker der geschriebenen Seite"). Setzt Schreiben + Gestaltung in Beziehung.
- **Zielgruppe (breit):** jeder, der schreibt und direkt gestalten will — Akademiker, Magazin-/Online-Magazin-Macher, digitale PDF-Produkte.
- **Logo/Marke:** „**P.**"-Monogramm — ein Spectral-„P" (creme `#f4f1ec`) auf dunkler Kachel (`#211e1a`) mit einem **Terrakotta-Quadrat** (`#a8503a`) als „Punkt" in der freien Fläche **unter dem Bauch** des P. Vom User final bestätigt.
  - Generierungs-Parameter (im Wegwerf-Typst-Script): Punkt = `rect(width: size*0.115)`, Position `place(top+left, dx: size*0.53, dy: size*0.595)`, P-Größe `size*0.64`, Kachel-Radius `size*0.225`.
  - Brand-Farben: dark `#211e1a`, terracotta/accent `#a8503a`, cream `#f4f1ec`, muted `#8a8174`. Schriften: Spectral (Headings/Logo), Crimson Pro (Body).
  - **Referenzbild:** `documentation/brand/penwright-monogram-final.png` (committed).
- **Domains:** `penwright.app` frei (Primär), `.studio/.io/.dev` frei. `penwright.com` ist eine geparkte Verkaufsseite (kein Konkurrent). Marken-Recherche (DPMA/EUIPO, Klasse 9) steht noch aus. → User muss `penwright.app` registrieren.

### Rebrand — was schon umgesetzt & committed ist (`164dea5`)
- **Identität:** `package.json` (`name: penwright`, `productName: Penwright`, `appId: com.penwright.app`, Beschreibung), Fenster-Titel + Pro-Datei-Titel (`src/main/index.ts`, inkl. `app.setName('Penwright')`), `AboutDialog.svelte`, `StartScreen.svelte`, `crashReporter.ts` (Report-Titel/productName/`feedback@penwright.app`/`[penwright]`-Logtags).
- **Logo/Icon (alle aus dem „P."-Monogramm):**
  - `build/icon.svg`, `build/icons/icon.icns` (10 Slots), `build/icons/{16,32,64,128,256,512,1024}.png` + `icon.png`.
  - `package.json` → `build.mac.icon = build/icons/icon.icns` (win = `icon.png`, linux = `build/icons`).
  - `src/renderer/assets/penwright-icon.svg` (App-Icon, in AboutDialog), `penwright-logo.svg` (Lockup „P. Penwright", in StartScreen), `penwright-monogram.svg`.
  - `documentation/penwright-logo.svg`, `penwright-monogram.svg` (extraResources logo zeigt jetzt auf `documentation/penwright-logo.svg`).
  - Alte `vswrite-logo.svg` (beide Kopien) entfernt; das alte „Raster"-Icon (war Octavo-Konzept) ist komplett raus.
- **MCP-Plumbing (risikoarm, self-contained, committed):**
  - Binary-Name `vswrite-mcp` → **`penwright-mcp`** (in `scripts/build-mcp-binary.mjs`, `afterPack-sign-mcp.mjs`, `build-mcpb.mjs`, `manifest.template.json`, `package.json` bin + extraResources-Filter, `mcpSetup.ts`).
  - MCP-Server-Name `name: 'penwright'` (`server.ts`), Claude-Config-Key `MCP_SERVER_KEY = 'penwright'` (`mcpSetup.ts`).
  - Env-Vars `VSWRITE_LICENSE_KEY` → **`PENWRIGHT_LICENSE_KEY`**, `VSWRITE_PROJECT_DIR` → **`PENWRIGHT_PROJECT_DIR`** (`server.ts`, `mcpSetup.ts`, `manifest.template.json`).
  - MCP-Datenordner `…/Application Support/vswrite/mcp-server` → `…/Penwright/mcp-server`.
  - `MCP_SETUP_VERSION` `0.8.0` → **`0.9.0`** (Wizard läuft beim Update neu).
- **Verifiziert:** `npx electron-vite build` ✓ und `node esbuild.mcp.mjs` ✓ (beide grün).
- **userData-Reset ist okay** (User bestätigt): `app.setName('Penwright')` verschiebt `…/Application Support/vswrite` → `…/Penwright`, d. h. Recent-Liste + Lizenz + Backup-Config starten leer. **Projekte sind self-contained** (`.git/`, `.vswrite/`, `comments/` liegen im Projektordner) → einfach wieder „Projekt öffnen". **Keine userData-Migration nötig.**

### Bewusst NICHT umbenannt (kommt in einer eigenen, koordinierten Phase — siehe §4)
`vswrite_*` MCP-Tool-Namen, `.vswrite/`-Projektordner (braucht Migration), `vswrite-asset://` / `vswrite-font://`-Protokolle, Skill-Slug `vswrite`/`vswrite-conventions`, Doku-Prosa. **Außerdem:** die Lizenz-Key-Präfixe — die werden aber JETZT in M8.7 mitgemacht (User hat neuen Prefix gesetzt, siehe §3).

---

## 3. M8.7: Lizenzmodell — ✅ IMPLEMENTIERT (diese Session)

> **Erledigt & verifiziert.** Alle Punkte aus 3.2 sind umgesetzt; Builds grün. Kurzfassung der tatsächlichen Umsetzung:
> - **A** `licenseManager.ts`: `OFFLINE_GRACE_DAYS=7`, neuer `TRIAL_DAYS=14`, `LICENSE_KEY_PREFIX='pw_LIC'`, `detectTier` gibt für `pw_LIC` weiterhin `'pro'` zurück (sonst `null`), `isProUser` ist jetzt Alias auf `isLicensed`, neu `getEntitlement(): Entitlement` (Access `licensed|trial|expired`). `mcpSetup.ts` + `server.ts` + `manifest.template.json` auf `pw_LIC` umgestellt (Texte/URLs Penwright).
> - **B** `persistenceManager.ts`: `trialStartedAt: number|null` im Schema/Defaults + `getTrialStartedAt()` / `ensureTrialStarted()`.
> - **C** `ipcHandlers.ts`: neuer Handler `license:getEntitlement`; `license:openCheckout` → `PENWRIGHT_CHECKOUT_URL` (Polar-Link). `preload-entry.ts`: Kanal whitelisted.
> - **D** `appState.svelte.ts`: `licenseAccess` + `trialDaysLeft`. `App.svelte`: onMount `validate().finally(getEntitlement)`, blockierender `<LicenseGate>` bei `expired`, schlanker Trial-Banner (`openCheckout`-Helper top-level), Statusleiste `Licensed` / `Testphase: X Tage` / `Gesperrt`. Neue Komponente `LicenseGate.svelte` (z-index 200, damit `LicenseDialog`@300 für „Key eingeben" darüber liegt). `LicenseDialog.svelte`: Placeholder `pw_LIC_…`, Upgrade-Block raus, Badge „Licensed", `refreshEntitlement()` nach activate/deactivate. `AboutDialog.svelte`: `tierLabel` → Licensed/Unlicensed.
> - **Falle vermieden:** das im Template referenzierte `electronAPI` lebt nur im `onMount`-Scope → eigener top-level `openCheckout()` (Build prüft Template-Identifier nicht; wäre ein Runtime-ReferenceError gewesen).
> - **Noch offen:** `git`-Commit (auf Ansage des Users) und ein realer `electron-vite dev`-Durchlauf zum Sicht-Test von Gate/Banner.

### 3.1 Finale Entscheidungen (vom User bestätigt)
- **Trial: LOKAL.** App runterladen → 14 Tage voll testen → danach **gesperrt** mit „Key kaufen". (Polar bietet keinen Gratis-/Demo-Key, darum lokal.)
- **„Key kaufen"** leitet auf die Homepage / direkt zum **Polar-Checkout**. → **URL noch offen, User fragen** (aktuell hartkodiert `https://vswrite.com/pricing` in `ipcHandlers.ts:665`).
- **Offline-Grace: 7 Tage** (runter von 30).
- **Preis: 59 €** (im Code/Checkout-Text; jederzeit änderbar).
- **Ein Key schaltet alles frei**, inkl. MCP. **Keine** Tiers (basic/pro fällt weg).
- **Key-Prefix ist jetzt `pw_LIC`** (vom User in Polar gesetzt). Ersetzt `VSWRITE_PRO` / `VSWRITE_LIC`.

### 3.2 Datei-für-Datei-Plan (alle Dateien sind bereits analysiert)

**A) Prefix `pw_LIC` + Grace 7 + Tiers raus**
- `src/main/licenseManager.ts`
  - `OFFLINE_GRACE_DAYS = 30` → `7` (Z. 18).
  - `detectTier()` (Z. 36–41): Modell ist Single-Tier. Empfehlung: jeden gültigen Key als volle Lizenz behandeln — am einfachsten weiter `'pro'` zurückgeben für `key.startsWith('pw_LIC')` (so funktioniert die bestehende „Licensed"-UI ohne großen Umbau), sonst `null`/abweisen. (Alternativ `LicenseTier` auf `'licensed'|null` umstellen — dann auch AboutDialog/Statusbar anpassen.)
  - `isProUser()`/`isLicensed()` (Z. 149–160): auf **eine** Prüfung kollabieren — „gültiger `pw_LIC`-Key aktiv" = alles frei. MCP nutzt dieselbe Prüfung.
  - **Neu:** `const TRIAL_DAYS = 14;` + `getEntitlement()` (siehe B).
- `src/main/mcpSetup.ts:160`: `startsWith('VSWRITE_PRO')` → `startsWith('pw_LIC')`. (Fehlertext sagt schon „Penwright Pro-Lizenz" — ggf. „Penwright-Lizenz".)
- `src/mcp/server.ts:2704`: `startsWith('VSWRITE_PRO')` → `startsWith('pw_LIC')`. `server.ts:2734`: Beispiel `VSWRITE_PRO_xxx` → `pw_LIC_xxx` (env-Var-Name `PENWRIGHT_LICENSE_KEY` bleibt).
- `src/renderer/components/LicenseDialog.svelte`: Placeholder `"VSWRITE_XXXXXXXX..."` (Z. 125) → `"pw_LIC_..."`. **Basic/Pro-Upgrade-Block entfernen** (Z. 106–111, der `{#if tier === 'basic'}`-Zweig). Badge-Text vereinfachen zu „Licensed".
- `src/mcp/manifest.template.json:25`: „starts with VSWRITE_PRO_" → „starts with pw_LIC_". (Manifest-Identität name/homepage = Teil von §4, optional jetzt.)

**B) Lokaler 14-Tage-Trial (Persistenz + Entitlement)**
- `src/main/persistenceManager.ts`
  - `StoreSchema` (Z. 62–74): Feld `trialStartedAt: number | null` ergänzen; `defaults` (Z. 84–106): `trialStartedAt: null`.
  - Neue Funktionen (bei den anderen Gettern, z. B. neben „Onboarding"):
    ```ts
    export function getTrialStartedAt(): number | null { return store.get('trialStartedAt'); }
    export function ensureTrialStarted(): number {
      let t = store.get('trialStartedAt');
      if (!t) { t = Date.now(); store.set('trialStartedAt', t); }
      return t;
    }
    ```
- `src/main/licenseManager.ts` — `getEntitlement()` (lokal/synchron für sofortiges Gating; `validateLicense()` läuft async im Hintergrund und aktualisiert den gespeicherten Status):
    ```ts
    export type Access = 'licensed' | 'trial' | 'expired';
    export interface Entitlement { access: Access; trialDaysLeft?: number; tier: LicenseTier; key: string | null; }
    export function getEntitlement(): Entitlement {
      const d = getLicenseData();
      const licensedLocally = d.licenseStatus === 'active' && !!d.licenseKey
        && (Date.now() - (d.lastValidation || 0)) / 86400000 < OFFLINE_GRACE_DAYS;
      if (licensedLocally) return { access: 'licensed', tier: d.licenseTier, key: d.licenseKey };
      const started = ensureTrialStarted();
      const daysUsed = (Date.now() - started) / 86400000;
      if (daysUsed < TRIAL_DAYS) return { access: 'trial', trialDaysLeft: Math.max(0, Math.ceil(TRIAL_DAYS - daysUsed)), tier: null, key: null };
      return { access: 'expired', tier: null, key: null };
    }
    ```
  - **Wichtig:** Offline-Grace darf den Trial nicht verlängern — `getEntitlement` ist die einzige Wahrheit fürs Gating; `validateLicense` setzt bei Revoke/Expiry `licenseStatus` zurück, danach greift wieder der Trial-/Expired-Pfad.

**C) IPC**
- `src/main/ipcHandlers.ts`
  - Neu: `ipcMain.handle('license:getEntitlement', () => getEntitlement());` (Import aus licenseManager ergänzen).
  - `license:openCheckout` (Z. 664–666): URL `https://vswrite.com/pricing` → **finale Penwright-Kauf-URL** (User fragen; z. B. `https://penwright.app/buy` oder direkter Polar-Checkout-Link).
- `src/main/preload-entry.ts` (INVOKE_CHANNELS, Z. ~80–84): `'license:getEntitlement'` zur Whitelist hinzufügen.

**D) Renderer-Gating**
- `src/renderer/appState.svelte.ts` (License-Felder Z. 30–33): ergänzen
  `licenseAccess: 'trial' as 'licensed' | 'trial' | 'expired'`, `trialDaysLeft: 14`.
- `src/renderer/App.svelte`
  - `onMount` (Z. ~306–313): nach `license:validate` zusätzlich `license:getEntitlement` aufrufen → `uiState.licenseAccess` + `uiState.trialDaysLeft` setzen. (Erst validate, dann getEntitlement, damit der lokale Status frisch ist.)
  - **Sperre:** wenn `uiState.licenseAccess === 'expired'` → neue Komponente **`<LicenseGate>`** als blockierender Fullscreen-Layer rendern (z. B. ganz oben im Haupt-Markup, vor StartScreen/Editor). Sie verhindert Projekt-Öffnen/Editieren.
  - **Trial-Banner:** wenn `=== 'trial'` → schlanker Hinweis „Testphase – noch {trialDaysLeft} Tage · Jetzt kaufen" (oben im StartScreen oder in der Statusleiste), nicht blockierend.
  - Statusleiste (Z. ~1126–1133): statt Licensed/Pro/Unlicensed → `licensed` = „Licensed", `trial` = „Testphase: X Tage", `expired` = „Gesperrt".
- **Neue Komponente** `src/renderer/components/LicenseGate.svelte`: Penwright-Logo, Überschrift „Testphase abgelaufen", Button **„Lizenz kaufen – 59 €"** → `license:openCheckout`, Button **„Key eingeben"** → öffnet `LicenseDialog`, optional „Erneut prüfen" (nach Key-Eingabe `license:validate` + `getEntitlement`).
- `LicenseDialog.svelte`: nach erfolgreicher `license:activate` zusätzlich `license:getEntitlement` neu holen und `uiState.licenseAccess` aktualisieren, damit die Sperre sofort fällt.
- `src/renderer/components/AboutDialog.svelte` `tierLabel()` (Z. 40–41): auf `'Licensed'` / `'Unlicensed'` reduzieren (Basic/Pro raus).

**E) „Ein Key = alles" / MCP**
- Durch A erledigt: MCP (`server.ts`/`mcpSetup.ts`) akzeptiert jeden gültigen `pw_LIC`-Key; die App gated alles über `getEntitlement().access`.

**F) Verifikation**
- `npx electron-vite build` (main+renderer) und `node esbuild.mcp.mjs` (MCP-Server) müssen grün sein.
- Trial-Logik gedanklich durchspielen: frische Installation → `trial` (14 Tage) → nach Ablauf `expired` (Sperre) → Key aktivieren → `licensed`. Offline mit gültigem Key < 7 Tage → bleibt `licensed`; > 7 Tage offline → `expired`.
- `app` mit `unset ELECTRON_RUN_AS_NODE && electron-vite dev` starten und Gate/Banner real prüfen.

### 3.3 Was du vom User brauchst, bevor/while du baust
1. **Finale „Key kaufen"-URL** (Homepage-Pricing-Seite oder direkter Polar-Checkout-Link).
2. (Optional) Bestätigung der UI-Wortwahl: „Licensed/Lizenziert", „Testphase", „Gesperrt".

---

## 4. Danach offen: koordinierter Rename (Tier-2, eigener Durchgang)
Alles bewusst aufgehoben, weil Migration/Prosa/Abstimmung nötig:
- **`vswrite_*` MCP-Tool-Namen** → `penwright_*` (~205 Stellen in `src/mcp/server.ts` + 67 in `manifest.template.json`; bricht bestehende Claude-Configs; betrifft auch Skill-Prosa).
- **`.vswrite/`-Projektordner** → `.penwright/` (**braucht Auto-Migration** beim Projekt-Öffnen; betrifft fileManager/persistenceManager/projectManager/App.svelte/styleParser …).
- **`vswrite-asset://` / `vswrite-font://`** Protokolle (index.ts protocol.handle + `typstImage.ts:43` + `DesignPanel.svelte:111` + CSP/Registrierung) — invisible, aber Bild-/Font-Rendering bricht, wenn eine Stelle vergessen wird.
- **Skill** `vswrite`/`vswrite-conventions` (`skillTemplates.ts` `VSWRITE_SKILL`, `projectManager.ts:550` Slug, `server.ts:355/357` Prompt, StartScreen-Badge) — verzahnt mit den Tool-Namen.
- **Doku-Prosa** (handbuch.md, handbook.md, mcp-server.md, project_status.md, CLAUDE.md, done/) — überall „vswrite".
- **Manifest-Identität** (name/display_name/homepage/keywords/author).

Empfohlene Reihenfolge, falls man Tier-2 angeht: Protokolle → Skill → MCP-Tools (`vswrite_*`) als ein konzentrierter Sweep + Doku → `.vswrite/` mit Migration → Doku-Prosa rollend.

---

## 5. Lesereihenfolge der Dokumente (im neuen Chat)
1. **`documentation/handover.md`** ← dieses Dokument (Einstieg).
2. **`CLAUDE.md`** (Repo-Root) — Architektur, Konventionen, Patterns. **Hinweis:** noch „vswrite"-Sprech; der Penwright-Rebrand ist neuer als diese Datei.
3. **`documentation/project_status.md`** — Feature-/Release-Status. **Achtung:** beschreibt den Stand VOR dem Rebrand (Name „vswrite", MCP-Tool-Counts etc.) — Identität ist inzwischen Penwright.
4. **`documentation/next-steps.md`** — Release-/Build-/Notarization-Plan (DMG/Notarization ist der reale Launch-Blocker; Apple-Dev-Account vorhanden; **Auto-Updater wurde gestrichen** → Updates per Newsletter; Handbuch wird **in-app** mitgeliefert, kein Hosting nötig).
5. Für M8.7 gezielt die Code-Dateien aus **§3.2** (licenseManager.ts, persistenceManager.ts, ipcHandlers.ts ~628–666, App.svelte ~306–316 & ~808–816 & ~1126–1133, LicenseDialog.svelte, appState.svelte.ts ~30–33, preload-entry.ts ~80–84).

---

## 6. Build-/Run-Befehle (macOS, aus VS Code/Cursor-Terminal)
```bash
# Dev (das unset ist Pflicht aus VS-Code-Terminals)
unset ELECTRON_RUN_AS_NODE && electron-vite dev
# Builds (Verifikation)
unset ELECTRON_RUN_AS_NODE && npx electron-vite build   # main + preload + renderer
node esbuild.mcp.mjs                                     # MCP-Server (server.ts)
# Packaging (Launch)
npm run package:mac   # build + mcp-binary(all) + fetch packages/fonts + audit + electron-builder --mac
```
- Typst-Binary lokal: `/opt/homebrew/bin/typst` (System), in Prod gebündelt. Schriften Spectral/Crimson Pro liegen in `~/Library/Fonts`.
- Git: Branch **`docx-overhaul`**. Rebrand = Commit `164dea5`. `.claude/` ist untracked und soll es bleiben (nicht committen). Commit nur auf Ansage des Users; Commit-Messages enden mit `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

## 7. Nützlicher Startsatz für den neuen Chat
> „Lies `documentation/handover.md`, dann CLAUDE.md. Wir machen mit **M8.7** weiter: das Lizenzmodell (lokaler 14-Tage-Trial, danach Sperre, Prefix `pw_LIC`, ein Key = alles, Offline-Grace 7 Tage, 59 €) nach dem Plan in §3 implementieren. Frag mich zuerst nach der finalen ‚Key kaufen'-URL, dann leg los."
