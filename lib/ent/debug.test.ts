import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import {
  entDebug,
  isDebugEnabled,
  redact,
  redactExcerpt,
  redactIdentity,
  startTrace,
} from "./debug";
import { loginToEnt } from "./client";
import type { EntConfig } from "./config";

const CONFIG: EntConfig = {
  baseUrl: "https://ent.exemple.fr",
  loginPagePath: "/login?ReturnUrl=/",
  loginPostPath: "/User/LoginPost?ReturnUrl=/",
  calendarPath: "/LoadEvents",
  sessionTtlSeconds: 900,
  mock: false,
};

const MOT_DE_PASSE = "Sup3r-S3cret!2026";
const IDENTIFIANT = "louis.chabanon@exemple.fr";
const JETON = "CfDJ8Nf-jeton-anti-csrf-tres-long_ABC123";
const COOKIE_AUTH = "8_49DMnhMUUmEgT_bx91lLcsPPXURzNASMg9HYwS2BY";

const LOGIN_PAGE = `<form action="/User/LoginPost" method="post">
  <input name="__RequestVerificationToken" type="hidden" value="${JETON}" />
</form>`;

/** Capture ce que le logger écrit réellement sur stderr. */
function captureStderr(): { lignes: () => string; restore: () => void } {
  const morceaux: string[] = [];
  const spy = vi
    .spyOn(process.stderr, "write")
    .mockImplementation((chunk: unknown) => {
      morceaux.push(String(chunk));
      return true;
    });

  return {
    lignes: () => morceaux.join(""),
    restore: () => spy.mockRestore(),
  };
}

beforeEach(() => {
  vi.stubEnv("ENT_DEBUG", "1");
  startTrace();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("redact", () => {
  test("ne rend que la longueur d'un secret", () => {
    expect(redact(JETON)).toBe(`<${JETON.length} car.>`);
    expect(redact(JETON)).not.toContain("CfDJ");
  });

  test("distingue une valeur absente d'une valeur vide", () => {
    expect(redact(null)).toBe("<absent>");
    expect(redact("")).toBe("<absent>");
  });
});

describe("redactIdentity", () => {
  test("masque l'identifiant tout en le laissant reconnaissable", () => {
    expect(redactIdentity(IDENTIFIANT)).toBe("lo…@e…");
  });

  test("gère un identifiant sans domaine", () => {
    expect(redactIdentity("jdupont")).toBe("jd…");
  });
});

describe("interrupteur", () => {
  test("n'écrit rien quand ENT_DEBUG n'est pas armé", () => {
    vi.stubEnv("ENT_DEBUG", "");
    const stderr = captureStderr();

    expect(isDebugEnabled()).toBe(false);
    entDebug("étape:test", { valeur: 42 });

    expect(stderr.lignes()).toBe("");
    stderr.restore();
  });

  test("écrit une ligne préfixée et horodatée quand il est armé", () => {
    const stderr = captureStderr();

    entDebug("étape:test", { valeur: 42, vide: "", absent: null });

    expect(stderr.lignes()).toMatch(
      /^\[ent] \+\d+ms étape:test valeur=42 vide=<vide> absent=<absent>\n$/,
    );
    stderr.restore();
  });
});

describe("traces du login", () => {
  /** Rejoue une séquence de login complète, traces activées. */
  async function tracerUnLogin(): Promise<string> {
    const stderr = captureStderr();

    let appel = 0;
    vi.stubGlobal("fetch", async () => {
      appel += 1;
      const headers = new Headers();

      if (appel === 1) {
        headers.append("set-cookie", `__RequestVerificationToken=cookie-${JETON}; path=/`);
        headers.append("set-cookie", "ASP.NET_SessionId=w1sgiwbq2gjk; path=/");
        return new Response(LOGIN_PAGE, { status: 200, headers });
      }

      headers.append("set-cookie", `.AspNet.ApplicationCookie=${COOKIE_AUTH}; path=/`);
      headers.set("location", "/");
      return new Response("", { status: 302, headers });
    });

    await loginToEnt({ username: IDENTIFIANT, password: MOT_DE_PASSE }, CONFIG);

    const sortie = stderr.lignes();
    stderr.restore();
    return sortie;
  }

  test("ne laisse fuir ni mot de passe, ni jeton, ni cookie de session", async () => {
    const sortie = await tracerUnLogin();

    expect(sortie).not.toContain(MOT_DE_PASSE);
    expect(sortie).not.toContain(JETON);
    expect(sortie).not.toContain(COOKIE_AUTH);
    expect(sortie).not.toContain(IDENTIFIANT);
    // Les cookies ne doivent apparaître que par leur nom.
    expect(sortie).not.toContain("w1sgiwbq2gjk");
  });

  test("trace chaque étape de la séquence", async () => {
    const sortie = await tracerUnLogin();

    for (const étape of [
      "login:début",
      "http:requête",
      "http:réponse",
      "login:jeton",
      "login:résultat",
    ]) {
      expect(sortie).toContain(étape);
    }
  });

  test("rend exploitables les noms de champs, de cookies et les statuts", async () => {
    const sortie = await tracerUnLogin();

    // Les noms suffisent à diagnostiquer sans exposer les valeurs.
    expect(sortie).toContain("champs=UserName,Password,__RequestVerificationToken");
    expect(sortie).toContain("utilisateur=lo…@e…");
    expect(sortie).toContain(`jeton=<${JETON.length} car.>`);
    expect(sortie).toContain("authentifié=true");
    expect(sortie).toContain("status=302");
    expect(sortie).toContain(".AspNet.ApplicationCookie");
  });
});

describe("redactExcerpt", () => {
  test("neutralise le jeton d'une page de login renvoyée à la place du JSON", () => {
    const page = `<input name="__RequestVerificationToken" type="hidden" value="${JETON}" />`;
    const extrait = redactExcerpt(page, 500);

    expect(extrait).not.toContain(JETON);
    expect(extrait).toContain("__RequestVerificationToken");
  });

  test("masque toute longue suite base64 hors attribut", () => {
    expect(redactExcerpt(`session ${COOKIE_AUTH} active`, 500)).not.toContain(
      COOKIE_AUTH,
    );
  });

  test("garde lisible un extrait anodin et le tronque", () => {
    expect(redactExcerpt("<!DOCTYPE html>\n<html>\n  <body>Erreur 500", 500)).toBe(
      "<!DOCTYPE html> <html> <body>Erreur 500",
    );
    expect(redactExcerpt("abcdefghij", 4)).toBe("abcd");
  });
});
