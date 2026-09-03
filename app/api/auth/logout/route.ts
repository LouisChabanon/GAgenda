import { NextResponse } from "next/server";

import { forgetSession } from "@/lib/ent/service";
import { clearCredentials, readCredentials } from "@/lib/session";

export const runtime = "nodejs";

export async function POST() {
  const credentials = await readCredentials();
  if (credentials) forgetSession(credentials);

  await clearCredentials();
  return new NextResponse(null, { status: 204 });
}
