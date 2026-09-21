"use client";

import { useActionState } from "react";

import { loginAction } from "@/actions/auth";
import { initialLoginState } from "@/actions/auth-state";
import { Field } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";

/**
 * Formulaire de connexion à l'ENT.
 * Les identifiants partent vers une Server Action, sont validés auprès de l'ENT,
 * puis chiffrés dans un cookie httpOnly — ils ne reviennent jamais au client.
 */
export function LoginForm() {
  const [state, formAction] = useActionState(loginAction, initialLoginState);

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      <Field
        id="username"
        name="username"
        label="Identifiant ENT"
        autoComplete="username"
      />
      <Field
        id="password"
        name="password"
        label="Mot de passe"
        type="password"
        autoComplete="current-password"
      />

      {state.status === "error" && (
        <p
          role="alert"
          className="rounded-lg border border-emphasis/20 bg-emphasis-container px-4 py-3 text-sm leading-snug text-emphasis"
        >
          {state.message}
          {state.code === "ENT_CONFIG" && (
            <span className="mt-1 block text-muted">
              Renseigner les variables ENT dans <code>.env.local</code>.
            </span>
          )}
        </p>
      )}

      <SubmitButton pendingLabel="Connexion à l'ENT…">Se connecter</SubmitButton>
    </form>
  );
}
