# vswrite Desktop — Third-Party Package Bundling & Licensing

> **Status:** Infrastruktur **implementiert** in Session 20 (2026-05-17). Auto-generated License-Report: [THIRD_PARTY_LICENSES.md](../THIRD_PARTY_LICENSES.md). Audit-Workflow + Acknowledgments-Dialog laufen produktiv. Letzte Aktualisierung: 2026-05-17.
>
> Was hier drinsteht: welche Typst-Packages wir mitliefern, unter welcher Lizenz, mit welchen Pflichten — und ein Workflow zum periodischen Audit.

---

## Strategie: Hybrid

| Tier | Was | Beispiele |
|---|---|---|
| **Bundled** | Mit-ausgelieferte Packages + Fonts, offline nutzbar, in `Contents/Resources/typst-packages/` | High-value Layout-/Grafik-/CV-Packages + Standard-OFL-Fonts |
| **Lazy-fetched** | vswrite kennt sie, Toolbar/Slash-Command schlaegt sie vor, Typst-CLI laedt vom Universe-CDN beim ersten Compile | Long-tail Spezial-Packages, alles ausserhalb der Whitelist |

Der **Lazy-Fetch-Pfad ist die Default-Position** — wir bundlen nur Packages mit echtem Mehrwert (offline-Nutzung, Performance, Stabilitaet) und sauberer permissiver Lizenz. Alle anderen koennen via `#import "@preview/..."` ohne Bundling-Aufwand benutzt werden.

---

## Lizenz-Whitelist

**Akzeptiert ohne Vorbehalt (Bundling OK):**

- MIT
- Apache 2.0 (mit `NOTICE`-File-Beachtung wenn das Package eins hat)
- BSD-2-Clause, BSD-3-Clause
- ISC
- MPL 2.0 (akzeptiert; Modifikationen am Package-Source muessten unter MPL veroeffentlicht werden — wir aendern den Source aber typischerweise nicht)
- Unlicense, CC0

**Akzeptiert mit Auflagen:**

- **OFL (Open Font License)** — fuer Schriften ueblich. Bundling OK, aber:
  - LICENSE.txt der Schrift muss mitausgeliefert werden
  - Schrift darf nicht *alleine* verkauft werden (z.B. kein "vswrite Font Pack" als eigenes Produkt — vswrite-mit-Fonts als Anwendung ist OK)
  - Reserved-Font-Name muss respektiert werden (Modifikationen muessen umbenannt werden)
- **LPPL** — falls aus dem LaTeX-Oekosystem portierte Packages auftauchen. Aehnlich permissiv, aber Modifikationen muessen umbenannt werden.

**Abgelehnt fuer Bundling:**

- **GPL v2 / GPL v3** — viraler Copyleft-Effekt zwingt zu OSS-Release von vswrite. Solche Packages **nur Lazy-Fetch**, niemals bundlen.
- **AGPL** — gleicher Effekt, gilt auch fuer Server-Use. Nie bundlen.
- **Proprietaere / "Source available"-Lizenzen** — eindeutig nicht bundlebar.

> Typst-Universe akzeptiert auf Repo-Ebene keine GPL-Packages — entsprechend ist die Tabelle fuer Universe-Packages selten ein Problem. Vorsicht bei lokal-installierten oder GitHub-direkt-importierten Packages.

---

## Was wir bundlen (finalisiert)

24 Packages insgesamt, davon 13 user-facing und 11 transitive Dependencies. Vollstaendige auto-generierte Tabelle mit Versionen, Lizenz-Texten und Repo-Links: [THIRD_PARTY_LICENSES.md](../THIRD_PARTY_LICENSES.md).

### User-facing Packages (13)

| Package | Version | Use-Case | Lizenz |
|---|---|---|---|
| **wrap-it** | 0.1.1 | Text fliesst um Bilder / Grafiken herum | Unlicense |
| **meander** | 0.4.2 | Page-Layout-Engine, multi-column reflow + text-threading + obstacles | MIT |
| **drafting** | 0.2.2 | Margin notes mit Auto-Collision-Avoidance | Unlicense |
| **cetz** | 0.5.2 | Vector graphics, TikZ-Aequivalent | **LGPL-3.0-or-later** |
| **fletcher** | 0.5.8 | Node-und-Kanten-Diagramme | MIT |
| **lilaq** | 0.6.0 | Scientific Plots (Line/Scatter/Bar/Boxplot/Contour) | MIT |
| **droplet** | 0.3.1 | Drop Caps fuer Editorial-Layouts | MIT |
| **codly** | 1.3.0 | Code-Blocks mit Line-Numbers, Annotations | MIT |
| **showybox** | 2.0.4 | Farbige Boxen mit Title/Footer/Border/Shadow | MIT |
| **gentle-clues** | 1.3.1 | Material-Design-Admonitions (Info/Tip/Warning) | MIT |
| **glossarium** | 0.5.10 | Glossare und Akronym-Listen | MIT |
| **subpar** | 0.2.2 | Sub-Figures mit shared Main-Caption | MIT |
| **lovelace** | 0.3.1 | Algorithm-Pseudocode | MIT |

### Transitive Dependencies (11)

Aus den Source-Files der user-facing Packages automatisch ermittelt:

- **cetz 0.3.4** (LGPL-3.0-or-later) — fuer fletcher (fletcher 0.5.8 ist nicht auf cetz 0.5.x portiert)
- **oxifmt 1.0.0** (MIT) — fuer cetz
- **codly-languages 0.1.7** (MIT) — Companion zu codly fuer Language-Icons
- **linguify 0.5.0** (MIT) — fuer gentle-clues
- **elembic 1.1.1** (MIT) — fuer lilaq
- **komet 0.1.0** + **0.2.0** (beide MIT) — fuer lilaq (verschiedene Plot-Module brauchen verschiedene Versionen)
- **suiji 0.5.1** (MIT) — fuer lilaq
- **tiptoe 0.4.0** (MIT) — fuer lilaq
- **zero 0.6.1** (MIT) — fuer lilaq
- **hy-dro-gen 0.1.1** (MIT) — fuer meander

### Lizenz-Verteilung

- **MIT:** 20 Packages
- **Unlicense:** 2 Packages (wrap-it, drafting)
- **LGPL-3.0:** 2 Packages (cetz 0.5.2 + 0.3.4) — siehe LGPL-Block oben

### Sonderfall: cetz unter LGPL-3.0-or-later

cetz ist das einzige Copyleft-lizenzierte Package im Bundle. LGPL-3.0 erlaubt kommerzielles Bundling unveraenderter Libraries explizit, mit den Auflagen:

1. **Lizenz-Text mitausliefern** — durch unsere `Contents/Resources/typst-packages/preview/cetz/<version>/LICENSE` + Acknowledgments-Dialog erfuellt.
2. **Source-Code accessible halten** — Typst-Packages sind reiner `.typ`-Source-Code. Der User hat per Filesystem-Zugriff vollen Zugriff auf den ungekuerzten cetz-Source. Erfuellt.
3. **Modifikationen unter LGPL** — wir modifizieren cetz nicht, das Bundle ist 1:1 das Upstream-Tarball. Falls wir in Zukunft cetz patchen muessten, kaeme der Patch upstream in das cetz-Repo, nicht in unseren Bundle-Source.

Resultierend: cetz-Bundle ist mit kommerzieller Distribution kompatibel.

### Fonts

In dieser Iteration **noch nicht gebundlet** — Phase B des Design-Editors ([design-editor-plan.md](design-editor-plan.md)) bringt den Font-Bundle (Inter, IBM Plex, JetBrains Mono, Crimson Pro, Libertinus, Spectral — alle OFL). Bis dahin verwendet vswrite nur System-Fonts.

---

## Audit-Workflow

Jedes Package, das in die Bundle-Liste rutscht, durchlaeuft folgenden Workflow:

### 1. Manuell pruefen

```bash
# Im Universe-Repo nach Package suchen:
open "https://typst.app/universe/package/<name>"

# GitHub-Source und LICENSE-File ueberpruefen:
open "https://github.com/<author>/<package>"
```

Checkliste pro Package:
- [ ] LICENSE-File existiert
- [ ] Lizenz ist auf der Whitelist (MIT / Apache 2.0 / BSD / MPL 2.0 / Unlicense / CC0)
- [ ] Version ist die aktuelle stabile (kein `0.0.x`-Pre-Release)
- [ ] Package-Dependencies: alle Dependencies sind selbst auf der Whitelist (rekursive Pruefung)
- [ ] Author / Maintainer ist identifizierbar (keine Sock-Puppet-Accounts)

### 2. In `resources/typst-packages/` ablegen

Struktur:

```
resources/typst-packages/
├── preview/
│   ├── wrap-it/
│   │   └── 0.1.1/
│   │       ├── typst.toml
│   │       ├── lib.typ
│   │       └── LICENSE
│   ├── cetz/
│   │   └── 0.3.2/
│   │       ├── typst.toml
│   │       ├── src/
│   │       └── LICENSE
│   └── ...
└── ...
```

Aufbau spiegelt die Typst-Package-Konvention (`@preview/<name>:<version>`). In `package.json`'s `extraResources` einbinden:

```json
{ "from": "resources/typst-packages/", "to": "typst-packages/" }
```

Im Main-Process via `TYPST_PACKAGE_PATH` env-Var (oder Typst-CLI-Flag `--package-path`) auf den gebundleten Ordner zeigen, sodass Typst dort ohne Internet-Zugriff fuendig wird.

### 3. Automatisierter Audit

Neues Script `scripts/audit-bundled-deps.mjs`:

- Walked `resources/typst-packages/`
- Liest pro Package das `typst.toml` (Name, Version, Author, Repository)
- Liest pro Package das `LICENSE`-File, klassifiziert die Lizenz (Regex auf bekannte Signatur-Phrases: "Permission is hereby granted, free of charge" → MIT, "Apache License" → Apache 2.0, etc.)
- Generiert `THIRD_PARTY_LICENSES.md` mit allen Eintraegen
- Generiert `resources/bundle-licenses.json` als strukturiertes Format fuer die In-App-Acknowledgments-UI
- Failed wenn ein Package eine nicht-whitelisted Lizenz hat

Lauf-Frequenz: jeder Release-Build (`package:mac` Script hookt `audit-bundled-deps` als Pre-Step).

### 4. In-App Acknowledgments

Im About-Dialog wird ein neuer Button "Open Source Licenses" / "Open Source Lizenzen" eingebaut. Klick oeffnet ein Modal mit:

- Scrollbare Liste aller gebundleten Packages + Fonts
- Pro Eintrag: Name, Version, Author, Lizenz-Typ, voller Lizenz-Text (expandable)
- Link zum jeweiligen Source-Repo

UI-Komponente: `AcknowledgmentsDialog.svelte`, gespeist aus `bundle-licenses.json` zur Build-Zeit.

---

## Aenderungen vor Release — Status

Implementiert in Session 20 (2026-05-17):

- [x] **Bundle-Liste finalisiert** — 13 user-facing + 11 transitive Packages, alle MIT / Unlicense / LGPL
- [x] **Pro Package LICENSE geprueft + dokumentiert** in [THIRD_PARTY_LICENSES.md](../THIRD_PARTY_LICENSES.md) (auto-generiert)
- [x] **`resources/typst-packages/` Struktur** angelegt und in `package.json` `extraResources` aufgenommen
- [x] **`scripts/audit-bundled-deps.mjs`** schreibt License-Klassifikation, failed bei Deny-List, generiert MD + JSON Output
- [x] **Main-Process + MCP-Server** angepasst — `--package-path` Flag via `buildTypstCompileArgs()` Helper bzw. `TYPST_PACKAGE_PATH` env-Var im MCP
- [x] **`AcknowledgmentsDialog.svelte`** mit License-Summary-Chips + ausklappbarem License-Text pro Package, Hook im About-Dialog
- [x] **`THIRD_PARTY_LICENSES.md`** committed (regeneriert bei jedem `package:*`-Build)

Verbleibend vor Launch:

- [ ] **Einmalige Rechtsberatung** vor dem ersten kommerziellen Release (~30–60 min, DACH-Anwalt mit OSS-Erfahrung) — empfohlen weil cetz LGPL ist; Anwalt soll insbesondere bestaetigen, dass unsere LGPL-Compliance (unveraendertes Bundling + accessible Source + LICENSE-Beilage + Acknowledgments-UI) ausreicht.

**Tatsaechlicher Aufwand:** ~4 Werktage Vollzeit fuer die Bundling-Infrastruktur (Session 20).

---

## Anti-Patterns

- **Niemals "vswrite Font Pack" oder "vswrite Template Bundle" als separates Produkt verkaufen.** OFL- und MIT-Lizenzen erlauben Redistribution als Teil eines groesseren Werks, nicht als isoliertes Produkt mit aufgesetzter Lizenz.
- **Niemals LICENSE-Files entfernen / unsichtbar machen.** Auch wenn keine Pflicht in der UI besteht, sie sichtbar zu haben — in den gebundleten Files muessen die LICENSE-Files exakt erhalten bleiben.
- **Niemals Package-Code modifizieren ohne Vermerk.** Wenn ein Package gefixt werden muss (z.B. Bug-Workaround), den Fix upstream einreichen statt lokal zu patchen. Wenn lokal gepatcht: separates Verzeichnis (`resources/typst-packages-patches/`) + klare Doku im Diff-File.
- **Niemals Lazy-Fetch und Bundle fuer dasselbe Package mischen.** Typst-CLI wuerde sich verwirren, welcher Pfad gewinnt. Pro Package entscheiden, entweder/oder.

---

## Pflege

Bundle-Versionen sind nicht "set and forget". Maintainer pushen Updates, manchmal mit Bugfixes, manchmal mit breaking changes.

- **Bei jedem Major-vswrite-Release** (1.x → 2.0): Bundle-Liste durchgehen, auf neueste stabile Versionen aktualisieren, Re-Audit. Aufwand: ~½ Tag.
- **Bei kritischen Bugs in einem Package** (z.B. Compile-Error-Regression): Out-of-band Update plus Vswrite-Patch-Release.
- **Wenn ein Package abandoned wird** (kein Update > 12 Monate, Maintainer reagiert nicht): forken in unser Org oder mit alternativer Package ersetzen, in `THIRD_PARTY_LICENSES.md` dokumentieren.

---

## Verweis

Implementiert wird das in derselben Iteration wie der [Design Editor](design-editor-plan.md) — der Visual-Style-Editor braucht die gebundleten Layout-Packages (`wrap-it` fuer Text-um-Bilder, `cetz`/`fletcher` fuer Grafik-Insertion via MCP, etc.), um seinem Versprechen einer "design-fokussierten" Erfahrung gerecht zu werden.

Die Reihenfolge in der naechsten Session:

1. Bundle-Liste finalisieren
2. Lizenz-Audit pro Package
3. `resources/typst-packages/` befuellen
4. Audit-Script + Acknowledgments-Dialog
5. Erst dann: Design-Editor-Phase-A starten
