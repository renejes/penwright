/**
 * License Manager — Polar SDK integration for license validation.
 *
 * Handles: activation, validation, offline grace period, tier detection.
 * Uses @polar-sh/sdk Customer Portal endpoints (no auth token needed).
 */

import { Polar } from '@polar-sh/sdk';
import * as os from 'os';
import {
  getLicenseData,
  saveLicenseData,
  clearLicenseData,
  ensureTrialStarted,
  getLocale,
  type LicenseData,
} from './persistenceManager';
import { resolveDict } from '../shared/i18n';

const POLAR_ORG_ID = 'a5a6573b-aacf-4501-a6c1-ebc15ef67b04';
/** Days a valid license keeps working offline before re-validation is forced. */
const OFFLINE_GRACE_DAYS = 7;
/** Length of the local, no-key trial granted on first launch. */
const TRIAL_DAYS = 14;
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

/**
 * Single-tier check: is there any active, valid license key on this device?
 * A `true` result unlocks everything, including the MCP server.
 */
export function isLicensed(): boolean {
  const data = getLicenseData();
  return data.licenseStatus === 'active' && data.licenseKey !== null;
}

/**
 * Back-compat alias. There are no tiers anymore — "Pro" == "licensed".
 */
export function isProUser(): boolean {
  return isLicensed();
}

// ─── Entitlement (local, synchronous gate) ──────────

export type Access = 'licensed' | 'trial' | 'expired';

export interface Entitlement {
  access: Access;
  /** Whole days left in the local trial, only present when access === 'trial'. */
  trialDaysLeft?: number;
  tier: LicenseTier;
  key: string | null;
}

/**
 * The single source of truth for feature-gating. Resolves synchronously from
 * locally stored data so the UI can gate immediately on boot; `validateLicense`
 * runs async in the background and updates the stored status on revoke/expiry,
 * after which this falls back to the trial/expired path.
 *
 * Offline grace never extends the trial: a locally-licensed device stays
 * `licensed` for up to OFFLINE_GRACE_DAYS without a network check, otherwise
 * we fall through to the trial clock (and `expired` once it runs out).
 */
export function getEntitlement(): Entitlement {
  const d = getLicenseData();
  const licensedLocally =
    d.licenseStatus === 'active' &&
    !!d.licenseKey &&
    (Date.now() - (d.lastValidation || 0)) / 86400000 < OFFLINE_GRACE_DAYS;
  if (licensedLocally) {
    return { access: 'licensed', tier: d.licenseTier, key: d.licenseKey };
  }

  const started = ensureTrialStarted();
  const daysUsed = (Date.now() - started) / 86400000;
  if (daysUsed < TRIAL_DAYS) {
    return {
      access: 'trial',
      trialDaysLeft: Math.max(0, Math.ceil(TRIAL_DAYS - daysUsed)),
      tier: null,
      key: null,
    };
  }

  return { access: 'expired', tier: null, key: null };
}
