import { NextResponse } from "next/server";

import { describeEntError } from "@/lib/ent/errors";
import { verifyCredentials } from "@/lib/ent/service";
import { writeCredentials } from "@/lib/session";

export const runtime = "nodejs";

/**
 * `POST /api/auth/login` — équivalent HTTP de la Server Action `loginAction`,
 * pour les usages hors formulaire (script, client natif éventuel).
 */
export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);

  const username = typeof payload?.username === "string" ? payload.username.trim() : "";
  const password = typeof payload?.password === "string" ? payload.password : "";

  if (!username || !password) {
    return NextResponse.json(
      { error: "`username` et `password` sont requis." },
      { status: 400 },
    );
  }

  try {
    await verifyCredentials({ username, password });
    await writeCredentials({ username, password });
  } catch (error) {
    const { code, message } = describeEntError(error);
    return NextResponse.json(
      { error: message, code },
      { status: code === "ENT_AUTH" ? 401 : 502 },
    );
  }

  return NextResponse.json({ ok: true });
}
