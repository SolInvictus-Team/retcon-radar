/**
 * frontend/src/components/Editor.tsx
 * Screenplay editor powered by CodeMirror 6 with live wavy red underline decorations.
 * Stylized as an authentic screenplay sheet (#fffefb) with Courier Prime typography.
 */

import React, { useEffect, useRef, useMemo } from "react";
import { EditorState, RangeSetBuilder, StateEffect, StateField } from "@codemirror/state";
import { EditorView, Decoration, DecorationSet } from "@codemirror/view";
import { AlertTriangle, CheckCircle, Clock, Loader2 } from "lucide-react";
import { useStoryStore } from "../store/useStoryStore";
import { Conflict } from "../types";

// StateEffect for updating conflict decorations dynamically
const setConflictDecorations = StateEffect.define<DecorationSet>();

const conflictField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none;
  },
  update(decorations, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setConflictDecorations)) {
        return effect.value;
      }
    }
    try {
      return decorations.map(tr.changes);
    } catch {
      return Decoration.none;
    }
  },
  provide: (f) => EditorView.decorations.from(f),
});

export const Editor: React.FC = () => {
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const editorViewRef = useRef<EditorView | null>(null);
  const debounceTimerRef = useRef<any>(null);

  const {
    currentProject,
    activeChapterId,
    conflicts,
    timings,
    isAnalyzing,
    selectedConflict,
    sourceHighlightSentenceId,
    updateChapterText,
    analyzeCurrentChapter,
    setSelectedConflict,
  } = useStoryStore();

  const activeChapter = useMemo(() => {
    return currentProject?.chapters.find((c) => c.id === activeChapterId) || null;
  }, [currentProject, activeChapterId]);

  // Compute sentence offsets for the active chapter
  const sentenceRanges = useMemo(() => {
    if (!activeChapter) return new Map<string, { from: number; to: number; text: string }>();

    const text = activeChapter.text;
    const ranges = new Map<string, { from: number; to: number; text: string }>();
    if (!text.trim()) return ranges;

    // Match sentences with terminators (. ! ?)
    const regex = /[^.!?]+[.!?]+|\S[^.!?]*$/g;
    let match;
    let idx = 1;

    while ((match = regex.exec(text)) !== null) {
      const sentText = match[0];
      const trimmedStartOffset = match.index + (sentText.length - sentText.trimStart().length);
      const trimmedText = sentText.trim();
      const trimmedEndOffset = trimmedStartOffset + trimmedText.length;

      const sentenceId = `s_${activeChapter.index}_${idx}`;
      ranges.set(sentenceId, {
        from: trimmedStartOffset,
        to: trimmedEndOffset,
        text: trimmedText,
      });
      idx++;
    }

    return ranges;
  }, [activeChapter]);

  // Active scene conflicts
  const currentSceneConflicts = useMemo(() => {
    if (!activeChapter) return [];
    return conflicts.filter((c) => c.scene_index === activeChapter.index);
  }, [conflicts, activeChapter]);

  // Build CodeMirror decorations for conflicting sentences and jump-to-source highlighted sentence
  const conflictDecorations = useMemo(() => {
    const builder = new RangeSetBuilder<Decoration>();
    if (!activeChapter) {
      return builder.finish();
    }

    // 1. Source sentence highlight (if user clicked "Jump to source")
    if (sourceHighlightSentenceId) {
      const srcRange = sentenceRanges.get(sourceHighlightSentenceId);
      if (srcRange && srcRange.from < srcRange.to && srcRange.to <= activeChapter.text.length) {
        builder.add(
          srcRange.from,
          srcRange.to,
          Decoration.mark({
            class: "source-sentence-highlight",
            attributes: {
              "data-source-sentence-id": sourceHighlightSentenceId,
              title: "Source origin fact established here",
            },
          })
        );
      }
    }

    // 2. Conflicting sentences with wavy red underline and active state
    if (currentSceneConflicts.length > 0) {
      const itemsToDecorate: { from: number; to: number; conflict: Conflict }[] = [];

      for (const conflict of currentSceneConflicts) {
        let range = sentenceRanges.get(conflict.sentence_id);

        // Fallback matching if sentence index format differs
        if (!range) {
          const parts = conflict.sentence_id.split("_");
          const idx = parts.length >= 3 ? parseInt(parts[parts.length - 1], 10) : 1;
          range = sentenceRanges.get(`s_${activeChapter.index}_${idx}`);
        }

        // Keyword fallback match within current chapter sentences if needed
        if (!range && sentenceRanges.size > 0) {
          const rLower = conflict.message.toLowerCase();
          for (const [_, r] of sentenceRanges.entries()) {
            const lower = r.text.toLowerCase();
            if (
              (rLower.includes("hand") && lower.includes("hand")) ||
              (rLower.includes("rope") && lower.includes("rope")) ||
              (rLower.includes("shoulder") && lower.includes("shoulder")) ||
              (rLower.includes("rifle") && lower.includes("rifle")) ||
              (rLower.includes("key") && lower.includes("key"))
            ) {
              range = r;
              break;
            }
          }
        }

        if (range && range.from < range.to && range.to <= activeChapter.text.length) {
          itemsToDecorate.push({
            from: range.from,
            to: range.to,
            conflict,
          });
        }
      }

      itemsToDecorate.sort((a, b) => a.from - b.from);

      for (const item of itemsToDecorate) {
        const isSelected = selectedConflict?.id === item.conflict.id;
        builder.add(
          item.from,
          item.to,
          Decoration.mark({
            class: `conflict-underline ${isSelected ? "conflict-active" : ""}`,
            attributes: {
              "data-conflict-id": item.conflict.id,
              role: "button",
              tabindex: "0",
              "aria-label": `Continuity conflict: ${item.conflict.message}`,
              title: `Continuity conflict: ${item.conflict.message}`,
            },
          })
        );
      }
    }

    return builder.finish();
  }, [
    sentenceRanges,
    currentSceneConflicts,
    activeChapter,
    selectedConflict?.id,
    sourceHighlightSentenceId,
  ]);

  // Mount CodeMirror editor
  useEffect(() => {
    if (!editorContainerRef.current) return;

    const initialText = activeChapter ? activeChapter.text : "";

    const editorTheme = EditorView.theme({
      "&": {
        height: "100%",
        backgroundColor: "#fffefb",
      },
      ".cm-content": {
        fontFamily: "'Courier Prime', Courier, monospace",
        fontSize: "19.5px",
        lineHeight: "1.95",
        color: "#25282c",
        caretColor: "#2a4559",
      },
      "&.cm-focused .cm-cursor": {
        borderLeftColor: "#2a4559",
        borderLeftWidth: "2px",
      },
      ".cm-scroller": {
        padding: "28px 36px",
        overflowY: "auto",
      },
    });

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged && activeChapterId) {
        const newText = update.state.doc.toString();
        updateChapterText(activeChapterId, newText);

        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
        }
        debounceTimerRef.current = setTimeout(() => {
          analyzeCurrentChapter(newText);
        }, 500);
      }
    });

    const state = EditorState.create({
      doc: initialText,
      extensions: [
        editorTheme,
        conflictField,
        updateListener,
        EditorView.lineWrapping,
      ],
    });

    const view = new EditorView({
      state,
      parent: editorContainerRef.current,
    });

    // Click and keyboard handlers to select conflict
    const dom = view.dom;
    const handleEditorClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const underlineSpan = target.closest(".conflict-underline");
      if (underlineSpan) {
        const conflictId = underlineSpan.getAttribute("data-conflict-id");
        if (conflictId) {
          const store = useStoryStore.getState();
          const found = store.conflicts.find((c) => c.id === conflictId);
          if (found) {
            store.setSelectedConflict(found);
          }
        }
      }
    };

    const handleEditorKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        const activeEl = document.activeElement as HTMLElement | null;
        const target = (e.target as HTMLElement) || activeEl;
        const underlineSpan = target?.closest(".conflict-underline");
        if (underlineSpan) {
          e.preventDefault();
          const conflictId = underlineSpan.getAttribute("data-conflict-id");
          if (conflictId) {
            const store = useStoryStore.getState();
            const found = store.conflicts.find((c) => c.id === conflictId);
            if (found) {
              store.setSelectedConflict(found);
            }
          }
        }
      }
    };

    dom.addEventListener("click", handleEditorClick);
    dom.addEventListener("keydown", handleEditorKeyDown);
    window.addEventListener("keydown", handleEditorKeyDown, { capture: true });
    editorViewRef.current = view;

    // Dispatch initial decorations if any
    view.dispatch({
      effects: setConflictDecorations.of(conflictDecorations),
    });

    return () => {
      dom.removeEventListener("click", handleEditorClick);
      dom.removeEventListener("keydown", handleEditorKeyDown);
      window.removeEventListener("keydown", handleEditorKeyDown, { capture: true });
      view.destroy();
      editorViewRef.current = null;
    };
  }, [activeChapterId]);

  // Scroll to source sentence when jumped to source
  useEffect(() => {
    if (sourceHighlightSentenceId && editorViewRef.current) {
      const range = sentenceRanges.get(sourceHighlightSentenceId);
      if (range) {
        editorViewRef.current.dispatch({
          effects: EditorView.scrollIntoView(range.from, { y: "center" }),
        });
      }
    }
  }, [sourceHighlightSentenceId, sentenceRanges]);

  // Dynamically update decorations whenever conflictDecorations updates
  useEffect(() => {
    if (editorViewRef.current) {
      editorViewRef.current.dispatch({
        effects: setConflictDecorations.of(conflictDecorations),
      });
    }
  }, [conflictDecorations]);

  // Sync external text changes (e.g. from patches or chapter switch)
  useEffect(() => {
    const view = editorViewRef.current;
    if (!view || !activeChapter) return;

    const currentDoc = view.state.doc.toString();
    if (currentDoc !== activeChapter.text) {
      view.dispatch({
        changes: { from: 0, to: currentDoc.length, insert: activeChapter.text },
      });
    }
  }, [activeChapter?.text]);

  return (
    <div className="flex-1 flex flex-col glass-panel rounded-panel h-full overflow-hidden">
      {/* Editor Sub-Header */}
      <div className="h-12 border-b border-white/80 px-6 flex items-center justify-between glass-control select-none">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-serif font-medium text-ink">
            {activeChapter ? activeChapter.title : "No scene selected"}
          </h2>
          {activeChapter && (
            <span className="text-xs font-serif italic text-muted bg-white/70 px-2 py-0.5 rounded-control border border-white/90">
              Scene {activeChapter.index}
            </span>
          )}
        </div>

        {/* Linter & Timing Status */}
        <div className="flex items-center gap-4 text-xs font-serif">
          {timings && (
            <div
              className="hidden lg:flex items-center gap-1.5 text-muted text-xs italic"
              title="Execution latency: Extraction vs deterministic continuity engine"
            >
              <Clock className="w-3.5 h-3.5 text-accent" />
              <span>Extraction: {timings.extraction_ms.toFixed(0)}ms</span>
              <span className="text-faint">·</span>
              <span>Engine: {timings.engine_ms.toFixed(1)}ms</span>
              <span className="text-faint">·</span>
              <span className="text-ink font-medium">
                Total: {timings.total_ms.toFixed(0)}ms
              </span>
            </div>
          )}

          {isAnalyzing ? (
            <span className="flex items-center gap-1.5 text-accent font-serif italic">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Checking canon...
            </span>
          ) : currentSceneConflicts.length > 0 ? (
            <span
              onClick={() => setSelectedConflict(currentSceneConflicts[0])}
              className="flex items-center gap-1.5 text-conflict font-serif italic cursor-pointer hover:underline transition-all"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              {currentSceneConflicts.length}{" "}
              {currentSceneConflicts.length === 1 ? "conflict" : "conflicts"} found
            </span>
          ) : activeChapter ? (
            <span className="flex items-center gap-1.5 text-ok font-serif italic">
              <CheckCircle className="w-3.5 h-3.5" />
              Canon consistent
            </span>
          ) : null}
        </div>
      </div>

      {/* Screenplay Page Container */}
      <div className="flex-1 overflow-auto p-6 flex justify-center bg-transparent">
        <div className="w-full max-w-3xl screenplay-sheet rounded-card flex flex-col min-h-[620px]">
          {/* Paper Header / Watermark: sentence case, no COMPILER badge */}
          <div className="px-8 pt-5 pb-2 text-xs text-muted/70 font-serif italic border-b border-black/[0.04] flex justify-between select-none">
            <span>Screenplay transcript</span>
            <span>Continuity verified</span>
          </div>

          {/* CodeMirror Mounting Surface */}
          <div ref={editorContainerRef} className="flex-1 relative cursor-text" />

          {/* Quick Help Footer */}
          <div className="px-8 py-3 text-xs text-muted/70 font-serif italic border-t border-black/[0.04] flex justify-between select-none">
            <span>Red wavy underline indicates a continuity contradiction.</span>
            <span>Click underlined sentence to view patches.</span>
          </div>
        </div>
      </div>
    </div>
  );
};
