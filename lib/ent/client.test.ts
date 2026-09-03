import { afterEach, describe, expect, test, vi } from "vitest";

import {
  ANTIFORGERY_FIELD,
  collectCookies,
  durationInDays,
  extractHiddenFields,
  extractVerificationToken,
  fetchSeances,
  loginToEnt,
  serializeCookies,
} from "./client";
import type { EntConfig } from "./config";
import { EntAuthError, EntUnavailableError } from "./errors";

const CONFIG: EntConfig = {
  baseUrl: "https://ent.exemple.fr",
  loginPagePath: "/Login",
  loginPostPath: "/LoginPost?ReturnUrl=/",
  calendarPath: "/LoadEvents",
  sessionTtlSeconds: 900,
  mock: false,
};

const TOKEN = "CfDJ8Nf-jeton-anti-csrf_ABC123";

/**
 * Cookies posés dès le GET de la page de login, avant toute authentification :
 * aucun ne prouve quoi que ce soit sur la validité des identifiants.
 */
const COOKIES_PRE_AUTH = [
  `${ANTIFORGERY_FIELD}=cookie-jumeau; path=/; HttpOnly`,
  "_culture=en; path=/",
  "ASP.NET_SessionId=w1sgiwbq2gjk2rlzocqedoqm; path=/; HttpOnly",
  "ARRAffinity=308ac136635ceb04; path=/; HttpOnly",
  "ARRAffinitySameSite=308ac136635ceb04; path=/; SameSite=None",
];

const COOKIE_AUTH = ".AspNet.ApplicationCookie=8_49DMnhMUUmEgT; path=/; HttpOnly";

/** Page de login telle que la rend un portail ASP.NET MVC. */
const LOGIN_PAGE = `<!DOCTYPE html><html><body>
  <form action="/LoginPost?ReturnUrl=%2F" method="post">
    <input name="__RequestVerificationToken" type="hidden" value="${TOKEN}" />
    <input name="UserName" type="text" />
    <input name="Password" type="password" />
  </form>
</body></html>`;

function response(
  body: string,
  { status = 200, cookies = [] as string[], location = "" } = {},
): Response {
  const headers = new Headers();
  for (const cookie of cookies) headers.append("set-cookie", cookie);
  if (location) headers.set("location", location);
  return new Response(body, { status, headers });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("extractHiddenFields", () => {
  test("relève les champs cachés en ignorant les champs visibles", () => {
    expect(extractHiddenFields(LOGIN_PAGE)).toEqual({
      [ANTIFORGERY_FIELD]: TOKEN,
    });
  });

  test("accepte les attributs dans le désordre et les guillemets simples", () => {
    const html = `<input value='v1' type='hidden' name='__RequestVerificationToken'>`;
    expect(extractVerificationToken(html)).toBe("v1");
  });

  test("retourne null quand le jeton est absent", () => {
    expect(extractVerificationToken("<html><body>rien</body></html>")).toBeNull();
  });
});

describe("cookies", () => {
  test("absorbe les Set-Cookie et les resérialise en en-tête Cookie", () => {
    const jar = collectCookies(
      new Map(),
      response("", {
        cookies: [
          "__RequestVerificationToken=abc; path=/; HttpOnly",
          ".ASPXAUTH=xyz; path=/; HttpOnly; secure",
        ],
      }),
    );

    expect(serializeCookies(jar)).toBe(
      "__RequestVerificationToken=abc; .ASPXAUTH=xyz",
    );
  });

  test("retire un cookie que le serveur vide", () => {
    const jar = collectCookies(new Map(), response("", { cookies: [".ASPXAUTH=xyz"] }));
    collectCookies(jar, response("", { cookies: [".ASPXAUTH=; expires=Thu, 01 Jan 1970"] }));

    expect(serializeCookies(jar)).toBe("");
  });
});

describe("loginToEnt", () => {
  test("envoie identifiants et jeton, et retourne le cookie de session", async () => {
    const appels: { url: string; init: RequestInit }[] = [];

    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      appels.push({ url, init });

      if (appels.length === 1) {
        return response(LOGIN_PAGE, { cookies: COOKIES_PRE_AUTH });
      }
      // Succès : 302 vers ReturnUrl + cookie d'authentification.
      return response("", { status: 302, cookies: [COOKIE_AUTH] });
    });

    const session = await loginToEnt(
      { username: "louis", password: "secret" },
      CONFIG,
    );

    expect(appels[0].url).toBe("https://ent.exemple.fr/Login");
    expect(appels[1].url).toBe("https://ent.exemple.fr/LoginPost?ReturnUrl=/");

    const body = new URLSearchParams(appels[1].init.body as string);
    expect(body.get("UserName")).toBe("louis");
    expect(body.get("Password")).toBe("secret");
    expect(body.get(ANTIFORGERY_FIELD)).toBe(TOKEN);

    // Le cookie anti-forgery doit accompagner son jeton, sinon ASP.NET refuse.
    const headers = new Headers(appels[1].init.headers);
    expect(headers.get("cookie")).toContain(`${ANTIFORGERY_FIELD}=cookie-jumeau`);

    expect(session.cookie).toContain(".AspNet.ApplicationCookie=8_49DMnhMUUmEgT");
    // L'affinité Azure doit survivre dans la session, sinon les requêtes
    // suivantes peuvent atterrir sur une autre instance.
    expect(session.cookie).toContain("ARRAffinity=308ac136635ceb04");
    expect(session.expiresAt).toBeGreaterThan(Date.now());
  });

  test("signale des identifiants refusés malgré les cookies de session posés d'office", async () => {
    // Le portail re-sert la page de login en 200 en conservant ASP.NET_SessionId,
    // ARRAffinity et l'anti-forgery : seul l'absence de cookie `.AspNet…` trahit
    // l'échec.
    vi.stubGlobal("fetch", async () =>
      response(LOGIN_PAGE, { cookies: COOKIES_PRE_AUTH }),
    );

    await expect(
      loginToEnt({ username: "louis", password: "faux" }, CONFIG),
    ).rejects.toBeInstanceOf(EntAuthError);
  });

  test("distingue une panne de l'ENT d'un refus d'identifiants", async () => {
    let appel = 0;
    vi.stubGlobal("fetch", async () => {
      appel += 1;
      return appel === 1 ? response(LOGIN_PAGE) : response("", { status: 503 });
    });

    await expect(
      loginToEnt({ username: "louis", password: "secret" }, CONFIG),
    ).rejects.toBeInstanceOf(EntUnavailableError);
  });

  test("échoue clairement si la page de login ne porte pas de jeton", async () => {
    vi.stubGlobal("fetch", async () => response("<html>maintenance</html>"));

    await expect(
      loginToEnt({ username: "louis", password: "secret" }, CONFIG),
    ).rejects.toThrow(/jeton anti-csrf/i);
  });

  test("remonte une erreur réseau en EntUnavailableError", async () => {
    vi.stubGlobal("fetch", async () => {
      throw new TypeError("fetch failed");
    });

    await expect(
      loginToEnt({ username: "louis", password: "secret" }, CONFIG),
    ).rejects.toBeInstanceOf(EntUnavailableError);
  });
});

describe("fetchSeances", () => {
  const SESSION = {
    cookie:
      ".AspNet.ApplicationCookie=8_49DMnhMUUmEgT; ASP.NET_SessionId=w1sgiwbq; ARRAffinity=308ac136635ceb04; _culture=en",
    expiresAt: Date.now() + 900_000,
  };

  /** Semaine du lundi 31 août 2026, bornes à minuit heure de Paris. */
  const SEMAINE = {
    from: new Date("2026-08-30T22:00:00.000Z"),
    to: new Date("2026-09-06T22:00:00.000Z"),
  };

  test("envoie start en ISO UTC et duration en jours, et rejoue les cookies", async () => {
    let capture: { url: string; init: RequestInit } | null = null;

    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      capture = { url, init };
      return new Response(JSON.stringify([{ Id: "1" }]), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });

    const seances = await fetchSeances(SESSION, SEMAINE, CONFIG);

    expect(capture!.url).toBe("https://ent.exemple.fr/LoadEvents");

    const body = new URLSearchParams(capture!.init.body as string);
    expect(body.get("start")).toBe("2026-08-30T22:00:00.000Z");
    expect(body.get("duration")).toBe("7");

    const headers = new Headers(capture!.init.headers);
    expect(headers.get("cookie")).toContain(".AspNet.ApplicationCookie=");
    expect(headers.get("cookie")).toContain("ARRAffinity=308ac136635ceb04");
    expect(headers.get("x-requested-with")).toBe("XMLHttpRequest");

    expect(seances).toHaveLength(1);
  });

  test("compte 7 jours sur une semaine de changement d'heure", () => {
    // Du 26 octobre au 2 novembre 2026 : 169 h, et pourtant 7 jours.
    expect(
      durationInDays({
        from: new Date("2026-10-25T22:00:00.000Z"),
        to: new Date("2026-11-01T23:00:00.000Z"),
      }),
    ).toBe(7);
  });

  test("traduit une redirection en session expirée", async () => {
    // L'ENT renvoie 302 vers la page de login, jamais 401.
    vi.stubGlobal("fetch", async () => new Response("", { status: 302 }));

    await expect(fetchSeances(SESSION, SEMAINE, CONFIG)).rejects.toBeInstanceOf(
      EntAuthError,
    );
  });

  test("refuse une réponse qui n'est pas un tableau", async () => {
    vi.stubGlobal("fetch", async () => new Response("<html>login</html>", { status: 200 }));

    await expect(fetchSeances(SESSION, SEMAINE, CONFIG)).rejects.toBeInstanceOf(
      EntUnavailableError,
    );
  });
});

describe("suivi des redirections", () => {
  test("suit /  → /login et récupère le jeton posé sur la page d'arrivée", async () => {
    // Reproduit le portail réel : la 302 ne porte ni le champ caché ni le
    // cookie anti-forgery, seule la page de login les fournit.
    const appels: string[] = [];

    vi.stubGlobal("fetch", async (url: string) => {
      appels.push(url);

      if (url === "https://ent.exemple.fr/") {
        return response("", {
          status: 302,
          location: "/login?ReturnUrl=%2F",
          cookies: ["ASP.NET_SessionId=abc; path=/", "ARRAffinity=xyz; path=/"],
        });
      }
      if (url.startsWith("https://ent.exemple.fr/login")) {
        return response(LOGIN_PAGE, {
          cookies: [`${ANTIFORGERY_FIELD}=cookie-jumeau; path=/`],
        });
      }
      // POST /LoginPost : succès.
      return response("", { status: 302, location: "/", cookies: [COOKIE_AUTH] });
    });

    const session = await loginToEnt({ username: "louis", password: "secret" }, {
      ...CONFIG,
      loginPagePath: "/",
    });

    expect(appels[0]).toBe("https://ent.exemple.fr/");
    expect(appels[1]).toContain("/login");
    // Les cookies des deux étapes sont conservés.
    expect(session.cookie).toContain("ASP.NET_SessionId=abc");
    expect(session.cookie).toContain(".AspNet.ApplicationCookie=");
  });

  test("résout une Location relative", async () => {
    const appels: string[] = [];

    vi.stubGlobal("fetch", async (url: string) => {
      appels.push(url);
      if (appels.length === 1) {
        return response("", { status: 302, location: "/login?ReturnUrl=%2F" });
      }
      return response(LOGIN_PAGE, {
        cookies: [`${ANTIFORGERY_FIELD}=jumeau`, COOKIE_AUTH],
      });
    });

    await loginToEnt({ username: "louis", password: "secret" }, { ...CONFIG, loginPagePath: "/" });

    expect(appels[1]).toBe("https://ent.exemple.fr/login?ReturnUrl=%2F");
  });

  test("abandonne après une boucle de redirections", async () => {
    vi.stubGlobal("fetch", async () =>
      response("", { status: 302, location: "/boucle" }),
    );

    await expect(
      loginToEnt({ username: "louis", password: "secret" }, { ...CONFIG, loginPagePath: "/" }),
    ).rejects.toThrow(/redirections/i);
  });
});
