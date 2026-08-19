# Release-Strategie — Lizenz, Modell, Vertrieb

> **Stand:** 2026-08-19 · **App-Version:** 0.12.0 (pre-release) · **Status:** kommerzielles Modell aufgegeben
>
> **Aktuell:** Penwright ist **kostenlos für alle**, inklusive Unternehmen. Die App darf genutzt werden; der Quelltext darf **nicht** in fremde Projekte übernommen oder weitergegeben werden (PolyForm Strict + zusätzliche Erlaubnis für Nutzung und Eigenbau, siehe [`LICENSE.md`](../LICENSE.md)). Polar, Kaufdialoge und die Frage „privat oder geschäftlich“ sind entfernt.
>
> Der Rest dieser Datei dokumentiert die **frühere** Entscheidung („Der Lesesaal": kostenlos privat, kostenpflichtig kommerziell) und die Marktrecherche dahinter. Sie bleibt als Begründung, warum der Quelltext source-available und nicht MIT ist. Preise, Polar und Feature-Gates gelten nicht mehr.

> **App-Version (historisch):** 0.12.0 (pre-release)

Diese Datei hält fest, **als was** Penwright veröffentlicht wird und **warum**. Sie ist die
Entscheidungsgrundlage — die technische Umsetzung steht in [next-steps.md](next-steps.md),
die Architektur in [../CLAUDE.md](../CLAUDE.md).

Die vollständige Marktrecherche (8 Stränge, Zahlen-Audit, adversariale Kritik) liegt der
Entscheidung zugrunde; die belastbaren Zahlen sind unten in §7 zusammengefasst.

---

## 1. Die Entscheidung in einem Absatz

Penwright wird **veröffentlicht, nicht verkauft** — aber **nicht verschenkt**. Der Quelltext geht
öffentlich, die App ist für private, akademische und Hobby-Nutzung **vollständig und dauerhaft
kostenlos**, inklusive der kompletten KI-/MCP-Schicht. Kommerzielle Nutzung erfordert eine
kostenpflichtige Lizenz. Es gibt **keine Testphase, keine Sperre und kein Feature-Gate** — die App
funktioniert für jeden immer vollständig. Die Unterscheidung liegt bei **wer**, nicht bei **was**.

**Die Variante heißt intern „Der Lesesaal".** Quelltext offen zum Lesen und Prüfen; Herstellung
und Vertrieb der Binaries bleiben bei uns.

---

## 2. Warum nicht die Alternativen

| Verworfen | Grund |
|---|---|
| **Verkaufen (closed source, Kampagne)** | Erwartungswert Jahr 1 ist bei **jedem** Preis negativ (−€1.300 bei €59, −€427 bei €290), weil ~400 Stunden Marketing- und Compliance-Arbeit dagegen stehen. Effektiver Stundenlohn über die gesamte Verteilung: **€4,64**. Ein Marketingjob, für den weder Budget noch Lust da ist. |
| **MIT / Apache-2.0** | Der Angriff ist kein Fork, sondern ein Patch: `licenseManager.ts` löschen ist ein ~50-Zeilen-Diff plus eine CI, die auf unsere Releases rebased. Unter MIT ist das **legal**. Und der Round-Trip-Parser — das einzige, woran TyX, Tylina, `typst-wysiwyg` und `papyrus` alle nachweislich hängen — wäre am Tag eins verschenkt. |
| **AGPL-3.0** | §13 schließt zwar eine reale Lücke (dieser Stack ist ein `vite build` von einer Web-App entfernt, und TypeTeX/Underleaf verkaufen genau das). Aber: von einem deutschen Einzelunternehmer gegen ausländisches SaaS nicht durchsetzbar, und die Tür, die es offenhält — proprietäre Ausnahmen für Leute, die Code **einbetten** wollen — führt bei einem Desktop-Editor in einen Markt, den es nicht gibt. **Bleibt der Fallback**, siehe §8. |
| **GPL-3.0** | Erlaubt jedem, unsere Binaries kostenlos weiterzuverbreiten. Genau das hat Ardour zerlegt (LWN: *„Linux distributions packaged Ardour for free, undermining the subscription model"*, Paul Davis: *„most of them around US$1"*). Aseprite, das Binary-Weiterverbreitung **verbietet**, hat geschätzt $4,4–5,4 Mio. gemacht. Eine Klausel Unterschied. |
| **FSL / BUSL** | FSL lässt **private und interne betriebliche Nutzung frei** — also exakt unseren zahlenden Fall — und wandelt sich nach zwei Jahren automatisch zu Apache-2.0. BUSL ist mechanisch in Ordnung, aber seit HashiCorp Marktkürzel für „rug pull". |
| **PolyForm-NC allein** | Gewährt Änderung **und Weiterverbreitung zu nicht-kommerziellen Zwecken.** Jeder kostenlose Konkurrent ist nicht-kommerziell. Das verschenkt den Parser legal. → Zusätze nötig, siehe §3. |
| **Reine Spenden / „Das Geschenk"** | Zettlr: 13.333 Stars → **3 GitHub-Sponsoren.** MarkText: 59.549 Stars → nie ein Cent, dann Burnout und Aufgabe. Realistischer Spendenertrag hier: €75–350/Jahr. Deckt nicht mal die Apple-Gebühr. |

---

## 3. Lizenz

### Gewählt: **PolyForm Strict 1.0.0 — unverändert**

> **Liegt vor:** [`../LICENSE.md`](../LICENSE.md) — und der PolyForm-Text steht **in einer eigenen,
> unangetasteten Datei** ([`../LICENSE-PolyForm-Strict-1.0.0.md`](../LICENSE-PolyForm-Strict-1.0.0.md),
> byte-identisch zum Upstream, SHA-256 in `LICENSE.md` vermerkt). Damit ist PolyForms Bedingung
> („wer ihren Text ändert, muss den Namen entfernen") nicht auslegungsbedürftig, sondern
> physisch erfüllt: ihre Datei ist unberührt, alles Eigene steht daneben.
> Beitragsregel: [`../CONTRIBUTING.md`](../CONTRIBUTING.md).

**Basis:** [PolyForm Strict 1.0.0](https://polyformproject.org/licenses/strict/1.0.0)
— Nutzung frei **für nicht-kommerzielle Zwecke**, aber der Copyright-Grant lautet wörtlich
*„…for any permitted purpose, **other than distributing the software or making changes or new works
based on the software**"*.

> **Korrektur gegenüber dem ersten Entwurf, und der Grund ist wichtig.** Geplant war
> PolyForm **Noncommercial** plus zwei selbstgeschriebene Zusätze, die dessen Distribution- und
> Changes-Grant wieder einkassieren. Zwei Dinge sprachen dagegen:
>
> 1. **PolyForm Strict tut das bereits ab Werk** — von Lizenzanwälten geschrieben, als
>    Standardformular, ohne eine einzige selbstgebaute Klausel. Beide Zusätze sind überflüssig.
> 2. PolyForm schreibt selbst: *„If you make changes to a PolyForm license, you must remove all
>    mention of ‚PolyForm' and polyformproject.org, as well."* Ein Dokument, das PolyForm-NC
>    zitiert und dann dessen Grants aushöhlt, hätte den Namen also gar nicht führen dürfen.
>
> Dazu ein Argument, das ohne Anwaltsprüfung schwerer wiegt als alles andere: ein Dokument, das
> in §3 etwas gewährt und in §4 zurücknimmt, ist **in sich widersprüchlich** — und Widersprüche in
> vorformulierten Bedingungen gehen nach **§ 305c Abs. 2 BGB zulasten des Verwenders**, also
> unseren. Ein unverändertes Standardformular hat diesen Angriffspunkt nicht.

**Auch der dritte Zusatz (Anti-Umgehung nach ELv2) entfällt** — und verliert dabei nichts:
unter Strict ist das Herauspatchen der Lizenzprüfung bereits *„making changes based on the
software"* und damit nicht lizenziert, und das Verteilen des gepatchten Builds ist es doppelt.
Was der Zusatz verbieten sollte, ist zweifach schon verboten.

**Eine einzige eigene Klausel bleibt — und sie *erweitert* nur:** [`LICENSE.md`](../LICENSE.md) §4
erlaubt ausdrücklich, aus dem Quelltext zu **bauen und das Ergebnis selbst zu nutzen**. Ohne sie
ließe sich „keine Änderungen" so lesen, dass schon das Kompilieren nicht gedeckt ist — was den
Zweck der Veröffentlichung zerstören würde. Eine zusätzliche Erlaubnis kann sich nicht gegen uns
wenden; sie ändert den PolyForm-Text nicht, sondern steht sichtbar daneben.

### Drei Festlegungen, die dazugehören

- **Kein Change Date.** Jede Reputationskatastrophe im Datensatz (Gitea, MinIO, Redis, Bruno,
  Audacity) bestrafte eine **Umkehr**, nicht einen Preis. n8n verlangt seit Tag eins Geld für eine
  eingeschränkte Lizenz — bei $2,5 Mrd. Bewertung, ohne nennenswerten Fork.
- **Nie „kostenlos für immer", „immer Open Source" oder „Community Edition" schreiben.**
  Wir sagen überall **„source-available, nicht Open Source"**. Ehrlich von Anfang an.
- **Ein Bauteil wird echt verschenkt:** `typst-pixel-diff` (`pngPixelHash` + kleiner Korpus-Runner,
  ~500 LOC) unter **Apache-2.0**. Bewaffnet niemanden — ein Regressions-Harness kann nichts parsen
  oder serialisieren — fehlt dem Ökosystem (1.450+ Packages, kein visuelles Regressionswerkzeug)
  tatsächlich, und macht unsere zentrale Behauptung **überprüfbar statt behauptet**.
  Dazu die Projekt-Templates, Paletten, Layout-Presets und Claude-Skills als **CC-BY-4.0**.

### Was am Tag eins wahr sein muss

- [x] ~~`package.json`: `"license": "MIT"` → `"SEE LICENSE IN LICENSE.md"`~~ — **erledigt**,
      zusätzlich `"private": true` (blockiert ein versehentliches `npm publish`; das Feld `bin`
      für `penwright-mcp` hätte das sonst nahegelegt). Nichts wurde je veröffentlicht, also
      existierte keine Rechteeinräumung und es gab nichts zu widerrufen.
- [ ] **100 % Copyright bleibt bei uns.** Aktuell erfüllt: Alleinautor, 236 Commits, privates Repo,
      keine externen Beiträge. Gesichert durch `CONTRIBUTING.md`: **Issues, Übersetzungen,
      Dokumentation und Korpus-Dokumente — keine Code-PRs.** Ein DCO gewährt **keine**
      Umlizenzierungsrechte; jedes Projekt, das je erfolgreich umlizenziert hat (MongoDB,
      HashiCorp, Elastic, Redis, Sentry, Grafana), hatte vorher ein CLA.
- [ ] **Kein permissiv lizenzierter Commit in der veröffentlichten Historie.** Vor dem Public-Push
      prüfen: kein Gist, kein npm publish, kein öffentliches CI-Artefakt, kein Mirror.
- [ ] **`penwright.online` registrieren**, DPMA/EUIPO-Recherche **vor** der Markenanmeldung
      (`penwright.com` und `penwright.ink` gehören bereits anderen). Ein Fork kann den Code nehmen,
      **nicht den Namen** — Gitea/Forgejo und Redis/Valkey waren am Ende Namensstreits.
- [ ] **Testkorpus bleibt außerhalb des öffentlichen Repos.** Echte Kundendokumente, vertraulich —
      und getrennt davon ein nicht reproduzierbares Asset.
- [ ] SBOM (CycloneDX) aus `audit-bundled-deps.mjs` emittieren; mitgelieferte Lizenztexte prüfen
      (LGPL-3.0 + GPL-3.0 für cetz, OFL je Schriftfamilie, Apache NOTICE für Typst und pdf.js);
      die Invariante **„Schriften werden unverändert ausgeliefert"** dokumentieren, damit eine
      künftige Bundle-Optimierung nicht still eine OFL-Verletzung erzeugt (Subsetting oder
      statisches Instanziieren einer Variable-Font verletzt den Reserved Font Name).

---

## 4. Das Modell

| | |
|---|---|
| **Privat / Studium / Forschung / Hobby** | Vollständig kostenlos, dauerhaft. **Alle Funktionen, inklusive aller 66 MCP-Tools.** Kein Schlüssel, kein Konto, kein Timer. |
| **Kommerziell** | Kostenpflichtige Lizenz pro Platz. |
| **Testphase** | **Entfällt.** Es gibt nichts zu testen — die App ist für den größten Teil der Nutzer ohnehin kostenlos, und der kommerzielle Nutzer sieht vor dem Kauf alles. |
| **Feature-Gates** | **Keine.** Nichts wird je gesperrt. Die Unterscheidung ist **wer**, nicht **was**. |

### Wie die App das merkt: gar nicht — sie fragt

Einmal beim ersten Start: **„Wie nutzt du Penwright?"** → *Privat / Studium / Forschung* oder
*Beruflich / kommerziell*. (Obsidian macht genau das.)

- **Privat** → nie wieder ein Hinweis.
- **Beruflich, ohne Lizenz** → ein schmaler, wegklickbarer Hinweis mit Kauf-Button. Kein Blocken,
  kein Modal, keine Zwangspause.
- **Beruflich, mit Lizenz** → nichts.

Die Antwort ist jederzeit im Lizenz-Dialog änderbar.

> **Warum überhaupt ein Hinweis?** Weil Zusatz 2 sonst wirkungslos wäre: Wo es kein technisches
> Element gibt, gibt es nichts zu umgehen. Ehrlichkeitsmodelle dieser Bauart (Sublime Text, WinRAR)
> konvertieren 1–10 % der kommerziellen Nutzer — reine Ehrlichkeit ohne jeden Hinweis konvertiert
> messbar schlechter.

### Preis

**Empfehlung: €290 pro Platz**, 12 Monate Updates inklusive, danach optional €90/Jahr; die letzte
berechtigte Version läuft offline dauerhaft weiter.

> **Offen** — das aktuelle Polar-Produkt steht auf **€59** und muss umgestellt werden.
> Begründung für die Erhöhung: die Kanäle liefern bei jedem Preis dieselben Leute (Typst-Hobbyisten
> und Studierende), also erhöht ein höherer Preis den Umsatz **um ~35 %, nicht um das Fünffache** —
> aber er macht das *kommerzielle* Gespräch überhaupt erst tragfähig. €290 liegt bewusst weit über
> der gesamten beobachteten Preisspanne der Kategorie (Typora $14.99, Texifier $39.99, Scrivener
> $59.99) und ist nur in einem warmen B2B-Kontakt zu verteidigen — also genau dort, wo er
> stattfindet.

---

## 5. Auslieferung

**Wir bauen die Binaries. Immer.** Der ganze Wert des Produkts ist „keine Installation, Compiler
ist drin". Wer selbst baut, braucht Node, `fetch:typst` (~45 MB pro Plattform), `fetch:packages`
(24 Packages), `fetch:fonts` (7 Familien) und eine funktionierende Toolchain. Die Zielgruppe macht
das nicht. Offener Quelltext heißt **nachprüfbar**, nicht **selbst kompilieren**.

Die Binaries sind **frei herunterladbar** — Privatnutzung ist ja kostenlos. Die Lizenz beschränkt
die kommerzielle *Nutzung* und die Weiterverbreitung durch Dritte, nicht den Download.

### Plattformen zum Launch: **macOS + Linux**

| | Signatur | Kosten | Status |
|---|---|---|---|
| **macOS** | Developer ID + Notarisierung, bereits eingerichtet (`identity: "Rene Jesser (3LAHNFWNT3)"`, `notarize: true`) | **€99/Jahr, läuft bereits** | ✅ getestet |
| **Linux** | keine | €0 | AppImage + deb |
| **Windows** | **verschoben** | — | ⚠️ *„wired but needs real-device verification"* |

**macOS ist Pflicht, nicht Komfort:** ohne Notarisierung blockiert Gatekeeper beim ersten Start,
und seit macOS 15 Sequoia ist der Rechtsklick→Öffnen-Trick weg — der Nutzer muss in die
Systemeinstellungen. Für ein Werkzeug gegen Markup-Angst ist das tödlich.

**Windows bewusst verschoben.** Zwei unabhängige Gründe:
1. **Ungeprüft.** Die ersten Bugreports kämen von Fremden und wären nicht reproduzierbar.
2. **Die günstige Signaturschiene gibt es für uns nicht.** Azure Trusted Signing ist seit dem
   2. April 2025 auf US-/Kanada-Organisationen mit ≥3 Jahren nachweisbarer Historie beschränkt;
   Onboarding für Einzelentwickler pausiert. Bleibt ein OV-Zertifikat mit Hardware-Token.
   [Certums Open-Source-Code-Signing](https://shop.certum.eu/code-signing.html) (~€69 Kit,
   ~€29/Jahr) ist die günstigste Schiene — **aber an Open-Source-Projekte gebunden, und ob
   PolyForm-NC deren Prüfung besteht, ist ungeklärt.** → dort anfragen, bevor Windows geplant wird.

„Windows: geplant" auf die Seite schreiben und sehen, ob überhaupt jemand fragt. Das ist ein
kostenloser Nachfragetest.

### Kostenboden

```
Apple Developer Program    €99
Domain                     €15
                          ────
                          €114/Jahr

Break-even bei €290 (netto €225,95):  1 Verkauf/Jahr
Break-even bei  €59 (netto  €45,04):  3 Verkäufe/Jahr
```

Die Kostenfrage ist damit erledigt und **kein Argument mehr** — weder dafür noch dagegen.
Polar ist Merchant of Record, die Umsatzsteuer kommt *aus* dem Preis heraus.

> ⚠️ **Der erste kommerzielle Verkauf ist eine Einbahnstraße.** Er bringt CRA-Herstellerstatus
> (Meldepflichten ab 11.09.2026, volle Konformität + CE + SBOM bis 11.12.2027), verschuldensunabhängige
> Produkthaftung ab 09.12.2026 inklusive Datenkorruption (per EULA nicht abdingbar), nach Art. 13(8)
> eine **erklärte Unterstützungsdauer von mindestens fünf Jahren** auf nicht rückrufbare Kopien,
> Gewerbeanmeldung und Abfärbe-Risiko für die freiberuflichen Beratungseinkünfte. Vorher:
> Steuerberater (Abfärbetheorie, §13b auf die MoR-Provision) und ein Angebot für
> IT-/Berufshaftpflicht mit ausdrücklicher Software-Produktdeckung.

---

## 6. Präsentation und Vertrieb

### Positionierung

> **„WYSIWYG-Editor für Typst" ist das Etikett vom Friedhof. Wir benutzen es nicht.**

Jedes kommerzielle WYSIWYG-für-Markup-Produkt der Geschichte ist tot (BaKoMa TeX 2019,
Scientific WorkPlace 2021). Der kostenlose Überlebende LyX hat nach **31 Jahren** 202 regelmäßige
Nutzer auf 277.349 gemeldeten Debian-Systemen. Gewonnen hat in „LaTeX benutzbar machen" nicht
WYSIWYG, sondern **Null-Installation + Zusammenarbeit** (Overleaf, 20 Mio. Nutzer).

Unsere zwei echten Differenzierer liegen auf der Gewinnerseite dieses Musters:

1. **Der Compiler ist drin.** Nichts installieren, offline vollständig.
2. **App ↔ KI-Parität.** Was der Mensch kann, kann die KI — mit gemeinsamem Safe-Apply-Rollback,
   gemeinsamer Undo-Historie, gemeinsamem Locking.

Dazu die Ausgabekette, die sonst niemand hat: Design-Tokens → `style.typ`, druckfertiges PDF mit
Beschnitt und Schnittmarken, journaltaugliches DOCX, redaktioneller Web-Export.

**Die Behauptung, die zieht** (belegt durch die Reaktion auf den TikZ-Editor-Thread: *„the killer
feature is not drawing TikZ visually, but being able to touch old TikZ without turning the source
into generated-looking soup"*):

> **Penwright fasst deine bestehenden `.typ`-Dateien an, ohne sie zu zerstören — und beweist es
> pixelweise.**

Das ist genau das, woran alle vier kostenlosen Konkurrenten scheitern, und es ist der Grund, warum
`typst-pixel-diff` verschenkt wird: die Behauptung wird dadurch **prüfbar**.

### Die Kanäle — nur die, die ohne uns weiterlaufen

| Kanal | Aufwand | Bemerkung |
|---|---|---|
| **awesome-typst PR** | 1 h | Zwei Einträge: App unter *Editors*, `typst-pixel-diff` unter *Tools* (dort ist OSI-Status unstrittig) |
| **best-of-typst** | 30 min | |
| **Typst-Forum Showcase** | 2 h | **Geführt von LANGSAM, dem Magazin — nicht vom Werkzeug.** Ein fertiges Heft ist der Beleg, das Tool die Fußnote. |
| **HN-Einreichung** | 3 h | Die **Engineering-Geschichte**, kein Show HN. Sonntag ~19:00 US Eastern. Alle ~14 Typst-Tool-Show-HNs lagen bei ≤27 Punkten; „Typesetter — minimalist local-first Typst editor" bekam **10**. Der offene Quelltext bringt in dieser Unterkategorie messbar **null** Auftrieb. |
| **c't / heise** | 4 h | DACH, zweisprachige App ist dort ein Argument |

**Drei Bildschirmaufnahmen, je 60–90 s, ohne Sprecher** — das sind die höchstwirksamen acht Stunden
im ganzen Plan, weil sie jeden folgenden Kanal multiplizieren:

1. **Round-Trip-Treue an einem echten Kundendokument.** Öffnen, visuell bearbeiten, speichern,
   sauberen Diff zeigen.
2. **Eine Designänderung, die den Compile bricht und sich selbst zurückrollt.** Kann sonst niemand.
3. **Claude fährt den MCP-Server** und produziert ein fertiges, compile-verifiziertes,
   gebrandetes Kundenangebot. Nicht beschrieben — **gezeigt**. Ein Filesystem-MCP plus `typst`-CLI
   ist ein kostenloser 80-%-Ersatz, und kein Mensch liest ein Architekturdokument.

### Was wir nicht tun

Keine Kampagne, kein Product Hunt als Pflichtprogramm, keine Verkaufsgespräche in die Kälte, kein
E-Mail-SLA, keine bezahlte Werbung. **Nach den Kanälen oben: zurück ans Bauen.**

### Vorprüfung vor dem Preis: zwanzig Gespräche

Bevor der kommerzielle Zweig überhaupt aufgemacht wird (Gewerbe, Versicherung, Steuerberater):
zwanzig warme Gespräche mit Beratern, Agenturen, Ingenieurbüros aus dem eigenen Umfeld. Je 15 min,
Bildschirmfreigabe, *deren* Problem an *unseren* Dokumenten — die Sichtbarkeitskonzepte und
Angebote im Testkorpus sind Verkaufsmaterial, keine Fixtures.

**Gefragt wird nach einer schriftlichen Zusage bei €290 mit Liefertermin — nicht nach Geld.**
Geld wäre das stärkere Signal, aber Geld nehmen ist die Einbahnstraße aus §5.

**≥6 von 20 → das Segment ist real.** <6 → es ist nicht real, gelernt für zwei Wochenenden, und der
Kauf-Button bleibt trotzdem stehen, weil er nichts kostet.

> Ehrlich in beide Richtungen lesen: **Scheitern ist informativ** (wenn sechs Leute, die uns
> vertrauen, nicht zusagen, tut es kein kalter Kanal). **Bestehen sagt weniger, als es sich
> anfühlt** — zwanzig Bekannte sind ein Freundschaftstest mit warmen Konversionsraten.

---

## 7. Die Zahlen, auf denen das beruht

| | |
|---|---|
| Typst-Ökosystem | 55.252 GitHub-Stars (+23 %/Jahr), 13.202 Discord, 1.450+ Packages (+84 %), Octoverse 2025 #2 der am schnellsten wachsenden Sprachen |
| **Die Asymmetrie** | **Tinymist (VS Code): 209.791 Installationen. Typst-Forum: 469 monatlich aktive Nutzer.** |
| Aktive Typst-Autoren | ~140.000 (Band 100k–200k) |
| **Belegte Nachfrage nach einer Typst-Desktop-GUI** | **~4.000–5.000 Menschen, jemals** (TyX 5.299 + Typstudio 4.913 Lifetime-Downloads, bereinigt) |
| TAM / erreichbar ohne Budget | ~28.000 / 10.000–14.000 |
| **Lebenszeit-Decke bei €59** | **~€100.000 netto** — ein bis drei Jahre Beratungseinkommen, verteilt auf fünf |
| Erwartete Verkäufe Jahr 1 (Kampagne) | **47 (Median 18)** |
| Kostenvermeidung durch Nicht-Monetarisierung | €1.520–4.080 Jahr 1 (CRA-/PLD-Ausnahme, kein Gewerbe, keine Versicherung) |
| **Referenzwert des Veröffentlichens** | **~€9.000 über 3 Jahre** bei +5 % Tagessatz auf €60.000 Jahresumsatz — **schlägt jeden Monetarisierungspfad im Dossier**, bei ~40 h Aufwand und null Haftung |

### Die Uhr — verifiziert am 2026-08-03

- **[Tylina](https://github.com/tylina)** — GitHub-Org, *„a WYSIWYG Typst desktop editor"*, Website +
  Issue-Tracker, Stand 26.07.2026. Closed Source, praktisch keine Nutzer — **aber mitgebaut von
  OrangeX4** (touying, 2.265★, 854 Follower). Community-Reichweite, die wir nicht haben.
- **[typst-wysiwyg](https://forum.typst.app/t/typst-wysiwyg-word-processor/9109)** (Remo, 17.06.2026)
  — im Typst-Forum begeistert aufgenommen. **Unsere 58.000 Zeilen Korrektheitsarbeit sind in einem
  Screenshot-Vergleich unsichtbar. Das ist das am stärksten unterschätzte Risiko im Produkt.**
- **[Typst-Roadmap](https://typst.app/docs/roadmap/)** listet wörtlich *„GUI inspector for editing
  function calls"* und *„Cursor in preview"*. Ersteres ist buchstäblich unser Makro-Formular.
- **TypeTeX** — Browser, Typst-first, Klick-zum-Bearbeiten in der Vorschau, KI-Entwurf,
  Echtzeit-Kollaboration, in der Beta kostenlos. **Hat keinen MCP-Server.** Das ist unser Keil.

**Das Fenster ist in Monaten bemessen. Das spricht für veröffentlichen statt weiter polieren.**

---

## 8. Ausstieg und Abbruchkriterien

**Fallback: AGPL-3.0-or-later.** Auslösen, wenn eines davon eintritt:

| Kriterium | Datum | Schwelle |
|---|---|---|
| Segment real? (zwanzig Gespräche) | 2026-08-24 | ≥6 von 20 schriftliche Zusagen |
| Verbreitung | 2026-10-31 | ≥400 Downloads, ≥150 Stars |
| Ist es ein Geschäft? | 2027-02-01 | ≥10 kommerzielle Lizenzen, davon ≥2 ohne Launch-Posting gefunden |
| Jahr-2-Investition | 2027-08-01 | ≥25 Lizenzen oder ≥€6.000 brutto |
| **Support-Last** | rollierend, 4 Wochen am Stück | Support + Compliance ≤6 h/Woche bei <€200/Monat. **Genau das hat MarkText bei 59.549 Stars getötet.** |
| Nicht-Engineering-Zeit | 2026-12-01 | ≤120 Stunden kumuliert |
| **Plattform** | rollierend | Typst liefert „cursor in preview" / „GUI inspector"; **oder** Tylina/TypeTeX erreicht ~1.000 Stars oder eine Erwähnung im Typst-Blog → binnen 30 Tagen „WYSIWYG" aus allen Texten streichen und vollständig auf die Ausgabekette umpositionieren |
| Name | rollierend | Marke abgelehnt oder Weiterverbreiter gewinnt Zugkraft → durchsetzen oder umbenennen, sofort |

**Die Umlizenzierung auf AGPL ist jederzeit erlaubt:** wir halten 100 % des Copyrights, haben keine
Code-Beiträge angenommen, und PolyForm hat kein Versprechen abgegeben, das gebrochen würde. Sie
kostet einen Commit und kauft SignPath-Signierung, die awesome-typst-*Editors*-Norm und die
Möglichkeit einer Nachfolge zurück. Als **bewusstes Geschenk zu einem Versionsmeilenstein**
ankündigen, nicht als Aufgabe.

> **Die Asymmetrie, die alles trägt: Die Option, später *weiter* zu öffnen, ist kostenlos und läuft
> nie ab. Die Option, Geld zu verlangen, erlischt in dem Moment, in dem ein permissiver Commit
> veröffentlicht ist.** Redis hat den Rückweg im Mai 2025 nach vierzehn Monaten versucht — die
> Contributor kamen nicht zurück.

---

## 9. Was sich im Code ändert

Umbau von „Testphase + Sperre" zu „kostenlos privat, Lizenz kommerziell". **Nichts wird je gesperrt.**

### Entfällt

| Was | Wo |
|---|---|
| 14-Tage-Timer | `licenseManager` (`TRIAL_DAYS`, `getTrialEndMs`), `persistenceManager.ensureTrialStarted`, Store-Key `trialStartedAt` |
| Die Sperrwand | `LicenseGate.svelte` (183 Z.) — **gelöscht** |
| **Die MCP-Startsperre** | `mcp/server.ts` — `validateAccess()` + `process.exit(1)`. Der Server startet jetzt bedingungslos. |
| Trial-Credential | `PENWRIGHT_TRIAL_UNTIL` in `mcpSetup.buildMcpEnv`, `mcpRegistration.envAccess`, `server.parseArgs` (`--trial-until`) |
| Trial-Banner + Trial-Status | `App.svelte`, i18n `app.trialLeft` / `app.trialStatus`, `mcpConnection.trialActive` |

> **Warum die MCP-Schicht ungesperrt gehört:** Sie treibt keine Käufe (niemand kauft eine
> €59-Desktop-App, um einen MCP-Server zu bekommen), sie ist unser bestes Demo-Objekt, und sie ist
> die supportintensivste Oberfläche im Produkt. **Eine Stunde E-Mail-Debugging frisst die Marge von
> zehn Lizenzen.** Ein Gate ausgerechnet dort, finanziert durch eine Einmalzahlung, war das Modell
> falsch herum.

### Bleibt, neu beschriftet

| Was | Neue Rolle |
|---|---|
| `licenseManager.ts` (209 Z.) | Polar-SDK, Aktivierung, Deaktivierung, Offline-Kulanz — fast unverändert |
| `LicenseDialog.svelte` (353 Z.) | Nur Text: „Testphase abgelaufen" → „Kommerzielle Lizenz" |
| `getEntitlement()` | Bleibt die einzige Wahrheitsquelle, liefert jetzt `access: 'personal' \| 'commercial'` + `usage` + `licenseDue`. **Nichts hängt mehr sperrend davon ab.** |

### Neu

| Was | Zweck |
|---|---|
| `UsageDialog.svelte` | Einmalige Frage beim ersten Start: privat oder beruflich |
| `usageContext` (electron-store) | `'personal' \| 'commercial' \| null` |
| `license:setUsage` (IPC) | Antwort speichern; im Lizenz-Dialog änderbar |
| Hinweisleiste | Nur bei `usage === 'commercial'` **und** ohne Lizenz. Wegklickbar. Nie blockierend. |

`MCP_SETUP_VERSION` wird gebumpt — das MCP-Binary ändert sich (keine Startsperre mehr), also muss
der Setup-Wizard erneut laufen.

---

## 10. Offene Punkte

- [ ] **Preis final entscheiden** — Polar-Produkt steht auf €59, Empfehlung €290 (§4)
- [ ] `penwright.online` registrieren + DPMA/EUIPO-Recherche
- [x] ~~Lizenz aufsetzen~~ — **erledigt.** Bewusst **ohne Anwalt** (Renés Entscheidung). Das
      Risiko wurde stattdessen durch die Bauform gesenkt: unverändertes Standardformular statt
      Eigenbau, plus deutsche Haftungs-/Rechtswahlklauseln (§§ 521/523 BGB, § 309 Nr. 7 BGB).
- [ ] ⚠️ **Kommerzielle Lizenz — HIER verdient ein Anwalt sein Geld, und erst hier.**
      Eigenes Dokument, von `LICENSE.md` NICHT abgedeckt: Grant, Platzdefinition,
      Update-/Supportzeitraum (CRA Art. 13(8), mind. 5 Jahre), Gewährleistung + Haftung,
      §356(5)-BGB-Widerrufsverzicht, Rechtswahl, AGB-Kontrolle §§ 305–310 BGB.
      **Aufschiebbar bis Tor G0 (24.08.):** sagen weniger als 6 von 20 zu, wird das Dokument
      nie gebraucht. Die kostenlose Veröffentlichung hängt nicht daran.
- [ ] `package.json`: `"license": "MIT"` → `"SEE LICENSE IN LICENSE.md"` (**vor dem ersten
      öffentlichen Push** — die Zeile, die alles besiegelt)
- [ ] Certum anfragen: Besteht PolyForm-NC die Open-Source-Prüfung fürs Code-Signing?
- [x] ~~`CONTRIBUTING.md` schreiben (keine Code-PRs)~~ — liegt vor
- [ ] CycloneDX-SBOM + mitgelieferte Lizenztexte prüfen — **`cetz` ist LGPL-3.0** (2 Versionen),
      Volltext muss mit ausgeliefert werden; OFL-Invariante „Schriften unverändert" dokumentieren
- [ ] Drei Bildschirmaufnahmen (§6)
- [ ] Zwanzig Gespräche → Tor am 2026-08-24
- [ ] Impressum (§5 DDG: voller Name, ladungsfähige Anschrift, E-Mail — Postfach genügt nicht;
      W-IdNr.-Pflicht ab Dezember 2026) und Datenschutzerklärung
- [ ] Crash-Reporter-Design als Stärke dokumentieren (lokale Dateien, Benutzername entfernt,
      Übertragung nur auf ausdrückliche Nutzeraktion) — und **nicht still ändern**
