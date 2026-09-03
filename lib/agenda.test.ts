import { describe, expect, test } from "vitest";

import {
  assignLanes,
  groupByDay,
  hourWindow,
  placeWeek,
  positionInWindow,
  SLOT_MINUTES,
} from "./agenda";
import { parseEntDateTime, toDayKey } from "./date";
import type { Seance } from "./ent/types";

function seance(id: string, debut: string, fin: string): Seance {
  const debutDate = parseEntDateTime(debut)!;

  return {
    id,
    debut: debutDate.toISOString(),
    fin: parseEntDateTime(fin)!.toISOString(),
    jour: toDayKey(debutDate),
    matiere: `Cours ${id}`,
    categorie: null,
    nature: "cm",
    type: "Cours",
    intervenants: [],
    salle: null,
    site: null,
    couleur: null,
    commentaire: null,
  };
}

/** Semaine du lundi 31 août 2026 au vendredi 4 septembre. */
const SEMAINE = [
  "2026-08-31",
  "2026-09-01",
  "2026-09-02",
  "2026-09-03",
  "2026-09-04",
];

describe("groupByDay", () => {
  test("répartit les séances par jour calendaire", () => {
    const grouped = groupByDay([
      seance("a", "2026-09-01T09:00:00", "2026-09-01T10:00:00"),
      seance("b", "2026-09-01T14:00:00", "2026-09-01T16:00:00"),
      seance("c", "2026-09-02T08:00:00", "2026-09-02T09:00:00"),
    ]);

    expect(Object.keys(grouped)).toEqual(["2026-09-01", "2026-09-02"]);
    expect(grouped["2026-09-01"]).toHaveLength(2);
  });
});

describe("hourWindow", () => {
  test("garde l'amplitude 8h–19h par défaut", () => {
    const window = hourWindow([seance("a", "2026-09-01T09:00:00", "2026-09-01T10:00:00")]);

    expect(window.startMinute).toBe(8 * 60);
    expect(window.endMinute).toBe(19 * 60);
    expect(window.hours).toEqual([8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18]);
  });

  test("s'élargit pour un cours matinal ou tardif", () => {
    const window = hourWindow([
      seance("a", "2026-09-01T07:15:00", "2026-09-01T08:00:00"),
      seance("b", "2026-09-01T19:00:00", "2026-09-01T20:30:00"),
    ]);

    expect(window.startMinute).toBe(7 * 60);
    expect(window.endMinute).toBe(21 * 60);
    expect(window.slotCount).toBe((14 * 60) / SLOT_MINUTES);
  });

  test("reste valide sans aucune séance", () => {
    const window = hourWindow([]);

    expect(window.hours).toHaveLength(11);
    expect(window.slotCount).toBeGreaterThan(0);
  });
});

describe("assignLanes", () => {
  test("laisse les séances qui se suivent en pleine largeur", () => {
    const lanes = assignLanes([
      seance("a", "2026-09-01T08:30:00", "2026-09-01T10:00:00"),
      seance("b", "2026-09-01T10:00:00", "2026-09-01T12:30:00"),
    ]);

    expect(lanes.map((item) => item.lane)).toEqual([0, 0]);
    expect(lanes.map((item) => item.laneCount)).toEqual([1, 1]);
  });

  test("répartit deux séances qui se chevauchent en deux couloirs", () => {
    const lanes = assignLanes([
      seance("a", "2026-09-01T09:00:00", "2026-09-01T11:00:00"),
      seance("b", "2026-09-01T10:00:00", "2026-09-01T12:00:00"),
    ]);

    expect(lanes.map((item) => item.lane)).toEqual([0, 1]);
    expect(lanes.map((item) => item.laneCount)).toEqual([2, 2]);
  });

  test("réutilise un couloir libéré dans une chaîne de chevauchements", () => {
    // A recouvre B, B recouvre C, mais A et C sont disjointes.
    const lanes = assignLanes([
      seance("a", "2026-09-01T09:00:00", "2026-09-01T10:30:00"),
      seance("b", "2026-09-01T10:00:00", "2026-09-01T11:30:00"),
      seance("c", "2026-09-01T11:00:00", "2026-09-01T12:00:00"),
    ]);

    expect(lanes.map((item) => item.lane)).toEqual([0, 1, 0]);
    expect(lanes.every((item) => item.laneCount === 2)).toBe(true);
  });
});

describe("placeWeek", () => {
  test("place une séance sur la bonne colonne et les bonnes rangées", () => {
    const seances = [seance("a", "2026-09-01T09:00:00", "2026-09-01T17:00:00")];
    const [placed] = placeWeek(seances, SEMAINE, hourWindow(seances));

    // Mardi = 2e colonne, donc index 1.
    expect(placed.dayIndex).toBe(1);
    // 09:00 dans une fenêtre démarrant à 08:00 : 60 min / 5 = 12 rangées, base 1.
    expect(placed.startSlot).toBe(13);
    expect(placed.slotSpan).toBe((8 * 60) / SLOT_MINUTES);
  });

  test("place chaque séance sur son jour", () => {
    const seances = [
      seance("lun", "2026-08-31T09:00:00", "2026-08-31T10:00:00"),
      seance("ven", "2026-09-04T14:00:00", "2026-09-04T16:00:00"),
    ];

    const places = placeWeek(seances, SEMAINE, hourWindow(seances));
    expect(places.map((item) => item.dayIndex)).toEqual([0, 4]);
  });

  test("ignore une séance hors des jours affichés", () => {
    // Samedi : hors de la semaine ouvrée.
    const seances = [seance("sam", "2026-09-05T09:00:00", "2026-09-05T10:00:00")];

    expect(placeWeek(seances, SEMAINE, hourWindow(seances))).toHaveLength(0);
  });

  test("garde au moins une rangée pour un créneau très court", () => {
    const seances = [seance("a", "2026-09-01T09:00:00", "2026-09-01T09:02:00")];
    const [placed] = placeWeek(seances, SEMAINE, hourWindow(seances));

    expect(placed.slotSpan).toBeGreaterThanOrEqual(1);
  });

  test("borne une séance qui déborde de la fenêtre affichée", () => {
    const seances = [seance("a", "2026-09-01T09:00:00", "2026-09-01T12:00:00")];
    // Fenêtre volontairement plus étroite que la séance.
    const window = { startMinute: 600, endMinute: 660, hours: [10], slotCount: 12 };

    const [placed] = placeWeek(seances, SEMAINE, window);

    expect(placed.startSlot).toBe(1);
    expect(placed.slotSpan).toBe(12);
  });
});

describe("positionInWindow", () => {
  test("situe un instant en pourcentage de l'amplitude", () => {
    const window = hourWindow([]); // 8h → 19h
    const midi = parseEntDateTime("2026-09-01T13:30:00")!;

    // 13h30 est à 5h30 des 11h d'amplitude, soit la moitié.
    expect(positionInWindow(midi, window)).toBeCloseTo(50, 5);
  });

  test("retourne null en dehors de l'amplitude", () => {
    const window = hourWindow([]);

    expect(positionInWindow(parseEntDateTime("2026-09-01T06:00:00")!, window)).toBeNull();
    expect(positionInWindow(parseEntDateTime("2026-09-01T22:00:00")!, window)).toBeNull();
  });
});
