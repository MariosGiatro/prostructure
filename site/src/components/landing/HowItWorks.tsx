type Step = {
  index: string;
  title: string;
  body: string;
};

const steps: Step[] = [
  {
    index: "I",
    title: "Describe what you're looking for",
    body: "Type a target name, gene symbol, disease, or ask in natural language. Biolable plans the lookup before answering.",
  },
  {
    index: "II",
    title: "Resolve against the data graph",
    body: "Live calls to UniProt return verified entries. PDB structures are surfaced from the cross-reference graph automatically.",
  },
  {
    index: "III",
    title: "Inspect, cite, follow up",
    body: "Open structures in Mol* in place, jump to source records, and continue the conversation with full context preserved.",
  },
];

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="border-b border-white/[0.06] bg-[#08080d]"
    >
      <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6 sm:py-28 lg:px-8">
        <div className="flex flex-col items-start gap-10 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-xl">
            <span className="eyebrow">How it works</span>
            <h2 className="section-title mt-5">
              From a sentence to a structure in three moves.
            </h2>
          </div>
          <p className="max-w-md text-[15px] leading-relaxed text-zinc-500">
            Built on Gemini with explicit tool-use over the UniProt REST
            API. No hallucinated identifiers, no synthetic citations.
          </p>
        </div>

        <ol className="mt-16 grid gap-px overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.06] md:grid-cols-3">
          {steps.map((s) => (
            <li key={s.index} className="bg-[#0a0a0f] p-8">
              <div className="flex items-center gap-3">
                <span className="font-mono text-2xl text-zinc-700">
                  {s.index}
                </span>
                <span className="h-px flex-1 bg-white/[0.08]" aria-hidden />
              </div>
              <h3 className="mt-6 text-lg font-medium tracking-tight text-zinc-50">
                {s.title}
              </h3>
              <p className="mt-3 text-[14px] leading-relaxed text-zinc-400">
                {s.body}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
