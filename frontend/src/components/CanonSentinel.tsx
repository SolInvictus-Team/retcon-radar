/**
 * frontend/src/components/CanonSentinel.tsx
 * Right Canon Sentinel container: Graph and Lore tabs.
 * Rounded glass panel styling with sentence case typography and no purple/indigo.
 */

import React, { useState } from "react";
import { Share2, BookMarked, ShieldCheck } from "lucide-react";
import { GraphPanel } from "./GraphPanel";
import { LorePanel } from "./LorePanel";
import { useStoryStore } from "../store/useStoryStore";

export const CanonSentinel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"graph" | "lore">("graph");
  const { currentProject } = useStoryStore();

  const charCount = currentProject?.lore?.characters?.length || 0;
  const itemCount = currentProject?.lore?.items?.length || 0;

  return (
    <aside className="w-full h-full flex flex-col select-none overflow-hidden">
      {/* Sentinel Header */}
      <div className="h-12 border-b border-white/80 px-4 flex items-center justify-between glass-control">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-accent" />
          <h2 className="text-base font-serif font-medium text-ink">
            Canon Sentinel
          </h2>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-white/60 p-0.5 rounded-control border border-white/80">
          <button
            onClick={() => setActiveTab("graph")}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-[8px] text-xs font-serif transition-all ${
              activeTab === "graph"
                ? "bg-white text-accent font-medium shadow-sm"
                : "text-muted hover:text-ink"
            }`}
          >
            <Share2 className="w-3.5 h-3.5" />
            Graph
          </button>
          <button
            onClick={() => setActiveTab("lore")}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-[8px] text-xs font-serif transition-all ${
              activeTab === "lore"
                ? "bg-white text-accent font-medium shadow-sm"
                : "text-muted hover:text-ink"
            }`}
          >
            <BookMarked className="w-3.5 h-3.5" />
            Lore
            {(charCount > 0 || itemCount > 0) && (
              <span className="text-xs opacity-75">({charCount + itemCount})</span>
            )}
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 relative overflow-hidden flex flex-col">
        {activeTab === "graph" ? <GraphPanel /> : <LorePanel />}
      </div>
    </aside>
  );
};
