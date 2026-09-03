"use server";

import { redirect } from "next/navigation";

import type { LoginState } from "@/actions/auth-state";
import { describeEntError } from "@/lib/ent/errors";
import { forgetSession, verifyCredentials } from "@/lib/ent/service";
import { clearCredentials, readCredentials, writeCredentials } from "@/lib/session";

/**
 * Valide les identifiants auprès de l'ENT avant de poser le cookie : on ne veut
 * pas d'une session « connectée » qui échouerait à chaque chargement de l'EDT.
 */
export async function loginAction(
  _previous: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!username || !password) {
    return {
      status: "error",
      code: "INVALID_INPUT",
      message: "Renseigne ton identifiant et ton mot de passe.",
    };
  }

  try {
    await verifyCredentials({ username, password });
    await writeCredentials({ username, password });
  } catch (error) {
    const { code, message } = describeEntError(error);
    return { status: "error", code, message };
  }

  // `redirect` lève une exception de contrôle : elle doit rester hors du `try`.
  redirect("/edt");
}

export async function logoutAction(): Promise<void> {
  const credentials = await readCredentials();
  if (credentials) forgetSession(credentials);

  await clearCredentials();
  redirect("/login");
}
