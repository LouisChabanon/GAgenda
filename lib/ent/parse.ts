/**
 * Le champ `Planification` de l'ENT est du HTML approximatif, avec des
 * séparateurs irréguliers :
 *
 *   "Accueil GA (Cours magistraux)\r\n<br />\r\nBECHADE Jean-Luc <br />\r\nSalle A1\r\n (SACLAY) \r\n"
 *
 * On en extrait matière, catégorie, intervenants, salle et site. Ces fonctions
 * sont pures et tolérantes : un champ absent vaut `null`, jamais une exception —
 * une séance mal formée doit rester affichable.
 */

import { parseEntDateTime, toDayKey } from "@/lib/date";
import { detecterNature, nettoyerMatiere } from "./nature";
import type { EntSeance, PlanificationParts, Seance } from "./types";

const BR_SEPARATOR = /<br\s*\/?>/i;
const TAGS = /<[^>]*>/g;
const SALLE_LINE = /^salle\b/i;
const SALLE_PARTS = /^salle\s+(.+?)(?:\s*\((.+?)\))?\s*$/i;
const MATIERE_PARTS = /^(.*?)\s*\(([^()]*)\)\s*$/;

/**
 * Entités nommées rencontrées dans les champs de l'ENT. Les accents français y
 * passent : `CommentaireExterne` contient par exemple `Le&ccedil;on inaugurale`,
 * qu'un décodeur incomplet transformerait en « Le on ».
 */
const ENTITIES: Record<string, string> = {
  nbsp: " ",
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  agrave: "à", aacute: "á", acirc: "â", atilde: "ã", auml: "ä", aring: "å",
  aelig: "æ", ccedil: "ç",
  egrave: "è", eacute: "é", ecirc: "ê", euml: "ë",
  igrave: "ì", iacute: "í", icirc: "î", iuml: "ï",
  ntilde: "ñ",
  ograve: "ò", oacute: "ó", ocirc: "ô", otilde: "õ", ouml: "ö", oelig: "œ",
  ugrave: "ù", uacute: "ú", ucirc: "û", uuml: "ü",
  yuml: "ÿ", szlig: "ß",
  deg: "°", euro: "€", laquo: "«", raquo: "»", hellip: "…",
  ndash: "–", mdash: "—", rsquo: "’", lsquo: "‘",
};

const ENTITY = /&(#x?[0-9a-f]+|[a-z]+);/gi;

/** Décode une entité HTML, nommée ou numérique. */
function decodeEntity(entity: string, corps: string): string {
  if (corps.startsWith("#")) {
    const base = corps[1] === "x" || corps[1] === "X" ? 16 : 10;
    const code = Number.parseInt(corps.slice(base === 16 ? 2 : 1), base);
    return Number.isFinite(code) ? String.fromCodePoint(code) : entity;
  }

  const nommee = ENTITIES[corps.toLowerCase()];
  // Une entité inconnue est laissée telle quelle : la remplacer par un espace
  // masquerait silencieusement du texte.
  return nommee ?? entity;
}

/** Retire les balises, décode les entités et normalise les espaces. */
export function cleanHtmlFragment(raw: string): string {
  return raw
    .replace(TAGS, " ")
    .replace(ENTITY, decodeEntity)
    .replace(/\s+/g, " ")
    .trim();
}

/** Découpe le bloc en lignes non vides. */
function toLines(raw: string): string[] {
  return raw
    .split(BR_SEPARATOR)
    .flatMap((chunk) => chunk.split(/\r?\n\s*\r?\n/))
    .map(cleanHtmlFragment)
    .filter((line) => line.length > 0);
}

export function parsePlanification(raw: string): PlanificationParts {
  const lines = toLines(raw ?? "");

  if (lines.length === 0) {
    return { matiere: null, categorie: null, intervenants: [], salle: null, site: null };
  }

  const [titre, ...reste] = lines;
  const titreMatch = MATIERE_PARTS.exec(titre);
  const matiere = (titreMatch?.[1] ?? titre).trim() || null;
  const categorie = titreMatch?.[2]?.trim() || null;

  const salleLine = reste.find((line) => SALLE_LINE.test(line));
  const salleMatch = salleLine ? SALLE_PARTS.exec(salleLine) : null;

  const intervenants = reste
    .filter((line) => line !== salleLine)
    .flatMap((line) => line.split(/\s*[,;]\s*/))
    .map((nom) => nom.trim())
    .filter((nom) => nom.length > 0);

  return {
    matiere,
    categorie,
    intervenants,
    salle: salleMatch?.[1]?.trim() || null,
    site: salleMatch?.[2]?.trim() || null,
  };
}

/**
 * Normalise une séance brute. Retourne `null` si les dates sont inexploitables :
 * mieux vaut masquer une séance illisible que casser toute la journée.
 */
export function normalizeSeance(raw: EntSeance): Seance | null {
  const debut = parseEntDateTime(raw.Debut);
  const fin = parseEntDateTime(raw.Fin);
  if (!debut || !fin) return null;

  const parts = parsePlanification(raw.Planification);
  const commentaire = cleanHtmlFragment(raw.CommentaireExterne ?? "");
  const intitule = parts.matiere ?? "";

  return {
    id: raw.Id,
    debut: debut.toISOString(),
    fin: fin.toISOString(),
    jour: toDayKey(debut),
    matiere: nettoyerMatiere(intitule) || "Séance",
    categorie: parts.categorie,
    nature: detecterNature(intitule, parts.categorie),
    type: raw.Type ?? "Cours",
    intervenants: parts.intervenants,
    salle: parts.salle,
    site: parts.site,
    couleur: raw.BorderColor,
    commentaire: commentaire.length > 0 ? commentaire : null,
  };
}

/** Normalise une liste brute et l'ordonne chronologiquement. */
export function normalizeSeances(raws: EntSeance[]): Seance[] {
  return raws
    .map(normalizeSeance)
    .filter((seance): seance is Seance => seance !== null)
    .sort((a, b) => a.debut.localeCompare(b.debut));
}
