import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import type { EntSeance, EntSession } from "./types";

const CREDENTIALS = { username: "louis", password: "secret" };

const SEMAINE = {
  from: new Date("2026-08-30T22:00:00.000Z"),
  to: new Date("2026-09-06T22:00:00.000Z"),
};

const SESSION: EntSession = { cookie: ".AspNet.ApplicationCookie=x", expiresAt: 0 };

const SEANCE: EntSeance = {
  Id: "1",
  IsSeance: true,
  DisplayTempoLink: false,
  Debut: "2026-08-31T09:00:00",
  Fin: "2026-08-31T11:00:00",
  Planification: "Thermodynamique (CM)\r\n<br />\r\nSalle A3\r\n",
  AssignmentColor: null,
  BorderColor: "#00875A",
  TextColor: null,
  Type: "Cours",
  Description: "",
  CommentaireExterne: "",
};

const loginToEnt = vi.fn();
const fetchSeances = vi.fn();

vi.mock("./client", () => ({
  loginToEnt: (...args: unknown[]) => loginToEnt(...args),
  fetchSeances: (...args: unknown[]) => fetchSeances(...args),
}));

/**
 * Le service garde un cache de sessions en mémoire : on recharge le module à
 * chaque test pour repartir à vide. Les erreurs viennent du même registre, sans
 * quoi les `instanceof` compareraient deux classes homonymes distinctes.
 */
async function loadService() {
  vi.resetModules();
  const [service, errors] = await Promise.all([
    import("./service"),
    import("./errors"),
  ]);
  return { ...service, ...errors };
}

beforeEach(() => {
  vi.stubEnv("ENT_MOCK", "");
  vi.stubEnv("ENT_BASE_URL", "https://ent.exemple.fr");
  vi.stubEnv("ENT_LOGIN_PAGE_PATH", "/login?ReturnUrl=/");
  vi.stubEnv("ENT_LOGIN_POST_PATH", "/User/LoginPost?ReturnUrl=/");
  vi.stubEnv("ENT_CALENDAR_PATH", "/Calendar/LoadEvents");

  loginToEnt.mockReset().mockResolvedValue({ ...SESSION, expiresAt: Date.now() + 900_000 });
  fetchSeances.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getSeances", () => {
  test("authentifie puis normalise les séances", async () => {
    const { getSeances } = await loadService();
    fetchSeances.mockResolvedValue([SEANCE]);

    const seances = await getSeances(CREDENTIALS, SEMAINE);

    expect(loginToEnt).toHaveBeenCalledTimes(1);
    expect(seances).toHaveLength(1);
    expect(seances[0].matiere).toBe("Thermodynamique");
  });

  test("réutilise la session en cache d'un appel à l'autre", async () => {
    const { getSeances } = await loadService();
    fetchSeances.mockResolvedValue([SEANCE]);

    await getSeances(CREDENTIALS, SEMAINE);
    await getSeances(CREDENTIALS, SEMAINE);

    expect(loginToEnt).toHaveBeenCalledTimes(1);
    expect(fetchSeances).toHaveBeenCalledTimes(2);
  });

  test("se ré-authentifie une fois quand l'ENT refuse la session", async () => {
    const { getSeances, EntAuthError } = await loadService();
    fetchSeances
      .mockRejectedValueOnce(new EntAuthError("Session ENT expirée."))
      .mockResolvedValueOnce([SEANCE]);

    const seances = await getSeances(CREDENTIALS, SEMAINE);

    expect(loginToEnt).toHaveBeenCalledTimes(2);
    expect(seances).toHaveLength(1);
  });

  test("désigne ENT_CALENDAR_PATH quand le refus persiste après reconnexion", async () => {
    // Symptôme réel : une route inexistante redirige vers /Login exactement
    // comme une session expirée. Deux refus d'affilée trahissent le chemin.
    const { getSeances, EntAuthError, EntUnavailableError } = await loadService();
    fetchSeances.mockRejectedValue(new EntAuthError("Session ENT expirée."));

    const echec = getSeances(CREDENTIALS, SEMAINE);

    await expect(echec).rejects.toBeInstanceOf(EntUnavailableError);
    await expect(echec).rejects.toThrow(/ENT_CALENDAR_PATH[^]*\/Calendar\/LoadEvents/);
    expect(loginToEnt).toHaveBeenCalledTimes(2);
  });

  test("laisse remonter une panne de l'ENT sans re-tenter", async () => {
    const { getSeances, EntUnavailableError } = await loadService();
    fetchSeances.mockRejectedValue(new EntUnavailableError("L'ENT a répondu 503."));

    await expect(getSeances(CREDENTIALS, SEMAINE)).rejects.toThrow(/503/);
    expect(loginToEnt).toHaveBeenCalledTimes(1);
  });

  test("n'appelle pas l'ENT en mode maquette", async () => {
    vi.stubEnv("ENT_MOCK", "1");
    const { getSeances } = await loadService();

    const seances = await getSeances(CREDENTIALS, SEMAINE);

    expect(loginToEnt).not.toHaveBeenCalled();
    expect(fetchSeances).not.toHaveBeenCalled();
    expect(seances.length).toBeGreaterThan(0);
  });
});
