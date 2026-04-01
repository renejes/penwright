# vswrite Desktop — Pricing, Licensing & Polar Integration

> **Stand:** 2026-03-26
> **Zahlungsanbieter:** Polar (polar.sh) — Merchant of Record
> **Ziel:** Lizenzverkauf über die Homepage, Validierung direkt in der Electron-App

---

## Preismodell

### Tiers

| Tier | Preis | Abrechnungsmodell | Enthält |
|------|-------|-------------------|---------|
| **Lizenz** | **39$** | Einmalig | Voller Editor, Preview (SVG/PDF), Spellcheck, Git, PDF-Viewer, Code-Editor, File Locking, Terminal, alle aktuellen Features |
| **Jahres-Abo** | **29$/Jahr** | Jährlich, automatische Verlängerung | Alles aus Lizenz + MCP Server + alle Updates inkl. Major Versions + Priority Support |
| **Monats-Abo** | **4.99$/Monat** | Monatlich kündbar | Wie Jahres-Abo |
| **Student** | **50% Rabatt** | Auf alle Tiers | .edu E-Mail-Verifizierung |

### Was ist was

**One-Time (39$):**
- Voller Funktionsumfang der aktuellen Version
- Minor Updates kostenlos (z.B. 1.0 → 1.5)
- Kein MCP Server (das ist das Abo-Feature)
- Major Version Upgrades (z.B. 2.0) kosten separat (~19$ Upgrade-Preis)

**Abo (29$/Jahr oder 4.99$/Monat):**
- Alles aus One-Time
- MCP Server Integration (Claude Desktop, Codex Desktop, etc.)
- Alle Updates inklusive Major Versions
- Priority Support
- Key wird automatisch revoked wenn Abo endet

**Student (50% auf alles):**
- Lizenz: 19.50$
- Jahres-Abo: 14.50$/Jahr
- Monats-Abo: 2.49$/Monat
- Verifizierung über .edu E-Mail (oder manuell über Support)

### Upgrade-Pfad

| Von | Nach | Preis |
|-----|------|-------|
| One-Time v1 → v2 | Upgrade | ~19$ (50% des vollen Preises) |
| One-Time → Abo | Wechsel | Voller Abo-Preis, One-Time wird nicht verrechnet |
| Abo → One-Time | Wechsel | 39$ (behält aktuelle Version wenn Abo endet) |

---

## Polar Konfiguration

### Warum Polar statt Lemon Squeezy

| Thema | Lemon Squeezy | Polar |
|-------|--------------|-------|
| Verifizierung | Social Media, Website-URL, Produkt-Videos nötig | GitHub/Google Login, sofort loslegen |
| Gebühren | 5% + 50¢ | 4% + 40¢ (~20% günstiger) |
| MoR (Steuern) | Ja | Ja (EU VAT, UK VAT, US Sales Tax) |
| Desktop-App API | Auth nötig | **Keine Auth für Validation** — sicher aus Electron aufrufbar |
| Device-Limiting | Manuell | Built-in Activation System |

### Produkte in Polar anlegen

Im Polar Dashboard (polar.sh/dashboard) 3 Produkte erstellen:

**Produkt 1: vswrite Desktop License**
- Typ: One-Time Purchase
- Preis: $39
- Benefit: License Key
  - Prefix: `VSWRITE_`
  - Activation Limit: 3 Geräte
  - Expiration: Keine (permanent)

**Produkt 2: vswrite Desktop Pro (Yearly)**
- Typ: Subscription (Yearly)
- Preis: $29/Jahr
- Benefit: License Key
  - Prefix: `VSWRITE_`
  - Activation Limit: 3 Geräte
  - Auto-Revoke bei Kündigung: Ja

**Produkt 3: vswrite Desktop Pro (Monthly)**
- Typ: Subscription (Monthly)
- Preis: $4.99/Monat
- Benefit: License Key
  - Prefix: `VSWRITE_`
  - Activation Limit: 3 Geräte
  - Auto-Revoke bei Kündigung: Ja

### Student-Discount

Zwei Optionen:
1. **Discount-Code** in Polar (50% off, validiert über .edu E-Mail manuell)
2. **Separate Produkte** mit halbierten Preisen (einfacher, aber mehr Produkte im Dashboard)

Empfehlung: Discount-Code für den Anfang, separate Produkte wenn Studentenanteil hoch genug ist.

---

## Homepage Integration

### Checkout-Flow

```
Homepage (SvelteKit)
  ├── /pricing                    Pricing-Seite mit 3 Tiers
  │     ├── "Buy License" Button  → Polar Checkout (One-Time)
  │     ├── "Subscribe" Button    → Polar Checkout (Yearly/Monthly)
  │     └── "Student" Toggle      → Discount-Code Eingabe
  │
  ├── /checkout/success           Polar Redirect nach Zahlung
  │     └── Zeigt License Key     (Polar liefert den Key automatisch)
  │
  └── /account                    Polar Customer Portal (optional)
        └── Key einsehen, Abo verwalten, Geräte sehen
```

### Polar SvelteKit Adapter

```bash
npm install @polar-sh/sveltekit
```

```typescript
// src/routes/api/checkout/+server.ts
import { Checkout } from '@polar-sh/sveltekit';

export const GET = Checkout({
  accessToken: process.env.POLAR_ACCESS_TOKEN,
  successUrl: '/checkout/success',
  server: 'production', // oder 'sandbox' für Testing
});
```

### Checkout-Link Alternative (einfacher)

Statt des SvelteKit-Adapters kann man auch direkt Polar Checkout-Links verwenden:

```html
<a href="https://polar.sh/checkout/PRODUCT_ID">Buy vswrite Desktop — $39</a>
```

Polar hosted die Checkout-Seite, kein eigener Server nötig. Für V1 die schnellste Option.

---

## Electron-App: Lizenz-Validierung

### Ablauf in der App

```
App startet
  │
  ├── electron-store: Hat gespeicherten Key + Activation ID?
  │     ├── Ja → Validate gegen Polar API
  │     │     ├── Status "granted" → App starten
  │     │     ├── Status "revoked/disabled" → Lizenz-Dialog zeigen
  │     │     └── Netzwerkfehler → Offline Grace Period (30 Tage)
  │     │
  │     └── Nein → Lizenz-Dialog zeigen
  │           ├── User gibt Key ein → Activate gegen Polar API
  │           │     ├── Erfolg → Key + Activation ID speichern, App starten
  │           │     └── Fehler (limit reached, invalid) → Fehlermeldung
  │           └── "Later" / Trial → App mit eingeschränktem Modus starten
  │
  └── Feature-Check bei MCP-Nutzung
        ├── Abo-Key → MCP Server verfügbar
        └── One-Time-Key → MCP Server gesperrt, Upgrade-Hinweis
```

### Polar API Calls (keine Auth nötig!)

**Erstmalige Aktivierung (bei Key-Eingabe):**

```typescript
import { Polar } from '@polar-sh/sdk';

const polar = new Polar(); // Keine Auth nötig für Customer Portal Endpoints

const activation = await polar.customerPortal.licenseKeys.activate({
  key: 'VSWRITE_xxxx-xxxx-xxxx-xxxx',
  organizationId: 'DEINE_ORG_ID',      // Aus Polar Dashboard
  label: `${os.userInfo().username}@${os.hostname()}`,  // Gerätename
});

// Speichern in electron-store:
store.set('licenseKey', key);
store.set('activationId', activation.id);
store.set('licenseStatus', 'active');
store.set('lastValidation', Date.now());
```

**Validierung bei jedem App-Start:**

```typescript
const validation = await polar.customerPortal.licenseKeys.validate({
  key: store.get('licenseKey'),
  organizationId: 'DEINE_ORG_ID',
  activationId: store.get('activationId'),
});

if (validation.status === 'granted') {
  // Alles gut — App normal starten
  store.set('lastValidation', Date.now());
} else {
  // Key revoked oder disabled — Lizenz-Dialog zeigen
  store.delete('licenseKey');
  store.delete('activationId');
}
```

**Fehlerbehandlung (Offline):**

```typescript
try {
  const validation = await polar.customerPortal.licenseKeys.validate({...});
  // ... wie oben
} catch (err) {
  // Netzwerkfehler — Offline Grace Period
  const lastValidation = store.get('lastValidation');
  const daysSinceValidation = (Date.now() - lastValidation) / (1000 * 60 * 60 * 24);

  if (daysSinceValidation < 30) {
    // Noch innerhalb der Grace Period — App starten
  } else {
    // Grace Period abgelaufen — Lizenz-Dialog zeigen
  }
}
```

### Feature-Gating

```typescript
function isProUser(): boolean {
  const key = store.get('licenseKey');
  const status = store.get('licenseStatus');
  // Pro = Abo-Key (hat "subscription" benefit in Polar)
  // Basic = One-Time-Key
  return status === 'active' && store.get('licenseTier') === 'pro';
}

// MCP Server nur für Pro-User
if (isProUser()) {
  setupMcpServer();
}
```

### Implementierung in vswrite (geplant)

Neue Dateien:
- `src/main/licenseManager.ts` — Polar SDK Wrapper, Activation, Validation, Grace Period
- `src/renderer/components/LicenseDialog.svelte` — Key-Eingabe UI, Fehlermeldungen, Upgrade-Button

Änderungen:
- `persistenceManager.ts` — License Key + Activation ID + Tier in electron-store
- `index.ts` — License-Check beim App-Start
- `preload-entry.ts` — IPC Channels für License-Dialog

### electron-store Schema-Erweiterung

```typescript
// In persistenceManager.ts hinzufügen:
interface StoreSchema {
  // ... bestehende Felder ...
  licenseKey: string | null;
  activationId: string | null;
  licenseTier: 'basic' | 'pro' | null;  // basic = One-Time, pro = Abo
  licenseStatus: 'active' | 'expired' | null;
  lastValidation: number;  // Timestamp für Offline Grace Period
}
```

---

## Sandbox-Testing

Polar bietet eine Sandbox-Umgebung zum Testen:

- **Sandbox API:** `https://sandbox-api.polar.sh`
- **Sandbox Dashboard:** `https://sandbox.polar.sh`
- **Test-Checkout:** Funktioniert mit Stripe Test-Kreditkarten (4242 4242 4242 4242)

### Test-Ablauf

1. In Polar Sandbox einloggen und Produkte anlegen
2. Checkout-Link generieren und Test-Kauf durchführen
3. License Key erhalten
4. In vswrite eingeben und Activation testen
5. Subscription kündigen und Revocation testen
6. Offline gehen und Grace Period testen

---

## Kosten-Kalkulation

### Polar Gebühren pro Transaktion

| Szenario | Brutto | Polar Gebühr | Netto |
|----------|--------|-------------|-------|
| One-Time $39 (US) | $39.00 | $1.96 (4% + $0.40) | $37.04 |
| One-Time $39 (EU, 20% VAT) | $46.80 | $2.27 | $36.73 |
| Jahres-Abo $29 (US) | $29.00 | $1.71 (4% + $0.40 + 0.5% sub) | $27.29 |
| Monats-Abo $4.99 (US) | $4.99 | $0.62 | $4.37 |
| Student One-Time $19.50 | $19.50 | $1.18 | $18.32 |

### Breakeven-Rechnung

| Szenario | Kunden/Monat | Monatsumsatz (netto) |
|----------|-------------|---------------------|
| 10 One-Time | 10 | ~$370 |
| 20 Jahres-Abos | 20 | ~$545 (annualisiert) |
| 50 Monats-Abos | laufend | ~$218 |
| Mix (realistisch) | 5 OT + 10 Abo | ~$400-500 |

---

## Zusammenfassung: Was in welcher Reihenfolge

### Schritt 1: Polar Setup (jetzt)
- [x] Polar Account erstellen
- [ ] Organization anlegen
- [ ] 3 Produkte erstellen (One-Time, Yearly, Monthly)
- [ ] License Key Benefit konfigurieren (VSWRITE_ Prefix, 3 Aktivierungen)
- [ ] Sandbox-Produkte für Testing anlegen

### Schritt 2: Homepage (als nächstes)
- [ ] Landing Page mit Pricing-Section
- [ ] Polar Checkout-Links einbinden
- [ ] Success-Page mit Key-Anzeige
- [ ] Optional: Customer Portal für Account-Management

### Schritt 3: Electron-App Integration (danach)
- [ ] `@polar-sh/sdk` installieren
- [ ] `licenseManager.ts` erstellen (Activate, Validate, Grace Period)
- [ ] `LicenseDialog.svelte` erstellen (Key-Eingabe, Fehler, Upgrade)
- [ ] `persistenceManager.ts` erweitern (License-Felder)
- [ ] Feature-Gating: MCP Server nur für Pro-User
- [ ] Sandbox-Testing: Kauf → Activation → Validation → Revocation → Offline
