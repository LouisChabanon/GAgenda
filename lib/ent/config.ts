/**
 * Cibles réseau de l'ENT. Aucune URL n'est écrite en dur : l'ENT visé dépend de
 * l'école et les chemins ASP.NET changent d'une version à l'autre.
 */

export type EntConfig = {
  baseUrl: string;
  loginPagePath: string;
  loginPostPath: string;
  calendarPath: string;
  /** Durée de validité supposée du cookie ASP.NET, en secondes. */
  sessionTtlSeconds: number;
  /** `true` : les séances viennent de la fixture locale, l'ENT n'est pas appelé. */
  mock: boolean;
};

const REQUIRED = [
  "ENT_BASE_URL",
  "ENT_LOGIN_PAGE_PATH",
  "ENT_LOGIN_POST_PATH",
  "ENT_CALENDAR_PATH",
] as const;

const DEFAULT_SESSION_TTL_SECONDS = 15 * 60;

export function isMockMode(): boolean {
  return process.env.ENT_MOCK === "1";
}

/**
 * Lit et valide la configuration. Échoue immédiatement si une variable manque,
 * plutôt que de partir en requête vers `undefined/...`.
 */
export function getEntConfig(): EntConfig {
  const mock = isMockMode();
  const missing = REQUIRED.filter((key) => !process.env[key]?.trim());

  if (missing.length > 0 && !mock) {
    throw new Error(
      `Configuration ENT incomplète : ${missing.join(", ")} manquante(s) dans .env.local (voir .env.example).`,
    );
  }

  const ttl = Number(process.env.ENT_SESSION_TTL_SECONDS);

  return {
    baseUrl: stripTrailingSlash(process.env.ENT_BASE_URL ?? "https://ent.invalid"),
    loginPagePath: process.env.ENT_LOGIN_PAGE_PATH ?? "/login?ReturnUrl=/",
    loginPostPath: process.env.ENT_LOGIN_POST_PATH ?? "/User/LoginPost?ReturnUrl=/",
    calendarPath: process.env.ENT_CALENDAR_PATH ?? "/Calendar/LoadEvents",
    sessionTtlSeconds:
      Number.isFinite(ttl) && ttl > 0 ? ttl : DEFAULT_SESSION_TTL_SECONDS,
    mock,
  };
}

/** Construit une URL absolue vers l'ENT à partir d'un chemin configuré. */
export function entUrl(config: EntConfig, path: string): string {
  return new URL(path, `${config.baseUrl}/`).toString();
}

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}
