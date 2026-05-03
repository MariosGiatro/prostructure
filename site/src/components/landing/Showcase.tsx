type Structure = {
  pdbId: string;
  method: string;
  resolution: string;
};

const structures: Structure[] = [
  { pdbId: "1A3N", method: "X-ray", resolution: "1.80 Å" },
  { pdbId: "2HHB", method: "X-ray", resolution: "1.74 Å" },
  { pdbId: "1GZX", method: "X-ray", resolution: "2.10 Å" },
  { pdbId: "4HHB", method: "X-ray", resolution: "1.74 Å" },
  { pdbId: "1BBB", method: "X-ray", resolution: "1.70 Å" },
  { pdbId: "2DN1", method: "X-ray", resolution: "1.25 Å" },
];

function pdbImageUrl(pdbId: string): string {
  const id = pdbId.toLowerCase();
  const mid = id.substring(1, 3);
  return `https://cdn.rcsb.org/images/structures/${mid}/${id}/${id}_assembly-1.jpeg`;
}

export function Showcase() {
  return (
    <section className="relative overflow-hidden border-b border-white/[0.06] bg-[#06060a]">
      <div className="spotlight absolute inset-0" aria-hidden />
      <div className="relative mx-auto grid max-w-6xl gap-14 px-4 py-24 sm:px-6 sm:py-28 lg:grid-cols-12 lg:gap-12 lg:px-8">
        <div className="lg:col-span-5">
          <span className="eyebrow">Live answer</span>
          <h2 className="section-title mt-5">
            Answers come with structure, not just words.
          </h2>
          <p className="section-kicker">
            Ask about any protein and Biolable returns a grounded
            explanation, the relevant UniProt entry, and the published
            3D structures — ready to inspect in Mol*.
          </p>
          <ul className="mt-8 space-y-3 text-[14px] text-zinc-400">
            <li className="flex gap-3">
              <span className="mono-cap min-w-[3.5rem] pt-0.5 text-zinc-500">
                Source
              </span>
              UniProt P69905, P68871
            </li>
            <li className="flex gap-3">
              <span className="mono-cap min-w-[3.5rem] pt-0.5 text-zinc-500">
                Models
              </span>
              6 experimental structures · X-ray
            </li>
            <li className="flex gap-3">
              <span className="mono-cap min-w-[3.5rem] pt-0.5 text-zinc-500">
                Viewer
              </span>
              Mol* embedded
            </li>
          </ul>
        </div>

        <div className="lg:col-span-7">
          <div className="card overflow-hidden shadow-[var(--shadow-deep)]">
            <header className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
              </div>
              <span className="mono-cap">biolable / chat</span>
              <span className="mono-cap">gemini · uniprot</span>
            </header>

            <div className="space-y-4 px-5 py-6 sm:px-6">
              <div className="ml-auto max-w-[80%] rounded-2xl rounded-br-md bg-zinc-200 px-4 py-2.5 text-sm leading-relaxed text-zinc-900">
                Show me the structure of human hemoglobin and explain how
                it carries oxygen.
              </div>

              <div className="max-w-full rounded-2xl rounded-bl-md bg-white/[0.05] px-4 py-3 text-[14px] leading-relaxed text-zinc-100">
                <p>
                  Human hemoglobin is a tetramer of two{" "}
                  <span className="font-mono text-[12px] text-zinc-300">
                    HBA
                  </span>{" "}
                  (P69905) and two{" "}
                  <span className="font-mono text-[12px] text-zinc-300">
                    HBB
                  </span>{" "}
                  (P68871) chains. Each subunit binds a heme group whose
                  iron(II) reversibly coordinates O₂.
                </p>
                <p className="mt-2 text-zinc-400">
                  Cooperative binding across subunits drives the sigmoidal
                  oxygen affinity curve.
                </p>

                <div className="mt-4 rounded-xl border border-white/[0.07] bg-white/[0.025] p-2.5">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="mono-cap">3D structures · 6</span>
                    <span className="mono-cap text-zinc-600">RCSB PDB</span>
                  </div>
                  <div className="grid grid-cols-6 gap-1.5">
                    {structures.map((s) => (
                      <div
                        key={s.pdbId}
                        className="group relative aspect-square overflow-hidden rounded-md border border-white/[0.08] bg-zinc-900"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={pdbImageUrl(s.pdbId)}
                          alt={`PDB ${s.pdbId}`}
                          loading="lazy"
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                        />
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent px-1 pb-0.5 pt-3">
                          <span className="block font-mono text-[9px] font-bold leading-tight text-white">
                            {s.pdbId}
                          </span>
                          <span className="hidden text-[8px] leading-tight text-zinc-400 sm:block">
                            {s.resolution}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
