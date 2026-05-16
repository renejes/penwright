# vswrite Desktop — Third-Party Package Bundling & Licensing

> **Status:** Strategie + Audit-Workflow. Eintrag-Datum: 2026-05-16. Geplant **vor** v1.0-Release zusammen mit dem [Design Editor](design-editor-plan.md), weil der Design-Use-Case ohne mitgelieferte Layout-Packages nicht funktioniert.
>
> Was hier drinsteht: welche Typst-Packages und Fonts wir mitliefern, unter welcher Lizenz, mit welchen Pflichten — und ein Workflow zum periodischen Audit.

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

## Bundle-Kandidaten

Die folgende Tabelle ist die **Arbeitsliste** fuer die naechste Session. Jeder Eintrag muss vor Bundling einzeln geprueft werden — Spalten **Version**, **License-File-Check** und **Acknowledgment** sind dabei zu fuellen.

### Packages (zu finalisieren)

| Package | Use-Case | Vermutete Lizenz | Status |
|---|---|---|---|
| **wrap-it** | Text fliesst um Bilder / Grafiken herum (Magazin-Layout) | MIT (zu pruefen) | Vom User explizit gewuenscht |
| **cetz** | Vektorgrafik / TikZ-Aequivalent | Apache 2.0 (zu pruefen) | Kandidat |
| **fletcher** | Diagramme / Knoten-Graphen / Flussdiagramme | MIT (zu pruefen) | Kandidat |
| **cetz-plot** | Charts (Line / Bar / Scatter) auf Basis von cetz | MIT (zu pruefen) | Kandidat |
| **glossarium** | Glossare, Akronym-Listen | MIT (zu pruefen) | Kandidat (akademisch) |
| **subpar** | Sub-Figures (mehrere Abbildungen unter einer Hauptcaption) | MIT (zu pruefen) | Kandidat (akademisch) |
| **oxifmt** | Number-Formatting fuer Tabellen / Zahlen-Heavy-Content | MIT (zu pruefen) | Kandidat |
| **lovelace** | Algorithm-Pseudocode | MIT (zu pruefen) | Kandidat (informatik/akademisch) |
| **marge** | Marginalia (Side-Notes am Seitenrand) | MIT (zu pruefen) | Kandidat (editorial / Magazin) |
| **modern-cv** o. **brilliant-CV** | CV-Template-Basis | MIT (zu pruefen) | Kandidat (Resume-Use-Case) |

> Diese Liste wird in der naechsten Session finalisiert. Der User legt die endgueltige Auswahl fest; jedes ausgewaehlte Package laeuft dann durch den Audit-Workflow (unten).

### Fonts (zu finalisieren)

| Font | Use-Case | Lizenz | Status |
|---|---|---|---|
| **Inter** (variable) | Modern-Sans-Default, UI- und Body-Schrift | OFL | Kandidat |
| **IBM Plex Sans / Serif / Mono** | Tech-affines Trio, gut fuer Documentation / Marketing | OFL | Kandidat |
| **JetBrains Mono** | Code-Schrift-Default | OFL | Kandidat |
| **Crimson Pro** | Klassische Serif fuer Akademik / Buchsatz | OFL | Kandidat |
| **Libertinus Serif / Sans / Mono** | Linux-Libertine-Nachfolger, akademik-tauglich | OFL | Kandidat |
| **Spectral** | Display-Serif fuer Editorial | OFL | Kandidat |
| **Source Sans / Serif / Code** | Adobe-Open-Source-Trio | OFL | Optional |

Alle gelisteten Fonts sind OFL — sauber bundlebar mit `LICENSE.txt`-Beilage.

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

## Aenderungen vor Release

Da Bundling jetzt **pre-v1.0** stattfindet, ergeben sich folgende Aufgaben:

- [ ] **Bundle-Liste finalisieren** (naechste Session) — User waehlt aus den Kandidaten oben aus
- [ ] **Pro Package LICENSE pruefen + dokumentieren** (~½ Tag pro 5 Packages)
- [ ] **`resources/typst-packages/` Struktur anlegen** und in `package.json` `extraResources` aufnehmen (~½ Tag)
- [ ] **`scripts/audit-bundled-deps.mjs`** schreiben (~1 Tag)
- [ ] **Main-Process** anpassen, dass Typst-Compiler den gebundleten Package-Pfad kennt (`TYPST_PACKAGE_PATH` o.ae., ~½ Tag)
- [ ] **`AcknowledgmentsDialog.svelte`** + Hook im About-Dialog (~1 Tag)
- [ ] **`THIRD_PARTY_LICENSES.md`** committen und im Repo halten
- [ ] **Einmalige Rechtsberatung** vor dem ersten kommerziellen Release (~30–60 min, DACH-Anwalt mit OSS-Erfahrung)

**Aufwand insgesamt:** ~4–6 Werktage fuer die Bundling-Infrastruktur, exklusive Rechtsberatungs-Wartezeit.

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
