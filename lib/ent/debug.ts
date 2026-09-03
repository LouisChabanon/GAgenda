/**
 * Traces du scraper, coupées par défaut et activées par `ENT_DEBUG=1`.
 *
 * Le scraper manipule un mot de passe, un jeton anti-CSRF et un cookie de
 * session : ces valeurs ne doivent jamais atterrir dans une sortie, même en
 * développement, même sur une machine perso. Tout ce qui est sensible passe donc
 * par `redact()` (longueur seule) ou n'est tracé que par son nom.
 *
 * L'écriture va sur `stderr` — le flux des diagnostics — plutôt que par
 * `console.log`, proscrit en code de production.
 */

/** Vrai quand les traces sont demandées. Relu à chaque appel pour les tests. */
export function isDebugEnabled(): boolean {
  return process.env.ENT_DEBUG === "1";
}

type Details = Record<string, unknown>;

/** Remplace une valeur sensible par sa seule longueur. */
export function redact(value: string | null | undefined): string {
  if (!value) return "<absent>";
  return `<${value.length} car.>`;
}

/**
 * Assainit un extrait de réponse avant de le tracer.
 *
 * Quand l'ENT renvoie une page de login à la place du JSON attendu, cet extrait
 * contient le HTML du formulaire — donc potentiellement la valeur du jeton
 * anti-CSRF. On neutralise les valeurs d'attributs et toute longue suite
 * base64 avant impression.
 */
export function redactExcerpt(raw: string, limit = 120): string {
  return raw
    .slice(0, limit)
    .replace(/value=["'][^"']*["']/gi, 'value="<masqué>"')
    .replace(/[A-Za-z0-9_-]{32,}/g, "<masqué>")
    .replace(/\s+/g, " ")
    .trim();
}

/** Masque une adresse ou un identifiant : `lo…@e…`. */
export function redactIdentity(value: string): string {
  const [local, domain] = value.split("@");
  const head = local.slice(0, 2);

  return domain ? `${head}…@${domain[0]}…` : `${head}…`;
}

let origin = 0;

/** Remet l'horloge relative à zéro au début d'une séquence. */
export function startTrace(): void {
  origin = Date.now();
}

/**
 * Trace une étape. `details` ne doit contenir que des valeurs déjà assainies :
 * ce module ne devine pas ce qui est secret.
 */
export function entDebug(step: string, details: Details = {}): void {
  if (!isDebugEnabled()) return;

  const elapsed = origin === 0 ? 0 : Date.now() - origin;
  const suffix = Object.entries(details)
    .map(([key, value]) => `${key}=${format(value)}`)
    .join(" ");

  process.stderr.write(`[ent] +${elapsed}ms ${step}${suffix ? ` ${suffix}` : ""}\n`);
}

function format(value: unknown): string {
  if (value === null || value === undefined) return "<absent>";
  if (Array.isArray(value)) return value.length > 0 ? value.join(",") : "<vide>";
  if (typeof value === "string") return value === "" ? "<vide>" : value;
  return String(value);
}
