/**
 * License validation and decoding
 * Verifies JWT signature and handles grace period logic
 */

import * as jose from "jose";
import { db } from "@/lib/db";
import { systemSettings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { License, LicensePayload } from "./types";
import { validateEnv } from "@/lib/env";

const GRACE_PERIOD_DAYS = 14;

/**
 * Decodes and validates a license JWT
 * Checks signature using RS256 public key
 * Handles grace period: if expired < 14 days, returns valid with gracePeriod=true
 */
export async function decodeLicense(jwt: string): Promise<License> {
  const env = validateEnv();
  const publicKeyStr = env.LICENSE_PUBLIC_KEY;

  if (!publicKeyStr) {
    throw new Error("LICENSE_PUBLIC_KEY not configured");
  }

  // Convert PEM string to KeyLike
  // Handle both raw PEM and base64-encoded variants
  let pem = publicKeyStr;
  if (!pem.includes("-----BEGIN")) {
    // Assume base64-encoded
    pem = Buffer.from(pem, "base64").toString("utf-8");
  }

  const publicKey = await jose.importSPKI(pem, "RS256");

  let decoded: LicensePayload;

  try {
    const verification = await jose.jwtVerify(jwt, publicKey);
    decoded = verification.payload as unknown as LicensePayload;
  } catch (err) {
    const error = err as Error;
    throw new Error(`Invalid license signature: ${error.message}`);
  }

  const now = Math.floor(Date.now() / 1000);
  const expired = now > decoded.expiresAt;
  const daysExpired = Math.floor((now - decoded.expiresAt) / 86400);
  const gracePeriod = expired && daysExpired < GRACE_PERIOD_DAYS;
  const valid = !expired || gracePeriod;

  return {
    payload: decoded,
    raw: jwt,
    expired,
    gracePeriod,
    valid,
  };
}

/**
 * Loads license from database (system_settings key 'license')
 * Returns null if no license is stored
 */
export async function getLicenseFromDB(): Promise<License | null> {
  try {
    const result = await db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.key, "license"))
      .limit(1);

    if (!result.length) {
      return null;
    }

    const record = result[0];
    const jwt = typeof record.value === "string" ? record.value : JSON.stringify(record.value);

    return await decodeLicense(jwt);
  } catch (err) {
    console.error("Failed to load license from DB:", err);
    return null;
  }
}

/**
 * Saves a license JWT to database
 * Validates signature before saving
 */
export async function saveLicenseToDB(jwt: string): Promise<License> {
  // Validate before saving
  const license = await decodeLicense(jwt);

  // Check if license key exists
  const existing = await db
    .select()
    .from(systemSettings)
    .where(eq(systemSettings.key, "license"))
    .limit(1);

  if (existing.length > 0) {
    // Update
    await db
      .update(systemSettings)
      .set({ value: jwt })
      .where(eq(systemSettings.key, "license"));
  } else {
    // Insert
    await db.insert(systemSettings).values({
      key: "license",
      value: jwt,
    });
  }

  return license;
}

/**
 * Revokes the current license by deleting it from database
 */
export async function revokeLicense(): Promise<void> {
  await db.delete(systemSettings).where(eq(systemSettings.key, "license"));
}
