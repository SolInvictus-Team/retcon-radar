/**
 * frontend/src/components/ConflictPanel.tsx
 * Conflict detail side panel sliding over Canon Sentinel graph area.
 * 200ms slide-in, close with X or Esc.
 * Shows explanation, source origin with Jump to source / Back to Scene N,
 * rule reason, and 3 lazy context-aware patches with 429 countdown handling.
 */

import React, { useEffect } from "react";
import {
  AlertOctagon,
  X,
  ExternalLink,
  Wand2,
  Loader2,
  Check,
  Sparkles,
  GitCommit,
  Layers,
  FileEdit,
  ArrowLeft,
  Info,
} from "lucide-react";
import { useStoryStore } from "../store/useStoryStore";
import { Conflict, PatchSuggestion } from "../types";

export const ConflictPanel: React.FC = () => {
  const {
    selectedConflict,
    isPatchLoading,
    patches,
    currentProject,
    jumpOriginSceneIndex,
    rateLimitCountdown,
    setSelectedConflict,
    loadPatchesForConflict,
    applyPatch,
    jumpToSource,
    backToConflictScene,
  } = useStoryStore();

  // Close panel on Esc key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelectedConflict(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [setSelectedConflict]);

  if (!selectedConflict) return null;

  // Retrieve breaking sentence text
  const currentChapter = currentProject?.chapters.find(
    (c) => c.index === selectedConflict.scene_index
  );
  const breakingSentenceText = currentChapter
    ? findSentenceText(currentChapter.text, selectedConflict.sentence_id)
    : "";

  // Retrieve source sentence text if caused_by is present
  const sourceChapter = selectedConflict.caused_by
    ? currentProject?.chapters.find(
        (c) => c.index === selectedConflict.caused_by?.scene_index
      )
    : null;
  const sourceSentenceText =
    sourceChapter && selectedConflict.caused_by
      ? findSentenceText(sourceChapter.text, selectedConflict.caused_by.sentence_id)
      : "";

  const getRuleExplanation = (rule: string) => {
    switch (rule) {
      case "INJURED_PART_HEAVY_USE":
        return "An injured body part cannot be used heavily until it has healed.";
      case "UNOWNED_ITEM_USE":
        return "A character cannot use an item that has been lost, destroyed, or not yet acquired.";
      case "UNOWNED_ITEM_TRANSFER":
        return "A character cannot transfer an item they do not currently hold.";
      case "DEAD_CHARACTER_ACTION":
        return "A deceased character cannot take physical actions in subsequent scenes.";
      case "MUTUALLY_EXCLUSIVE_LOCATION":
        return "A character cannot physically be in two distant places simultaneously.";
      default:
        return "This action contradicts established canon facts and continuity invariants from earlier scenes.";
    }
  };

  const getPatchBadge = (type: string) => {
    switch (type) {
      case "modify_source":
        return {
          label: "Modify earlier scene",
          icon: <GitCommit className="w-3.5 h-3.5 text-accent" />,
          color: "bg-accent/10 border-accent/30 text-accent",
        };
      case "bridge_gap":
        return {
          label: "Bridge gap",
          icon: <Layers className="w-3.5 h-3.5 text-ok" />,
          color: "bg-ok/10 border-ok/30 text-ok",
        };
      case "override_rule":
      default:
        return {
          label: "Rewrite this sentence",
          icon: <FileEdit className="w-3.5 h-3.5 text-[#8f5d1e]" />,
          color: "bg-[#f5ebd7] border-[#d4be95] text-[#6d4411]",
        };
    }
  };

  return (
    <div className="absolute inset-0 z-30 glass-panel border-l border-white/90 shadow-sheet flex flex-col select-none slide-in-200 font-serif overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-white/80 flex items-center justify-between bg-conflict/5 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-conflict/10 rounded-control text-conflict">
            <AlertOctagon className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-serif italic text-conflict font-medium block">
              Continuity conflict
            </span>
            <h3 className="text-sm font-medium text-ink truncate max-w-[280px]">
              {selectedConflict.rule}
            </h3>
          </div>
        </div>

        <button
          onClick={() => setSelectedConflict(null)}
          className="p-1.5 hover:bg-white/80 rounded-control text-muted hover:text-ink transition-colors"
          title="Close panel (Esc)"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Scrollable Content Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Back Link if currently jumped to source */}
        {jumpOriginSceneIndex !== null && (
          <div className="p-2.5 bg-accent/10 border border-accent/20 rounded-control flex items-center justify-between text-xs">
            <span className="text-accent font-serif italic">
              Viewing source in Scene {selectedConflict.caused_by?.scene_index}
            </span>
            <button
              onClick={backToConflictScene}
              className="flex items-center gap-1 text-accent font-medium hover:underline cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to Scene {jumpOriginSceneIndex}
            </button>
          </div>
        )}

        {/* 1. What's the conflict */}
        <div className="glass-card rounded-card p-4 space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-serif italic text-muted">
              What's the conflict
            </h4>
            <span className="text-[11px] font-mono uppercase px-2 py-0.5 rounded bg-conflict/10 text-conflict border border-conflict/20">
              Severity: {selectedConflict.severity}
            </span>
          </div>

          <p className="text-sm text-ink leading-relaxed font-normal">
            {selectedConflict.message}
          </p>

          {breakingSentenceText && (
            <div className="p-2.5 bg-white/70 rounded-control border border-white/90 text-xs font-mono text-ink italic">
              "{breakingSentenceText}"
            </div>
          )}

          <div className="pt-2 border-t border-black/[0.05] text-xs text-muted flex items-center justify-between font-serif italic">
            <span>Location: Scene {selectedConflict.scene_index}</span>
            <span>Sentence ID: {selectedConflict.sentence_id}</span>
          </div>
        </div>

        {/* 2. Where it comes from */}
        {selectedConflict.caused_by && (
          <div className="glass-card rounded-card p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-serif italic text-muted">
                Where it comes from
              </h4>
              <span className="text-xs bg-white/80 text-ink px-2 py-0.5 rounded-control font-serif italic border border-white/90">
                Scene {selectedConflict.caused_by.scene_index} ({selectedConflict.caused_by.event.toLowerCase()})
              </span>
            </div>

            {sourceSentenceText ? (
              <div className="p-2.5 bg-white/70 rounded-control border border-white/90 text-xs font-mono text-ink italic">
                "{sourceSentenceText}"
              </div>
            ) : (
              <p className="text-xs text-muted leading-relaxed">
                The fact violated here was established earlier in{" "}
                <strong className="text-ink">
                  Scene {selectedConflict.caused_by.scene_index}
                </strong>.
              </p>
            )}

            <button
              onClick={() => jumpToSource(selectedConflict)}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-white/70 hover:bg-white text-ink border border-white/90 rounded-control text-xs font-medium transition-all shadow-sm cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5 text-accent" />
              Jump to source (Scene {selectedConflict.caused_by.scene_index})
            </button>
          </div>
        )}

        {/* 3. Why it's a problem */}
        <div className="glass-card rounded-card p-4 space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-serif italic text-muted">
            <Info className="w-3.5 h-3.5 text-accent" />
            <span>Why it's a problem</span>
          </div>
          <p className="text-xs text-ink/90 leading-relaxed font-normal">
            {getRuleExplanation(selectedConflict.rule)}
          </p>
        </div>

        {/* 4. Context-aware patches */}
        <div className="space-y-3 pt-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Wand2 className="w-4 h-4 text-accent" />
              <h4 className="text-xs font-serif italic text-muted">
                Context-aware patches
              </h4>
            </div>

            {patches.length === 0 && !isPatchLoading && rateLimitCountdown === null && (
              <button
                onClick={() => loadPatchesForConflict(selectedConflict.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-accent hover:bg-accent-hover text-white rounded-control text-xs font-serif transition-colors shadow-sm cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Suggest 3 fixes
              </button>
            )}
          </div>

          {/* Placeholder before clicking Suggest 3 fixes */}
          {patches.length === 0 && !isPatchLoading && rateLimitCountdown === null && (
            <div className="p-4 glass-card rounded-card text-center text-xs text-muted font-serif italic">
              No fixes yet.
            </div>
          )}

          {/* 429 Rate Limit Countdown Alert */}
          {rateLimitCountdown !== null && (
            <div className="p-3.5 glass-card rounded-card border-conflict/30 bg-conflict/5 text-xs text-conflict font-serif space-y-1">
              <div className="font-medium">Rate limit reached (429)</div>
              <p className="text-muted italic">
                Retrying in {rateLimitCountdown} seconds...
              </p>
            </div>
          )}

          {/* Loading Skeleton */}
          {isPatchLoading && (
            <div className="space-y-3 p-4 glass-card rounded-card">
              <div className="flex items-center gap-2 text-xs text-accent font-serif italic">
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating 3 context-aware fixes...
              </div>
              <div className="h-14 bg-white/40 animate-pulse rounded-control" />
              <div className="h-14 bg-white/40 animate-pulse rounded-control" />
              <div className="h-14 bg-white/40 animate-pulse rounded-control" />
            </div>
          )}

          {/* Render 3 Patch Cards */}
          {patches.length > 0 && (
            <div className="space-y-3">
              {patches.map((patch) => {
                const badge = getPatchBadge(patch.type);
                const targetIdx =
                  patch.target_scene_index ?? selectedConflict.scene_index;
                return (
                  <div
                    key={patch.id}
                    className="glass-card rounded-card p-4 space-y-2.5 hover:bg-white/80 transition-all border border-white/90 shadow-sm"
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-control border flex items-center gap-1 font-serif italic ${badge.color}`}
                      >
                        {badge.icon}
                        {badge.label}
                      </span>
                      <span className="text-xs text-muted font-serif italic">
                        Target: Scene {targetIdx}
                      </span>
                    </div>

                    <h5 className="text-sm font-medium text-ink">{patch.title}</h5>
                    <p className="text-xs text-muted leading-relaxed">
                      {patch.description}
                    </p>

                    {patch.suggested_text && (
                      <div className="p-2.5 bg-white/80 rounded-control border border-white/90 text-xs font-mono text-ink italic leading-relaxed">
                        "{patch.suggested_text}"
                      </div>
                    )}

                    <button
                      onClick={() => applyPatch(patch)}
                      className="w-full mt-1.5 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-accent/10 hover:bg-accent text-accent hover:text-white border border-accent/30 rounded-control text-xs font-serif transition-colors cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      Apply this fix
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

function findSentenceText(text: string, sentenceId?: string): string {
  if (!text || !sentenceId) return "";
  const parts = sentenceId.split("_");
  const idx = parseInt(parts[parts.length - 1], 10);
  if (isNaN(idx)) return "";

  const regex = /[^.!?\n]+(?:[.!?]+|\n+|$)/g;
  let match;
  let cur = 1;
  while ((match = regex.exec(text)) !== null) {
    const raw = match[0].trim();
    if (!raw) continue;
    if (cur === idx) return raw;
    cur++;
  }
  return "";
}
