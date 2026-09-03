/**
 * Nature d'une séance.
 *
 * Le champ `Type` de l'ENT vaut `"Cours"` sur *toutes* les séances, examens et
 * TD compris : il est inexploitable. De même, `BorderColor` vaut `#FF4000`
 * partout, donc la couleur renvoyée ne distingue rien non plus.
 *
 * La seule information fiable est l'intitulé, qui suit une convention de
 * nommage : préfixe `CC_` / `TD_` / `TP_`, et catégorie entre parenthèses
 * (`(Cours magistraux)`, `(Travaux dirigés)`, `(Travaux pratique)`, `(Examen)`).
 * Les deux sont lus, car la catégorie est parfois vide — `CC_Matériaux ()`.
 */

export type NatureSeance =
  | "cm"
  | "td"
  | "tp"
  | "examen"
  | "distanciel"
  | "evenement"
  | "autre";

const LIBELLES: Record<NatureSeance, string> = {
  cm: "Cours magistral",
  td: "Travaux dirigés",
  tp: "Travaux pratiques",
  examen: "Examen",
  distanciel: "À distance",
  evenement: "Événement",
  autre: "Séance",
};

export function libelleNature(nature: NatureSeance): string {
  return LIBELLES[nature];
}

/**
 * Déduit la nature à partir de l'intitulé et de la catégorie.
 * L'examen est testé en premier : c'est la seule erreur de classement qui
 * coûterait cher à l'utilisateur.
 */
export function detecterNature(matiere: string, categorie: string | null): NatureSeance {
  const intitule = matiere.toLowerCase();
  const cat = (categorie ?? "").toLowerCase();

  if (cat.startsWith("examen") || /\bexamen\b/.test(intitule)) return "examen";

  if (/^td[_\s-]/.test(intitule) || cat.startsWith("travaux dirig")) return "td";
  // L'ENT écrit « Travaux pratique » au singulier : le préfixe suffit à couvrir.
  if (/^tp[_\s-]/.test(intitule) || cat.startsWith("travaux pratique")) return "tp";
  if (/^cc[_\s-]/.test(intitule) || cat.startsWith("cours magistra")) return "cm";

  if (/e-?learning|distanciel|visio/.test(intitule)) return "distanciel";
  if (/conf[ée]rence|rencontre|forum|accueil|s[ée]minaire/.test(intitule)) {
    return "evenement";
  }

  return "autre";
}

/**
 * Nettoie l'intitulé pour l'affichage : le préfixe de type devient un badge, il
 * n'a plus à encombrer le titre, et les underscores de la convention de nommage
 * redeviennent des espaces.
 *
 * `TP_Thermohydraulique_1` → `Thermohydraulique 1`
 */
export function nettoyerMatiere(matiere: string): string {
  return matiere
    .replace(/^(cc|td|tp)[_\s-]+/i, "")
    .replace(/^examen[_\s-]+/i, "")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
