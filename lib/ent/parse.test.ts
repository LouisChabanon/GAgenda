import { describe, expect, test } from "vitest";

import fixture from "./__fixtures__/seances.json";
import { cleanHtmlFragment, normalizeSeance, normalizeSeances, parsePlanification } from "./parse";
import type { EntSeance } from "./types";

/** Le bloc exact renvoyé par l'ENT, séparateurs irréguliers compris. */
const PLANIFICATION_REELLE =
  "Accueil GA (Cours magistraux)\r\n<br />\r\nBECHADE Jean-Luc <br />\r\nSalle A1\r\n (SACLAY) \r\n";

describe("parsePlanification", () => {
  test("extrait matière, catégorie, intervenant, salle et site", () => {
    expect(parsePlanification(PLANIFICATION_REELLE)).toEqual({
      matiere: "Accueil GA",
      categorie: "Cours magistraux",
      intervenants: ["BECHADE Jean-Luc"],
      salle: "A1",
      site: "SACLAY",
    });
  });

  test("accepte une matière sans catégorie entre parenthèses", () => {
    const parts = parsePlanification("Physique nucléaire\r\n<br />\r\nSalle C102\r\n");

    expect(parts.matiere).toBe("Physique nucléaire");
    expect(parts.categorie).toBeNull();
    expect(parts.salle).toBe("C102");
    expect(parts.site).toBeNull();
  });

  test("sépare plusieurs intervenants", () => {
    const parts = parsePlanification(
      "Projet\r\n<br />\r\nMARTIN Claire, GARCIA Paul <br />\r\nSalle D12\r\n",
    );

    expect(parts.intervenants).toEqual(["MARTIN Claire", "GARCIA Paul"]);
  });

  test("survit à un bloc tronqué ou vide", () => {
    expect(parsePlanification("")).toEqual({
      matiere: null,
      categorie: null,
      intervenants: [],
      salle: null,
      site: null,
    });

    const seulTitre = parsePlanification("Accueil GA");
    expect(seulTitre.matiere).toBe("Accueil GA");
    expect(seulTitre.intervenants).toEqual([]);
  });

  test("tolère l'absence de balises <br />", () => {
    const parts = parsePlanification("Thermodynamique (CM)\n\nLEROY Antoine\n\nSalle A3 (SACLAY)");

    expect(parts.matiere).toBe("Thermodynamique");
    expect(parts.salle).toBe("A3");
    expect(parts.site).toBe("SACLAY");
  });

  test("conserve les accents et décode les entités", () => {
    const parts = parsePlanification("Génie logiciel &amp; systèmes (TD)\r\n<br />\r\nSalle B2\r\n");

    expect(parts.matiere).toBe("Génie logiciel & systèmes");
    expect(parts.categorie).toBe("TD");
  });
});

describe("cleanHtmlFragment", () => {
  test("retire les balises et normalise les blancs", () => {
    expect(cleanHtmlFragment("  Salle   A1 \r\n <b>bis</b>  ")).toBe("Salle A1 bis");
  });
});

describe("normalizeSeance", () => {
  const brute = fixture[2] as EntSeance;

  test("normalise la séance d'exemple de l'ENT", () => {
    const seance = normalizeSeance(brute);

    expect(seance).toMatchObject({
      id: "2575281",
      jour: "2026-09-01",
      matiere: "Accueil GA",
      categorie: "Cours magistraux",
      nature: "cm",
      type: "Cours",
      salle: "A1",
      site: "SACLAY",
      couleur: "#FF4000",
      intervenants: ["BECHADE Jean-Luc"],
    });
    // 09:00 heure de Paris, quel que soit le fuseau du serveur.
    expect(seance?.debut).toBe("2026-09-01T07:00:00.000Z");
  });

  test("accepte une couleur absente", () => {
    const sansCouleur = normalizeSeance({ ...brute, BorderColor: null });
    expect(sansCouleur?.couleur).toBeNull();
  });

  test("retourne null si les dates sont inexploitables", () => {
    expect(normalizeSeance({ ...brute, Debut: "" })).toBeNull();
    expect(normalizeSeance({ ...brute, Fin: "n/a" })).toBeNull();
  });

  test("affiche « Séance » quand la planification ne donne pas de matière", () => {
    // Se rabattre sur `Type` ne servirait à rien : il vaut « Cours » partout,
    // y compris sur les examens.
    const seance = normalizeSeance({ ...brute, Planification: "" });
    expect(seance?.matiere).toBe("Séance");
  });
});

describe("normalizeSeances", () => {
  test("ordonne chronologiquement et écarte les séances illisibles", () => {
    const seances = normalizeSeances([
      { ...(fixture[2] as EntSeance) },
      { ...(fixture[0] as EntSeance) },
      { ...(fixture[0] as EntSeance), Id: "cassée", Debut: "???" },
    ]);

    expect(seances.map((seance) => seance.id)).toEqual(["2594839", "2575281"]);
  });

  test("normalise toute la fixture sans perte", () => {
    expect(normalizeSeances(fixture as EntSeance[])).toHaveLength(fixture.length);
  });
});

describe("normalizeSeance — natures et nettoyage", () => {
  const gabarit = fixture[2] as EntSeance;

  function normaliser(planification: string, commentaire = "") {
    return normalizeSeance({
      ...gabarit,
      Planification: planification,
      CommentaireExterne: commentaire,
    });
  }

  test("déduit la nature malgré un Type toujours à « Cours »", () => {
    const examen = normaliser(
      "EXAMEN Physique Nucléaire (Examen)\r\n<br />\r\n<br />\r\nSalle  A8\r\n (SACLAY) \r\n",
    );

    expect(examen?.type).toBe("Cours");
    expect(examen?.nature).toBe("examen");
    // Le double espace de « Salle  A8 » ne doit pas se retrouver dans la salle.
    expect(examen?.salle).toBe("A8");
  });

  test("nettoie l'intitulé affiché", () => {
    const tp = normaliser(
      "TP_Thermohydraulique_1 (Travaux pratique)\r\n<br />\r\nRENAULT Claude <br />\r\nSalle 149\r\n (SACLAY) \r\n",
    );

    expect(tp?.matiere).toBe("Thermohydraulique 1");
    expect(tp?.nature).toBe("tp");
    expect(tp?.intervenants).toEqual(["RENAULT Claude"]);
  });

  test("gère une séance sans salle ni intervenant", () => {
    const distanciel = normaliser("E-Learning ()\r\n<br />\r\n<br />\r\n");

    expect(distanciel?.matiere).toBe("E-Learning");
    expect(distanciel?.nature).toBe("distanciel");
    expect(distanciel?.salle).toBeNull();
    expect(distanciel?.intervenants).toEqual([]);
  });

  test("décode les entités accentuées du commentaire", () => {
    // Sans décodage correct, « Leçon » devenait « Le on ».
    const conference = normaliser(
      "Conférence ()\r\n<br />\r\n<br />\r\nAmphi\r\n (SACLAY) \r\n",
      "<p>Le&ccedil;on inaugurale INSTN</p>",
    );

    expect(conference?.commentaire).toBe("Leçon inaugurale INSTN");
    expect(conference?.nature).toBe("evenement");
  });
});
