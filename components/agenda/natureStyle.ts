import type { NatureSeance } from "@/lib/ent/nature";

export type StyleNature = {
  fond: string;
  texte: string;
  filet: string;
  /** Le distanciel n'a pas de salle : le trait discontinu le signale. */
  discontinu: boolean;
};

/**
 * Traduit une nature en habillage.
 *
 * Les trois valeurs viennent de `globals.css`. La palette y est catégorielle et
 * indépendante des couleurs INSTN, qui manquaient de teintes distinctes pour
 * coder sept natures sans virer au gris.
 */
export function styleNature(nature: NatureSeance): StyleNature {
  return {
    fond: `var(--nature-${nature}-fill)`,
    texte: `var(--nature-${nature}-text)`,
    filet: `var(--nature-${nature}-edge)`,
    discontinu: nature === "distanciel",
  };
}
