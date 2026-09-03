/**
 * Utilitaires de dates pour l'emploi du temps.
 *
 * L'ENT renvoie des dates "naïves" (`"2026-09-01T09:00:00"`) : pas de suffixe `Z`,
 * pas d'offset. Elles sont exprimées en heure locale française. `new Date(s)` les
 * interpréterait dans le fuseau du process — donc décalées de 2h si le serveur
 * tourne en UTC (cas Vercel). Tout passe donc par `parseEntDateTime()`.
 */

export const TIME_ZONE = "Europe/Paris";

/** Un jour calendaire au format `YYYY-MM-DD`, utilisé comme identité de journée. */
export type DayKey = string;

const NAIVE_DATE_TIME =
  /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/;

const PARTS_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  hour12: false,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

type WallClock = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

/** Décalage (ms) entre l'heure murale parisienne et UTC à un instant donné. */
function zoneOffsetMs(instantMs: number): number {
  const parts = PARTS_FORMATTER.formatToParts(new Date(instantMs));
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? "0");

  const asUtc = Date.UTC(
    read("year"),
    read("month") - 1,
    read("day"),
    read("hour") === 24 ? 0 : read("hour"),
    read("minute"),
    read("second"),
  );

  return asUtc - instantMs;
}

/** Convertit une heure murale parisienne en instant absolu. */
function wallClockToInstant(wall: WallClock): Date {
  const naiveUtc = Date.UTC(
    wall.year,
    wall.month - 1,
    wall.day,
    wall.hour,
    wall.minute,
    wall.second,
  );

  // Première approximation, puis une passe de correction pour les jours de
  // changement d'heure où l'offset diffère de part et d'autre de l'estimation.
  const firstGuess = naiveUtc - zoneOffsetMs(naiveUtc);
  return new Date(naiveUtc - zoneOffsetMs(firstGuess));
}

/** Décompose un instant en heure murale parisienne. */
export function toWallClock(date: Date): WallClock {
  const parts = PARTS_FORMATTER.formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? "0");

  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    hour: read("hour") === 24 ? 0 : read("hour"),
    minute: read("minute"),
    second: read("second"),
  };
}

/**
 * Parse une date naïve de l'ENT en l'interprétant à Paris.
 * Retourne `null` si la chaîne n'a pas la forme attendue — l'appelant décide.
 */
export function parseEntDateTime(raw: string): Date | null {
  const match = NAIVE_DATE_TIME.exec(raw.trim());
  if (!match) return null;

  return wallClockToInstant({
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
    second: Number(match[6] ?? "0"),
  });
}

/** Parse un jour `YYYY-MM-DD` (minuit à Paris). */
export function parseDayKey(raw: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  return parseEntDateTime(`${raw}T00:00:00`);
}

/** Identité de journée `YYYY-MM-DD` telle que vue à Paris. */
export function toDayKey(date: Date): DayKey {
  const { year, month, day } = toWallClock(date);
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** `"09:00"` — heure murale parisienne. */
export function formatHeure(date: Date): string {
  const { hour, minute } = toWallClock(date);
  return `${pad(hour)}:${pad(minute)}`;
}

/** Position en minutes depuis minuit, base du placement dans la colonne horaire. */
export function minutesDepuisMinuit(date: Date): number {
  const { hour, minute } = toWallClock(date);
  return hour * 60 + minute;
}

export function addDays(date: Date, days: number): Date {
  const wall = toWallClock(date);
  return wallClockToInstant({ ...wall, day: wall.day + days });
}

/** Lundi de la semaine contenant `date` (minuit à Paris). */
export function startOfWeek(date: Date): Date {
  const dayKey = toDayKey(date);
  const midnight = parseDayKey(dayKey);
  if (!midnight) return date;

  // getUTCDay sur l'instant de minuit parisien donnerait le mauvais jour :
  // on repart du jour calendaire, dont le "jour de la semaine" est stable.
  const [year, month, day] = dayKey.split("-").map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  const offsetToMonday = weekday === 0 ? -6 : 1 - weekday;

  return addDays(midnight, offsetToMonday);
}

/** Les `count` jours consécutifs à partir de `start`. */
export function daysFrom(start: Date, count: number): Date[] {
  return Array.from({ length: count }, (_, index) => addDays(start, index));
}

/** `"lun."`, `"mar."`… */
export function formatJourCourt(date: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: TIME_ZONE,
    weekday: "short",
  })
    .format(date)
    .replace(".", "");
}

/** `"lundi 1 septembre"` */
export function formatJourLong(date: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: TIME_ZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);
}

/** `"1 – 5 septembre 2026"` pour l'en-tête de semaine. */
export function formatPlageSemaine(lundi: Date, vendredi: Date): string {
  const debut = toWallClock(lundi);
  const fin = toWallClock(vendredi);
  const mois = (date: Date) =>
    new Intl.DateTimeFormat("fr-FR", { timeZone: TIME_ZONE, month: "long" }).format(date);

  if (debut.month === fin.month) {
    return `${debut.day} – ${fin.day} ${mois(vendredi)} ${fin.year}`;
  }
  return `${debut.day} ${mois(lundi)} – ${fin.day} ${mois(vendredi)} ${fin.year}`;
}

/** Numéro du jour dans le mois, pour le bandeau semaine. */
export function numeroJour(date: Date): number {
  return toWallClock(date).day;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** Plage couvrant la semaine de `date` : du lundi 00:00 au lundi suivant. */
export function weekRange(date: Date): { from: Date; to: Date } {
  const from = startOfWeek(date);
  return { from, to: addDays(from, 7) };
}

/** Jours ouvrés de la semaine de `date` (lundi → vendredi). */
export function weekDays(date: Date): Date[] {
  return daysFrom(startOfWeek(date), 5);
}

/** `"septembre 2026"` — en-tête de la grille hebdomadaire. */
export function formatMoisAnnee(date: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: TIME_ZONE,
    month: "long",
    year: "numeric",
  }).format(date);
}
