/**
 * Journées nationales et mondiales françaises
 * Format : mois (1-12), jour, nom
 * Source : gouvernement.fr, Nations Unies, associations françaises
 *
 * Ces événements récurrents annuels peuvent être injectés
 * dans un calendrier d'organisation via le seed ou l'API.
 */

export interface NationalDay {
  month: number;
  day: number;
  title: string;
  category: "nationale" | "mondiale" | "europeenne";
}

export const NATIONAL_DAYS: NationalDay[] = [
  // ─── Janvier ───
  { month: 1, day: 1, title: "Jour de l'An", category: "nationale" },
  { month: 1, day: 4, title: "Journée mondiale du braille", category: "mondiale" },
  { month: 1, day: 24, title: "Journée internationale de l'éducation", category: "mondiale" },
  { month: 1, day: 27, title: "Journée de la mémoire de l'Holocauste", category: "mondiale" },

  // ─── Février ───
  { month: 2, day: 2, title: "Chandeleur", category: "nationale" },
  { month: 2, day: 4, title: "Journée mondiale contre le cancer", category: "mondiale" },
  { month: 2, day: 6, title: "Journée mondiale sans téléphone portable", category: "mondiale" },
  { month: 2, day: 11, title: "Journée internationale des femmes et filles de science", category: "mondiale" },
  { month: 2, day: 14, title: "Saint-Valentin", category: "nationale" },
  { month: 2, day: 21, title: "Journée internationale de la langue maternelle", category: "mondiale" },

  // ─── Mars ───
  { month: 3, day: 8, title: "Journée internationale des droits des femmes", category: "mondiale" },
  { month: 3, day: 14, title: "Journée du nombre Pi", category: "mondiale" },
  { month: 3, day: 20, title: "Journée internationale du bonheur", category: "mondiale" },
  { month: 3, day: 21, title: "Journée mondiale de la poésie", category: "mondiale" },
  { month: 3, day: 22, title: "Journée mondiale de l'eau", category: "mondiale" },
  { month: 3, day: 27, title: "Journée mondiale du théâtre", category: "mondiale" },

  // ─── Avril ───
  { month: 4, day: 1, title: "Poisson d'avril", category: "nationale" },
  { month: 4, day: 2, title: "Journée mondiale de sensibilisation à l'autisme", category: "mondiale" },
  { month: 4, day: 7, title: "Journée mondiale de la santé", category: "mondiale" },
  { month: 4, day: 22, title: "Journée de la Terre", category: "mondiale" },
  { month: 4, day: 23, title: "Journée mondiale du livre", category: "mondiale" },

  // ─── Mai ───
  { month: 5, day: 1, title: "Fête du Travail", category: "nationale" },
  { month: 5, day: 3, title: "Journée mondiale de la liberté de la presse", category: "mondiale" },
  { month: 5, day: 8, title: "Victoire 1945", category: "nationale" },
  { month: 5, day: 9, title: "Journée de l'Europe", category: "europeenne" },
  { month: 5, day: 15, title: "Journée internationale des familles", category: "mondiale" },
  { month: 5, day: 17, title: "Journée mondiale contre l'homophobie", category: "mondiale" },
  { month: 5, day: 21, title: "Journée mondiale de la diversité culturelle", category: "mondiale" },
  { month: 5, day: 22, title: "Journée internationale de la biodiversité", category: "mondiale" },

  // ─── Juin ───
  { month: 6, day: 1, title: "Journée mondiale des parents", category: "mondiale" },
  { month: 6, day: 5, title: "Journée mondiale de l'environnement", category: "mondiale" },
  { month: 6, day: 8, title: "Journée mondiale de l'océan", category: "mondiale" },
  { month: 6, day: 14, title: "Journée mondiale du don du sang", category: "mondiale" },
  { month: 6, day: 20, title: "Journée mondiale des réfugiés", category: "mondiale" },
  { month: 6, day: 21, title: "Fête de la musique", category: "nationale" },

  // ─── Juillet ───
  { month: 7, day: 14, title: "Fête nationale", category: "nationale" },
  { month: 7, day: 18, title: "Journée internationale Nelson Mandela", category: "mondiale" },
  { month: 7, day: 30, title: "Journée mondiale contre la traite d'êtres humains", category: "mondiale" },

  // ─── Août ───
  { month: 8, day: 9, title: "Journée internationale des peuples autochtones", category: "mondiale" },
  { month: 8, day: 12, title: "Journée internationale de la jeunesse", category: "mondiale" },
  { month: 8, day: 15, title: "Assomption", category: "nationale" },
  { month: 8, day: 19, title: "Journée mondiale de l'aide humanitaire", category: "mondiale" },

  // ─── Septembre ───
  { month: 9, day: 8, title: "Journée internationale de l'alphabétisation", category: "mondiale" },
  { month: 9, day: 15, title: "Journée internationale de la démocratie", category: "mondiale" },
  { month: 9, day: 21, title: "Journée internationale de la paix", category: "mondiale" },
  { month: 9, day: 26, title: "Journée européenne des langues", category: "europeenne" },
  { month: 9, day: 27, title: "Journée mondiale du tourisme", category: "mondiale" },

  // ─── Octobre ───
  { month: 10, day: 1, title: "Journée internationale des personnes âgées", category: "mondiale" },
  { month: 10, day: 2, title: "Journée internationale de la non-violence", category: "mondiale" },
  { month: 10, day: 5, title: "Journée mondiale des enseignants", category: "mondiale" },
  { month: 10, day: 10, title: "Journée mondiale de la santé mentale", category: "mondiale" },
  { month: 10, day: 16, title: "Journée mondiale de l'alimentation", category: "mondiale" },
  { month: 10, day: 17, title: "Journée mondiale du refus de la misère", category: "mondiale" },
  { month: 10, day: 25, title: "Journée européenne de la justice", category: "europeenne" },

  // ─── Novembre ───
  { month: 11, day: 1, title: "Toussaint", category: "nationale" },
  { month: 11, day: 11, title: "Armistice 1918", category: "nationale" },
  { month: 11, day: 13, title: "Journée mondiale de la gentillesse", category: "mondiale" },
  { month: 11, day: 16, title: "Journée internationale de la tolérance", category: "mondiale" },
  { month: 11, day: 20, title: "Journée internationale des droits de l'enfant", category: "mondiale" },
  { month: 11, day: 25, title: "Journée internationale pour l'élimination de la violence faite aux femmes", category: "mondiale" },

  // ─── Décembre ───
  { month: 12, day: 1, title: "Journée mondiale de lutte contre le sida", category: "mondiale" },
  { month: 12, day: 3, title: "Journée internationale des personnes handicapées", category: "mondiale" },
  { month: 12, day: 5, title: "Journée mondiale du bénévolat", category: "mondiale" },
  { month: 12, day: 10, title: "Journée mondiale des droits de l'homme", category: "mondiale" },
  { month: 12, day: 18, title: "Journée internationale des migrants", category: "mondiale" },
  { month: 12, day: 25, title: "Noël", category: "nationale" },
];

/**
 * Génère les événements pour une année donnée.
 * Retourne un tableau d'objets compatibles avec l'API events.
 */
export function generateNationalDayEvents(year: number) {
  return NATIONAL_DAYS.map((day) => {
    const date = new Date(year, day.month - 1, day.day);
    const color =
      day.category === "nationale"
        ? "#2563eb"
        : day.category === "europeenne"
          ? "#7c3aed"
          : "#059669";

    return {
      title: day.title,
      startAt: date.toISOString(),
      endAt: date.toISOString(),
      allDay: true,
      color,
      status: "confirmed" as const,
      visibility: "public" as const,
      recurrenceRule: "FREQ=YEARLY",
    };
  });
}
