/** Squelette affiché pendant l'appel initial à l'ENT — jamais d'écran blanc. */
export default function Loading() {
  return (
    <main className="pad-safe-top flex h-dvh w-full flex-col gap-3 px-3 pb-2">
      <header className="flex flex-none items-center justify-between gap-3">
        <div className="h-5 w-36 animate-pulse rounded bg-rule" />
        <div className="flex gap-1.5">
          {[0, 1, 2, 3].map((index) => (
            <div key={index} className="size-11 animate-pulse rounded-lg bg-rule" />
          ))}
        </div>
      </header>

      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-rule bg-surface">
        <div className="grid flex-none grid-cols-[2rem_repeat(5,1fr)] border-b border-rule">
          <div />
          {[0, 1, 2, 3, 4].map((index) => (
            <div key={index} className="flex flex-col items-center gap-1 py-2">
              <div className="h-2 w-6 animate-pulse rounded bg-rule" />
              <div className="size-7 animate-pulse rounded-full bg-rule" />
            </div>
          ))}
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-[2rem_repeat(5,1fr)] gap-px p-1">
          <div />
          {[0, 1, 2, 3, 4].map((colonne) => (
            <div key={colonne} className="flex flex-col gap-2 px-0.5 pt-4">
              <div
                className="animate-pulse rounded-md bg-rule/70"
                style={{ height: `${18 + ((colonne * 7) % 22)}%` }}
              />
              <div
                className="animate-pulse rounded-md bg-rule/50"
                style={{ height: `${12 + ((colonne * 5) % 16)}%` }}
              />
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
