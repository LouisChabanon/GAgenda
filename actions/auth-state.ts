import type { EntErrorCode } from "@/lib/ent/errors";

/**
 * État du formulaire de connexion.
 * Isolé de `actions/auth.ts` : un fichier `"use server"` ne peut exporter que
 * des fonctions asynchrones.
 */
export type LoginState = {
  status: "idle" | "error";
  code?: EntErrorCode | "INVALID_INPUT";
  message?: string;
};

export const initialLoginState: LoginState = { status: "idle" };
