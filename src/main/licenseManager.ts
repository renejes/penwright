/**
 * License Manager — Polar SDK integration for commercial licence validation.
 *
 * Handles: activation, validation, offline grace period, tier detection.
 * Uses @polar-sh/sdk Customer Portal endpoints (no auth token needed).
 *
 * ─── The model ───────────────────────────────────────────────────────────
 * Penwright is FREE and complete for personal, academic and hobby use —
 * every feature, including all 66 MCP tools. A commercial licence is required
 * for commercial use.
 *
 * There is NO trial, NO expiry and NO feature gate. Nothing in this module
 * ever locks anything: the distinction is WHO is using the app, not WHAT they
 * may use, and the app cannot detect that — so it asks once (see
 * `persistenceManager.getUsageContext`) and shows a dismissible notice when a
 * self-declared commercial user has no licence.
 *
 * See documentation/release-strategy.md for why.
 */

import { Polar } from '@polar-sh/sdk';
import * as os from 'os';
import {
  getLicenseData,
  saveLicenseData,
  clearLicenseData,
  getUsageContext,
  getLocale,
  type LicenseData,
  type UsageContext,
} from './persistenceManager';
import { resolveDict } from '../shared/i18n';

const POLAR_ORG_ID = 'a5a6573b-aacf-4501-a6c1-ebc15ef67b04';
/** Days a valid license keeps working offline before re-validation is forced. */
const OFFLINE_GRACE_DAYS = 7;
/** Penwright license keys all start with this prefix (single tier, set in Polar). */
const LICENSE_KEY_PREFIX = 'pw_LIC';

const polar = new Polar();

// Single-tier model: any valid `pw_LIC…` key unlocks everything (incl. MCP).
// The `'pro'` value is kept only so the existing "active license" plumbing
// (persistence/UI badge) keeps working without a wider refactor.
export type LicenseTier = 'basic' | 'pro' | null;
export type LicenseStatus = 'active' | 'expired' | 'trial' | 'none';

export interface LicenseInfo {
  status: LicenseStatus;
  tier: LicenseTier;
  key: string | null;
  message?: string;
}

/**
 * Detect tier from license key prefix. Single-tier: a valid `pw_LIC…` key is
 * a full license; anything else is unknown and treated as no tier.
 */
function detectTier(key: string): LicenseTier {
  return key.startsWith(LICENSE_KEY_PREFIX) ? 'pro' : null;
}

/**
 * Generate a human-readable device label for activation.
 */
function deviceLabel(): string {
  return `${os.userInfo().username}@${os.hostname()}`;
}

/**
 * Activate a new license key against Polar.
 * Returns LicenseInfo on success, throws on failure.
 */
export async function activateLicense(key: string): Promise<LicenseInfo> {
  const activation = await polar.customerPortal.licenseKeys.activate({
    key,
    organizationId: POLAR_ORG_ID,
    label: deviceLabel(),
  });

  const tier = detectTier(key);
  const data: LicenseData = {
    licenseKey: key,
    activationId: activation.id,
    licenseTier: tier,
    licenseStatus: 'active',
    lastValidation: Date.now(),
  };
  saveLicenseData(data);

  return { status: 'active', tier, key };
}

/**
 * Validate the stored license key against Polar.
 * Handles offline grace period.
 */
export async function validateLicense(): Promise<LicenseInfo> {
  const data = getLicenseData();

  if (!data.licenseKey || !data.activationId) {
    return { status: 'none', tier: null, key: null };
  }

  try {
    const validation = await polar.customerPortal.licenseKeys.validate({
      key: data.licenseKey,
      organizationId: POLAR_ORG_ID,
      activationId: data.activationId,
    });

    if (validation.status === 'granted') {
      saveLicenseData({ ...data, licenseStatus: 'active', lastValidation: Date.now() });
      return { status: 'active', tier: data.licenseTier, key: data.licenseKey };
    }

    // Key revoked or disabled
    clearLicenseData();
    return {
      status: 'expired',
      tier: null,
      key: null,
      message: resolveDict(getLocale()).mainDialogs.licenseRevoked,
    };
  } catch {
    // Network error — check offline grace period
    const daysSince = (Date.now() - (data.lastValidation || 0)) / (1000 * 60 * 60 * 24);

    if (daysSince < OFFLINE_GRACE_DAYS) {
      return {
        status: 'active',
        tier: data.licenseTier,
        key: data.licenseKey,
        message: resolveDict(getLocale()).mainDialogs.licenseOfflineMode(Math.ceil(OFFLINE_GRACE_DAYS - daysSince)),
      };
    }

    return {
      status: 'expired',
      tier: null,
      key: null,
      message: resolveDict(getLocale()).mainDialogs.licenseOfflineExpired,
    };
  }
}

/**
 * Deactivate the current license (remove from this device).
 */
export async function deactivateLicense(): Promise<void> {
  const data = getLicenseData();
  if (data.licenseKey && data.activationId) {
    try {
      await polar.customerPortal.licenseKeys.deactivate({
        key: data.licenseKey,
        organizationId: POLAR_ORG_ID,
        activationId: data.activationId,
      });
    } catch {
      // Ignore — we clear locally regardless
    }
  }
  clearLicenseData();
}

// ─── Entitlement (local, synchronous) ───────────────
// Describes the licence situation. It does NOT gate anything — no caller may
// use it to lock a feature, block the UI or refuse to start the MCP server.
// Its only jobs are the status-bar label and the dismissible notice.

/** Whether a paid commercial licence is active on this device. */
export type Access = 'personal' | 'commercial';

export interface Entitlement {
  /** 'commercial' iff a valid licence is active locally; 'personal' otherwise. */
  access: Access;
  /** What the user declared at first launch; `null` until they answer. */
  usage: UsageContext;
  /**
   * True when the user said they use Penwright commercially but no licence is
   * active. Drives the dismissible notice — and nothing else.
   */
  licenseDue: boolean;
  tier: LicenseTier;
  key: string | null;
}

/**
 * The single source of truth for the licence state. Resolves synchronously
 * from locally stored data so the UI can label itself immediately on boot;
 * `validateLicense` runs async in the background and updates the stored status
 * on revoke, after which this falls back to `personal`.
 *
 * A locally-licensed device stays `commercial` for up to OFFLINE_GRACE_DAYS
 * without a network check. Falling back to `personal` costs the user nothing —
 * the app keeps working in full either way.
 */
export function getEntitlement(): Entitlement {
  const d = getLicenseData();
  const usage = getUsageContext();
  const licensedLocally =
    d.licenseStatus === 'active' &&
    !!d.licenseKey &&
    (Date.now() - (d.lastValidation || 0)) / 86400000 < OFFLINE_GRACE_DAYS;

  if (licensedLocally) {
    return {
      access: 'commercial',
      usage,
      licenseDue: false,
      tier: d.licenseTier,
      key: d.licenseKey,
    };
  }

  return {
    access: 'personal',
    usage,
    licenseDue: usage === 'commercial',
    tier: null,
    key: null,
  };
}
