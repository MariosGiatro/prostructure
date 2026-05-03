"use client";

import { useRouter } from "next/navigation";

type Group = {
  label: string;
  queries: string[];
};

const groups: Group[] = [
  {
    label: "Drug discovery",
    queries: [
      "Show kinase targets implicated in non-small cell lung cancer.",
      "What's known about KRAS G12C inhibitors and which structures cover them?",
      "Find GPCRs with cryo-EM structures resolved below 3 Å.",
    ],
  },
  {
    label: "Disease biology",
    queries: [
      "Explain BRCA1's role in homologous recombination.",
      "Which proteins drive familial Alzheimer's disease?",
      "Summarize the function of SOD1 and show its mutant structures.",
    ],
  },
  {
    label: "Structural biology",
    queries: [
      "Compare available structures of human hemoglobin.",
      "Show the heme-binding pocket of cytochrome c.",
      "List membrane proteins with structures below 2 Å resolution.",
    ],
  },
];

export function ExampleQueries() {
  const router = useRouter();

  const ask = (q: string) => {
    router.push(`/chat?q=${encodeURIComponent(q)}`);
  };

  return (
    <section className="border-b border-white/[0.06] bg-[#06060a]">
      <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6 sm:py-28 lg:px-8">
        <div className="max-w-2xl">
          <span className="eyebrow">Try it</span>
          <h2 className="section-title mt-5">Start with a real question.</h2>
          <p className="section-kicker">
            These prompts run through the same pipeline as your own
            questions — UniProt lookups, structure resolution, follow-up
            recommendations.
          </p>
        </div>

        <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.06] md:grid-cols-3">
          {groups.map((g) => (
            <div key={g.label} className="flex flex-col bg-[#0a0a0f] p-7">
              <span className="mono-cap">{g.label}</span>
              <ul className="mt-5 flex flex-1 flex-col gap-2.5">
                {g.queries.map((q) => (
                  <li key={q}>
                    <button
                      type="button"
                      onClick={() => ask(q)}
                      className="group flex w-full items-start gap-3 rounded-lg border border-white/[0.06] bg-white/[0.015] px-3.5 py-3 text-left text-[13.5px] leading-snug text-zinc-300 transition-colors hover:border-white/[0.14] hover:bg-white/[0.05] hover:text-white"
                    >
                      <span
                        aria-hidden
                        className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-600 transition-colors group-hover:bg-[var(--accent)]"
                      />
                      <span className="flex-1">{q}</span>
                      <span
                        aria-hidden
                        className="mt-0.5 text-zinc-600 transition-transform group-hover:translate-x-0.5 group-hover:text-zinc-300"
                      >
                        ↗
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
