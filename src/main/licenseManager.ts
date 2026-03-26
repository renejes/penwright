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
  type LicenseData,
} from './persistenceManager';

const POLAR_ORG_ID = 'a5a6573b-aacf-4501-a6c1-ebc15ef67b04';
const OFFLINE_GRACE_DAYS = 30;

const polar = new Polar();

export type LicenseTier = 'basic' | 'pro' | null;
export type LicenseStatus = 'active' | 'expired' | 'trial' | 'none';

export interface LicenseInfo {
  status: LicenseStatus;
  tier: LicenseTier;
  key: string | null;
  message?: string;
}

/**
 * Detect tier from license key prefix.
 * VSWRITE_PRO = subscription (pro), VSWRITE_LIC = one-time (basic).
 */
function detectTier(key: string): LicenseTier {
  if (key.startsWith('VSWRITE_PRO')) return 'pro';
  if (key.startsWith('VSWRITE_LIC')) return 'basic';
  // Fallback: treat unknown prefixes as basic
  return 'basic';
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
      message: 'Your license has been revoked or has expired.',
    };
  } catch {
    // Network error — check offline grace period
    const daysSince = (Date.now() - (data.lastValidation || 0)) / (1000 * 60 * 60 * 24);

    if (daysSince < OFFLINE_GRACE_DAYS) {
      return {
        status: 'active',
        tier: data.licenseTier,
        key: data.licenseKey,
        message: `Offline mode (${Math.ceil(OFFLINE_GRACE_DAYS - daysSince)} days remaining)`,
      };
    }

    return {
      status: 'expired',
      tier: null,
      key: null,
      message: 'Offline grace period expired. Please connect to the internet to re-validate.',
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
 * Check if the current license is Pro tier (subscription).
 */
export function isProUser(): boolean {
  const data = getLicenseData();
  return data.licenseStatus === 'active' && data.licenseTier === 'pro';
}

/**
 * Check if there is any active license (basic or pro).
 */
export function isLicensed(): boolean {
  const data = getLicenseData();
  return data.licenseStatus === 'active' && data.licenseKey !== null;
}
