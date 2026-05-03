import { HeroChatInput } from "@/components/HeroChatInput";
import { TrustStrip } from "@/components/landing/TrustStrip";
import { Capabilities } from "@/components/landing/Capabilities";
import { Showcase } from "@/components/landing/Showcase";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { ExampleQueries } from "@/components/landing/ExampleQueries";
import { StatsCta } from "@/components/landing/StatsCta";
import { SiteFooter } from "@/components/landing/SiteFooter";

type NavItem = { label: string; href: string; hasChevron?: boolean };

const navLinks: NavItem[] = [
  { label: "Capabilities", href: "#capabilities" },
  { label: "How it works", href: "#how-it-works" },
  { label: "Sources", href: "#sources" },
  { label: "Pricing", href: "#" },
  { label: "Docs", href: "#" },
];

const heroPrompts = [
  "BRCA1 in homologous recombination",
  "KRAS G12C inhibitor structures",
  "Compare hemoglobin variants",
];

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-[#050508] text-zinc-50">
      {/* ── Hero ──────────────────────────────────────────────── */}
      <section className="mesh-hero relative flex flex-col">
        <header className="relative z-10 border-b border-white/[0.06] bg-black/20 backdrop-blur-md">
          <nav className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:h-16 sm:px-6 lg:px-8">
            <a
              href="/"
              className="flex items-center gap-2 font-semibold tracking-tight"
            >
              <BioLogo className="h-6 w-6 text-white" />
              <span className="text-lg">Biolable</span>
            </a>
            <ul className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-1 text-sm text-zinc-300 lg:flex">
              {navLinks.map(({ label, href, hasChevron }) => (
                <li key={label}>
                  <a
                    href={href}
                    className="flex items-center gap-0.5 rounded-md px-2.5 py-1.5 transition-colors hover:bg-white/[0.06] hover:text-white"
                  >
                    {label}
                    {hasChevron === true ? <NavChevron /> : null}
                  </a>
                </li>
              ))}
            </ul>
            <div className="flex items-center gap-3 sm:gap-4">
              <a
                href="#"
                className="hidden text-sm text-zinc-300 transition-colors hover:text-white sm:inline"
              >
                Log in
              </a>
              <a
                href="/chat"
                className="rounded-full bg-white px-4 py-2 text-sm font-medium text-zinc-900 transition-opacity hover:opacity-90"
              >
                Open Biolable
              </a>
            </div>
          </nav>
        </header>

        <main className="relative z-0 flex flex-1 flex-col items-center justify-center px-4 pb-28 pt-16 sm:px-6 sm:pb-36 sm:pt-24">
          <div className="mx-auto flex w-full max-w-3xl flex-col items-center text-center">
            <span className="eyebrow">
              Conversational protein research
            </span>
            <h1 className="mt-6 text-balance text-4xl font-semibold tracking-tight sm:text-5xl md:text-[3.5rem] md:leading-[1.05]">
              Ask the protein graph.
              <br />
              <span className="text-zinc-400">Get a structured answer.</span>
            </h1>
            <p className="mt-5 max-w-xl text-balance text-base text-zinc-400 sm:text-lg">
              Biolable turns natural-language questions into grounded
              answers backed by UniProt entries and PDB structures —
              ready to inspect in Mol*.
            </p>

            <div className="mt-10 w-full max-w-2xl sm:mt-12">
              <HeroChatInput />
            </div>

            <ul className="mt-5 flex flex-wrap items-center justify-center gap-2">
              <li>
                <span className="mono-cap pr-1">Try</span>
              </li>
              {heroPrompts.map((p) => (
                <li key={p}>
                  <a
                    href={`/chat?q=${encodeURIComponent(p)}`}
                    className="chip"
                  >
                    {p}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </main>
      </section>

      {/* ── Body ──────────────────────────────────────────────── */}
      <TrustStrip />
      <Capabilities />
      <Showcase />
      <HowItWorks />
      <ExampleQueries />
      <StatsCta />
      <SiteFooter />
    </div>
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

function NavChevron() {
  return (
    <svg
      className="h-3.5 w-3.5 text-zinc-500"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <path
        d="M6 9l6 6 6-6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
