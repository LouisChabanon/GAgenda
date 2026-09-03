/**
 * Client ENT — portail ASP.NET MVC.
 *
 * Deux requêtes POST portent tout le fonctionnement :
 *  1. `POST ENT_LOGIN_POST_PATH` (`/User/LoginPost?ReturnUrl=/`) authentifie et
 *     pose le cookie `.AspNet.ApplicationCookie` ;
 *  2. `POST ENT_CALENDAR_PATH` (`/Calendar/LoadEvents`) renvoie les séances
 *     en JSON.
 *
 * Contraintes qui structurent le code :
 *  - runtime Node obligatoire (`export const runtime = "nodejs"` côté route) ;
 *  - `fetch` ne tient aucun cookie jar : on lit `Set-Cookie` et on rejoue
 *    l'en-tête `Cookie` à la main, avec `redirect: "manual"` pour ne pas perdre
 *    les cookies posés au fil des 302 ;
 *  - jeton anti-CSRF `__RequestVerificationToken` à extraire de la page de login
 *    et à renvoyer avec son cookie jumeau ;
 *  - erreurs typées (`EntAuthError` / `EntUnavailableError`) ;
 *  - aucun log des identifiants, même en développement.
 */

import { entUrl, getEntConfig, type EntConfig } from "./config";
import { entDebug, redact, redactExcerpt, redactIdentity, startTrace } from "./debug";
import { EntAuthError, EntUnavailableError } from "./errors";
import type { DateRange, EntCredentials, EntSeance, EntSession } from "./types";

const USER_AGENT =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

const REQUEST_TIMEOUT_MS = 15_000;

/* -------------------------------------------------------------------------- */
/* Cookies                                                                     */
/* -------------------------------------------------------------------------- */

type CookieJar = Map<string, string>;

/** Absorbe les `Set-Cookie` d'une réponse dans le bocal. */
export function collectCookies(jar: CookieJar, response: Response): CookieJar {
  for (const raw of response.headers.getSetCookie()) {
    const [pair] = raw.split(";");
    const separator = pair.indexOf("=");
    if (separator <= 0) continue;

    const name = pair.slice(0, separator).trim();
    const value = pair.slice(separator + 1).trim();
    // Une valeur vide signifie une suppression côté serveur.
    if (value === "") jar.delete(name);
    else jar.set(name, value);
  }
  return jar;
}

/** Sérialise le bocal en en-tête `Cookie`. */
export function serializeCookies(jar: CookieJar): string {
  return Array.from(jar, ([name, value]) => `${name}=${value}`).join("; ");
}

/* -------------------------------------------------------------------------- */
/* Anti-forgery ASP.NET MVC                                                    */
/* -------------------------------------------------------------------------- */

export const ANTIFORGERY_FIELD = "__RequestVerificationToken";

const HIDDEN_INPUT = /<input[^>]*type=["']hidden["'][^>]*>/gi;
const ATTR = (name: string) => new RegExp(`\\b${name}=["']([^"']*)["']`, "i");

/** Extrait tous les champs cachés d'un formulaire. */
export function extractHiddenFields(html: string): Record<string, string> {
  const fields: Record<string, string> = {};

  for (const input of html.match(HIDDEN_INPUT) ?? []) {
    const name = ATTR("name").exec(input)?.[1];
    if (!name) continue;
    fields[name] = ATTR("value").exec(input)?.[1] ?? "";
  }

  return fields;
}

/**
 * Jeton anti-CSRF d'ASP.NET MVC, posé dans un champ caché de la page de login.
 *
 * Il fonctionne en paire avec le cookie `__RequestVerificationToken` reçu sur la
 * même réponse : les deux doivent être renvoyés ensemble, sinon le serveur
 * répond « The required anti-forgery cookie is not present ». Le cookie est
 * repris automatiquement par le bocal, il n'y a que le champ à extraire ici.
 */
export function extractVerificationToken(html: string): string | null {
  return extractHiddenFields(html)[ANTIFORGERY_FIELD] ?? null;
}

/* -------------------------------------------------------------------------- */
/* Requêtes                                                                    */
/* -------------------------------------------------------------------------- */

type EntRequestInit = {
  method?: "GET" | "POST";
  jar: CookieJar;
  body?: URLSearchParams;
  headers?: Record<string, string>;
  /** Suit les 3xx en collectant les cookies de chaque étape. */
  follow?: boolean;
};

const MAX_REDIRECTS = 5;

function isRedirect(response: Response): boolean {
  return response.status >= 300 && response.status < 400;
}

/** Une requête, sans suivi de redirection. Les cookies reçus vont au bocal. */
async function rawFetch(url: string, init: EntRequestInit): Promise<Response> {
  const cookie = serializeCookies(init.jar);
  const method = init.method ?? "GET";
  const startedAt = Date.now();

  entDebug("http:requête", {
    method,
    url,
    // Noms seulement : les valeurs de cookies sont des secrets de session.
    cookies: [...init.jar.keys()],
    champs: init.body ? [...new Set([...init.body.keys()])] : [],
  });

  let response: Response;
  try {
    response = await fetch(url, {
      method: init.method ?? "GET",
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
        "Accept-Language": "fr-FR,fr;q=0.9",
        ...(init.body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
        ...(cookie ? { Cookie: cookie } : {}),
        ...init.headers,
      },
      body: init.body,
    });
  } catch (cause) {
    entDebug("http:échec", {
      method,
      url,
      ms: Date.now() - startedAt,
      cause: cause instanceof Error ? cause.message : String(cause),
    });
    throw new EntUnavailableError("L'ENT n'a pas répondu dans les temps.", { cause });
  }

  const recus = response.headers.getSetCookie().map((raw) => raw.split("=")[0]);
  entDebug("http:réponse", {
    method,
    url,
    status: response.status,
    ms: Date.now() - startedAt,
    "set-cookie": recus,
    location: response.headers.get("location"),
    type: response.headers.get("content-type"),
  });

  collectCookies(init.jar, response);
  return response;
}

/**
 * `fetch` vers l'ENT : cookies gérés à la main, redirections suivies pas à pas.
 *
 * Le suivi manuel n'est pas un détail de confort. `GET /` répond 302 vers
 * `/login`, et c'est la page d'arrivée — pas la redirection — qui pose le cookie
 * `__RequestVerificationToken`. Un `redirect: "follow"` natif masquerait les
 * `Set-Cookie` intermédiaires, et un `"manual"` sans suivi rendrait un corps
 * vide, donc aucun jeton à extraire.
 */
async function entFetch(url: string, init: EntRequestInit): Promise<Response> {
  let response = await rawFetch(url, init);
  let current = url;

  if (!init.follow) return response;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    if (!isRedirect(response)) return response;

    const location = response.headers.get("location");
    // Une 3xx sans `Location` n'est pas une boucle : on rend la réponse telle
    // quelle et l'appelant échouera avec un message qui décrit ce qu'il attendait.
    if (!location) return response;

    if (hop === MAX_REDIRECTS) break;

    current = new URL(location, current).toString();
    entDebug("http:redirection", { saut: hop + 1, vers: current });
    // Comme un navigateur : une redirection se rejoue en GET, sans corps.
    response = await rawFetch(current, { jar: init.jar, headers: init.headers });
  }

  throw new EntUnavailableError("Trop de redirections sur l'ENT.");
}

/* -------------------------------------------------------------------------- */
/* Authentification                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Authentifie et retourne le cookie de session.
 *
 * Séquence :
 *   1. GET  `ENT_LOGIN_PAGE_PATH`  → cookie anti-forgery + jeton du champ caché
 *   2. POST `ENT_LOGIN_POST_PATH`  → `UserName`, `Password`,
 *                                    `__RequestVerificationToken`
 *
 * Le jeton et le cookie du même nom forment une paire : envoyer l'un sans
 * l'autre fait échouer la validation anti-CSRF côté serveur.
 */
export async function loginToEnt(
  credentials: EntCredentials,
  config: EntConfig = getEntConfig(),
): Promise<EntSession> {
  const jar: CookieJar = new Map();

  startTrace();
  entDebug("login:début", {
    base: config.baseUrl,
    page: config.loginPagePath,
    post: config.loginPostPath,
    utilisateur: redactIdentity(credentials.username),
  });

  // 1. Page de login. On suit les redirections : le cookie anti-forgery et le
  //    champ caché ne sont posés que sur la page d'arrivée.
  const loginPage = await entFetch(entUrl(config, config.loginPagePath), {
    jar,
    follow: true,
  });
  const html = await safeText(loginPage);
  const token = extractVerificationToken(html);

  entDebug("login:jeton", {
    trouvé: token !== null,
    jeton: redact(token),
    "champs-cachés": Object.keys(extractHiddenFields(html)),
    "octets-page": html.length,
  });

  if (!token) {
    throw new EntUnavailableError(
      "Jeton anti-CSRF introuvable sur la page de connexion de l'ENT.",
    );
  }

  // 2. Soumission des identifiants.
  const response = await entFetch(entUrl(config, config.loginPostPath), {
    method: "POST",
    jar,
    body: new URLSearchParams({
      UserName: credentials.username,
      Password: credentials.password,
      [ANTIFORGERY_FIELD]: token,
    }),
    headers: {
      Referer: entUrl(config, config.loginPagePath),
      Origin: config.baseUrl,
    },
  });

  if (response.status >= 500) {
    entDebug("login:panne", { status: response.status });
    throw new EntUnavailableError(`L'ENT a répondu ${response.status}.`);
  }

  // Succès = pose d'un cookie d'authentification. Un échec redirige vers
  // `/login?Err=True` sans ce cookie — le statut seul ne distingue pas les deux.
  const authentifié = hasAuthCookie(jar);
  entDebug("login:résultat", {
    authentifié,
    status: response.status,
    location: response.headers.get("location"),
    cookies: [...jar.keys()],
  });

  if (!authentifié) {
    throw new EntAuthError();
  }

  return {
    cookie: serializeCookies(jar),
    expiresAt: Date.now() + config.sessionTtlSeconds * 1000,
  };
}

/**
 * Le cookie d'authentification ASP.NET commence par un point :
 * `.AspNet.ApplicationCookie` sur ce portail, `.ASPXAUTH` sur les plus anciens.
 *
 * Ce préfixe est le seul discriminant fiable : dès le GET de la page de login,
 * le serveur pose déjà `ASP.NET_SessionId`, `ARRAffinity`, `_culture` et
 * `__RequestVerificationToken`. Compter « un cookie de plus que l'anti-forgery »
 * prendrait donc un échec d'authentification pour un succès.
 */
function hasAuthCookie(jar: CookieJar): boolean {
  for (const name of jar.keys()) {
    if (name.startsWith(".")) return true;
  }
  return false;
}

/* -------------------------------------------------------------------------- */
/* Calendrier                                                                  */
/* -------------------------------------------------------------------------- */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Reconstruit un bocal à partir de l'en-tête `Cookie` mémorisé dans la session. */
function jarFromCookieHeader(cookie: string): CookieJar {
  const jar: CookieJar = new Map();

  for (const pair of cookie.split("; ")) {
    const separator = pair.indexOf("=");
    if (separator > 0) jar.set(pair.slice(0, separator), pair.slice(separator + 1));
  }

  return jar;
}

/**
 * Nombre de jours couverts par la plage.
 * Arrondi : une semaine de changement d'heure fait 167 ou 169 heures, et doit
 * malgré tout valoir 7 jours.
 */
export function durationInDays(range: DateRange): number {
  return Math.max(1, Math.round((range.to.getTime() - range.from.getTime()) / MS_PER_DAY));
}

/**
 * Récupère les séances sur une plage de dates.
 *
 * `POST /Calendar/LoadEvents` prend `start` (instant ISO UTC du premier jour,
 * soit minuit heure de Paris) et `duration` (nombre de jours), et renvoie
 * directement le tableau JSON des séances.
 *
 * Tous les cookies de la session sont rejoués tels quels, y compris ceux qui ne
 * portent pas l'authentification : `ASP.NET_SessionId`, et surtout `ARRAffinity`
 * qui épingle la requête sur l'instance Azure où la session existe. Les omettre
 * ferait retomber sur un autre backend, donc sur une session inconnue.
 */
export async function fetchSeances(
  session: EntSession,
  range: DateRange,
  config: EntConfig = getEntConfig(),
): Promise<EntSeance[]> {
  const jar = jarFromCookieHeader(session.cookie);
  const duration = durationInDays(range);

  startTrace();
  entDebug("calendrier:début", {
    url: entUrl(config, config.calendarPath),
    start: range.from.toISOString(),
    duration,
    cookies: [...jar.keys()],
  });

  const body = new URLSearchParams({
    start: range.from.toISOString(),
    duration: String(duration),
  });

  const response = await entFetch(entUrl(config, config.calendarPath), {
    method: "POST",
    jar,
    body,
    headers: {
      Accept: "application/json, text/javascript, */*; q=0.01",
      "X-Requested-With": "XMLHttpRequest",
      Referer: config.baseUrl + "/",
      Origin: config.baseUrl,
    },
  });

  // Une session expirée se traduit par une redirection vers la page de login,
  // pas par un 401 : c'est le signal qu'il faut rejouer `loginToEnt()`.
  if (isRedirect(response)) {
    entDebug("calendrier:session-expirée", {
      status: response.status,
      location: response.headers.get("location"),
    });
    throw new EntAuthError("Session ENT expirée.");
  }
  if (!response.ok) {
    entDebug("calendrier:panne", { status: response.status });
    throw new EntUnavailableError(`L'ENT a répondu ${response.status}.`);
  }

  const brut = await safeText(response);
  const payload = parseJson(brut);

  if (!Array.isArray(payload)) {
    entDebug("calendrier:réponse-inattendue", {
      "octets-reçus": brut.length,
      // Un extrait suffit à reconnaître une page de login renvoyée à la place
      // du JSON, sans déverser la réponse entière ni les jetons qu'elle porte.
      extrait: redactExcerpt(brut),
    });
    throw new EntUnavailableError("Réponse calendrier inattendue (JSON non tabulaire).");
  }

  entDebug("calendrier:résultat", { séances: payload.length });

  return payload as EntSeance[];
}

/* -------------------------------------------------------------------------- */

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function safeText(response: Response): Promise<string> {
  try {
    return await response.clone().text();
  } catch {
    return "";
  }
}
