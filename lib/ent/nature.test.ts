import { describe, expect, test } from "vitest";

import { detecterNature, libelleNature, nettoyerMatiere } from "./nature";

/**
 * Tous les intitulés viennent de séances réelles de l'ENT. Le champ `Type` y
 * vaut « Cours » partout, examens et TD compris : c'est l'intitulé qui porte
 * l'information, et ces cas verrouillent sa lecture.
 */
describe("detecterNature", () => {
  test("reconnaît un examen par sa catégorie et par son intitulé", () => {
    expect(detecterNature("EXAMEN Physique Nucléaire", "Examen")).toBe("examen");
    expect(detecterNature("EXAMEN Physique Nucléaire", null)).toBe("examen");
  });

  test("reconnaît les préfixes de la convention de nommage", () => {
    expect(detecterNature("CC_Physique_nucléaire", "Cours magistraux")).toBe("cm");
    expect(detecterNature("TD_Matériaux", "Travaux dirigés")).toBe("td");
    expect(detecterNature("TP_Thermohydraulique_1", "Travaux pratique")).toBe("tp");
  });

  test("s'appuie sur le seul préfixe quand la catégorie est vide", () => {
    // L'ENT renvoie régulièrement `CC_Matériaux ()`.
    expect(detecterNature("CC_Matériaux", null)).toBe("cm");
    expect(detecterNature("TD_Matériaux", null)).toBe("td");
    expect(detecterNature("TP_Thermohydraulique_1", null)).toBe("tp");
  });

  test("accepte « Travaux pratique » au singulier, tel que l'ENT l'écrit", () => {
    expect(detecterNature("Atelier", "Travaux pratique")).toBe("tp");
    expect(detecterNature("Atelier", "Travaux pratiques")).toBe("tp");
  });

  test("classe le distanciel et les événements", () => {
    expect(detecterNature("E-Learning", null)).toBe("distanciel");
    expect(detecterNature("Conférence", null)).toBe("evenement");
    expect(detecterNature("Rencontre_Entreprise", null)).toBe("evenement");
    expect(detecterNature("Accueil GA", "Cours magistraux")).toBe("cm");
  });

  test("l'examen l'emporte sur tout autre indice", () => {
    // Un examen étiqueté comme un cours magistral doit rester un examen :
    // c'est le classement dont l'erreur coûte le plus cher.
    expect(detecterNature("EXAMEN Matériaux", "Cours magistraux")).toBe("examen");
  });

  test("retombe sur « autre » plutôt que de deviner", () => {
    expect(detecterNature("Réunion de promo", null)).toBe("autre");
    expect(detecterNature("", null)).toBe("autre");
  });
});

describe("nettoyerMatiere", () => {
  test("retire le préfixe de type et rend les underscores en espaces", () => {
    expect(nettoyerMatiere("CC_Physique_nucléaire")).toBe("Physique nucléaire");
    expect(nettoyerMatiere("TP_Thermohydraulique_1")).toBe("Thermohydraulique 1");
    expect(nettoyerMatiere("TD_Matériaux")).toBe("Matériaux");
    expect(nettoyerMatiere("Rencontre_Entreprise")).toBe("Rencontre Entreprise");
  });

  test("retire la mention EXAMEN, que le badge porte déjà", () => {
    expect(nettoyerMatiere("EXAMEN Physique Nucléaire")).toBe("Physique Nucléaire");
  });

  test("laisse intact un intitulé déjà propre", () => {
    expect(nettoyerMatiere("Accueil GA")).toBe("Accueil GA");
    expect(nettoyerMatiere("Conférence")).toBe("Conférence");
  });

  test("ne casse pas un tiret légitime", () => {
    // « E-Learning » ne doit pas perdre son tiret, contrairement aux underscores.
    expect(nettoyerMatiere("E-Learning")).toBe("E-Learning");
  });
});

describe("libelleNature", () => {
  test("donne un libellé lisible à chaque nature", () => {
    expect(libelleNature("cm")).toBe("Cours magistral");
    expect(libelleNature("examen")).toBe("Examen");
    expect(libelleNature("distanciel")).toBe("À distance");
  });
});
