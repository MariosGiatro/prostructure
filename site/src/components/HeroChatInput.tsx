"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

export function HeroChatInput() {
  const [input, setInput] = useState("");
  const [buildOpen, setBuildOpen] = useState(false);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const router = useRouter();

  const adjustHeight = () => {
    const el = areaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  };

  const submit = () => {
    const text = input.trim();
    if (!text) return;
    const encoded = encodeURIComponent(text);
    router.push(`/chat?q=${encoded}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="relative w-full rounded-2xl border border-white/[0.08] bg-[#121214]/90 shadow-[0_24px_80px_-20px_rgba(0,0,0,0.65)] backdrop-blur-xl">
      <div className="p-4 pb-2">
        <textarea
          ref={areaRef}
          rows={3}
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            adjustHeight();
          }}
          onKeyDown={handleKeyDown}
          placeholder="Ask about any protein, gene, or pathway…"
          className="max-h-[200px] min-h-[88px] w-full resize-none bg-transparent text-[15px] leading-relaxed text-zinc-100 placeholder:text-zinc-500 focus:outline-none"
        />
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-white/[0.06] px-3 py-2.5">
        <button
          type="button"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-white/[0.06] hover:text-zinc-200"
          aria-label="Add attachment"
        >
          <PlusIcon />
        </button>
        <div className="flex flex-1 items-center justify-end gap-1.5 sm:gap-2">
          <div className="relative">
            <button
              type="button"
              onClick={() => setBuildOpen((o) => !o)}
              className="flex h-9 items-center gap-1 rounded-full border border-white/[0.1] bg-white/[0.04] px-3 text-sm font-medium text-zinc-200 transition-colors hover:bg-white/[0.08]"
              aria-expanded={buildOpen}
              aria-haspopup="listbox"
            >
              Build
              <ChevronDownIcon className={buildOpen ? "rotate-180" : ""} />
            </button>
            {buildOpen && (
              <>
                <button
                  type="button"
                  className="fixed inset-0 z-10 cursor-default"
                  aria-label="Close menu"
                  onClick={() => setBuildOpen(false)}
                />
                <ul
                  className="absolute bottom-full right-0 z-20 mb-2 min-w-[140px] rounded-xl border border-white/[0.1] bg-[#1a1a1d] py-1 shadow-xl"
                  role="listbox"
                >
                  {["App", "Website", "Prototype"].map((label) => (
                    <li key={label}>
                      <button
                        type="button"
                        className="w-full px-3 py-2 text-left text-sm text-zinc-200 hover:bg-white/[0.06]"
                        onClick={() => setBuildOpen(false)}
                      >
                        {label}
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
          <button
            type="button"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-white/[0.06] hover:text-zinc-200"
            aria-label="Voice input"
          >
            <MicIcon />
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!input.trim()}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-zinc-900 transition-transform hover:scale-105 active:scale-95 disabled:opacity-40"
            aria-label="Send"
          >
            <ArrowUpIcon />
          </button>
        </div>
      </div>
    </div>
  );
}

function PlusIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function ChevronDownIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={`h-4 w-4 transition-transform ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MicIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 14a3 3 0 003-3V5a3 3 0 10-6 0v6a3 3 0 003 3z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M19 10v1a7 7 0 01-14 0v-1M12 18v4M8 22h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ArrowUpIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 19V5M5 12l7-7 7 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
