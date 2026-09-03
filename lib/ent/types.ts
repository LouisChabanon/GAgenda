import type { NatureSeance } from "./nature";

/** Séance telle que renvoyée par l'endpoint calendrier de l'ENT (JSON brut). */
export type EntSeance = {
  Id: string;
  IsSeance: boolean;
  DisplayTempoLink: boolean;
  /** Date naïve heure de Paris : `"2026-09-01T09:00:00"`. Voir `lib/date.ts`. */
  Debut: string;
  Fin: string;
  /** Bloc HTML approximatif : matière, intervenant, salle, site. */
  Planification: string;
  AssignmentColor: string | null;
  BorderColor: string | null;
  TextColor: string | null;
  /** Vaut `"Cours"` sur toutes les séances, examens compris : inexploitable. */
  Type: string;
  Description: string;
  CommentaireExterne: string;
};

/** Fragments extraits du champ `Planification`. `null` quand absent. */
export type PlanificationParts = {
  matiere: string | null;
  categorie: string | null;
  intervenants: string[];
  salle: string | null;
  site: string | null;
};

/** Séance normalisée, seule forme consommée par l'UI. */
export type Seance = {
  id: string;
  /** ISO 8601 absolu (sérialisable Server -> Client). */
  debut: string;
  fin: string;
  /** Jour calendaire `YYYY-MM-DD` à Paris, pour le regroupement. */
  jour: string;
  /** Intitulé nettoyé : préfixe de type retiré, underscores rendus en espaces. */
  matiere: string;
  categorie: string | null;
  /** Nature déduite de l'intitulé — voir `lib/ent/nature.ts`. */
  nature: NatureSeance;
  /** Champ `Type` brut de l'ENT. Vaut « Cours » partout : conservé pour trace. */
  type: string;
  intervenants: string[];
  salle: string | null;
  site: string | null;
  /** `BorderColor` de l'ENT. Identique sur toutes les séances : non discriminant. */
  couleur: string | null;
  commentaire: string | null;
};

export type EntCredentials = {
  username: string;
  password: string;
};

/** Session ASP.NET obtenue après les deux POST d'authentification. */
export type EntSession = {
  /** En-tête `Cookie` prêt à être renvoyé à l'ENT. */
  cookie: string;
  /** Instant (ms epoch) au-delà duquel on rejoue le login. */
  expiresAt: number;
};

export type DateRange = {
  from: Date;
  to: Date;
};
