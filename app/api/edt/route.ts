import { NextResponse, type NextRequest } from "next/server";

import { parseDayKey, weekRange } from "@/lib/date";
import { describeEntError } from "@/lib/ent/errors";
import { getSeances } from "@/lib/ent/service";
import { readCredentials } from "@/lib/session";

// Le scraper s'appuie sur `node:crypto` et sur la gestion manuelle des cookies.
export const runtime = "nodejs";

/**
 * `GET /api/edt?semaine=YYYY-MM-DD`
 * Séances de la semaine contenant la date passée. Consommé par l'agenda lors
 * des navigations de semaine, sans recharger la page.
 */
export async function GET(request: NextRequest) {
  const credentials = await readCredentials();
  if (!credentials) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const raw = request.nextUrl.searchParams.get("semaine");
  const day = raw ? parseDayKey(raw) : new Date();
  if (!day) {
    return NextResponse.json(
      { error: "Paramètre `semaine` invalide (attendu YYYY-MM-DD)." },
      { status: 400 },
    );
  }

  try {
    const seances = await getSeances(credentials, weekRange(day));
    return NextResponse.json({ seances });
  } catch (error) {
    const { code, message } = describeEntError(error);
    return NextResponse.json(
      { error: message, code },
      { status: code === "ENT_AUTH" ? 401 : 502 },
    );
  }
}
