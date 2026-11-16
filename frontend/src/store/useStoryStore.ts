/**
 * frontend/src/store/useStoryStore.ts
 * Global reactive state for RETCON-RADAR.
 */

import { create } from "zustand";
import { apiClient } from "../api/client";
import {
  Chapter,
  Conflict,
  DevTimings,
  Event,
  GraphData,
  GraphViewMode,
  PatchSuggestion,
  Project,
  ProjectSummary,
} from "../types";

interface UndoSnapshot {
  chapters: Chapter[];
  activeChapterId: string | null;
  conflicts: Conflict[];
  graphData: GraphData;
  events: Event[];
  selectedConflict: Conflict | null;
}

interface ProjectUndoSnapshot {
  deletedProjects: Project[];
  previousActiveId: string | null;
}

interface StoryStoreState {
  projects: ProjectSummary[];
  currentProject: Project | null;
  activeChapterId: string | null;
  conflicts: Conflict[];
  graphData: GraphData;
  events: Event[];
  allEvents: Event[];
  graphViewMode: GraphViewMode;
  timings: DevTimings | null;
  affectedScenes: number[];
  isAnalyzing: boolean;
  selectedConflict: Conflict | null;
  isPatchLoading: boolean;
  patches: PatchSuggestion[];
  toastMessage: string | null;
  undoSnapshot: UndoSnapshot | null;
  projectUndoSnapshot: ProjectUndoSnapshot | null;
  deleteToastTimer: any;
  jumpOriginSceneIndex: number | null;
  sourceHighlightSentenceId: string | null;
  rateLimitCountdown: number | null;

  // Actions
  fetchProjects: () => Promise<void>;
  loadProject: (id: string) => Promise<void>;
  createProject: (title: string) => Promise<Project>;
  loadSampleProject: (targetSceneIndex?: number) => Promise<void>;
  deleteProject: (projectId: string) => Promise<void>;
  bulkDeleteProjects: (projectIds: string[]) => Promise<void>;
  undoDeleteProject: () => Promise<void>;
  selectChapter: (chapterId: string) => void;
  addChapter: (title: string, text?: string) => Promise<void>;
  updateChapterText: (chapterId: string, text: string) => void;
  updateChapterTitle: (chapterId: string, title: string) => Promise<void>;
  moveChapter: (chapterId: string, direction: "up" | "down") => Promise<void>;
  deleteChapter: (chapterId: string) => Promise<void>;
  analyzeCurrentChapter: (text: string) => Promise<void>;
  triggerRipple: (fromSceneIndex: number) => Promise<void>;
  setSelectedConflict: (conflict: Conflict | null) => void;
  loadPatchesForConflict: (conflictId: string) => Promise<void>;
  applyPatch: (patch: PatchSuggestion) => Promise<void>;
  undoLastPatch: () => Promise<void>;
  jumpToSource: (conflict: Conflict) => void;
  backToConflictScene: () => void;
  setRateLimitCountdown: (seconds: number | null) => void;
  addCharacter: (name: string, aliases?: string[], traits?: Record<string, any>, description?: string) => Promise<void>;
  deleteCharacter: (charId: string) => Promise<void>;
  addItem: (name: string, aliases?: string[], description?: string) => Promise<void>;
  deleteItem: (itemId: string) => Promise<void>;
  dismissRipple: () => void;
  setToast: (msg: string | null) => void;
  setGraphViewMode: (mode: GraphViewMode) => void;
}

export const useStoryStore = create<StoryStoreState>((set, get) => ({
  projects: [],
  currentProject: null,
  activeChapterId: null,
  conflicts: [],
  graphData: { nodes: [], edges: [] },
  events: [],
  allEvents: [],
  graphViewMode: "this_scene",
  timings: null,
  affectedScenes: [],
  isAnalyzing: false,
  selectedConflict: null,
  isPatchLoading: false,
  patches: [],
  toastMessage: null,
  undoSnapshot: null,
  projectUndoSnapshot: null,
  deleteToastTimer: null,
  jumpOriginSceneIndex: null,
  sourceHighlightSentenceId: null,
  rateLimitCountdown: null,

  fetchProjects: async () => {
    try {
      const projects = await apiClient.getProjects();
      set({ projects });
    } catch (e: any) {
      console.error("fetchProjects error:", e);
    }
  },

  loadProject: async (id: string) => {
    try {
      const project = await apiClient.getProject(id);
      const activeId = project.chapters.length > 0 ? project.chapters[0].id : null;
      set({
        currentProject: project,
        activeChapterId: activeId,
        conflicts: [],
        graphData: { nodes: [], edges: [] },
        affectedScenes: [],
        selectedConflict: null,
        patches: [],
      });

      // Analyze initial active chapter
      if (activeId) {
        const ch = project.chapters.find((c) => c.id === activeId);
        if (ch && ch.text.trim()) {
          await get().analyzeCurrentChapter(ch.text);
        }
      }
    } catch (e: any) {
      set({ toastMessage: `Failed to load project: ${e.message}` });
    }
  },

  createProject: async (title: string) => {
    const project = await apiClient.createProject(title);
    set((state) => ({
      projects: [{ id: project.id, title: project.title, chapter_count: 0 }, ...state.projects],
      currentProject: project,
      activeChapterId: null,
      conflicts: [],
      graphData: { nodes: [], edges: [] },
      affectedScenes: [],
    }));
    return project;
  },

  loadSampleProject: async (targetSceneIndex?: number) => {
    try {
      await apiClient.loadSampleProject();
      await get().loadProject("courier-protocol");
      await get().fetchProjects();
    } catch {
      await get().loadProject("courier-protocol");
    }
    if (targetSceneIndex !== undefined) {
      const { currentProject } = get();
      const targetChapter = currentProject?.chapters.find(
        (c) => c.index === targetSceneIndex
      );
      if (targetChapter) {
        set({ activeChapterId: targetChapter.id });
        await get().analyzeCurrentChapter(targetChapter.text);
      }
    }
  },

  deleteProject: async (projectId: string) => {
    const { currentProject, deleteToastTimer } = get();
    if (deleteToastTimer) clearTimeout(deleteToastTimer);

    // Grab full project details for undo
    let fullProject: Project | null = null;
    if (currentProject?.id === projectId) {
      fullProject = currentProject;
    } else {
      try {
        fullProject = await apiClient.getProject(projectId);
      } catch {}
    }

    try {
      const updatedProjects = await apiClient.deleteProject(projectId);
      const wasActive = currentProject?.id === projectId;

      set({ projects: updatedProjects });

      if (wasActive) {
        if (updatedProjects.length > 0) {
          await get().loadProject(updatedProjects[0].id);
        } else {
          set({
            currentProject: null,
            activeChapterId: null,
            conflicts: [],
            graphData: { nodes: [], edges: [] },
            events: [],
            timings: null,
            affectedScenes: [],
            selectedConflict: null,
            patches: [],
            undoSnapshot: null,
          });
        }
      }

      const snapshot: ProjectUndoSnapshot = {
        deletedProjects: fullProject ? [fullProject] : [],
        previousActiveId: wasActive ? projectId : null,
      };

      const timer = setTimeout(() => {
        set((state) => ({
          projectUndoSnapshot: null,
          deleteToastTimer: null,
          toastMessage: state.toastMessage === "Project deleted" ? null : state.toastMessage,
        }));
      }, 6000);

      set({
        projectUndoSnapshot: snapshot,
        deleteToastTimer: timer,
        toastMessage: "Project deleted",
      });
    } catch (e: any) {
      set({ toastMessage: `Failed to delete project: ${e.message}` });
    }
  },

  bulkDeleteProjects: async (projectIds: string[]) => {
    if (projectIds.length === 0) return;
    const { currentProject, deleteToastTimer } = get();
    if (deleteToastTimer) clearTimeout(deleteToastTimer);

    // Grab full project details for undo
    const fullProjects: Project[] = [];
    for (const pid of projectIds) {
      if (currentProject?.id === pid) {
        fullProjects.push(currentProject);
      } else {
        try {
          const p = await apiClient.getProject(pid);
          fullProjects.push(p);
        } catch {}
      }
    }

    try {
      const updatedProjects = await apiClient.bulkDeleteProjects(projectIds);
      const wasActive = projectIds.includes(currentProject?.id || "");

      set({ projects: updatedProjects });

      if (wasActive) {
        if (updatedProjects.length > 0) {
          await get().loadProject(updatedProjects[0].id);
        } else {
          set({
            currentProject: null,
            activeChapterId: null,
            conflicts: [],
            graphData: { nodes: [], edges: [] },
            events: [],
            timings: null,
            affectedScenes: [],
            selectedConflict: null,
            patches: [],
            undoSnapshot: null,
          });
        }
      }

      const snapshot: ProjectUndoSnapshot = {
        deletedProjects: fullProjects,
        previousActiveId: wasActive ? currentProject?.id || null : null,
      };

      const msg = projectIds.length > 1 ? `${projectIds.length} projects deleted` : "Project deleted";
      const timer = setTimeout(() => {
        set((state) => ({
          projectUndoSnapshot: null,
          deleteToastTimer: null,
          toastMessage: state.toastMessage === msg ? null : state.toastMessage,
        }));
      }, 6000);

      set({
        projectUndoSnapshot: snapshot,
        deleteToastTimer: timer,
        toastMessage: msg,
      });
    } catch (e: any) {
      set({ toastMessage: `Failed to delete projects: ${e.message}` });
    }
  },

  undoDeleteProject: async () => {
    const { projectUndoSnapshot, deleteToastTimer } = get();
    if (!projectUndoSnapshot) return;
    if (deleteToastTimer) clearTimeout(deleteToastTimer);

    try {
      for (const p of projectUndoSnapshot.deletedProjects) {
        await apiClient.restoreProject(p);
      }
      await get().fetchProjects();

      if (projectUndoSnapshot.previousActiveId) {
        await get().loadProject(projectUndoSnapshot.previousActiveId);
      } else if (!get().currentProject && projectUndoSnapshot.deletedProjects.length > 0) {
        await get().loadProject(projectUndoSnapshot.deletedProjects[0].id);
      }

      set({
        projectUndoSnapshot: null,
        deleteToastTimer: null,
        toastMessage: "Project restored",
      });
    } catch (e: any) {
      set({ toastMessage: `Failed to restore project: ${e.message}` });
    }
  },

  selectChapter: (chapterId: string) => {
    set({ activeChapterId: chapterId, selectedConflict: null, patches: [] });
    const project = get().currentProject;
    if (project) {
      const ch = project.chapters.find((c) => c.id === chapterId);
      if (ch) {
        get().analyzeCurrentChapter(ch.text);
      }
    }
  },

  addChapter: async (title: string, text: string = "") => {
    const { currentProject } = get();
    if (!currentProject) return;

    try {
      const newChapter = await apiClient.addChapter(currentProject.id, title, text);
      const updatedChapters = [...currentProject.chapters, newChapter];
      set({
        currentProject: { ...currentProject, chapters: updatedChapters },
        activeChapterId: newChapter.id,
      });
    } catch (e: any) {
      set({ toastMessage: `Could not add scene: ${e.message}` });
    }
  },

  updateChapterText: (chapterId: string, text: string) => {
    const { currentProject } = get();
    if (!currentProject) return;

    const updated = currentProject.chapters.map((ch) =>
      ch.id === chapterId ? { ...ch, text } : ch
    );
    set({ currentProject: { ...currentProject, chapters: updated } });
  },

  updateChapterTitle: async (chapterId: string, title: string) => {
    const { currentProject } = get();
    if (!currentProject) return;
    const updated = currentProject.chapters.map((ch) =>
      ch.id === chapterId ? { ...ch, title } : ch
    );
    set({ currentProject: { ...currentProject, chapters: updated } });
    try {
      await apiClient.updateChapter(currentProject.id, chapterId, { title });
    } catch (e) {
      console.warn("Failed to update title:", e);
    }
  },

  moveChapter: async (chapterId: string, direction: "up" | "down") => {
    const { currentProject } = get();
    if (!currentProject) return;
    const chapters = [...currentProject.chapters].sort((a, b) => a.index - b.index);
    const idx = chapters.findIndex((c) => c.id === chapterId);
    if (idx === -1) return;
    if (direction === "up" && idx === 0) return;
    if (direction === "down" && idx === chapters.length - 1) return;

    const targetIdx = direction === "up" ? idx - 1 : idx + 1;
    const temp = chapters[idx];
    chapters[idx] = chapters[targetIdx];
    chapters[targetIdx] = temp;

    const reindexed = chapters.map((ch, i) => ({ ...ch, index: i + 1 }));
    set({ currentProject: { ...currentProject, chapters: reindexed } });

    try {
      for (const ch of reindexed) {
        await apiClient.updateChapter(currentProject.id, ch.id, { index: ch.index });
      }
    } catch (e) {
      console.warn("Failed to reorder chapters:", e);
    }
  },

  deleteChapter: async (chapterId: string) => {
    const { currentProject, activeChapterId } = get();
    if (!currentProject) return;

    try {
      await apiClient.deleteChapter(currentProject.id, chapterId);
      const remaining = currentProject.chapters
        .filter((ch) => ch.id !== chapterId)
        .map((ch, idx) => ({ ...ch, index: idx + 1 }));

      const nextActive =
        activeChapterId === chapterId
          ? remaining.length > 0
            ? remaining[0].id
            : null
          : activeChapterId;

      set({
        currentProject: { ...currentProject, chapters: remaining },
        activeChapterId: nextActive,
      });

      if (nextActive) {
        const nextCh = remaining.find((c) => c.id === nextActive);
        if (nextCh) get().analyzeCurrentChapter(nextCh.text);
      }
    } catch (e: any) {
      set({ toastMessage: `Could not delete scene: ${e.message}` });
    }
  },

  analyzeCurrentChapter: async (text: string) => {
    const { currentProject, activeChapterId } = get();
    if (!currentProject || !activeChapterId) return;

    set({ isAnalyzing: true });
    try {
      const res = await apiClient.analyze(currentProject.id, activeChapterId, text);
      const updatedLore = res.lore || currentProject.lore;
      const targetCh = currentProject.chapters.find((c) => c.id === activeChapterId);
      const targetSceneIndex = targetCh?.index ?? 1;

      set((state) => ({
        conflicts: res.conflicts,
        graphData: res.graph,
        events: res.events,
        allEvents: res.all_events || [
          ...state.allEvents.filter((e) => e.scene_index !== targetSceneIndex),
          ...(res.events || []),
        ],
        timings: res.timings || null,
        isAnalyzing: false,
        currentProject: state.currentProject
          ? { ...state.currentProject, lore: updatedLore }
          : null,
      }));

      // Also trigger ripple if this scene is before the end of the script
      const ch = currentProject.chapters.find((c) => c.id === activeChapterId);
      if (ch && ch.index < currentProject.chapters.length) {
        get().triggerRipple(ch.index);
      }
    } catch (e: any) {
      if (e.name === "AbortError") {
        // Silently ignore aborted requests
        return;
      }
      loggerWarning(`Analysis error: ${e.message}`);
      set({ isAnalyzing: false });
    }
  },

  triggerRipple: async (fromSceneIndex: number) => {
    const { currentProject } = get();
    if (!currentProject) return;

    try {
      const res = await apiClient.ripple(currentProject.id, fromSceneIndex);
      if (res.affected_scene_indexes.length > 0) {
        set({ affectedScenes: res.affected_scene_indexes });
      }
    } catch (e: any) {
      console.warn("Ripple error:", e);
    }
  },

  setSelectedConflict: (conflict: Conflict | null) => {
    set({ selectedConflict: conflict, patches: [] });
  },

  loadPatchesForConflict: async (conflictId: string) => {
    const { currentProject } = get();
    set({ isPatchLoading: true, rateLimitCountdown: null });
    try {
      const res = await apiClient.getPatches(conflictId, currentProject?.id);
      set({ patches: res.patches, isPatchLoading: false, rateLimitCountdown: null });
    } catch (e: any) {
      const errMsg = e?.message || "";
      if (
        errMsg.includes("429") ||
        errMsg.toLowerCase().includes("rate limit") ||
        errMsg.toLowerCase().includes("quota")
      ) {
        let secondsLeft = 10;
        set({ isPatchLoading: false, rateLimitCountdown: secondsLeft });
        const timer = setInterval(() => {
          secondsLeft -= 1;
          if (secondsLeft <= 0) {
            clearInterval(timer);
            set({ rateLimitCountdown: null });
          } else {
            set({ rateLimitCountdown: secondsLeft });
          }
        }, 1000);
      } else {
        set({
          isPatchLoading: false,
          toastMessage: "Could not generate patches right now. Try again.",
        });
      }
    }
  },

  applyPatch: async (patch: PatchSuggestion) => {
    const {
      currentProject,
      activeChapterId,
      conflicts,
      graphData,
      events,
      selectedConflict,
      updateChapterText,
      analyzeCurrentChapter,
    } = get();
    if (!currentProject || !patch.suggested_text) return;

    // Snapshot for undo action
    const snapshot: UndoSnapshot = {
      chapters: JSON.parse(JSON.stringify(currentProject.chapters)),
      activeChapterId,
      conflicts: [...conflicts],
      graphData: {
        nodes: [...graphData.nodes],
        edges: [...graphData.edges],
      },
      events: [...events],
      selectedConflict,
    };

    const targetSceneIdx = patch.target_scene_index ?? (selectedConflict?.scene_index ?? 1);
    const targetChapter = currentProject.chapters.find((c) => c.index === targetSceneIdx);

    if (targetChapter) {
      const fallbackId =
        targetSceneIdx === selectedConflict?.scene_index
          ? selectedConflict?.sentence_id
          : targetSceneIdx === selectedConflict?.caused_by?.scene_index
          ? selectedConflict?.caused_by?.sentence_id
          : undefined;

      let newText: string;
      if (patch.type === "bridge_gap" && patch.target_scene_index === null) {
        // Bridge transition added before chapter text
        newText = `${patch.suggested_text.trim()}\n\n${targetChapter.text}`;
      } else {
        newText = replaceSentenceInText(
          targetChapter.text,
          targetSceneIdx,
          patch.target_sentence_id,
          patch.suggested_text,
          fallbackId
        );
      }

      // 1. Update text in local store
      updateChapterText(targetChapter.id, newText);

      // 2. Persist to backend
      try {
        await apiClient.updateChapter(currentProject.id, targetChapter.id, { text: newText });
      } catch (err) {
        console.warn("Failed to persist patched chapter to backend:", err);
      }

      // 3. If target chapter was different from active chapter, analyze target chapter first
      if (targetChapter.id !== activeChapterId) {
        try {
          await apiClient.analyze(currentProject.id, targetChapter.id, newText);
        } catch (e) {
          console.warn("Target chapter analyze error:", e);
        }
      }

      // 4. Re-analyze current active chapter to reflect updated world state & graph
      const activeCh = currentProject.chapters.find((c) => c.id === activeChapterId);
      const activeText =
        activeChapterId === targetChapter.id ? newText : activeCh ? activeCh.text : "";
      await analyzeCurrentChapter(activeText);

      set({
        undoSnapshot: snapshot,
        selectedConflict: null,
        patches: [],
        toastMessage: "Fix applied",
      });
    }
  },

  undoLastPatch: async () => {
    const { undoSnapshot, currentProject } = get();
    if (!undoSnapshot || !currentProject) return;

    // Restore state from snapshot
    set({
      currentProject: {
        ...currentProject,
        chapters: undoSnapshot.chapters,
      },
      activeChapterId: undoSnapshot.activeChapterId,
      conflicts: undoSnapshot.conflicts,
      graphData: undoSnapshot.graphData,
      events: undoSnapshot.events,
      selectedConflict: undoSnapshot.selectedConflict,
      undoSnapshot: null,
      toastMessage: "Fix undone",
    });

    // Persist all restored chapters to backend
    try {
      for (const ch of undoSnapshot.chapters) {
        await apiClient.updateChapter(currentProject.id, ch.id, { text: ch.text });
      }
      // Re-analyze active chapter
      const activeCh = undoSnapshot.chapters.find(
        (c) => c.id === undoSnapshot.activeChapterId
      );
      if (activeCh) {
        await get().analyzeCurrentChapter(activeCh.text);
      }
    } catch (e) {
      console.warn("Undo persist error:", e);
    }
  },

  jumpToSource: (conflict: Conflict) => {
    if (!conflict.caused_by) return;
    const { currentProject } = get();
    if (!currentProject) return;

    const targetIdx = conflict.caused_by.scene_index;
    const targetChapter = currentProject.chapters.find((c) => c.index === targetIdx);
    if (targetChapter) {
      set({
        jumpOriginSceneIndex: conflict.scene_index,
        sourceHighlightSentenceId: conflict.caused_by.sentence_id,
        activeChapterId: targetChapter.id,
      });
      get().analyzeCurrentChapter(targetChapter.text);
    }
  },

  backToConflictScene: () => {
    const { currentProject, jumpOriginSceneIndex } = get();
    if (!currentProject || jumpOriginSceneIndex === null) return;

    const originChapter = currentProject.chapters.find(
      (c) => c.index === jumpOriginSceneIndex
    );
    if (originChapter) {
      set({
        jumpOriginSceneIndex: null,
        sourceHighlightSentenceId: null,
        activeChapterId: originChapter.id,
      });
      get().analyzeCurrentChapter(originChapter.text);
    }
  },

  setRateLimitCountdown: (seconds: number | null) => {
    set({ rateLimitCountdown: seconds });
  },

  addCharacter: async (name: string, aliases: string[] = [], traits: Record<string, any> = {}, description: string = "") => {
    const { currentProject } = get();
    if (!currentProject) return;
    try {
      const newChar = await apiClient.addCharacter(currentProject.id, { name, aliases, traits, description });
      const updatedLore = {
        ...currentProject.lore,
        characters: [...currentProject.lore.characters, newChar],
      };
      set({ currentProject: { ...currentProject, lore: updatedLore }, toastMessage: `Added character "${name}"` });
    } catch (e: any) {
      set({ toastMessage: `Failed to add character: ${e.message}` });
    }
  },

  deleteCharacter: async (charId: string) => {
    const { currentProject } = get();
    if (!currentProject) return;
    try {
      await apiClient.deleteCharacter(currentProject.id, charId);
      const updatedLore = {
        ...currentProject.lore,
        characters: currentProject.lore.characters.filter((c) => c.id !== charId),
      };
      set({ currentProject: { ...currentProject, lore: updatedLore }, toastMessage: "Deleted character" });
    } catch (e: any) {
      set({ toastMessage: `Failed to delete character: ${e.message}` });
    }
  },

  addItem: async (name: string, aliases: string[] = [], description: string = "") => {
    const { currentProject } = get();
    if (!currentProject) return;
    try {
      const newItem = await apiClient.addItem(currentProject.id, { name, aliases, description });
      const updatedLore = {
        ...currentProject.lore,
        items: [...currentProject.lore.items, newItem],
      };
      set({ currentProject: { ...currentProject, lore: updatedLore }, toastMessage: `Added item "${name}"` });
    } catch (e: any) {
      set({ toastMessage: `Failed to add item: ${e.message}` });
    }
  },

  deleteItem: async (itemId: string) => {
    const { currentProject } = get();
    if (!currentProject) return;
    try {
      await apiClient.deleteItem(currentProject.id, itemId);
      const updatedLore = {
        ...currentProject.lore,
        items: currentProject.lore.items.filter((i) => i.id !== itemId),
      };
      set({ currentProject: { ...currentProject, lore: updatedLore }, toastMessage: "Deleted item" });
    } catch (e: any) {
      set({ toastMessage: `Failed to delete item: ${e.message}` });
    }
  },

  dismissRipple: () => set({ affectedScenes: [] }),
  setToast: (msg: string | null) => set({ toastMessage: msg }),
  setGraphViewMode: (mode: GraphViewMode) => set({ graphViewMode: mode }),
}));

function replaceSentenceInText(
  text: string,
  sceneIndex: number,
  targetSentenceId: string | null | undefined,
  replacement: string,
  fallbackSentenceId?: string
): string {
  if (!text || !text.trim()) return replacement;

  const targetId = targetSentenceId || fallbackSentenceId;

  // Split into sentences preserving positions
  const regex = /[^.!?\n]+(?:[.!?]+|\n+|$)/g;
  let match;
  let idx = 1;
  const sentences: { id: string; from: number; to: number; trimmed: string; raw: string }[] = [];

  while ((match = regex.exec(text)) !== null) {
    const raw = match[0];
    if (!raw.trim()) continue;
    const trimmedStart = match.index + (raw.length - raw.trimStart().length);
    const trimmed = raw.trim();
    const trimmedEnd = trimmedStart + trimmed.length;
    sentences.push({
      id: `s_${sceneIndex}_${idx}`,
      from: trimmedStart,
      to: trimmedEnd,
      trimmed,
      raw,
    });
    idx++;
  }

  // 1. Match by exact sentence ID (e.g., "s_3_4")
  let matchedIdx = sentences.findIndex((s) => s.id === targetId);

  // 2. Match by sentence numeric index if ID ends with _N
  if (matchedIdx === -1 && targetId) {
    const parts = targetId.split("_");
    const num = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(num) && num >= 1 && num <= sentences.length) {
      matchedIdx = num - 1;
    }
  }

  // 3. Fallback: match by keywords if present
  if (matchedIdx === -1 && sentences.length > 0) {
    const rLower = replacement.toLowerCase();
    matchedIdx = sentences.findIndex((s) => {
      const sLower = s.trimmed.toLowerCase();
      return (
        (rLower.includes("hand") && sLower.includes("hand")) ||
        (rLower.includes("rope") && sLower.includes("rope")) ||
        (rLower.includes("lamp") && sLower.includes("lamp")) ||
        (rLower.includes("burn") && sLower.includes("burn")) ||
        (rLower.includes("shoulder") && sLower.includes("shoulder")) ||
        (rLower.includes("rifle") && sLower.includes("rifle")) ||
        (rLower.includes("key") && sLower.includes("key"))
      );
    });
  }

  if (matchedIdx !== -1) {
    const from = sentences[matchedIdx].from;
    let to = sentences[matchedIdx].to;
    // Check if the next sentence is already duplicated within replacement
    if (
      matchedIdx + 1 < sentences.length &&
      replacement.includes(sentences[matchedIdx + 1].trimmed)
    ) {
      to = sentences[matchedIdx + 1].to;
    }
    return text.slice(0, from) + replacement + text.slice(to);
  }

  // If not found, insert before the scene text
  return `${replacement}\n${text}`;
}

function loggerWarning(msg: string) {
  console.warn(`[RETCON-RADAR Store] ${msg}`);
}

