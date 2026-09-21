import type { Metadata } from "next";

import { LoginForm } from "@/components/login/LoginForm";

export const metadata: Metadata = { title: "Connexion" };

export default function LoginPage() {
  return (
    <main className="pad-safe-top pad-safe-bottom mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-10 px-6 py-12">
      <header className="flex flex-col gap-3">
        {/* Aucune webfont : le nom est composé dans la police de l'app. Le « GA »
            de Génie Atomique est posé dans la pastille qui marque aujourd'hui
            dans la grille — la signature est un morceau du produit, et le mot
            reste d'un seul tenant plutôt qu'à moitié grisé. */}
        <h1 className="text-[clamp(2.75rem,1.6rem+5.5vw,4rem)] font-bold leading-none tracking-[-0.035em] text-ink">
          <span className="mr-[0.08em] inline-block rounded-full bg-primary px-[0.18em] py-[0.1em] text-on-primary">
            GA
          </span>
          genda
        </h1>
        <p className="text-[0.9375rem] text-muted">Emploi du temps</p>
      </header>

      <LoginForm />
    </main>
  );
}
