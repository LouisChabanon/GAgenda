/**
 * Couche métier entre l'application et le scraper.
 *
 * Elle porte la mécanique qui fait tenir la session sur la durée : seuls les
 * identifiants (chiffrés) vivent dans le cookie du navigateur, tandis que le
 * cookie ASP.NET est gardé en mémoire côté serveur et re-négocié silencieusement
 * dès qu'il expire.
 */

import "server-only";

import { createHash } from "node:crypto";

import { startOfWeek, toDayKey } from "@/lib/date";
import { fetchSeances, loginToEnt } from "./client";
import { getEntConfig } from "./config";
import { entDebug } from "./debug";
import { EntAuthError, EntUnavailableError } from "./errors";
import { normalizeSeances } from "./parse";
import fixture from "./__fixtures__/seances.json";
import type {
  DateRange,
  EntCredentials,
  EntSeance,
  EntSession,
  Seance,
} from "./types";

/**
 * Cache de sessions ASP.NET. En mémoire du process : une perte au redéploiement
 * coûte une simple re-authentification, invisible pour l'utilisateur.
 */
const sessions = new Map<string, EntSession>();

function cacheKey(credentials: EntCredentials): string {
  return createHash("sha256")
    .update(`${credentials.username} ${credentials.password}`)
    .digest("hex");
}

async function getSession(
  credentials: EntCredentials,
  { force = false }: { force?: boolean } = {},
): Promise<EntSession> {
  const key = cacheKey(credentials);
  const cached = sessions.get(key);
  const valide = cached !== undefined && cached.expiresAt > Date.now();

  entDebug("session:cache", {
    état: force ? "forcé" : valide ? "valide" : cached ? "expiré" : "absent",
    "reste-s": cached ? Math.round((cached.expiresAt - Date.now()) / 1000) : 0,
  });

  if (!force && valide) return cached;

  const session = await loginToEnt(credentials);
  sessions.set(key, session);
  entDebug("session:renouvelée", { "ttl-s": getEntConfig().sessionTtlSeconds });
  return session;
}

/** Oublie la session ASP.NET associée à ces identifiants (déconnexion). */
export function forgetSession(credentials: EntCredentials): void {
  sessions.delete(cacheKey(credentials));
}

/**
 * Valide des identifiants auprès de l'ENT. Utilisé au login pour ne poser le
 * cookie que si la connexion fonctionne réellement.
 */
export async function verifyCredentials(credentials: EntCredentials): Promise<void> {
  if (getEntConfig().mock) return;
  await getSession(credentials, { force: true });
}

/**
 * Séances normalisées sur une plage. Une session expirée (l'ENT redirige vers
 * la page de login au lieu de renvoyer un 401) déclenche une seule nouvelle
 * tentative après re-authentification.
 */
export async function getSeances(
  credentials: EntCredentials,
  range: DateRange,
): Promise<Seance[]> {
  entDebug("séances:demande", {
    du: range.from.toISOString(),
    au: range.to.toISOString(),
    mode: getEntConfig().mock ? "maquette" : "ENT",
  });

  if (getEntConfig().mock) {
    return normalise(mockSeances(range));
  }

  const session = await getSession(credentials);

  try {
    return normalise(await fetchSeances(session, range));
  } catch (error) {
    if (!(error instanceof EntAuthError)) throw error;

    entDebug("séances:nouvelle-tentative", { motif: "session refusée par l'ENT" });
    const renewed = await getSession(credentials, { force: true });

    try {
      return normalise(await fetchSeances(renewed, range));
    } catch (retryError) {
      if (!(retryError instanceof EntAuthError)) throw retryError;

      // Deux refus d'affilée juste après une authentification réussie : ce n'est
      // pas une session expirée. Le portail redirige de la même façon vers
      // `/Login` quand la route n'existe pas — c'est le symptôme d'un
      // `ENT_CALENDAR_PATH` erroné, pas d'un problème d'identifiants.
      entDebug("séances:échec-après-renouvellement", {
        chemin: getEntConfig().calendarPath,
      });
      throw new EntUnavailableError(
        `L'ENT refuse l'accès au calendrier juste après une connexion réussie : ` +
          `vérifie ENT_CALENDAR_PATH (actuellement ${getEntConfig().calendarPath}).`,
      );
    }
  }
}

/**
 * Normalise en signalant les séances écartées : une date illisible les fait
 * disparaître silencieusement de l'agenda, ce qui est indétectable côté UI.
 */
function normalise(brutes: EntSeance[]): Seance[] {
  const seances = normalizeSeances(brutes);

  entDebug("séances:normalisées", {
    reçues: brutes.length,
    retenues: seances.length,
    écartées: brutes.length - seances.length,
    jours: [...new Set(seances.map((seance) => seance.jour))],
  });

  return seances;
}

/* -------------------------------------------------------------------------- */
/* Mode maquette                                                               */
/* -------------------------------------------------------------------------- */

/** Lundi de la semaine couverte par la fixture. */
const FIXTURE_MONDAY = "2026-08-31";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Rejoue la fixture sur la semaine demandée, pour développer l'interface avant
 * que le scraper réel soit branché (`ENT_MOCK=1`).
 */
function mockSeances(range: DateRange): EntSeance[] {
  const offset = daysBetween(FIXTURE_MONDAY, toDayKey(startOfWeek(range.from)));

  return (fixture as EntSeance[]).map((seance) => ({
    ...seance,
    Debut: shiftNaiveDate(seance.Debut, offset),
    Fin: shiftNaiveDate(seance.Fin, offset),
  }));
}

function daysBetween(from: string, to: string): number {
  const asUtc = (key: string) => {
    const [year, month, day] = key.split("-").map(Number);
    return Date.UTC(year, month - 1, day);
  };
  return Math.round((asUtc(to) - asUtc(from)) / MS_PER_DAY);
}

/** Décale la partie date d'un horodatage naïf, sans toucher à l'heure murale. */
function shiftNaiveDate(naive: string, days: number): string {
  const [date, time] = naive.split("T");
  const [year, month, day] = date.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));

  return `${shifted.toISOString().slice(0, 10)}T${time}`;
}
