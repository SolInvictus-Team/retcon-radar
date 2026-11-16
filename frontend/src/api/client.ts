/**
 * frontend/src/api/client.ts
 * REST API client with AbortController for stale typing request cancellation.
 */

import {
  AnalyzeResponse,
  Chapter,
  Character,
  Item,
  PatchesResponse,
  Project,
  ProjectSummary,
  RippleResponse,
} from "../types";

const BASE_URL = import.meta.env.VITE_API_URL || "";

let analyzeAbortController: AbortController | null = null;

export const apiClient = {
  async getProjects(): Promise<ProjectSummary[]> {
    const res = await fetch(`${BASE_URL}/api/projects`);
    if (!res.ok) throw new Error(`Failed to list projects: ${res.statusText}`);
    return res.json();
  },

  async getProject(id: string): Promise<Project> {
    const res = await fetch(`${BASE_URL}/api/projects/${id}`);
    if (!res.ok) throw new Error(`Failed to get project ${id}: ${res.statusText}`);
    return res.json();
  },

  async createProject(title: string): Promise<Project> {
    const res = await fetch(`${BASE_URL}/api/projects`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    if (!res.ok) throw new Error(`Failed to create project: ${res.statusText}`);
    return res.json();
  },

  async deleteProject(id: string): Promise<ProjectSummary[]> {
    const res = await fetch(`${BASE_URL}/api/projects/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error(`Failed to delete project: ${res.statusText}`);
    return res.json();
  },

  async bulkDeleteProjects(ids: string[]): Promise<ProjectSummary[]> {
    const res = await fetch(`${BASE_URL}/api/projects/delete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project_ids: ids }),
    });
    if (!res.ok) throw new Error(`Failed to bulk delete projects: ${res.statusText}`);
    return res.json();
  },

  async restoreProject(project: Project): Promise<Project> {
    const res = await fetch(`${BASE_URL}/api/projects/restore`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(project),
    });
    if (!res.ok) throw new Error(`Failed to restore project: ${res.statusText}`);
    return res.json();
  },

  async loadSampleProject(): Promise<Project> {
    const res = await fetch(`${BASE_URL}/api/projects/sample`, {
      method: "POST",
    });
    if (!res.ok) throw new Error(`Failed to load sample project: ${res.statusText}`);
    return res.json();
  },

  async addChapter(projectId: string, title: string, text: string = ""): Promise<Chapter> {
    const res = await fetch(`${BASE_URL}/api/projects/${projectId}/chapters`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, text }),
    });
    if (!res.ok) throw new Error(`Failed to add chapter: ${res.statusText}`);
    return res.json();
  },

  async updateChapter(
    projectId: string,
    chapterId: string,
    data: { title?: string; text?: string; index?: number }
  ): Promise<Chapter> {
    const res = await fetch(`${BASE_URL}/api/projects/${projectId}/chapters/${chapterId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`Failed to update chapter: ${res.statusText}`);
    return res.json();
  },

  async deleteChapter(projectId: string, chapterId: string): Promise<void> {
    const res = await fetch(`${BASE_URL}/api/projects/${projectId}/chapters/${chapterId}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error(`Failed to delete chapter: ${res.statusText}`);
  },

  async addCharacter(projectId: string, data: { name: string; aliases?: string[]; traits?: Record<string, any>; description?: string }): Promise<Character> {
    const res = await fetch(`${BASE_URL}/api/projects/${projectId}/lore/characters`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`Failed to add character: ${res.statusText}`);
    return res.json();
  },

  async deleteCharacter(projectId: string, charId: string): Promise<void> {
    const res = await fetch(`${BASE_URL}/api/projects/${projectId}/lore/characters/${charId}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error(`Failed to delete character: ${res.statusText}`);
  },

  async addItem(projectId: string, data: { name: string; aliases?: string[]; description?: string }): Promise<Item> {
    const res = await fetch(`${BASE_URL}/api/projects/${projectId}/lore/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`Failed to add item: ${res.statusText}`);
    return res.json();
  },

  async deleteItem(projectId: string, itemId: string): Promise<void> {
    const res = await fetch(`${BASE_URL}/api/projects/${projectId}/lore/items/${itemId}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error(`Failed to delete item: ${res.statusText}`);
  },

  async analyze(projectId: string, chapterId: string, text: string): Promise<AnalyzeResponse> {
    // Cancel prior in-flight analyze requests to avoid stale UI updates
    if (analyzeAbortController) {
      analyzeAbortController.abort();
    }
    analyzeAbortController = new AbortController();

    try {
      const res = await fetch(`${BASE_URL}/api/projects/${projectId}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chapter_id: chapterId, text }),
        signal: analyzeAbortController.signal,
      });

      if (!res.ok) {
        throw new Error(`Analyze failed: ${res.statusText}`);
      }
      return await res.json();
    } finally {
      // Clear controller when this specific call concludes
      if (analyzeAbortController?.signal.aborted) {
        analyzeAbortController = null;
      }
    }
  },

  async ripple(projectId: string, fromSceneIndex: number): Promise<RippleResponse> {
    const res = await fetch(`${BASE_URL}/api/projects/${projectId}/ripple`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ from_scene_index: fromSceneIndex }),
    });
    if (!res.ok) throw new Error(`Ripple failed: ${res.statusText}`);
    return res.json();
  },

  async getPatches(conflictId: string, projectId?: string): Promise<PatchesResponse> {
    const url = projectId
      ? `${BASE_URL}/api/projects/${projectId}/conflicts/${conflictId}/patches`
      : `${BASE_URL}/api/conflicts/${conflictId}/patches`;

    const res = await fetch(url, {
      method: "POST",
    });
    if (!res.ok) throw new Error(`Failed to generate patches: ${res.statusText}`);
    return res.json();
  },
};

