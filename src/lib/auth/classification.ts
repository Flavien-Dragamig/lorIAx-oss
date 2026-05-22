/**
 * Classification de sécurité — Sprint 35
 *
 * Hiérarchie : public (1) < internal (2) < confidential (3) < secret (4)
 * Règle du plafond : un document doit avoir un niveau ≥ celui de son espace.
 */

export type ClassificationLevel = "public" | "internal" | "confidential" | "secret";

const CLASSIFICATION_HIERARCHY: Record<ClassificationLevel, number> = {
  public: 1,
  internal: 2,
  confidential: 3,
  secret: 4,
};

export interface ClassificationInfo {
  value: ClassificationLevel;
  level: number;
  label: string;
  description: string;
  color: string; // tailwind color name
}

export const CLASSIFICATION_CONFIG: Record<ClassificationLevel, ClassificationInfo> = {
  public: {
    value: "public",
    level: 1,
    label: "Public",
    description: "Communication, portfolio, offres — partageable à l'extérieur",
    color: "green",
  },
  internal: {
    value: "internal",
    level: 2,
    label: "Interne",
    description: "Wiki, processus, base de connaissances — visible par l'organisation",
    color: "blue",
  },
  confidential: {
    value: "confidential",
    level: 3,
    label: "Confidentiel",
    description: "Dossiers clients, données sensibles — accès restreint aux membres",
    color: "amber",
  },
  secret: {
    value: "secret",
    level: 4,
    label: "Secret",
    description: "Direction, stratégie, finances — auteur et admins uniquement",
    color: "red",
  },
};

/**
 * Retourne le niveau numérique d'une classification.
 */
export function getClassificationLevel(classification: ClassificationLevel): number {
  return CLASSIFICATION_HIERARCHY[classification];
}

/**
 * Vérifie si un niveau de classification de document est autorisé dans un espace.
 * Règle du plafond : le document doit avoir un niveau ≥ celui de l'espace.
 * Ex: un espace "confidential" n'accepte que des documents "confidential" ou "secret".
 */
export function isClassificationAllowed(
  docClassification: ClassificationLevel,
  spaceClassification: ClassificationLevel
): boolean {
  return CLASSIFICATION_HIERARCHY[docClassification] >= CLASSIFICATION_HIERARCHY[spaceClassification];
}

/**
 * Retourne les niveaux de classification autorisés pour un document dans un espace donné.
 */
export function getAllowedDocClassifications(
  spaceClassification: ClassificationLevel
): ClassificationLevel[] {
  const spaceLevel = CLASSIFICATION_HIERARCHY[spaceClassification];
  return (Object.entries(CLASSIFICATION_HIERARCHY) as [ClassificationLevel, number][])
    .filter(([, level]) => level >= spaceLevel)
    .sort((a, b) => a[1] - b[1])
    .map(([classification]) => classification);
}

/**
 * Vérifie si un document peut être partagé à l'extérieur (lien public).
 * Condition : le document ET l'espace doivent être classifiés "public".
 */
export function canShareExternally(
  docClassification: ClassificationLevel,
  spaceClassification: ClassificationLevel
): boolean {
  return docClassification === "public" && spaceClassification === "public";
}

/**
 * Retourne la classification par défaut pour un nouveau document dans un espace.
 */
export function getDefaultDocClassification(
  spaceClassification: ClassificationLevel
): ClassificationLevel {
  // Le document hérite du niveau de l'espace par défaut
  return spaceClassification;
}

/**
 * Obtient le label français d'une classification.
 */
export function getClassificationLabel(classification: ClassificationLevel): string {
  return CLASSIFICATION_CONFIG[classification].label;
}

/**
 * Compare deux niveaux de classification. Retourne un nombre négatif si a < b,
 * zéro si a === b, positif si a > b.
 */
export function compareClassifications(
  a: ClassificationLevel,
  b: ClassificationLevel
): number {
  return CLASSIFICATION_HIERARCHY[a] - CLASSIFICATION_HIERARCHY[b];
}
