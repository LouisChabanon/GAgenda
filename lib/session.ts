/**
 * Session applicative.
 *
 * Le cookie ASP.NET de l'ENT expire vite (quelques dizaines de minutes) : le
 * conserver côté client obligerait à se reconnecter plusieurs fois par jour, ce
 * qui est inacceptable pour une app lancée depuis l'écran d'accueil. On stocke
 * donc les identifiants ENT, chiffrés en AES-256-GCM, dans un cookie httpOnly ;
 * le serveur rejoue l'authentification tout seul quand c'est nécessaire.
 *
 * Le mot de passe ne repart donc jamais en clair vers le navigateur, et le
 * cookie est inexploitable sans `SESSION_SECRET`.
 */

import "server-only";

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { cookies } from "next/headers";

import type { EntCredentials } from "@/lib/ent/types";
import { SESSION_COOKIE } from "@/lib/session-cookie";

export { SESSION_COOKIE };

const ALGORITHM = "aes-256-gcm";
const KEY_BYTES = 32;
const IV_BYTES = 12;
const TAG_BYTES = 16;
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

function getSecretKey(): Buffer {
  const raw = process.env.SESSION_SECRET?.trim();

  if (!raw) {
    throw new Error(
      "Configuration ENT incomplète : SESSION_SECRET manquante dans .env.local (générer avec `openssl rand -base64 32`).",
    );
  }

  const key = Buffer.from(raw, "base64");
  if (key.length !== KEY_BYTES) {
    throw new Error(
      `Configuration ENT incomplète : SESSION_SECRET doit faire ${KEY_BYTES} octets en base64 (reçu ${key.length}).`,
    );
  }

  return key;
}

/** Chiffre les identifiants en une chaîne compacte transportable en cookie. */
export function sealCredentials(credentials: EntCredentials): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, getSecretKey(), iv);

  const payload = Buffer.concat([
    cipher.update(JSON.stringify(credentials), "utf8"),
    cipher.final(),
  ]);

  return Buffer.concat([iv, cipher.getAuthTag(), payload]).toString("base64url");
}

/** Déchiffre un cookie. `null` si absent, altéré ou chiffré avec une autre clé. */
export function unsealCredentials(token: string | undefined): EntCredentials | null {
  if (!token) return null;

  try {
    const raw = Buffer.from(token, "base64url");
    if (raw.length <= IV_BYTES + TAG_BYTES) return null;

    const decipher = createDecipheriv(
      ALGORITHM,
      getSecretKey(),
      raw.subarray(0, IV_BYTES),
    );
    decipher.setAuthTag(raw.subarray(IV_BYTES, IV_BYTES + TAG_BYTES));

    const plain = Buffer.concat([
      decipher.update(raw.subarray(IV_BYTES + TAG_BYTES)),
      decipher.final(),
    ]).toString("utf8");

    const parsed: unknown = JSON.parse(plain);
    return isCredentials(parsed) ? parsed : null;
  } catch {
    // Cookie forgé, tronqué, ou secret ayant tourné : on traite comme déconnecté.
    return null;
  }
}

/** Identifiants de la requête courante, ou `null` si non connecté. */
export async function readCredentials(): Promise<EntCredentials | null> {
  const store = await cookies();
  return unsealCredentials(store.get(SESSION_COOKIE)?.value);
}

/**
 * Pose le cookie de session.
 * À n'appeler que depuis une Server Function ou un Route Handler : le rendu
 * d'un Server Component ne peut pas émettre d'en-tête `Set-Cookie`.
 */
export async function writeCredentials(credentials: EntCredentials): Promise<void> {
  const store = await cookies();

  store.set(SESSION_COOKIE, sealCredentials(credentials), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function clearCredentials(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

function isCredentials(value: unknown): value is EntCredentials {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as EntCredentials).username === "string" &&
    typeof (value as EntCredentials).password === "string"
  );
}
