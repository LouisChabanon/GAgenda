/**
 * Nom du cookie de session, isolé dans son propre module : `proxy.ts` en a
 * besoin, mais ne doit pas tirer `lib/session.ts` (et donc `node:crypto`) dans
 * le bundle du Proxy.
 */
export const SESSION_COOKIE = "edt_session";
