# Penwright — License

Copyright © 2026 René Jesser. All rights reserved except as expressly granted below.

Penwright is **source-available software, not open source.** It is free for
personal, academic and any other non-commercial use. **Commercial use requires a
paid licence.**

---

## 1. Plain-language summary

**This summary is not the licence.** It is here so you do not have to read the
legal text to answer the common questions. Where the summary and the terms below
disagree, the terms below win.

### Free, forever, with no key and no time limit

If you use Penwright for **personal, academic, hobby or any other
non-commercial purpose**, you may use the complete application — every feature,
including the whole MCP / AI integration — at no cost, for as long as you like.
Nothing is locked, nothing expires, and you never have to register.

This explicitly includes universities, schools, public research bodies,
charities, public health and safety bodies, environmental organisations and
government institutions (see *Noncommercial Organizations* in [§3](#3-licence)).

### A licence is required for commercial use

Using Penwright **in the course of a business** — producing documents for
clients, internal company reports, anything with an anticipated commercial
application — requires a paid commercial licence, whatever the size of the
business. See [§5](#5-commercial-use).

The application does not enforce this. It asks you once how you use it, and
takes your answer. **The honesty of commercial users is the entire mechanism.**

### You may read the source and build it for yourself

The source is public so it can be **inspected, audited and understood**, and
[§4](#4-additional-permission--building-from-source) explicitly permits you to
build it and run the result yourself.

What you may **not** do is give it to anyone else, or reuse its code: the
licence in §3 grants everything **except distributing the software and making
changes or new works based on it.** Those two exceptions are the whole
restriction, and they are why this is not open source.

---

## 2. Scope

These terms cover **Penwright's own source code and the application built from
it** — everything in this repository authored by the copyright holder.

They do **not** cover the third-party components Penwright bundles or depends
on, each of which remains under its own licence and is unaffected by these
terms. These include, among others:

| Component | Licence |
|---|---|
| Typst compiler | Apache-2.0 |
| Electron, TipTap, ProseMirror, Svelte | MIT |
| pdf.js | Apache-2.0 |
| Bundled Typst packages (24) | 40 × MIT, 4 × Unlicense, **2 × LGPL-3.0 (`cetz`)** |
| Bundled font families (7) | SIL Open Font License 1.1 |

The authoritative, generated inventory is [`THIRD_PARTY_LICENSES.md`](THIRD_PARTY_LICENSES.md).

**Two obligations that follow from that list and must be honoured in every build:**

1. **`cetz` is LGPL-3.0.** Its full licence text ships with the application, and
   it ships as readable, replaceable Typst source under
   `resources/typst-packages/`.
2. **The bundled fonts are OFL-1.1 and ship unmodified.** Subsetting a font,
   statically instancing a variable font, or otherwise altering a font file
   while keeping its name would breach the Reserved Font Name clause. Any future
   bundle-size optimisation must not touch the font files.

---

## 3. Licence

The software is licensed under the **PolyForm Strict License 1.0.0**.

That licence is **not reproduced here.** It is shipped alongside this file, in
its own file, **byte-for-byte identical to the text published by the PolyForm
Project**, with nothing added, removed or altered:

> ### 📄 [`LICENSE-PolyForm-Strict-1.0.0.md`](LICENSE-PolyForm-Strict-1.0.0.md)
>
> SHA-256 `9eb48619fbc193ab7bb327b090cfcc703000265b83e670f81f231d0b1c43c56e`
> · 3593 bytes · retrieved from
> <https://github.com/polyformproject/polyform-licenses/blob/1.0.0/PolyForm-Strict-1.0.0.md>
>
> **Do not edit that file.** If it ever needs updating, replace it wholesale
> with the upstream text and update the hash above.

Its core grant, quoted here for orientation only — the file itself governs:

> The licensor grants you a copyright license for the software to do everything
> you might do with the software that would otherwise infringe the licensor's
> copyright in it **for any permitted purpose, other than distributing the
> software or making changes or new works based on the software.**

Permitted purposes are **any noncommercial purpose**, personal use, and use by
charitable, educational, public research, public safety or health,
environmental, and government organisations.

### Why the licence is in a separate file

The PolyForm Project permits anyone to use its licence texts, on one condition:

> *"If you make changes to a PolyForm license, you must remove all mention of
> 'PolyForm' and polyformproject.org, as well."*

Keeping their text in its own untouched file, and putting everything the
licensor says separately in **this** file, makes that condition unambiguously
satisfied: the PolyForm licence is used exactly as published, and nothing in
this document alters it.

[§4](#4-additional-permission--building-from-source) grants an **additional
permission** on top of it. An additional permission is not a change to the
licence — it is the copyright holder of *the software* granting more than the
licence requires, the same pattern as GNU GPL v3 §7 "additional permissions" or
the Classpath Exception. It cannot mislead anyone about what PolyForm Strict
says, because it only ever gives you more than PolyForm Strict gives you, never
less.

---

## 4. Additional permission — building from source

The licensor grants you, **in addition** to §3, permission to compile, build and
package the software from source, and to run the result, **for a permitted
purpose as defined in §3 and for your own use only.**

This permission does not entitle you to distribute the result, or any part of
it, to anyone else, and it does not permit changes or new works beyond those
technically required to build and run the software.

> *Why this is here:* the licence in §3 withholds the right to make "changes or
> new works", which could otherwise be read to cover compiling the published
> source. Since the source is published precisely so that it can be inspected,
> verified and run, that reading would defeat the purpose. This section only
> **adds** a permission, and it leaves
> [`LICENSE-PolyForm-Strict-1.0.0.md`](LICENSE-PolyForm-Strict-1.0.0.md)
> untouched.

---

## 5. Commercial use

Commercial use requires a separate paid licence from the licensor. Terms,
pricing and purchasing: **<https://penwright.online>**.

A commercial licence is granted per seat and includes twelve months of updates;
the last version covered by the licence continues to work offline indefinitely.

The commercial licence is a **separate agreement** and is not contained in this
file. Until such an agreement is in place, commercial use is not licensed.

---

## 6. Trademarks

These terms grant no rights in the name **Penwright**, the Penwright logo, or
any other trademark, trade name or trade dress of the licensor.

---

## 7. No change date, no promise about future versions

These terms contain **no change date and no automatic conversion** to any other
licence. Nothing here promises that the software will be released under
different terms at any future time.

The licensor may offer the software under additional or different terms at any
time, and may release future versions under any licence, including a more
permissive one. That does not change the terms applying to any version already
released under these terms.

---

## 8. Liability and warranty under German law

The licensor is based in Germany and these terms are governed by German law
([§9](#9-governing-law-severability-language)). The *No Liability* paragraph of
the licence in §3 is drafted for a common-law setting; by its own wording it
applies only "as far as the law allows". The following is what the licensor
states under German law, and it applies in any case:

1. **Liability that cannot be excluded is not excluded.** Nothing in these terms
   limits or excludes the licensor's liability for intent (*Vorsatz*), for
   injury to life, body or health, for fraudulently concealed defects, or under
   the German Product Liability Act (*Produkthaftungsgesetz*), to the extent
   such liability is mandatory.

2. **Free use is a gift in the legal sense.** Where the software is provided
   free of charge under §3 and §4, the licensor's liability for defects of
   quality and title, and for damages, is limited to intent and gross negligence
   (*Vorsatz und grobe Fahrlässigkeit*), in line with §§ 521, 523, 524 BGB.

3. **No warranty.** Beyond paragraphs 1 and 2, the software is provided *as is*,
   without any warranty or condition of any kind, express or implied, including
   any implied warranty of merchantability, fitness for a particular purpose, or
   non-infringement.

4. **Back up your work.** Penwright reads and writes your files. You are
   responsible for keeping independent backups of anything you cannot afford to
   lose. Penwright's own version history and automatic backups are a
   convenience, not a backup strategy.

---

## 9. Governing law, severability, language

**Governing law.** These terms are governed by the law of the Federal Republic
of Germany, excluding its conflict-of-laws rules and excluding the United
Nations Convention on Contracts for the International Sale of Goods (CISG).
Where you are a consumer with habitual residence in another state, this choice
of law does not deprive you of the protection of mandatory provisions of the law
of that state.

**Place of jurisdiction.** Where you are a merchant (*Kaufmann*), a legal entity
under public law, or have no general place of jurisdiction in Germany, the
courts at the licensor's registered seat have exclusive jurisdiction. Mandatory
statutory places of jurisdiction remain unaffected.

**Severability.** If any provision of these terms is or becomes wholly or partly
invalid or unenforceable, the validity of the remaining provisions is not
affected. This does not apply to the PolyForm Strict License 1.0.0 text in §3,
which is governed by its own terms.

**Language.** The English text of these terms is authoritative. Any translation
is provided for convenience only.

---

## 10. Contact

**René Jesser** · feedback@penwright.online · <https://penwright.online>

*Required Notice: Copyright René Jesser (https://penwright.online)*
