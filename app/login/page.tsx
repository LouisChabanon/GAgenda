import type { Metadata } from "next";

import { LoginForm } from "@/components/login/LoginForm";

export const metadata: Metadata = { title: "Connexion" };

export default function LoginPage() {
  return (
    <main className="pad-safe-top pad-safe-bottom mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-10 px-6 py-12">
      <header className="flex flex-col gap-1">
        <p className="text-eyebrow uppercase text-accent">Emploi du temps</p>
        {/* Aucune webfont : le nom est composé dans la police de l'app, en
            détachant le « GA » de Génie Atomique du reste du mot. */}
        <h1 className="text-[clamp(2.75rem,1.6rem+5.5vw,4rem)] font-bold leading-none tracking-[-0.035em]">
          <span className="text-primary">GA</span>
          <span className="font-medium text-muted">genda</span>
        </h1>
      </header>

      <LoginForm />
    </main>
  );
}
