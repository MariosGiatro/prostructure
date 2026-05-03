type Source = { name: string; tag: string };

const sources: Source[] = [
  { name: "UniProt", tag: "Sequence + annotation" },
  { name: "RCSB PDB", tag: "Experimental structures" },
  { name: "AlphaFold", tag: "Predicted models" },
  { name: "Mol*", tag: "3D viewer" },
  { name: "Reactome", tag: "Pathways" },
];

export function TrustStrip() {
  return (
    <section
      aria-label="Connected data sources"
      className="border-y border-white/[0.06] bg-[#07070b]"
    >
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <p className="mono-cap mb-6 text-center">
          Grounded in the public protein data graph
        </p>
        <ul className="grid grid-cols-2 gap-x-6 gap-y-6 sm:grid-cols-3 lg:grid-cols-5">
          {sources.map((s) => (
            <li
              key={s.name}
              className="flex flex-col items-center gap-1 text-center"
            >
              <span className="text-base font-medium tracking-tight text-zinc-200">
                {s.name}
              </span>
              <span className="mono-cap text-[10px]">{s.tag}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
