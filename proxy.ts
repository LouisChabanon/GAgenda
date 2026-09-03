import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE } from "@/lib/session-cookie";

/**
 * Garde optimiste : on ne fait que constater la présence du cookie de session.
 * Le déchiffrement et l'appel à l'ENT ont lieu dans la page — la doc Next 16
 * déconseille explicitement toute logique lente ou d'autorisation réelle ici.
 *
 * (Depuis Next 16, `middleware.ts` s'appelle `proxy.ts`.)
 */
export function proxy(request: NextRequest) {
  const hasSession = request.cookies.has(SESSION_COOKIE);

  if (!hasSession && request.nextUrl.pathname.startsWith("/edt")) {
    const login = new URL("/login", request.url);
    return NextResponse.redirect(login);
  }

  if (hasSession && request.nextUrl.pathname === "/login") {
    return NextResponse.redirect(new URL("/edt", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/edt/:path*", "/login"],
};
