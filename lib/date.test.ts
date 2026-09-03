import { describe, expect, test } from "vitest";

import {
  addDays,
  formatHeure,
  formatPlageSemaine,
  minutesDepuisMinuit,
  parseDayKey,
  parseEntDateTime,
  startOfWeek,
  toDayKey,
  weekDays,
} from "./date";

/**
 * Ces tests tournent volontairement sous `TZ=UTC` (voir `npm test`) : c'est la
 * configuration d'un serveur de production, et celle où une lecture naïve des
 * dates de l'ENT décalerait tous les cours de deux heures.
 */
describe("parseEntDateTime", () => {
  test("interprète une date naïve en heure de Paris, pas en UTC", () => {
    const debut = parseEntDateTime("2026-09-01T09:00:00");

    // 09:00 à Paris en septembre (UTC+2) = 07:00 UTC.
    expect(debut?.toISOString()).toBe("2026-09-01T07:00:00.000Z");
    expect(formatHeure(debut!)).toBe("09:00");
  });

  test("reste juste en heure d'hiver (UTC+1)", () => {
    const debut = parseEntDateTime("2026-01-12T08:30:00");

    expect(debut?.toISOString()).toBe("2026-01-12T07:30:00.000Z");
    expect(formatHeure(debut!)).toBe("08:30");
  });

  test("gère le jour du passage à l'heure d'été", () => {
    // Le 29 mars 2026, 02:00 devient 03:00 : un cours de 10:00 reste 10:00.
    const debut = parseEntDateTime("2026-03-29T10:00:00");

    expect(formatHeure(debut!)).toBe("10:00");
    expect(debut?.toISOString()).toBe("2026-03-29T08:00:00.000Z");
  });

  test("accepte les secondes optionnelles", () => {
    expect(parseEntDateTime("2026-09-01T09:00")).not.toBeNull();
  });

  test("retourne null sur une chaîne inexploitable", () => {
    expect(parseEntDateTime("")).toBeNull();
    expect(parseEntDateTime("pas une date")).toBeNull();
    expect(parseEntDateTime("01/09/2026 09:00")).toBeNull();
  });
});

describe("toDayKey", () => {
  test("range une séance de fin de soirée dans le bon jour parisien", () => {
    // 23:30 à Paris = 21:30 UTC : le jour UTC et le jour parisien coïncident.
    const tardif = parseEntDateTime("2026-09-01T23:30:00");
    expect(toDayKey(tardif!)).toBe("2026-09-01");
  });

  test("est stable en début de journée", () => {
    // 00:30 à Paris = 22:30 UTC la veille : c'est là qu'une lecture UTC échoue.
    const matin = parseEntDateTime("2026-09-02T00:30:00");
    expect(toDayKey(matin!)).toBe("2026-09-02");
  });
});

describe("startOfWeek", () => {
  test("remonte au lundi depuis un mardi", () => {
    const mardi = parseDayKey("2026-09-01");
    expect(toDayKey(startOfWeek(mardi!))).toBe("2026-08-31");
  });

  test("laisse un lundi inchangé", () => {
    const lundi = parseDayKey("2026-08-31");
    expect(toDayKey(startOfWeek(lundi!))).toBe("2026-08-31");
  });

  test("rattache le dimanche à la semaine qui s'achève", () => {
    const dimanche = parseDayKey("2026-09-06");
    expect(toDayKey(startOfWeek(dimanche!))).toBe("2026-08-31");
  });
});

describe("weekDays", () => {
  test("retourne les cinq jours ouvrés", () => {
    const jours = weekDays(parseDayKey("2026-09-02")!).map(toDayKey);

    expect(jours).toEqual([
      "2026-08-31",
      "2026-09-01",
      "2026-09-02",
      "2026-09-03",
      "2026-09-04",
    ]);
  });
});

describe("addDays", () => {
  test("franchit un changement d'heure sans dériver", () => {
    // Du 28 au 29 mars 2026 : la journée ne fait que 23 h.
    const veille = parseDayKey("2026-03-28");
    expect(toDayKey(addDays(veille!, 1))).toBe("2026-03-29");
    expect(formatHeure(addDays(veille!, 1))).toBe("00:00");
  });

  test("franchit un changement de mois", () => {
    expect(toDayKey(addDays(parseDayKey("2026-08-31")!, 1))).toBe("2026-09-01");
  });
});

describe("minutesDepuisMinuit", () => {
  test("mesure la position dans la journée parisienne", () => {
    expect(minutesDepuisMinuit(parseEntDateTime("2026-09-01T09:30:00")!)).toBe(570);
  });
});

describe("formatPlageSemaine", () => {
  test("factorise le mois quand la semaine ne le franchit pas", () => {
    const lundi = parseDayKey("2026-09-07")!;
    expect(formatPlageSemaine(lundi, addDays(lundi, 4))).toBe(
      "7 – 11 septembre 2026",
    );
  });

  test("affiche les deux mois à cheval", () => {
    const lundi = parseDayKey("2026-08-31")!;
    expect(formatPlageSemaine(lundi, addDays(lundi, 4))).toBe(
      "31 août – 4 septembre 2026",
    );
  });
});
