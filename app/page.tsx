import { redirect } from "next/navigation";

import { readCredentials } from "@/lib/session";

/** La racine n'affiche rien : elle oriente vers l'agenda ou la connexion. */
export default async function HomePage() {
  const credentials = await readCredentials();
  redirect(credentials ? "/edt" : "/login");
}
