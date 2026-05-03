type Stat = {
  value: string;
  label: string;
  caption: string;
};

const stats: Stat[] = [
  {
    value: "250M+",
    label: "Sequences",
    caption: "Indexed via UniProt",
  },
  {
    value: "230k",
    label: "Structures",
    caption: "Resolvable through PDB",
  },
  {
    value: "<2s",
    label: "Median answer",
    caption: "Question to first byte",
  },
];

export function StatsCta() {
  return (
    <section className="relative overflow-hidden border-b border-white/[0.06]">
      <div
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_50%_120%,rgba(120,80,200,0.35),transparent_60%),radial-gradient(ellipse_60%_50%_at_50%_-10%,rgba(56,189,248,0.18),transparent_55%)]"
      />
      <div className="absolute inset-0 bg-grid bg-grid-fade opacity-40" aria-hidden />

      <div className="relative mx-auto max-w-6xl px-4 py-28 sm:px-6 sm:py-32 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <span className="eyebrow">Get started</span>
          <h2 className="mt-6 text-balance text-4xl font-semibold tracking-tight text-white sm:text-5xl md:text-[3.25rem] md:leading-[1.05]">
            Have a real conversation with the protein graph.
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-balance text-base text-zinc-400 sm:text-lg">
            Free to start. No credit card. No demo dataset — your first
            question hits the live data.
          </p>

          <div className="mt-10 flex items-center justify-center gap-3">
            <a
              href="/chat"
              className="rounded-full bg-white px-5 py-2.5 text-sm font-medium text-zinc-900 shadow-[var(--shadow-soft)] transition-opacity hover:opacity-90"
            >
              Open Biolable
            </a>
            <a
              href="#capabilities"
              className="rounded-full border border-white/[0.12] bg-white/[0.03] px-5 py-2.5 text-sm font-medium text-zinc-200 transition-colors hover:bg-white/[0.07]"
            >
              How it works
            </a>
          </div>
        </div>

        <ul className="mx-auto mt-20 grid max-w-3xl grid-cols-1 gap-px overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.06] sm:grid-cols-3">
          {stats.map((s) => (
            <li key={s.label} className="bg-[#0a0a0f]/85 px-6 py-7 text-center backdrop-blur">
              <div className="font-mono text-3xl tracking-tight text-white sm:text-4xl">
                {s.value}
              </div>
              <div className="mt-2 text-sm text-zinc-300">{s.label}</div>
              <div className="mono-cap mt-1.5">{s.caption}</div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
