/**
 * frontend/src/App.tsx
 * Top-level application layout: Header, Sidebar Outline, Editor, Canon Sentinel, and Conflict Panels.
 */

import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Radar, Terminal, X, Film, FolderPlus, Sparkles, Home } from "lucide-react";
import { SidebarOutline } from "./components/SidebarOutline";
import { Editor } from "./components/Editor";
import { CanonSentinel } from "./components/CanonSentinel";
import { ConflictPanel } from "./components/ConflictPanel";
import { RippleBanner } from "./components/RippleBanner";
import { WelcomeModal } from "./components/WelcomeModal";
import { useStoryStore } from "./store/useStoryStore";

export const App: React.FC = () => {
  const {
    currentProject,
    loadSampleProject,
    toastMessage,
    undoSnapshot,
    projectUndoSnapshot,
    undoLastPatch,
    undoDeleteProject,
    setToast,
    isAnalyzing,
  } = useStoryStore();

  const [isWelcomeOpen, setIsWelcomeOpen] = useState(false);
  const location = useLocation();

  // Handle demo query parameter or auto-load sample project on first launch
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const isDemo = params.get("demo") === "true";
    if (isDemo) {
      loadSampleProject(5);
    } else if (!currentProject) {
      loadSampleProject().catch(() => {
        setIsWelcomeOpen(true);
      });
    }
  }, [location.search]);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-radar-bg text-ink select-none font-serif page-fade-in">
      {/* Top Application Navigation Bar: Glass bar, round logo, small muted "v1.0", italic tagline */}
      <header className="h-14 glass-panel border-b border-white/90 px-6 flex items-center justify-between shrink-0 z-20 shadow-glass">
        {/* Brand & Project Identity */}
        <div className="flex items-center gap-3">
          <Link
            to="/"
            title="Return to home landing page"
            className="flex items-center gap-1.5 text-xs text-muted hover:text-accent font-serif italic py-1 px-2 rounded-control hover:bg-black/5 transition-colors cursor-pointer mr-1"
          >
            <Home className="w-3.5 h-3.5 text-accent" />
            <span>Home</span>
          </Link>

          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-accent/10 border border-accent/25 flex items-center justify-center text-accent shadow-sm">
              <Radar className="w-4.5 h-4.5 animate-spin-slow" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <Link
                  to="/"
                  className="font-serif font-medium text-lg tracking-tight text-ink hover:text-accent transition-colors"
                  title="Return to home landing page"
                >
                  Retcon-Radar
                </Link>
                <span className="text-xs text-muted/80 font-serif italic">
                  v1.0
                </span>
              </div>
              <p className="text-xs text-muted font-serif italic hidden sm:block">
                The continuity linter for serialized fiction
              </p>
            </div>
          </div>
        </div>

        {/* Global Controls & Status */}
        <div className="flex items-center gap-4">
          {/* Realtime Engine Status */}
          <div className="hidden md:flex items-center gap-2 glass-control px-3.5 py-1.5 rounded-control text-xs">
            <span
              className={`w-2 h-2 rounded-full ${
                isAnalyzing ? "bg-[#c9822b] animate-ping" : "bg-ok"
              }`}
            />
            <span className="text-muted text-xs font-serif italic">
              {isAnalyzing ? "Replaying graph..." : "Continuity invariants active"}
            </span>
          </div>

          {/* Switch Project Button */}
          <button
            onClick={() => setIsWelcomeOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 glass-control hover:bg-white/90 text-ink hover:text-accent rounded-control text-xs font-serif transition-all shadow-sm"
          >
            <Terminal className="w-3.5 h-3.5 text-accent" />
            <span>Projects</span>
          </button>
        </div>
      </header>

      {/* Ripple Effect Notice Banner (appears when earlier edits impact downstream scenes) */}
      <RippleBanner />

      {/* Main Working Space: 3-Column Studio or Friendly Empty State if no project loaded */}
      {!currentProject ? (
        <div className="flex-1 flex items-center justify-center p-6 select-none">
          <div className="max-w-md w-full glass-card p-8 rounded-panel text-center space-y-4 border border-white shadow-sheet animate-in fade-in duration-200">
            <div className="w-14 h-14 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center text-accent mx-auto">
              <Film className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-xl font-medium text-ink">No projects yet</h2>
              <p className="text-xs text-muted font-serif italic mt-1.5 leading-relaxed">
                Create a new story project or load the built-in sample project to start continuity linting.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => setIsWelcomeOpen(true)}
                className="px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-control text-xs font-serif font-medium transition-colors shadow-sm flex items-center gap-1.5 cursor-pointer"
              >
                <FolderPlus className="w-3.5 h-3.5" />
                New project
              </button>
              <button
                onClick={async () => {
                  await loadSampleProject();
                }}
                className="px-4 py-2 glass-control hover:bg-white text-ink border border-white/90 rounded-control text-xs font-serif transition-colors shadow-sm flex items-center gap-1.5 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-accent" />
                Load sample
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex overflow-hidden relative p-3 gap-3">
          {/* Left Column: Scene Outline */}
          <SidebarOutline onOpenWelcome={() => setIsWelcomeOpen(true)} />

          {/* Center Column: Screenplay Editor */}
          <Editor />

          {/* Right Column: Canon Sentinel with overlaid Conflict Panel */}
          <div className="w-[520px] h-full shrink-0 relative overflow-hidden rounded-panel glass-panel">
            <CanonSentinel />
            <ConflictPanel />
          </div>
        </div>
      )}

      {/* Welcome & Project Selection Modal */}
      <WelcomeModal
        isOpen={isWelcomeOpen}
        onClose={() => setIsWelcomeOpen(false)}
      />

      {/* Non-blocking Toast Alerts with Undo action */}
      {toastMessage && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 glass-card text-ink text-xs px-4 py-2.5 rounded-card shadow-sheet flex items-center gap-3 animate-in fade-in duration-150">
          <span>{toastMessage}</span>
          {projectUndoSnapshot && (
            <button
              onClick={undoDeleteProject}
              className="px-2.5 py-1 bg-accent text-white rounded-control text-xs font-serif hover:bg-accent-hover transition-colors font-medium ml-1 cursor-pointer"
            >
              Undo
            </button>
          )}
          {undoSnapshot && !projectUndoSnapshot && (
            <button
              onClick={undoLastPatch}
              className="px-2.5 py-1 bg-accent text-white rounded-control text-xs font-serif hover:bg-accent-hover transition-colors font-medium ml-1 cursor-pointer"
            >
              Undo
            </button>
          )}
          <button
            onClick={() => setToast(null)}
            className="text-muted hover:text-ink transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};
