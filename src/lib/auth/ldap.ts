import ldap from "ldapjs";
import { db } from "@/lib/db";
import { systemSettings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import logger from "@/lib/logger";
import { decrypt } from "@/lib/crypto";

/**
 * Escape special characters in an LDAP filter value per RFC 4515.
 * Characters: \ * ( ) NUL → backslash + 2-digit hex code.
 */
function escapeLdapFilter(value: string): string {
  return value.replace(/[\\*()\x00]/g, (c) =>
    "\\" + c.charCodeAt(0).toString(16).padStart(2, "0")
  );
}

export interface LdapConfig {
  ldapEnabled: boolean;
  ldapUrl: string;
  ldapBindDn: string;
  ldapBindPassword: string;
  ldapBaseDn: string;
  ldapSearchFilter: string;
  ldapNameAttribute: string;
  ldapEmailAttribute: string;
  ldapRejectUnauthorized: boolean;
}

export interface LdapUser {
  dn: string;
  email: string;
  name: string;
}

const defaultLdapConfig: LdapConfig = {
  ldapEnabled: false,
  ldapUrl: "",
  ldapBindDn: "",
  ldapBindPassword: "",
  ldapBaseDn: "",
  ldapSearchFilter: "(mail={{email}})",
  ldapNameAttribute: "cn",
  ldapEmailAttribute: "mail",
  ldapRejectUnauthorized: true,
};

/**
 * Load LDAP configuration from system settings.
 */
export async function getLdapConfig(): Promise<LdapConfig> {
  const row = await db
    .select()
    .from(systemSettings)
    .where(eq(systemSettings.key, "ldap"))
    .limit(1);

  if (row.length === 0) return defaultLdapConfig;
  const config = { ...defaultLdapConfig, ...(row[0].value as Partial<LdapConfig>) };

  // Déchiffrer le mot de passe LDAP si chiffré (format iv:tag:cipher)
  if (config.ldapBindPassword && /^[0-9a-f]{32}:[0-9a-f]{32}:/.test(config.ldapBindPassword)) {
    try {
      config.ldapBindPassword = decrypt(config.ldapBindPassword);
    } catch {
      logger.error("Impossible de déchiffrer ldapBindPassword");
    }
  }

  return config;
}

/**
 * Create an LDAP client. Caller is responsible for calling client.destroy().
 */
function createClient(config: LdapConfig): ldap.Client {
  return ldap.createClient({
    url: config.ldapUrl,
    tlsOptions: {
      rejectUnauthorized: config.ldapRejectUnauthorized,
    },
    connectTimeout: 10000,
    timeout: 10000,
  });
}

/**
 * Promisified LDAP bind.
 */
function bindAsync(client: ldap.Client, dn: string, password: string): Promise<void> {
  return new Promise((resolve, reject) => {
    client.bind(dn, password, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

/**
 * Promisified LDAP search.
 */
function searchAsync(
  client: ldap.Client,
  baseDn: string,
  options: ldap.SearchOptions
): Promise<ldap.SearchEntry[]> {
  return new Promise((resolve, reject) => {
    client.search(baseDn, options, (err, res) => {
      if (err) return reject(err);

      const entries: ldap.SearchEntry[] = [];

      res.on("searchEntry", (entry) => {
        entries.push(entry);
      });

      res.on("error", (err) => {
        reject(err);
      });

      res.on("end", () => {
        resolve(entries);
      });
    });
  });
}

/**
 * Authenticate a user against LDAP.
 * 1. Bind with service account
 * 2. Search for user by email
 * 3. Bind with user's credentials
 * Returns LdapUser on success, null on failure.
 */
export async function ldapAuthenticate(
  email: string,
  password: string
): Promise<LdapUser | null> {
  const config = await getLdapConfig();

  if (!config.ldapEnabled || !config.ldapUrl) {
    return null;
  }

  const client = createClient(config);

  try {
    // Step 1: Bind with service account
    await bindAsync(client, config.ldapBindDn, config.ldapBindPassword);

    // Step 2: Search for user (email escaped per RFC 4515)
    const filter = config.ldapSearchFilter.replace("{{email}}", escapeLdapFilter(email));
    const entries = await searchAsync(client, config.ldapBaseDn, {
      filter,
      scope: "sub",
      attributes: [config.ldapNameAttribute, config.ldapEmailAttribute, "dn"],
    });

    if (entries.length === 0) {
      return null;
    }

    const entry = entries[0];
    const userDn = entry.objectName?.toString() || entry.dn?.toString() || "";

    // Step 3: Bind with user's credentials
    const userClient = createClient(config);
    try {
      await bindAsync(userClient, userDn, password);
    } catch {
      return null; // Invalid password
    } finally {
      userClient.destroy();
    }

    // Extract attributes
    const getName = (attr: string) => {
      const a = entry.attributes?.find(
        (a) => a.type.toLowerCase() === attr.toLowerCase()
      );
      return a?.values?.[0] || "";
    };

    return {
      dn: userDn,
      name: getName(config.ldapNameAttribute) || email.split("@")[0],
      email: getName(config.ldapEmailAttribute) || email,
    };
  } catch (err) {
    logger.error({ err }, "Erreur d'authentification LDAP");
    return null;
  } finally {
    client.destroy();
  }
}

/**
 * Test LDAP connection by binding with the service account.
 */
export async function testLdapConnection(): Promise<{ success: boolean; error?: string }> {
  const config = await getLdapConfig();

  if (!config.ldapEnabled || !config.ldapUrl) {
    return { success: false, error: "LDAP non configuré" };
  }

  const client = createClient(config);

  try {
    await bindAsync(client, config.ldapBindDn, config.ldapBindPassword);
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    return { success: false, error: message };
  } finally {
    client.destroy();
  }
}
