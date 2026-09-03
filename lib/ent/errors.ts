/**
 * Erreurs du scraper. Le front doit pouvoir distinguer « mauvais identifiants »
 * de « l'ENT est injoignable » : ce sont deux actions utilisateur différentes.
 */

export class EntAuthError extends Error {
  readonly code = "ENT_AUTH" as const;

  constructor(message = "Identifiant ou mot de passe refusé par l'ENT.") {
    super(message);
    this.name = "EntAuthError";
  }
}

export class EntUnavailableError extends Error {
  readonly code = "ENT_UNAVAILABLE" as const;

  constructor(
    message = "L'ENT est injoignable ou a renvoyé une réponse inattendue.",
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "EntUnavailableError";
  }
}

export type EntErrorCode = "ENT_AUTH" | "ENT_UNAVAILABLE" | "ENT_CONFIG";

/**
 * Traduit une erreur en code + message affichable.
 * Rien du HTML brut de l'ENT ne doit fuiter vers le client.
 */
export function describeEntError(error: unknown): {
  code: EntErrorCode;
  message: string;
} {
  if (error instanceof EntAuthError) {
    return { code: "ENT_AUTH", message: error.message };
  }
  if (error instanceof EntUnavailableError) {
    return { code: "ENT_UNAVAILABLE", message: error.message };
  }
  if (error instanceof Error && error.message.startsWith("Configuration ENT")) {
    return { code: "ENT_CONFIG", message: error.message };
  }
  return {
    code: "ENT_UNAVAILABLE",
    message: "Une erreur inattendue est survenue lors de l'appel à l'ENT.",
  };
}
