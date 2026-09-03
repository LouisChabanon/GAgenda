/**
 * Géométrie de la grille hebdomadaire.
 *
 * La grille est en CSS Grid : chaque journée est une colonne, chaque tranche de
 * cinq minutes une rangée. Une séance occupe donc `grid-row: début / span durée`,
 * ce qui laisse le navigateur gérer la hauteur — pas de calcul en pixels, et la
 * grille s'étire naturellement à la hauteur disponible.
 *
 * Fonctions pures, utilisables côté serveur comme côté client.
 */

import { minutesDepuisMinuit } from "@/lib/date";
import type { Seance } from "@/lib/ent/types";

/** Granularité d'une rangée de la grille, en minutes. */
export const SLOT_MINUTES = 5;

/** Fenêtre affichée par défaut, élargie si des séances débordent. */
const DEFAULT_START_MINUTE = 8 * 60;
const DEFAULT_END_MINUTE = 19 * 60;
const MINUTES_PER_HOUR = 60;

export type HourWindow = {
  startMinute: number;
  endMinute: number;
  /** Heures pleines à graduer, la première servant d'origine. */
  hours: number[];
  /** Nombre de rangées de la grille. */
  slotCount: number;
};

/** Regroupe les séances par jour calendaire. */
export function groupByDay(seances: Seance[]): Record<string, Seance[]> {
  const grouped: Record<string, Seance[]> = {};

  for (const seance of seances) {
    grouped[seance.jour] = [...(grouped[seance.jour] ?? []), seance];
  }

  return grouped;
}

/** Amplitude horaire couvrant toutes les séances, arrondie à l'heure. */
export function hourWindow(seances: Seance[]): HourWindow {
  let startMinute = DEFAULT_START_MINUTE;
  let endMinute = DEFAULT_END_MINUTE;

  for (const seance of seances) {
    startMinute = Math.min(startMinute, floorToHour(minutesOf(seance.debut)));
    endMinute = Math.max(endMinute, ceilToHour(minutesOf(seance.fin)));
  }

  const hours = [];
  for (let hour = startMinute / MINUTES_PER_HOUR; hour < endMinute / MINUTES_PER_HOUR; hour += 1) {
    hours.push(hour);
  }

  return {
    startMinute,
    endMinute,
    hours,
    slotCount: (endMinute - startMinute) / SLOT_MINUTES,
  };
}

export type LaneAssignment = {
  seance: Seance;
  /** Couloir horizontal, pour les séances qui se chevauchent. */
  lane: number;
  laneCount: number;
};

/**
 * Répartit en couloirs les séances d'une même journée : l'ENT laisse passer des
 * créneaux qui se recouvrent, et les empiler les rendrait illisibles.
 */
export function assignLanes(seances: Seance[]): LaneAssignment[] {
  const bounds = seances.map((seance) => ({
    seance,
    debut: minutesOf(seance.debut),
    fin: minutesOf(seance.fin),
  }));

  const lanes: number[] = [];
  const assignments: LaneAssignment[] = [];
  let groupStart = 0;
  let groupEnd = -Infinity;

  const closeGroup = (until: number) => {
    const laneCount = Math.max(1, new Set(lanes.slice(groupStart, until)).size);
    for (let index = groupStart; index < until; index += 1) {
      assignments[index] = { ...assignments[index], laneCount };
    }
  };

  bounds.forEach((item, index) => {
    // Un groupe = une chaîne de séances qui se chevauchent de proche en proche.
    if (index > 0 && item.debut >= groupEnd) {
      closeGroup(index);
      groupStart = index;
      groupEnd = -Infinity;
    }

    const lane = firstFreeLane(bounds, lanes, index);
    lanes[index] = lane;
    groupEnd = Math.max(groupEnd, item.fin);
    assignments[index] = { seance: item.seance, lane, laneCount: 1 };
  });

  closeGroup(bounds.length);
  return assignments;
}

export type WeekPlacement = LaneAssignment & {
  /** Colonne, 0 = lundi. */
  dayIndex: number;
  /** Rangée de départ, base 1 comme en CSS Grid. */
  startSlot: number;
  slotSpan: number;
};

/**
 * Place les séances d'une semaine sur la grille.
 * Les séances hors de la fenêtre ou hors des jours affichés sont ignorées.
 */
export function placeWeek(
  seances: Seance[],
  dayKeys: string[],
  window: HourWindow,
): WeekPlacement[] {
  const parJour = groupByDay(seances);

  return dayKeys.flatMap((dayKey, dayIndex) =>
    assignLanes(parJour[dayKey] ?? []).map((assignment) => {
      const debut = clamp(minutesOf(assignment.seance.debut), window);
      const fin = clamp(minutesOf(assignment.seance.fin), window);

      return {
        ...assignment,
        dayIndex,
        startSlot: Math.floor((debut - window.startMinute) / SLOT_MINUTES) + 1,
        slotSpan: Math.max(1, Math.round((fin - debut) / SLOT_MINUTES)),
      };
    }),
  );
}

/** Position de l'instant `date` dans la fenêtre, en pourcentage, ou `null`. */
export function positionInWindow(date: Date, window: HourWindow): number | null {
  const minute = minutesDepuisMinuit(date);
  if (minute < window.startMinute || minute > window.endMinute) return null;

  return ((minute - window.startMinute) / (window.endMinute - window.startMinute)) * 100;
}

/** Premier couloir libre parmi les séances chevauchant celle d'indice `index`. */
function firstFreeLane(
  bounds: { debut: number; fin: number }[],
  lanes: number[],
  index: number,
): number {
  const current = bounds[index];
  const busy = new Set<number>();

  for (let other = 0; other < index; other += 1) {
    const overlaps = bounds[other].fin > current.debut && bounds[other].debut < current.fin;
    if (overlaps) busy.add(lanes[other]);
  }

  let lane = 0;
  while (busy.has(lane)) lane += 1;
  return lane;
}

function minutesOf(iso: string): number {
  return minutesDepuisMinuit(new Date(iso));
}

function clamp(minute: number, window: HourWindow): number {
  return Math.min(Math.max(minute, window.startMinute), window.endMinute);
}

function floorToHour(minute: number): number {
  return Math.floor(minute / MINUTES_PER_HOUR) * MINUTES_PER_HOUR;
}

function ceilToHour(minute: number): number {
  return Math.ceil(minute / MINUTES_PER_HOUR) * MINUTES_PER_HOUR;
}
