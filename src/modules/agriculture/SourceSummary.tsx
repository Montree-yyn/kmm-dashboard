"use client";

import { BookOpen, ChevronDown, ExternalLink } from "lucide-react";
import { useState } from "react";
import { cn } from "../../../lib/utils";
import { formatNumber } from "./agriculture.data-charts";
import type { SourceGroup } from "./agriculture.data-view";

type Copy = ReturnType<typeof import("./agriculture.ui").agricultureCopy>["dataView"];

export function SourceSummary({ sources, copy }: { sources: SourceGroup[]; copy: Copy }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? sources : sources.slice(0, 4);
  return (
    <section className="rounded-[var(--radius-card)] border border-[var(--border-default)] bg-[var(--surface-default)] p-5 shadow-[var(--shadow-card)]" data-agri-sources>
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[#fdf6dc] text-[#8a6a00]"><BookOpen size={16} /></span>
          <div className="min-w-0">
            <h2 className="truncate text-[16px] font-semibold text-[var(--text-primary)]">{copy.sourcesTitle}</h2>
            <p className="mt-0.5 truncate text-[11px] text-[var(--text-secondary)]">{copy.sourcesSub}</p>
          </div>
        </div>
        {sources.length > 4 && <span className="shrink-0 rounded-full bg-[var(--surface-subtle)] px-2.5 py-1 text-[10px] font-semibold text-[var(--text-tertiary)]">{copy.viewAllSources.replace("{n}", String(sources.length))}</span>}
      </div>
      {sources.length ? (
        <>
          <ul className="mt-4 space-y-2">
            {visible.map((source) => (
              <li key={source.sourceId} className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-subtle)] p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 text-[11px] font-semibold leading-5 text-[var(--text-primary)]">{source.name}</p>
                  {source.uri && <a href={source.uri} target="_blank" rel="noreferrer" className="mt-0.5 shrink-0 text-[var(--text-tertiary)] transition hover:text-[#47763d]" aria-label={source.name}><ExternalLink size={12} /></a>}
                </div>
                <p className="mt-1 text-[10px] text-[var(--text-secondary)]">{formatNumber(source.recordCount)} {copy.sourceRecords}{source.kinds.length > 1 ? ` · ${source.kinds.join(", ")}` : ""}</p>
              </li>
            ))}
          </ul>
          {sources.length > 4 && (
            <button type="button" onClick={() => setExpanded((current) => !current)} className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-[#47763d] transition hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]">
              {expanded ? copy.showLess : copy.showMore}
              <ChevronDown size={13} className={cn("transition-transform", expanded && "rotate-180")} />
            </button>
          )}
        </>
      ) : (
        <div className="mt-4 rounded-xl border border-dashed border-[var(--border-default)] bg-[var(--surface-subtle)] p-4 text-xs text-[var(--text-secondary)]">{copy.sourcesEmpty}</div>
      )}
    </section>
  );
}
