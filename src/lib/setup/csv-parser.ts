// src/lib/setup/csv-parser.ts

export interface CsvUser {
  nom: string;
  email: string;
  role: string;
  mot_de_passe: string;
  equipe: string;
}

export interface ParsedUser {
  name: string;
  email: string;
  role: "super_admin" | "admin" | "editor" | "viewer";
  password: string;
  team: string;
}

export interface CsvParseResult {
  users: ParsedUser[];
  errors: string[];
}

const VALID_ROLES = ["super_admin", "admin", "editor", "viewer"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function generatePassword(length = 12): string {
  const chars = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$";
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => chars[b % chars.length]).join("");
}

export function parseCsvUsers(csvText: string): CsvParseResult {
  const lines = csvText.trim().split("\n");
  if (lines.length < 2) {
    return { users: [], errors: ["Le fichier CSV est vide ou ne contient que l'en-tête"] };
  }

  const header = lines[0].toLowerCase().split(",").map((h) => h.trim());
  const nomIdx = header.indexOf("nom");
  const emailIdx = header.indexOf("email");
  const roleIdx = header.indexOf("role");
  const pwdIdx = header.indexOf("mot_de_passe");
  const teamIdx = header.indexOf("equipe");

  if (nomIdx === -1 || emailIdx === -1) {
    return { users: [], errors: ["Colonnes obligatoires manquantes : nom, email"] };
  }

  const users: ParsedUser[] = [];
  const errors: string[] = [];
  const seenEmails = new Set<string>();

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const cols = line.split(",").map((c) => c.trim());
    const nom = cols[nomIdx] || "";
    const email = (cols[emailIdx] || "").toLowerCase();
    const role = (roleIdx >= 0 ? cols[roleIdx] : "") || "editor";
    const pwd = pwdIdx >= 0 ? cols[pwdIdx] || "" : "";
    const team = teamIdx >= 0 ? cols[teamIdx] || "" : "";

    if (!nom) {
      errors.push(`Ligne ${i + 1} : nom manquant`);
      continue;
    }
    if (!email || !EMAIL_RE.test(email)) {
      errors.push(`Ligne ${i + 1} : email invalide (${email || "vide"})`);
      continue;
    }
    if (seenEmails.has(email)) {
      errors.push(`Ligne ${i + 1} : email en doublon (${email})`);
      continue;
    }
    if (!VALID_ROLES.includes(role)) {
      errors.push(`Ligne ${i + 1} : rôle invalide « ${role} » (attendu : ${VALID_ROLES.join(", ")})`);
      continue;
    }

    seenEmails.add(email);
    users.push({
      name: nom,
      email,
      role: role as ParsedUser["role"],
      password: pwd || generatePassword(),
      team,
    });
  }

  return { users, errors };
}
