import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { logoutAction } from "@/actions/auth";
import AgendaWrapper from "@/components/agenda/AgendaWrapper";
import { addDays, startOfWeek, toDayKey, weekRange } from "@/lib/date";
import { describeEntError } from "@/lib/ent/errors";
import { getSeances } from "@/lib/ent/service";
import type { Seance } from "@/lib/ent/types";
import { readCredentials } from "@/lib/session";

export const metadata: Metadata = { title: "Emploi du temps" };

// Le scraper tourne sous Node (cookies gérés à la main, `node:crypto`).
export const runtime = "nodejs";

const JOURS_OUVRES = 5;

export default async function EdtPage() {
  const credentials = await readCredentials();
  if (!credentials) redirect("/login");

  const today = new Date();
  const jourInitial = prochainJourOuvre(today);
  const semaine = startOfWeek(jourInitial);

  let seances: Seance[] = [];
  let erreur: string | null = null;

  try {
    seances = await getSeances(credentials, weekRange(jourInitial));
  } catch (error) {
    erreur = describeEntError(error).message;
  }

  if (erreur) {
    return <EdtErreur message={erreur} />;
  }

  return (
    <AgendaWrapper
      initialSeances={seances}
      initialSemaine={toDayKey(semaine)}
      today={toDayKey(today)}
    />
  );
}

/** Le week-end, on ouvre directement sur le lundi suivant. */
function prochainJourOuvre(date: Date): Date {
  const lundi = startOfWeek(date);
  const index = Math.round(
    (Date.parse(toDayKey(date)) - Date.parse(toDayKey(lundi))) / 86_400_000,
  );

  return index < JOURS_OUVRES ? date : addDays(lundi, 7);
}

function EdtErreur({ message }: { message: string }) {
  return (
    <main className="pad-safe-top pad-safe-bottom mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-6 py-12">
      <p className="text-eyebrow uppercase text-accent">Emploi du temps</p>
      <h1 className="text-display font-bold text-balance text-ink-strong">
        Impossible de récupérer le planning.
      </h1>
      <p role="alert" className="text-[0.9375rem] leading-relaxed text-muted">
        {message}
      </p>
      <form action={logoutAction}>
        <button
          type="submit"
          className="min-h-12 rounded-lg bg-primary px-5 text-[0.9375rem] font-medium text-on-primary shadow-sm transition-colors duration-(--duration-fast) hover:bg-primary-hover disabled:cursor-progress disabled:opacity-60"
        >
          Se reconnecter
        </button>
      </form>
    </main>
  );
}
