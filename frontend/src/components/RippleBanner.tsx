/**
 * frontend/src/components/RippleBanner.tsx
 * Downstream ripple impact banner shown when earlier scene edits change downstream state.
 * Restyled with gentle glass tint and Newsreader typography.
 */

import React from "react";
import { Waves, X, ArrowRight } from "lucide-react";
import { useStoryStore } from "../store/useStoryStore";

export const RippleBanner: React.FC = () => {
  const { affectedScenes, dismissRipple, currentProject, selectChapter } = useStoryStore();

  if (affectedScenes.length === 0) return null;

  return (
    <div className="bg-[#fbf7ee]/95 backdrop-blur-[12px] border-b border-[#e8dfc8] px-6 py-2 flex items-center justify-between text-xs text-ink select-none animate-in fade-in duration-150 font-serif shadow-sm">
      <div className="flex items-center gap-2.5">
        <span className="p-1 bg-[#c9822b]/15 rounded-control text-[#c9822b]">
          <Waves className="w-4 h-4 animate-pulse" />
        </span>
        <span className="text-xs">
          <strong className="font-medium text-[#78541c]">Downstream ripple:</strong> Your earlier edit changed continuity facts in{" "}
          <span className="font-serif italic font-medium underline text-ink">
            {affectedScenes.length} later scene{affectedScenes.length > 1 ? "s" : ""} (Scene{" "}
            {affectedScenes.join(", ")})
          </span>
          .
        </span>
      </div>

      <div className="flex items-center gap-3">
        {currentProject && affectedScenes.length > 0 && (
          <button
            onClick={() => {
              const targetSceneIdx = affectedScenes[0];
              const targetChapter = currentProject.chapters.find((c) => c.index === targetSceneIdx);
              if (targetChapter) selectChapter(targetChapter.id);
            }}
            className="flex items-center gap-1 text-xs bg-[#c9822b] text-white font-medium px-2.5 py-1 rounded-control hover:bg-[#b07024] transition-colors shadow-sm"
          >
            Review Scene {affectedScenes[0]} <ArrowRight className="w-3 h-3" />
          </button>
        )}
        <button
          onClick={dismissRipple}
          className="p-1 hover:bg-black/5 rounded-control text-muted hover:text-ink transition-colors"
          title="Dismiss banner"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
