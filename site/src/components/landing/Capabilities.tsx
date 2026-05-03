type Capability = {
  index: string;
  title: string;
  description: string;
  bullets: string[];
};

const capabilities: Capability[] = [
  {
    index: "01",
    title: "Ask in plain language",
    description:
      "Describe a target, disease, or pathway. Biolable resolves it against UniProt and returns grounded answers, not generic summaries.",
    bullets: [
      "Cited accession IDs",
      "Multi-organism aware",
      "Conversational follow-ups",
    ],
  },
  {
    index: "02",
    title: "See the structure",
    description:
      "Every protein answer ships with a thumbnail strip of its experimental structures and an embedded Mol* viewer for inspection.",
    bullets: [
      "PDB images via RCSB CDN",
      "In-place Mol* viewer",
      "Resolution + method shown",
    ],
  },
  {
    index: "03",
    title: "Move to evidence",
    description:
      "Jump from any answer back to the source — UniProt entries, PDB records, or AlphaFold models — without leaving the conversation.",
    bullets: [
      "One-click source links",
      "Stable accession references",
      "Designed for review",
    ],
  },
];

export function Capabilities() {
  return (
    <section
      id="capabilities"
      className="relative border-b border-white/[0.06]"
    >
      <div className="absolute inset-0 bg-grid bg-grid-fade opacity-60" aria-hidden />
      <div className="relative mx-auto max-w-6xl px-4 py-24 sm:px-6 sm:py-28 lg:px-8">
        <div className="max-w-2xl">
          <span className="eyebrow">Capabilities</span>
          <h2 className="section-title mt-5">
            A research interface, not a generic chatbot.
          </h2>
          <p className="section-kicker">
            Biolable is built around how protein scientists actually
            work — query, inspect, cite — and uses the public data graph
            as ground truth.
          </p>
        </div>

        <ul className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.06] sm:grid-cols-3">
          {capabilities.map((c) => (
            <li key={c.index} className="bg-[#0a0a0f] p-7 sm:p-8">
              <div className="flex items-baseline justify-between">
                <span className="mono-cap">{c.index}</span>
                <span className="h-px w-10 bg-white/[0.1]" aria-hidden />
              </div>
              <h3 className="mt-6 text-xl font-medium tracking-tight text-zinc-50">
                {c.title}
              </h3>
              <p className="mt-3 text-[15px] leading-relaxed text-zinc-400">
                {c.description}
              </p>
              <ul className="mt-6 space-y-2 text-[13px] text-zinc-500">
                {c.bullets.map((b) => (
                  <li key={b} className="flex items-center gap-2">
                    <span className="h-px w-3 bg-zinc-600" aria-hidden />
                    {b}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
