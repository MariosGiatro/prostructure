import { ChatView } from "@/components/ChatInput";

export const metadata = {
  title: "Chat — Biolable",
  description: "Chat with AI about proteins, genes, and pathways",
};

export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;

  return (
    <div className="flex h-screen flex-col bg-[#050508] text-zinc-50">
      <header className="flex shrink-0 items-center justify-between border-b border-white/[0.06] bg-black/30 px-4 backdrop-blur-md sm:px-6">
        <a
          href="/"
          className="flex items-center gap-2 py-3 font-semibold tracking-tight text-white"
        >
          <BioLogo className="h-5 w-5" />
          <span className="text-sm">Biolable</span>
        </a>
        <span className="text-xs text-zinc-500">Gemini + UniProt</span>
      </header>

      <div className="flex-1 overflow-hidden">
        <ChatView initialQuery={q} />
      </div>
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
