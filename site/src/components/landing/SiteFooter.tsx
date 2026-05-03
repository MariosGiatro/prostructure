type Column = {
  title: string;
  links: { label: string; href: string }[];
};

const columns: Column[] = [
  {
    title: "Product",
    links: [
      { label: "Chat", href: "/chat" },
      { label: "Capabilities", href: "#capabilities" },
      { label: "How it works", href: "#how-it-works" },
      { label: "Changelog", href: "#" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Documentation", href: "#" },
      { label: "API reference", href: "#" },
      { label: "Cookbook", href: "#" },
      { label: "Status", href: "#" },
    ],
  },
  {
    title: "Sources",
    links: [
      { label: "UniProt", href: "https://www.uniprot.org/" },
      { label: "RCSB PDB", href: "https://www.rcsb.org/" },
      { label: "AlphaFold DB", href: "https://alphafold.ebi.ac.uk/" },
      { label: "Mol* Viewer", href: "https://molstar.org/" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "#" },
      { label: "Security", href: "#" },
      { label: "Privacy", href: "#" },
      { label: "Terms", href: "#" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="bg-[#040407]">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <a href="/" className="flex items-center gap-2 font-semibold tracking-tight text-white">
              <BioLogo className="h-5 w-5" />
              <span>Biolable</span>
            </a>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-zinc-500">
              A research-grade conversational layer over the public
              protein data graph.
            </p>
            <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              <span className="mono-cap text-zinc-400">
                All systems operational
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-10 lg:col-span-8 lg:grid-cols-4">
            {columns.map((col) => (
              <div key={col.title}>
                <h4 className="mono-cap text-zinc-300">{col.title}</h4>
                <ul className="mt-4 space-y-2.5">
                  {col.links.map((l) => (
                    <li key={l.label}>
                      <a
                        href={l.href}
                        className="text-sm text-zinc-500 transition-colors hover:text-white"
                      >
                        {l.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-14 flex flex-col items-start justify-between gap-3 border-t border-white/[0.06] pt-6 text-xs text-zinc-600 sm:flex-row sm:items-center">
          <span>© {new Date().getFullYear()} Biolable. All rights reserved.</span>
          <span className="mono-cap">
            Built with Gemini · UniProt · RCSB PDB · Mol*
          </span>
        </div>
      </div>
    </footer>
  );
}

function BioLogo({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M7 4c0 3 5 5 5 8s-5 5-5 8" />
      <path d="M17 4c0 3-5 5-5 8s5 5 5 8" />
      <line x1="8" y1="6" x2="16" y2="6" />
      <line x1="9" y1="10" x2="15" y2="10" />
      <line x1="9" y1="14" x2="15" y2="14" />
      <line x1="8" y1="18" x2="16" y2="18" />
    </svg>
  );
}
