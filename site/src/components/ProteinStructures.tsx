"use client";

import { useState } from "react";
import type { PdbStructure } from "@/app/api/chat/route";

type Props = {
  structures: PdbStructure[];
};

export function ProteinStructures({ structures }: Props) {
  const [viewerPdb, setViewerPdb] = useState<string | null>(null);

  if (!structures.length) return null;

  return (
    <div className="mt-3 rounded-xl border border-white/[0.08] bg-white/[0.03] p-2.5">
      <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
        3D Structures ({structures.length})
      </h4>

      {/* Horizontal scrollable thumbnail strip */}
      <div className="flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: "thin" }}>
        {structures.map((s) => (
          <button
            key={s.pdbId}
            type="button"
            onClick={() =>
              setViewerPdb(viewerPdb === s.pdbId ? null : s.pdbId)
            }
            className={`group relative shrink-0 overflow-hidden rounded-md border transition-all ${
              viewerPdb === s.pdbId
                ? "border-blue-500 ring-1 ring-blue-500/40"
                : "border-white/[0.08] hover:border-white/[0.15]"
            }`}
            style={{ width: 72, height: 72 }}
          >
            <div className="h-full w-full bg-zinc-900">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={s.imageUrl}
                alt={`PDB ${s.pdbId}`}
                loading="lazy"
                className="h-full w-full object-cover transition-transform group-hover:scale-110"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            </div>
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-1 pb-0.5 pt-3">
              <span className="block text-[9px] font-bold leading-tight text-white">
                {s.pdbId}
              </span>
              <span className="block text-[8px] leading-tight text-zinc-400">
                {s.method}
                {s.resolution ? ` · ${s.resolution}` : ""}
              </span>
            </div>
          </button>
        ))}
      </div>

      {viewerPdb && (
        <div className="mt-2 overflow-hidden rounded-lg border border-white/[0.08]">
          <div className="flex items-center justify-between bg-white/[0.04] px-2.5 py-1">
            <span className="text-[11px] font-medium text-zinc-300">
              Mol* — {viewerPdb}
            </span>
            <div className="flex items-center gap-2">
              <a
                href={`https://www.rcsb.org/structure/${viewerPdb}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-blue-400 hover:text-blue-300"
              >
                RCSB ↗
              </a>
              <button
                type="button"
                onClick={() => setViewerPdb(null)}
                className="text-[11px] text-zinc-500 hover:text-zinc-300"
                aria-label="Close viewer"
              >
                ✕
              </button>
            </div>
          </div>
          <iframe
            src={`https://molstar.org/viewer/?pdb=${viewerPdb}&preset=default&hide-controls=1`}
            title={`3D structure of ${viewerPdb}`}
            className="h-[240px] w-full border-0 bg-black sm:h-[280px]"
            allow="fullscreen"
          />
        </div>
      )}
    </div>
  );
}
