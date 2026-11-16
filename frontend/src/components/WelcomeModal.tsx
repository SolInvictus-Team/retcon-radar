/**
 * frontend/src/components/WelcomeModal.tsx
 * First-launch welcome and project switcher modal with full project deletion & bulk select.
 * Restyled with light glass aesthetic, Newsreader typography, and no purple/indigo.
 */

import React, { useState, useEffect, useRef } from "react";
import {
  Sparkles,
  FolderPlus,
  Film,
  X,
  ArrowRight,
  ShieldCheck,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import { useStoryStore } from "../store/useStoryStore";
import { ProjectSummary } from "../types";

interface WelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ConfirmModalState =
  | { type: "single"; project: ProjectSummary }
  | { type: "bulk"; ids: string[] }
  | { type: "all" }
  | null;

export const WelcomeModal: React.FC<WelcomeModalProps> = ({ isOpen, onClose }) => {
  const {
    projects,
    currentProject,
    isAnalyzing,
    fetchProjects,
    loadProject,
    loadSampleProject,
    createProject,
    deleteProject,
    bulkDeleteProjects,
  } = useStoryStore();

  const [newTitle, setNewTitle] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [confirmDeleteModal, setConfirmDeleteModal] = useState<ConfirmModalState>(null);
  const [deleteAllConfirmInput, setDeleteAllConfirmInput] = useState("");

  const cancelBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen) {
      fetchProjects();
      setIsSelectMode(false);
      setSelectedProjectIds([]);
      setConfirmDeleteModal(null);
    }
  }, [isOpen]);

  // Focus Cancel button when confirm dialog opens, and handle Esc key
  useEffect(() => {
    if (!confirmDeleteModal) return;

    if (confirmDeleteModal.type !== "all") {
      const t = setTimeout(() => {
        cancelBtnRef.current?.focus();
      }, 50);
      return () => clearTimeout(t);
    }
  }, [confirmDeleteModal]);

  useEffect(() => {
    if (!confirmDeleteModal) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setConfirmDeleteModal(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [confirmDeleteModal]);

  if (!isOpen) return null;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setIsCreating(true);
    try {
      await createProject(newTitle.trim());
      setNewTitle("");
      onClose();
    } finally {
      setIsCreating(false);
    }
  };

  const handleLoadSample = async () => {
    await loadSampleProject();
    onClose();
  };

  const handleSelectProject = async (id: string) => {
    if (isSelectMode) {
      toggleSelect(id);
      return;
    }
    await loadProject(id);
    onClose();
  };

  const toggleSelect = (id: string) => {
    setSelectedProjectIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleToggleSelectAll = () => {
    if (selectedProjectIds.length === projects.length) {
      setSelectedProjectIds([]);
    } else {
      setSelectedProjectIds(projects.map((p) => p.id));
    }
  };

  const handleConfirmDelete = async () => {
    if (!confirmDeleteModal) return;

    if (confirmDeleteModal.type === "single") {
      await deleteProject(confirmDeleteModal.project.id);
    } else if (confirmDeleteModal.type === "bulk") {
      await bulkDeleteProjects(confirmDeleteModal.ids);
      setSelectedProjectIds([]);
      setIsSelectMode(false);
    } else if (confirmDeleteModal.type === "all") {
      const allIds = projects.map((p) => p.id);
      await bulkDeleteProjects(allIds);
      setSelectedProjectIds([]);
      setIsSelectMode(false);
      onClose();
    }

    setConfirmDeleteModal(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/20 backdrop-blur-sm select-none animate-in fade-in duration-150 font-serif">
      <div className="w-full max-w-lg glass-panel bg-white/90 border border-white rounded-panel shadow-sheet flex flex-col overflow-hidden relative">
        {/* Modal Header */}
        <div className="p-6 border-b border-white/80 flex items-start justify-between bg-white/40">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-accent" />
              <span className="text-xs font-serif italic text-accent">
                Story continuity linter
              </span>
            </div>
            <h2 className="text-xl font-medium text-ink mt-1">Retcon-Radar</h2>
            <p className="text-xs text-muted mt-0.5 italic">
              Live deterministic continuity linting for novels, screenplays, and serialized fiction.
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-1 hover:bg-white/80 rounded-control text-muted hover:text-ink transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Quick Start Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Load Courier Protocol Sample */}
            <div
              onClick={handleLoadSample}
              className="group p-4 glass-card rounded-card border border-white/90 hover:bg-white/90 cursor-pointer transition-all shadow-glass flex flex-col justify-between"
            >
              <div>
                <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center text-accent mb-3 group-hover:scale-105 transition-transform">
                  <Sparkles className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-medium text-ink">Load sample project</h3>
                <p className="text-xs text-muted mt-1 leading-snug italic">
                  The Courier Protocol: 5 scenes with injury, item, and trait test cases.
                </p>
              </div>
              <div className="mt-4 flex items-center gap-1 text-xs font-medium text-accent group-hover:translate-x-0.5 transition-transform">
                Launch sample <ArrowRight className="w-3 h-3" />
              </div>
            </div>

            {/* Create Blank Project */}
            <div className="p-4 glass-card rounded-card border border-white/90 flex flex-col justify-between shadow-glass">
              <div>
                <div className="w-8 h-8 rounded-full bg-black/5 flex items-center justify-center text-ink mb-3">
                  <FolderPlus className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-medium text-ink">New project</h3>
                <p className="text-xs text-muted mt-1 leading-snug italic">
                  Start fresh with your own original characters and world lore.
                </p>
              </div>

              <form onSubmit={handleCreate} className="mt-3 space-y-2">
                <input
                  type="text"
                  placeholder="Story title..."
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full text-xs font-serif bg-white/90 border border-white/90 focus:border-accent px-2.5 py-1.5 rounded-control outline-none text-ink shadow-sm"
                />
                <button
                  type="submit"
                  disabled={!newTitle.trim() || isCreating}
                  className="w-full py-1.5 bg-accent hover:bg-accent-hover disabled:opacity-50 text-white rounded-control text-xs font-medium transition-colors cursor-pointer"
                >
                  Create project
                </button>
              </form>
            </div>
          </div>

          {/* Existing Projects Section */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2.5">
                <h4 className="text-xs font-serif italic text-muted">
                  Existing projects ({projects.length})
                </h4>
                {isSelectMode && projects.length > 0 && (
                  <label className="flex items-center gap-1.5 text-xs text-muted cursor-pointer hover:text-ink select-none">
                    <input
                      type="checkbox"
                      checked={
                        selectedProjectIds.length === projects.length && projects.length > 0
                      }
                      onChange={handleToggleSelectAll}
                      className="cursor-pointer rounded accent-accent"
                    />
                    <span className="italic">Select all</span>
                  </label>
                )}
              </div>

              {projects.length > 0 && (
                <div className="flex items-center gap-2">
                  {isSelectMode ? (
                    <>
                      <button
                        onClick={() => {
                          if (selectedProjectIds.length > 0) {
                            setConfirmDeleteModal({ type: "bulk", ids: selectedProjectIds });
                          }
                        }}
                        disabled={selectedProjectIds.length === 0}
                        className="text-xs px-2.5 py-1 bg-conflict/10 hover:bg-conflict text-conflict hover:text-white disabled:opacity-40 disabled:hover:bg-conflict/10 disabled:hover:text-conflict rounded-control transition-colors font-medium cursor-pointer"
                      >
                        Delete selected ({selectedProjectIds.length})
                      </button>
                      <button
                        onClick={() => {
                          setIsSelectMode(false);
                          setSelectedProjectIds([]);
                        }}
                        className="text-xs text-muted hover:text-ink transition-colors font-serif italic cursor-pointer"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setIsSelectMode(true)}
                      className="text-xs text-accent hover:underline transition-colors font-serif italic cursor-pointer"
                    >
                      Select
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Project rows or friendly empty state */}
            {projects.length > 0 ? (
              <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                {projects.map((p) => {
                  const isThisAnalyzing = isAnalyzing && currentProject?.id === p.id;
                  const isSelected = selectedProjectIds.includes(p.id);

                  return (
                    <div
                      key={p.id}
                      onClick={() => handleSelectProject(p.id)}
                      className={`group flex items-center justify-between p-2.5 glass-control hover:bg-white/90 rounded-card border transition-all shadow-sm cursor-pointer ${
                        currentProject?.id === p.id
                          ? "border-accent/40 bg-accent/5"
                          : "border-white/90"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 truncate pr-2 flex-1 min-w-0">
                        {isSelectMode && (
                          <input
                            type="checkbox"
                            checked={isSelected}
                            disabled={isThisAnalyzing}
                            onChange={(e) => {
                              e.stopPropagation();
                              toggleSelect(p.id);
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="cursor-pointer rounded accent-accent shrink-0"
                            aria-label={`Select ${p.title}`}
                          />
                        )}

                        <Film className="w-3.5 h-3.5 text-muted shrink-0" />
                        <span className="text-xs font-medium text-ink truncate">
                          {p.title}
                        </span>
                        {currentProject?.id === p.id && (
                          <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 text-accent bg-accent/10 rounded shrink-0">
                            Current
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-muted font-serif italic">
                          {p.chapter_count} {p.chapter_count === 1 ? "scene" : "scenes"}
                        </span>

                        {/* Delete project button / Analysing hint */}
                        {isThisAnalyzing ? (
                          <span
                            className="text-[11px] text-accent font-serif italic px-1.5 py-0.5 bg-accent/5 rounded border border-accent/20"
                            title="Cannot delete while analysis is running"
                          >
                            Analysing...
                          </span>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setConfirmDeleteModal({ type: "single", project: p });
                            }}
                            aria-label={`Delete project ${p.title}`}
                            title={`Delete project ${p.title}`}
                            className="p-1.5 text-muted hover:text-conflict hover:bg-conflict/10 rounded-control transition-colors opacity-100 sm:opacity-0 sm:group-hover:opacity-100 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="glass-card rounded-card p-4 text-center space-y-1.5 border border-white/90">
                <p className="text-xs text-muted font-serif italic">No projects yet.</p>
                <p className="text-xs text-muted/70">
                  Create a new project above or launch the sample project to begin.
                </p>
              </div>
            )}

            {/* One-click "Delete all projects..." option */}
            {projects.length > 0 && (
              <div className="mt-2.5 pt-2 border-t border-black/[0.04] flex justify-end">
                <button
                  onClick={() => {
                    setDeleteAllConfirmInput("");
                    setConfirmDeleteModal({ type: "all" });
                  }}
                  className="text-[11px] text-conflict/70 hover:text-conflict font-serif italic cursor-pointer transition-colors"
                >
                  Delete all projects...
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-white/80 bg-white/40 flex items-center justify-between text-xs text-muted font-serif italic">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-ok" />
            Deterministic graph verification
          </span>
          <span>v1.0</span>
        </div>

        {/* Small Confirm Dialog in Glass Style */}
        {confirmDeleteModal && (
          <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-ink/30 backdrop-blur-sm animate-in fade-in duration-100">
            <div className="w-full max-w-sm glass-panel bg-white/95 border border-white rounded-panel shadow-sheet p-5 space-y-4 animate-in zoom-in-95 duration-150">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-full bg-conflict/10 text-conflict shrink-0 mt-0.5">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div className="space-y-1 flex-1">
                  <h3 className="text-sm font-medium text-ink">
                    {confirmDeleteModal.type === "single"
                      ? `Delete '${confirmDeleteModal.project.title}'?`
                      : confirmDeleteModal.type === "bulk"
                      ? `Delete ${confirmDeleteModal.ids.length} projects?`
                      : "Delete all projects?"}
                  </h3>
                  <p className="text-xs text-muted leading-relaxed">
                    {confirmDeleteModal.type === "single"
                      ? "This removes its scenes and analysis. This can't be undone."
                      : confirmDeleteModal.type === "bulk"
                      ? "This removes their scenes and analysis. This can't be undone."
                      : `This will permanently remove all ${projects.length} projects and their data. This cannot be undone.`}
                  </p>
                </div>
              </div>

              {/* Delete All stronger confirm input */}
              {confirmDeleteModal.type === "all" && (
                <div className="space-y-1.5 pt-1">
                  <label className="text-xs text-muted font-serif italic block">
                    Type <span className="font-mono font-bold text-conflict">DELETE</span> to confirm:
                  </label>
                  <input
                    type="text"
                    value={deleteAllConfirmInput}
                    onChange={(e) => setDeleteAllConfirmInput(e.target.value)}
                    placeholder="DELETE"
                    autoFocus
                    className="w-full text-xs font-mono bg-white border border-black/15 focus:border-conflict px-2.5 py-1.5 rounded-control outline-none text-ink shadow-sm"
                  />
                </div>
              )}

              {/* Dialog Actions */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-black/[0.05]">
                <button
                  ref={cancelBtnRef}
                  type="button"
                  onClick={() => setConfirmDeleteModal(null)}
                  className="px-3.5 py-1.5 glass-control hover:bg-white text-ink border border-white/90 rounded-control text-xs font-serif font-medium transition-colors cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  disabled={
                    confirmDeleteModal.type === "all" &&
                    deleteAllConfirmInput !== "DELETE"
                  }
                  onClick={handleConfirmDelete}
                  className="px-3.5 py-1.5 bg-conflict hover:bg-conflict/90 disabled:opacity-40 text-white rounded-control text-xs font-serif font-medium transition-colors shadow-sm cursor-pointer"
                >
                  {confirmDeleteModal.type === "all"
                    ? "Delete all"
                    : confirmDeleteModal.type === "bulk"
                    ? `Delete (${confirmDeleteModal.ids.length})`
                    : "Delete"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
