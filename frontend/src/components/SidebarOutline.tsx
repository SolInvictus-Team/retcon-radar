/**
 * frontend/src/components/SidebarOutline.tsx
 * Left scene outline panel: add, select, inline rename, delete, and reorder scenes.
 * Writer-centric styling with small italic numerals, soft white active card, and plain italic status words.
 */

import React, { useState } from "react";
import { Plus, Trash2, Check, X, ArrowUp, ArrowDown, Edit2, ArrowRight } from "lucide-react";
import { useStoryStore } from "../store/useStoryStore";

interface SidebarOutlineProps {
  onOpenWelcome: () => void;
}

export const SidebarOutline: React.FC<SidebarOutlineProps> = ({ onOpenWelcome }) => {
  const {
    currentProject,
    activeChapterId,
    conflicts,
    affectedScenes,
    selectChapter,
    addChapter,
    deleteChapter,
    updateChapterTitle,
    moveChapter,
  } = useStoryStore();

  const [newSceneTitle, setNewSceneTitle] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [editingChapterId, setEditingChapterId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");

  const chapters = currentProject?.chapters || [];

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSceneTitle.trim()) return;
    await addChapter(newSceneTitle.trim());
    setNewSceneTitle("");
    setIsAdding(false);
  };

  const handleStartRename = (ch: { id: string; title: string }) => {
    setEditingChapterId(ch.id);
    setEditTitle(ch.title);
  };

  const handleSaveRename = async (chapterId: string) => {
    if (editTitle.trim()) {
      await updateChapterTitle(chapterId, editTitle.trim());
    }
    setEditingChapterId(null);
  };

  return (
    <aside className="w-72 glass-panel rounded-panel flex flex-col h-full select-none shrink-0 overflow-hidden">
      {/* Project Header */}
      <div className="p-4 border-b border-white/80 flex items-center justify-between">
        <div className="overflow-hidden">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-accent" />
            <h1 className="text-xs font-serif italic text-muted">
              Project
            </h1>
          </div>
          <h2
            onClick={onOpenWelcome}
            className="text-base font-serif font-medium text-ink truncate cursor-pointer hover:text-accent transition-colors mt-0.5"
            title="Click to switch or create projects"
          >
            {currentProject?.title || "No project loaded"}
          </h2>
        </div>
        <button
          onClick={onOpenWelcome}
          className="text-xs font-serif glass-control hover:bg-white/90 text-muted hover:text-ink px-2.5 py-1 rounded-control transition-all shadow-sm"
        >
          Switch
        </button>
      </div>

      {/* Outline Header & Add Button */}
      <div className="px-4 py-3 flex items-center justify-between text-xs font-serif italic text-muted">
        <span>Scene outline ({chapters.length})</span>
        <button
          onClick={() => setIsAdding(true)}
          className="p-1 hover:text-accent rounded-control transition-colors"
          title="Add new scene"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Add Scene Inline Form */}
      {isAdding && (
        <form onSubmit={handleAddSubmit} className="px-3 pb-3">
          <div className="flex gap-1.5">
            <input
              type="text"
              autoFocus
              placeholder="e.g. Scene 6: The Rooftop"
              value={newSceneTitle}
              onChange={(e) => setNewSceneTitle(e.target.value)}
              className="flex-1 text-xs font-serif glass-control bg-white/80 border border-accent/40 text-ink rounded-control px-2.5 py-1.5 outline-none"
            />
            <button
              type="submit"
              className="px-2.5 py-1 bg-accent hover:bg-accent-hover text-white rounded-control text-xs font-serif transition-colors"
            >
              Add
            </button>
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="px-2 py-1 text-muted hover:text-ink text-xs font-serif"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Scenes List */}
      <div className="flex-1 overflow-y-auto px-3 py-1 space-y-1.5">
        {chapters.length === 0 ? (
          <div className="p-4 text-center text-xs font-serif italic text-muted">
            No scenes yet. Click <strong>+</strong> to start writing.
          </div>
        ) : (
          chapters.map((ch, idx) => {
            const isActive = ch.id === activeChapterId;
            const hasConflict = conflicts.some((c) => c.scene_index === ch.index);
            const isAffected = affectedScenes.includes(ch.index);
            const isEditing = editingChapterId === ch.id;

            return (
              <div
                key={ch.id}
                onClick={() => !isEditing && selectChapter(ch.id)}
                className={`group relative flex items-center justify-between px-3 py-2.5 cursor-pointer transition-all ${
                  isActive
                    ? "bg-white/95 shadow-glass border border-white rounded-card text-ink"
                    : "hover:bg-white/45 rounded-card text-ink/90 border border-transparent"
                }`}
              >
                {/* Scene Numeral & Title */}
                <div className="flex items-center gap-2.5 min-w-0 pr-2 flex-1">
                  {/* Small italic numeral instead of icon tile */}
                  <span className="font-serif italic text-sm text-muted w-4 shrink-0 text-right">
                    {ch.index}.
                  </span>
                  <div className="truncate flex-1">
                    {isEditing ? (
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="text"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          className="w-full text-xs font-serif bg-white border border-accent text-ink px-1.5 py-0.5 rounded-control outline-none shadow-sm"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleSaveRename(ch.id);
                            if (e.key === "Escape") setEditingChapterId(null);
                          }}
                        />
                        <button onClick={() => handleSaveRename(ch.id)} className="text-ok hover:text-ok/80 p-0.5">
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => setEditingChapterId(null)} className="text-muted hover:text-ink p-0.5">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div
                        onDoubleClick={() => handleStartRename(ch)}
                        title="Double-click to rename scene"
                        className="truncate"
                      >
                        <span className="font-serif text-sm font-medium text-ink truncate block">
                          {ch.title}
                        </span>
                        <span className="text-xs text-muted/80 font-serif italic block">
                          Scene {ch.index}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Status: plain italic words instead of filled pills */}
                {!isEditing && (
                  <div className="flex items-center gap-1 shrink-0">
                    {hasConflict ? (
                      <span
                        className="italic text-xs text-conflict font-serif"
                        title="Continuity conflict detected"
                      >
                        conflict
                      </span>
                    ) : isAffected ? (
                      <span
                        className="italic text-xs text-[#c9822b] font-serif"
                        title="Affected by upstream change"
                      >
                        ripple
                      </span>
                    ) : isActive ? (
                      <span className="italic text-xs text-accent font-serif">
                        current
                      </span>
                    ) : (
                      <span className="italic text-xs text-ok font-serif opacity-0 group-hover:opacity-100 transition-opacity">
                        clean
                      </span>
                    )}

                    {/* Reorder / Rename / Delete (hover only) */}
                    <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 ml-1 transition-opacity">
                      {idx > 0 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            moveChapter(ch.id, "up");
                          }}
                          className="p-1 hover:text-accent text-muted transition-colors"
                          title="Move scene up"
                        >
                          <ArrowUp className="w-3 h-3" />
                        </button>
                      )}
                      {idx < chapters.length - 1 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            moveChapter(ch.id, "down");
                          }}
                          className="p-1 hover:text-accent text-muted transition-colors"
                          title="Move scene down"
                        >
                          <ArrowDown className="w-3 h-3" />
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartRename(ch);
                        }}
                        className="p-1 hover:text-accent text-muted transition-colors"
                        title="Rename scene"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`Delete "${ch.title}"?`)) {
                            deleteChapter(ch.id);
                          }
                        }}
                        className="p-1 hover:text-conflict text-muted transition-colors"
                        title="Delete scene"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Footer Info */}
      <div className="p-3 border-t border-white/80 glass-control text-xs font-serif text-muted flex items-center justify-between">
        <span className="flex items-center gap-1.5 italic">
          <span className="w-1.5 h-1.5 rounded-full bg-ok" />
          Deterministic continuity
        </span>
        <button
          onClick={onOpenWelcome}
          className="hover:text-accent flex items-center gap-0.5 transition-colors italic"
        >
          Sample <ArrowRight className="w-3 h-3" />
        </button>
      </div>
    </aside>
  );
};
