"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import { ProteinStructures } from "./ProteinStructures";
import type { PdbStructure } from "@/app/api/chat/route";

type Message = {
  role: "user" | "assistant";
  text: string;
  structures?: PdbStructure[];
};

export function ChatView({ initialQuery }: { initialQuery?: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const hasSentInitial = useRef(false);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      scrollRef.current?.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    }, 50);
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading, scrollToBottom]);

  const getHistory = useCallback(
    () =>
      messages.map((m) => ({
        role: m.role,
        text: m.text,
      })),
    [messages],
  );

  const sendFollowUp = useCallback(
    async (structures: PdbStructure[], currentMessages: Message[]) => {
      const ids = structures.map((s) => s.pdbId).join(", ");
      const prompt =
        `I just showed the user these PDB structures: ${ids}. ` +
        `Based on the resolution, method, and relevance, which one would you recommend they explore first and why? ` +
        `Keep it brief and friendly — 2-3 sentences max.`;

      const history = currentMessages.map((m) => ({
        role: m.role,
        text: m.text,
      }));

      setLoading(true);
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: prompt, history }),
        });
        const data = await res.json();
        const reply = data.reply ?? "";
        if (reply) {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", text: reply },
          ]);
        }
      } catch {
        // silently skip follow-up on failure
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const sendMessage = useCallback(
    async (text: string) => {
      const history = getHistory();
      setMessages((prev) => [...prev, { role: "user", text }]);
      setLoading(true);
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: text, history }),
        });
        const data = await res.json();
        const reply = data.reply ?? data.error ?? "No response";
        const structures: PdbStructure[] = data.structures ?? [];

        const updatedMessages: Message[] = [
          ...messages,
          { role: "user", text },
          { role: "assistant", text: reply, structures },
        ];
        setMessages(updatedMessages);

        if (structures.length > 0) {
          await sendFollowUp(structures, updatedMessages);
        }
      } catch {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", text: "Failed to reach the server." },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [getHistory, messages, sendFollowUp],
  );

  useEffect(() => {
    if (initialQuery && !hasSentInitial.current) {
      hasSentInitial.current = true;
      sendMessage(initialQuery);
    }
  }, [initialQuery, sendMessage]);

  const adjustHeight = () => {
    const el = areaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  };

  const send = () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    if (areaRef.current) areaRef.current.style.height = "auto";
    sendMessage(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* Scrollable messages area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-6 sm:px-6"
      >
        <div className="mx-auto flex max-w-3xl flex-col gap-4">
          {messages.length === 0 && (
            <div className="flex flex-1 flex-col items-center justify-center py-24 text-center">
              <BioIcon className="mb-4 h-10 w-10 text-zinc-600" />
              <p className="text-lg font-medium text-zinc-400">
                Ask about any protein, gene, or pathway
              </p>
              <p className="mt-1 text-sm text-zinc-600">
                Powered by Gemini + UniProt
              </p>
            </div>
          )}
          {messages.map((m, i) => (
            <MessageBubble
              key={i}
              message={m}
              onFindProtein={
                m.role === "assistant" &&
                (!m.structures || m.structures.length === 0) &&
                !loading
                  ? () => {
                      const snippet = m.text.slice(0, 300);
                      sendMessage(
                        `Based on this information, find the most relevant proteins in UniProt and show their 3D structures:\n\n"${snippet}"`,
                      );
                    }
                  : undefined
              }
            />
          ))}
          {loading && (
            <div className="flex items-center gap-1 self-start px-4 py-2 text-sm text-zinc-500">
              <span className="animate-pulse">●</span>
              <span className="animate-pulse [animation-delay:150ms]">●</span>
              <span className="animate-pulse [animation-delay:300ms]">●</span>
            </div>
          )}
        </div>
      </div>

      {/* Fixed bottom input */}
      <div className="shrink-0 border-t border-white/[0.06] bg-[#0a0a0d]/90 px-4 pb-4 pt-3 backdrop-blur-xl sm:px-6">
        <div className="mx-auto flex max-w-3xl items-end gap-2 rounded-xl border border-white/[0.08] bg-[#121214] px-3 py-2">
          <button
            type="button"
            className="mb-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-white/[0.06] hover:text-zinc-300"
            aria-label="Add attachment"
          >
            <PlusIcon />
          </button>
          <textarea
            ref={areaRef}
            rows={1}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              adjustHeight();
            }}
            onKeyDown={handleKeyDown}
            placeholder="Ask about any protein, gene, or pathway…"
            className="max-h-[120px] min-h-[36px] flex-1 resize-none bg-transparent py-1.5 text-sm leading-snug text-zinc-100 placeholder:text-zinc-500 focus:outline-none"
          />
          <button
            type="button"
            onClick={send}
            disabled={loading || !input.trim()}
            className="mb-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-zinc-900 transition-transform hover:scale-105 active:scale-95 disabled:opacity-40"
            aria-label="Send"
          >
            <ArrowUpIcon />
          </button>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({
  message,
  onFindProtein,
}: {
  message: Message;
  onFindProtein?: () => void;
}) {
  if (message.role === "user") {
    return (
      <div className="max-w-[80%] self-end whitespace-pre-wrap rounded-2xl rounded-br-md bg-zinc-200 px-4 py-2.5 text-left text-sm leading-relaxed text-zinc-900">
        {message.text}
      </div>
    );
  }

  const hasStructures =
    message.structures && message.structures.length > 0;

  return (
    <div className="max-w-full self-start rounded-2xl rounded-bl-md bg-white/[0.06] px-4 py-3 text-left text-sm leading-relaxed text-zinc-100">
      <ReactMarkdown
        components={{
          p: ({ children }) => <p className="my-1.5">{children}</p>,
          strong: ({ children }) => (
            <strong className="font-semibold text-white">{children}</strong>
          ),
          em: ({ children }) => (
            <em className="italic text-zinc-300">{children}</em>
          ),
          code: ({ children }) => (
            <code className="rounded bg-white/10 px-1.5 py-0.5 text-[13px] text-zinc-200">
              {children}
            </code>
          ),
          pre: ({ children }) => (
            <pre className="my-2 overflow-x-auto rounded-lg bg-white/[0.05] p-3 text-[13px]">
              {children}
            </pre>
          ),
          ul: ({ children }) => (
            <ul className="my-2 list-disc space-y-1 pl-5">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="my-2 list-decimal space-y-1 pl-5">{children}</ol>
          ),
          li: ({ children }) => <li className="pl-0.5">{children}</li>,
          h1: ({ children }) => (
            <h1 className="mb-2 mt-3 text-lg font-bold text-white">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="mb-1.5 mt-3 text-base font-bold text-white">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="mb-1 mt-2 text-sm font-bold text-white">
              {children}
            </h3>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 underline decoration-blue-400/40 hover:decoration-blue-400"
            >
              {children}
            </a>
          ),
          blockquote: ({ children }) => (
            <blockquote className="my-2 border-l-2 border-zinc-500 pl-3 text-zinc-400">
              {children}
            </blockquote>
          ),
        }}
      >
        {message.text}
      </ReactMarkdown>
      {hasStructures && (
        <ProteinStructures structures={message.structures!} />
      )}
      {!hasStructures && onFindProtein && (
        <button
          type="button"
          onClick={onFindProtein}
          className="mt-3 flex items-center gap-1.5 rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-1.5 text-xs font-medium text-blue-400 transition-colors hover:bg-blue-500/20 hover:text-blue-300"
        >
          <SearchIcon />
          Find Related Proteins
        </button>
      )}
    </div>
  );
}

function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
      <path d="M16 16l4.5 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function BioIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
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

function PlusIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 5v14M5 12h14"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ArrowUpIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 19V5M5 12l7-7 7 7"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
