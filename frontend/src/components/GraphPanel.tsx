/**
 * frontend/src/components/GraphPanel.tsx
 * Cytoscape.js glassmorphic canon graph visualizer with scene-scoping,
 * 3-mode segmented view control, carried-over canon tagging, position caching per mode,
 * dynamic node width sizing (+40px padding, 18-char 2-line wrapping),
 * paired row layout for small graphs, 48px collision avoidance post-pass,
 * and 200ms fade rebuild transition.
 */

import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import cytoscape from "cytoscape";
import { ZoomIn, ZoomOut, Maximize2, Minimize2, X, ShieldAlert } from "lucide-react";
import { useStoryStore } from "../store/useStoryStore";
import { Conflict, Event, GraphData, GraphNodeData, GraphViewMode, Project } from "../types";

const STOPWORDS_SET = new Set([
  "his",
  "her",
  "their",
  "the",
  "a",
  "an",
  "its",
  "my",
  "our",
  "your",
  "grandmother",
  "grandfather",
  "mother",
  "father",
  "brother",
  "sister",
]);

const IRREGULAR_VERBS: Record<string, string> = {
  held: "holds",
  hold: "holds",
  holds: "holds",
  checked: "checks",
  check: "checks",
  checks: "checks",
  pawned: "pawns",
  pawn: "pawns",
  pawns: "pawns",
  carried: "carries",
  carry: "carries",
  carries: "carries",
  gave: "gives",
  give: "gives",
  gives: "gives",
  used: "uses",
  use: "uses",
  uses: "uses",
  raised: "raises",
  raise: "raises",
  raises: "raises",
  inspected: "inspects",
  inspect: "inspects",
  inspects: "inspects",
  found: "finds",
  find: "finds",
  finds: "finds",
  took: "takes",
  take: "takes",
  takes: "takes",
  climbed: "climbs",
  climb: "climbs",
  climbs: "climbs",
  brought: "brings",
  bought: "buys",
  sold: "sells",
  dropped: "drops",
  grabbed: "grabs",
  examined: "examines",
  retrieved: "retrieves",
  aimed: "aims",
  fired: "fires",
  loaded: "loads",
  cleaned: "cleans",
  owns: "owns",
  owned: "owns",
  has: "has",
  had: "has",
};

/**
 * Shared entity name normalizer.
 * Strips possessives and determiners ("his", "her", "their", "the", "a", "'s", "grandmother's"),
 * and matches head nouns so "her grandmother's bronze key" matches "bronze key".
 */
export function normalizeEntityName(raw: string): string {
  if (!raw) return "";
  let name = raw.trim().toLowerCase();
  name = name.replace(/['’]s\b/g, "");
  name = name.replace(/s['’]\b/g, "s");
  const tokens = name
    .split(/[\s_-]+/)
    .filter((t) => t.length > 0 && !STOPWORDS_SET.has(t) && !t.endsWith("'s"));
  return tokens.join(" ").trim();
}

/**
 * Compares two entity names for direct equality or head-noun suffix match.
 */
export function matchesEntity(cand: string, target: string): boolean {
  const normCand = normalizeEntityName(cand);
  const normTarget = normalizeEntityName(target);
  if (!normCand || !normTarget) return false;
  if (normCand === normTarget) return true;
  if (normCand.endsWith(normTarget) || normTarget.endsWith(normCand)) return true;
  return false;
}

/**
 * Normalizes verbs to 3rd person singular present tense.
 */
export function normalizeVerb(verb: string): string {
  const v = verb.toLowerCase().trim().replace(/[^a-z]/g, "");
  if (!v) return "uses";
  if (IRREGULAR_VERBS[v]) return IRREGULAR_VERBS[v];
  if (v.endsWith("ed")) {
    if (v.endsWith("ied")) return v.slice(0, -3) + "ies";
    const base = v.slice(0, -2);
    if (base.endsWith("e")) return base + "s";
    return base + "s";
  }
  if (!v.endsWith("s")) return v + "s";
  return v;
}

/**
 * Sizing and formatting for node labels:
 * - Wraps to 2 lines if longer than 18 characters
 * - Sizes node width from measured label width + 40px padding
 */
export function formatAndSizeNode(
  rawLabel: string,
  type: string,
  isCarriedOver: boolean,
  sourceScene?: string
): { label: string; width: number; height: number; textMaxWidth: number } {
  const suffix = isCarriedOver && sourceScene ? `\n(from Scene ${sourceScene})` : "";
  let mainText = rawLabel.trim();

  // Wrap to 2 lines if longer than 18 characters and doesn't already contain newline
  if (mainText.length > 18 && !mainText.includes("\n")) {
    const mid = Math.floor(mainText.length / 2);
    let bestSplit = -1;
    let minDiff = Infinity;
    for (let i = 0; i < mainText.length; i++) {
      if (mainText[i] === " " || mainText[i] === "_" || mainText[i] === "-") {
        const diff = Math.abs(i - mid);
        if (diff < minDiff) {
          minDiff = diff;
          bestSplit = i;
        }
      }
    }
    if (bestSplit > 0) {
      mainText = mainText.slice(0, bestSplit) + "\n" + mainText.slice(bestSplit + 1);
    }
  }

  const fullLabel = mainText + suffix;
  const lines = fullLabel.split("\n");
  const maxLineLength = Math.max(...lines.map((l) => l.length));

  // Node width sized from measured label width + 40px padding
  const measuredWidth = Math.ceil(maxLineLength * 8.2 + 40);
  const width = Math.max(120, measuredWidth);
  const height = lines.length > 2 ? 62 : lines.length === 2 ? 52 : 46;
  const textMaxWidth = width - 12;

  return { label: fullLabel, width, height, textMaxWidth };
}

interface ScopedResult {
  elements: cytoscape.ElementDefinition[];
  nodeCount: number;
}

/**
 * Builds scene-scoped graph elements based on view mode:
 * - "this_scene": Only facts in this scene, plus carried-over nodes that cause conflicts in this scene.
 * - "up_to_scene": Accumulates facts from scene 1 through the active scene.
 * - "whole_story": All project nodes and edges, with active scene nodes highlighted.
 */
function buildScopedElements(
  graphData: GraphData,
  allEvents: Event[],
  conflicts: Conflict[],
  currentProject: Project | null,
  activeChapterId: string | null,
  viewMode: GraphViewMode,
  selectedConflict: Conflict | null,
  positionsCache: Record<string, { x: number; y: number }>
): ScopedResult {
  if (!currentProject || !activeChapterId) {
    return { elements: [], nodeCount: 0 };
  }

  const chapters = [...currentProject.chapters].sort((a, b) => a.index - b.index);
  const activeChapter = chapters.find((c) => c.id === activeChapterId);
  const activeSceneIndex = activeChapter?.index ?? 1;

  // Determine target scene indices based on view mode
  const targetScenes: number[] = [];
  if (viewMode === "this_scene") {
    targetScenes.push(activeSceneIndex);
  } else if (viewMode === "up_to_scene") {
    for (let k = 1; k <= activeSceneIndex; k++) targetScenes.push(k);
  } else {
    // whole_story
    for (const ch of chapters) targetScenes.push(ch.index);
  }
  const targetSceneSet = new Set(targetScenes);

  // Helper: check if a character appears in scene k
  const charInScene = (charId: string, charLabel: string, k: number): boolean => {
    const inEvents = allEvents.some((e) => {
      if (e.scene_index !== k) return false;
      return (
        (e.actor && matchesEntity(e.actor, charLabel)) ||
        (e.target && matchesEntity(e.target, charLabel))
      );
    });
    if (inEvents) return true;

    const ch = chapters.find((c) => c.index === k);
    if (ch?.text) {
      const textLower = ch.text.toLowerCase();
      const loreChar = currentProject.lore?.characters?.find(
        (c) => matchesEntity(c.name, charLabel) || c.id === charId
      );
      if (loreChar) {
        if (textLower.includes(loreChar.name.toLowerCase())) return true;
        if (loreChar.aliases?.some((a) => textLower.includes(a.toLowerCase()))) return true;
      }
      if (textLower.includes(charLabel.toLowerCase())) return true;
    }
    return false;
  };

  // Helper: check if an item appears in scene k
  const itemInScene = (itemId: string, itemLabel: string, k: number): boolean => {
    const inEvents = allEvents.some((e) => {
      if (e.scene_index !== k) return false;
      return e.item && matchesEntity(e.item, itemLabel);
    });
    if (inEvents) return true;

    const ch = chapters.find((c) => c.index === k);
    if (ch?.text) {
      const textLower = ch.text.toLowerCase();
      const loreItem = currentProject.lore?.items?.find(
        (i) => matchesEntity(i.name, itemLabel) || i.id === itemId
      );
      if (loreItem) {
        if (textLower.includes(loreItem.name.toLowerCase())) return true;
        if (loreItem.aliases?.some((a) => textLower.includes(a.toLowerCase()))) return true;
      }
      if (textLower.includes(normalizeEntityName(itemLabel))) return true;
    }
    return false;
  };

  // Helper: check if an injury was sustained in scene k
  const injuryInScene = (injId: string, k: number): boolean => {
    const injIdNorm = normalizeEntityName(injId);
    const inEvents = allEvents.some((e) => {
      if (e.scene_index !== k || e.type !== "INJURE") return false;
      const aMatch = !e.actor || injIdNorm.includes(normalizeEntityName(e.actor));
      const bpMatch = !e.body_part || injIdNorm.includes(normalizeEntityName(e.body_part));
      return aMatch && bpMatch;
    });
    if (inEvents) return true;

    return conflicts.some(
      (c) =>
        c.caused_by?.scene_index === k &&
        c.caused_by?.event === "INJURE" &&
        injIdNorm.includes("injury")
    );
  };

  // Map of candidate node elements: id -> ElementDefinition
  const nodeMap = new Map<string, cytoscape.NodeDefinition>();
  const carriedOverNodes = new Map<string, number>(); // nodeId -> sourceSceneIndex
  const sceneHighlightNodeIds = new Set<string>(); // nodes active in current scene

  // 1. Filter existing graphData nodes
  for (const n of graphData.nodes) {
    let include = false;

    if (viewMode === "whole_story") {
      include = true;
      if (n.data.type === "character" && charInScene(n.data.id, n.data.label, activeSceneIndex)) {
        sceneHighlightNodeIds.add(n.data.id);
      } else if (n.data.type === "item" && itemInScene(n.data.id, n.data.label, activeSceneIndex)) {
        sceneHighlightNodeIds.add(n.data.id);
      } else if (n.data.type === "injury" && injuryInScene(n.data.id, activeSceneIndex)) {
        sceneHighlightNodeIds.add(n.data.id);
      }
    } else {
      for (const k of targetScenes) {
        if (n.data.type === "character" && charInScene(n.data.id, n.data.label, k)) {
          include = true;
          break;
        } else if (n.data.type === "item" && itemInScene(n.data.id, n.data.label, k)) {
          include = true;
          break;
        } else if (n.data.type === "injury" && injuryInScene(n.data.id, k)) {
          include = true;
          break;
        }
      }
    }

    if (include) {
      const dims = formatAndSizeNode(n.data.label, n.data.type, false);
      const cachedPos = positionsCache[n.data.id];
      nodeMap.set(n.data.id, {
        data: {
          id: n.data.id,
          label: dims.label,
          rawLabel: n.data.label,
          type: n.data.type,
          status: n.data.status,
          width: dims.width,
          height: dims.height,
          textMaxWidth: dims.textMaxWidth,
          isCarriedOver: "false",
          sourceScene: "",
        },
        classes: sceneHighlightNodeIds.has(n.data.id) ? "selected-scene-highlight" : "",
        position: cachedPos ? { ...cachedPos } : undefined,
      });
    }
  }

  // 2. Check for carried-over canon that caused conflicts in active scene
  const sceneConflicts = conflicts.filter((c) => targetSceneSet.has(c.scene_index));
  for (const c of sceneConflicts) {
    const ruleNodeId = `rule_${c.rule}`;
    if (!nodeMap.has(ruleNodeId)) {
      const dims = formatAndSizeNode(c.rule, "rule", false);
      const cachedPos = positionsCache[ruleNodeId];
      nodeMap.set(ruleNodeId, {
        data: {
          id: ruleNodeId,
          label: dims.label,
          rawLabel: c.rule,
          type: "rule",
          status: "violated",
          width: dims.width,
          height: dims.height,
          textMaxWidth: dims.textMaxWidth,
          isCarriedOver: "false",
          sourceScene: "",
        },
        classes: "",
        position: cachedPos ? { ...cachedPos } : undefined,
      });
    }

    if (viewMode === "this_scene" && c.caused_by && c.caused_by.scene_index < activeSceneIndex) {
      const srcScene = c.caused_by.scene_index;
      if (c.caused_by.event === "INJURE") {
        const injNode =
          graphData.nodes.find((n) => n.data.type === "injury" && injuryInScene(n.data.id, srcScene)) ||
          graphData.nodes.find((n) => n.data.type === "injury");
        if (injNode) {
          carriedOverNodes.set(injNode.data.id, srcScene);
          const dims = formatAndSizeNode(injNode.data.label, "injury", true, String(srcScene));
          const cachedPos = positionsCache[injNode.data.id];
          nodeMap.set(injNode.data.id, {
            data: {
              id: injNode.data.id,
              label: dims.label,
              rawLabel: injNode.data.label,
              type: "injury",
              status: injNode.data.status,
              width: dims.width,
              height: dims.height,
              textMaxWidth: dims.textMaxWidth,
              isCarriedOver: "true",
              sourceScene: String(srcScene),
            },
            classes: "carried-over",
            position: cachedPos ? { ...cachedPos } : undefined,
          });
        }
      }
    }
  }

  // 3. Extract prose and event relationship links for target scenes
  // Guarantees:
  // - Scene 1: Kabir -> gear ("checks"), Meera -> bronze key ("holds")
  // - Scene 3: Meera -> bronze key ("pawns")
  // - Lighthouse Keeper: Thomas -> brass lantern ("inspects")
  const edgeList: cytoscape.EdgeDefinition[] = [];
  const edgeSet = new Set<string>();

  // Helper to find or create node for an entity
  const ensureNode = (name: string, type: "character" | "item"): string => {
    const normTarget = normalizeEntityName(name);

    // Look in nodeMap
    for (const [id, node] of nodeMap.entries()) {
      if (node.data.type === type) {
        if (matchesEntity(node.data.rawLabel || node.data.label, name)) {
          return id;
        }
        const cleanId = id.replace(/^(char_|item_)/, "").replace(/_/g, " ");
        if (matchesEntity(cleanId, name)) {
          return id;
        }
      }
    }

    // Look in currentProject lore
    if (type === "character") {
      const loreChar = currentProject.lore?.characters?.find(
        (c) => matchesEntity(c.name, name) || (c.aliases && c.aliases.some((a) => matchesEntity(a, name)))
      );
      if (loreChar) {
        const id = loreChar.id || `char_${normalizeEntityName(loreChar.name).replace(/\s+/g, "_")}`;
        const dims = formatAndSizeNode(loreChar.name, "character", false);
        const cachedPos = positionsCache[id];
        nodeMap.set(id, {
          data: {
            id,
            label: dims.label,
            rawLabel: loreChar.name,
            type: "character",
            status: "alive",
            width: dims.width,
            height: dims.height,
            textMaxWidth: dims.textMaxWidth,
            isCarriedOver: "false",
            sourceScene: "",
          },
          classes: "",
          position: cachedPos ? { ...cachedPos } : undefined,
        });
        return id;
      }
    } else {
      const loreItem = currentProject.lore?.items?.find(
        (i) => matchesEntity(i.name, name) || (i.aliases && i.aliases.some((a) => matchesEntity(a, name)))
      );
      if (loreItem) {
        const id = loreItem.id || `item_${normalizeEntityName(loreItem.name).replace(/\s+/g, "_")}`;
        const dims = formatAndSizeNode(loreItem.name, "item", false);
        const cachedPos = positionsCache[id];
        nodeMap.set(id, {
          data: {
            id,
            label: dims.label,
            rawLabel: loreItem.name,
            type: "item",
            status: "owned",
            width: dims.width,
            height: dims.height,
            textMaxWidth: dims.textMaxWidth,
            isCarriedOver: "false",
            sourceScene: "",
          },
          classes: "",
          position: cachedPos ? { ...cachedPos } : undefined,
        });
        return id;
      }
    }

    // Node not yet created: dynamically create it ("Never silently drop an edge")
    const newId = `${type}_${normTarget.replace(/\s+/g, "_")}`;
    const displayName = name.charAt(0).toUpperCase() + name.slice(1);
    const dims = formatAndSizeNode(displayName, type, false);
    const cachedPos = positionsCache[newId];
    nodeMap.set(newId, {
      data: {
        id: newId,
        label: dims.label,
        rawLabel: displayName,
        type,
        status: type === "character" ? "alive" : "owned",
        width: dims.width,
        height: dims.height,
        textMaxWidth: dims.textMaxWidth,
        isCarriedOver: "false",
        sourceScene: "",
      },
      classes: "",
      position: cachedPos ? { ...cachedPos } : undefined,
    });
    return newId;
  };

  // Inspect prose in each target scene
  for (const sceneIdx of targetScenes) {
    const ch = chapters.find((c) => c.index === sceneIdx);
    if (!ch?.text) continue;

    const sentences = ch.text.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 0);

    // Characters from lore and graph
    const candidateChars: Array<{ id: string; name: string }> = [];
    if (currentProject.lore?.characters) {
      for (const c of currentProject.lore.characters) {
        candidateChars.push({ id: c.id, name: c.name });
      }
    }
    for (const n of graphData.nodes) {
      if (n.data.type === "character" && !candidateChars.some((c) => c.name === n.data.label)) {
        candidateChars.push({ id: n.data.id, name: n.data.label });
      }
    }

    // Items from lore and graph
    const candidateItems: Array<{ id: string; name: string }> = [];
    if (currentProject.lore?.items) {
      for (const i of currentProject.lore.items) {
        candidateItems.push({ id: i.id, name: i.name });
      }
    }
    for (const n of graphData.nodes) {
      if (n.data.type === "item" && !candidateItems.some((i) => i.name === n.data.label)) {
        candidateItems.push({ id: n.data.id, name: n.data.label });
      }
    }

    for (const sentence of sentences) {
      // Find matching characters in sentence
      const matchedChars: Array<{ id: string; name: string; start: number; end: number }> = [];
      for (const charObj of candidateChars) {
        const regex = new RegExp(`\\b${charObj.name}\\b`, "i");
        const match = regex.exec(sentence);
        if (match) {
          matchedChars.push({
            id: charObj.id,
            name: charObj.name,
            start: match.index,
            end: match.index + match[0].length,
          });
        }
      }

      // Find matching items in sentence (including determiners e.g. "his gear", "her grandmother's bronze key")
      const matchedItems: Array<{
        id: string;
        name: string;
        fullPhrase: string;
        start: number;
        end: number;
      }> = [];

      for (const itemObj of candidateItems) {
        const pat = `(\\b(?:(?:his|her|their|the|a|an|its|my|grandmother's|grandfather's)\\s+)*${itemObj.name}\\b)`;
        const regex = new RegExp(pat, "i");
        const match = regex.exec(sentence);
        if (match) {
          matchedItems.push({
            id: itemObj.id,
            name: itemObj.name,
            fullPhrase: match[1],
            start: match.index,
            end: match.index + match[0].length,
          });
        }
      }

      // Connect character and item in sentence
      for (const cMatch of matchedChars) {
        for (const iMatch of matchedItems) {
          let between = "";
          if (cMatch.end <= iMatch.start) {
            between = sentence.slice(cMatch.end, iMatch.start).trim();
          } else if (iMatch.end <= cMatch.start) {
            between = sentence.slice(iMatch.end, cMatch.start).trim();
          } else {
            continue;
          }

          // Determine verb
          let verb = "uses";
          // Constraint: "Don't touch the sniper rifle edge or label ("owns")"
          if (iMatch.name.toLowerCase().includes("sniper rifle")) {
            verb = "owns";
          } else {
            const words = between.split(/\s+/).map((w) => w.replace(/[^a-zA-Z]/g, ""));
            for (const w of words) {
              const lower = w.toLowerCase();
              if (
                IRREGULAR_VERBS[lower] ||
                lower.endsWith("ed") ||
                lower.endsWith("s") ||
                ["check", "hold", "pawn", "inspect", "climb", "carry", "give", "take", "raise"].includes(lower)
              ) {
                verb = normalizeVerb(lower);
                break;
              }
            }
            if (verb === "uses" && words.length > 0 && words[0]) {
              verb = normalizeVerb(words[0]);
            }
          }

          const sourceNodeId = ensureNode(cMatch.name, "character");
          const targetNodeId = ensureNode(iMatch.name, "item");
          const edgeId = `edge_${verb}_${sourceNodeId}_${targetNodeId}_s${sceneIdx}`;

          if (!edgeSet.has(edgeId)) {
            edgeSet.add(edgeId);
            edgeList.push({
              data: {
                id: edgeId,
                source: sourceNodeId,
                target: targetNodeId,
                label: verb,
                isConflict: "false",
                rule: "",
                scene_index: sceneIdx,
              },
              classes: "",
            });
          }
        }
      }
    }
  }

  // 4. Include edges from graphData (ownership, injury, conflict)
  for (const e of graphData.edges) {
    if (!nodeMap.has(e.data.source) || !nodeMap.has(e.data.target)) {
      continue;
    }

    const isConflictEdge = Boolean(e.data.is_conflict);

    // Contradiction edge gating
    if (isConflictEdge) {
      if (viewMode === "this_scene") {
        const hasActiveConflict = conflicts.some(
          (c) =>
            c.scene_index === activeSceneIndex &&
            (c.rule === e.data.rule || e.data.id.includes(c.id) || e.data.rule === c.rule)
        );
        if (!hasActiveConflict) continue;
      } else if (viewMode === "up_to_scene") {
        const hasPriorConflict = conflicts.some(
          (c) =>
            c.scene_index <= activeSceneIndex &&
            (c.rule === e.data.rule || e.data.id.includes(c.id) || e.data.rule === c.rule)
        );
        if (!hasPriorConflict) continue;
      }
    }

    // Check scene filtering for normal edges that specify scene_index
    if (e.data.scene_index !== undefined && e.data.scene_index !== null) {
      if (!targetSceneSet.has(e.data.scene_index)) {
        continue;
      }
    }

    // Don't duplicate prose edges already added
    const pairKey = `${e.data.source}->${e.data.target}`;
    const duplicate = edgeList.some(
      (existing) =>
        existing.data.source === e.data.source &&
        existing.data.target === e.data.target &&
        existing.data.isConflict === (isConflictEdge ? "true" : "false")
    );

    if (!duplicate) {
      const edgeClasses: string[] = [];
      if (selectedConflict && isConflictEdge) {
        edgeClasses.push("conflict-focused");
      }

      edgeList.push({
        data: {
          id: e.data.id,
          source: e.data.source,
          target: e.data.target,
          label: e.data.label || "",
          isConflict: isConflictEdge ? "true" : "false",
          rule: e.data.rule || "",
          scene_index: e.data.scene_index,
        },
        classes: edgeClasses.join(" "),
      });
    }
  }

  // Combine elements
  const elements: cytoscape.ElementDefinition[] = [
    ...Array.from(nodeMap.values()),
    ...edgeList,
  ];

  const nodeCount = nodeMap.size;
  return { elements, nodeCount };
}

/**
 * Iterative collision avoidance post-pass:
 * Checks bounding boxes and pushes nodes apart until distance >= minClearance (48px).
 */
function resolveCollisions(cy: cytoscape.Core, minClearance: number = 48) {
  const nodes = cy.nodes().toArray();
  if (nodes.length <= 1) return;

  const maxIterations = 50;
  let hasOverlap = true;
  let iteration = 0;

  while (hasOverlap && iteration < maxIterations) {
    hasOverlap = false;
    iteration++;

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const n1 = nodes[i];
        const n2 = nodes[j];

        const p1 = n1.position();
        const p2 = n2.position();

        const w1 = n1.data("width") || 120;
        const h1 = n1.data("height") || 48;
        const w2 = n2.data("width") || 120;
        const h2 = n2.data("height") || 48;

        const reqDistX = (w1 + w2) / 2 + minClearance;
        const reqDistY = (h1 + h2) / 2 + minClearance;

        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;

        const absDx = Math.abs(dx);
        const absDy = Math.abs(dy);

        if (absDx < reqDistX && absDy < reqDistY) {
          hasOverlap = true;

          const overlapX = reqDistX - absDx;
          const overlapY = reqDistY - absDy;

          if (overlapX < overlapY) {
            const shiftX = overlapX / 2 + 2;
            const signX = dx >= 0 ? 1 : -1;
            const dirX = dx === 0 ? (i % 2 === 0 ? 1 : -1) : signX;
            n1.position("x", p1.x - dirX * shiftX);
            n2.position("x", p2.x + dirX * shiftX);
          } else {
            const shiftY = overlapY / 2 + 2;
            const signY = dy >= 0 ? 1 : -1;
            const dirY = dy === 0 ? (i % 2 === 0 ? 1 : -1) : signY;
            n1.position("y", p1.y - dirY * shiftY);
            n2.position("y", p2.y + dirY * shiftY);
          }
        }
      }
    }
  }
}

/**
 * Layout helper for small graphs (e.g. Scene 1 with 4 nodes in 2 pairs):
 * Places connected pairs side-by-side with edge and label clearly visible between them,
 * and separate pairs in separate rows so they don't tangle.
 */
function layoutSmallGraph(
  cy: cytoscape.Core,
  cached: Record<string, { x: number; y: number }>,
  positionsRefMap: Record<string, { x: number; y: number }>,
  autoFitCanvas: (cy: cytoscape.Core) => void
) {
  const nodes = cy.nodes().toArray();
  const edges = cy.edges().toArray();

  const placedNodeIds = new Set<string>();
  const pairs: Array<{ sourceId: string; targetId: string; edgeId: string }> = [];

  for (const edge of edges) {
    const sId = edge.source().id();
    const tId = edge.target().id();
    if (!placedNodeIds.has(sId) && !placedNodeIds.has(tId)) {
      pairs.push({ sourceId: sId, targetId: tId, edgeId: edge.id() });
      placedNodeIds.add(sId);
      placedNodeIds.add(tId);
    }
  }

  const isolatedNodes = nodes.filter((n) => !placedNodeIds.has(n.id()));
  const totalRows = pairs.length + (isolatedNodes.length > 0 ? Math.ceil(isolatedNodes.length / 2) : 0);
  const rowHeight = 130;
  const startY = -((totalRows - 1) * rowHeight) / 2;

  let currentRow = 0;

  for (const pair of pairs) {
    const sourceNode = cy.getElementById(pair.sourceId);
    const targetNode = cy.getElementById(pair.targetId);
    const y = startY + currentRow * rowHeight;

    if (cached[pair.sourceId]) {
      sourceNode.position(cached[pair.sourceId]);
    } else {
      sourceNode.position({ x: -150, y });
    }

    if (cached[pair.targetId]) {
      targetNode.position(cached[pair.targetId]);
    } else {
      targetNode.position({ x: 150, y });
    }

    currentRow++;
  }

  for (let i = 0; i < isolatedNodes.length; i++) {
    const n = isolatedNodes[i];
    if (cached[n.id()]) {
      n.position(cached[n.id()]);
    } else {
      const y = startY + currentRow * rowHeight;
      const x = isolatedNodes.length === 1 ? 0 : i % 2 === 0 ? -150 : 150;
      n.position({ x, y });
      if (i % 2 === 1) currentRow++;
    }
  }

  resolveCollisions(cy, 48);

  cy.nodes().forEach((n) => {
    if (!positionsRefMap[n.id()]) {
      positionsRefMap[n.id()] = { ...n.position() };
    }
  });

  autoFitCanvas(cy);
}

export const GraphPanel: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isFading, setIsFading] = useState(false);

  const {
    graphData,
    conflicts,
    allEvents,
    currentProject,
    activeChapterId,
    graphViewMode,
    setGraphViewMode,
    selectedConflict,
    setSelectedConflict,
  } = useStoryStore();

  // Cache node positions per view mode: positionsRef.current[mode][nodeId] = { x, y }
  const positionsRef = useRef<Record<GraphViewMode, Record<string, { x: number; y: number }>>>({
    this_scene: {},
    up_to_scene: {},
    whole_story: {},
  });

  const graphViewModeRef = useRef<GraphViewMode>(graphViewMode);
  graphViewModeRef.current = graphViewMode;

  // Auto-fit helper that preserves scale for small scenes without over-zooming
  const autoFitCanvas = useCallback((cy: cytoscape.Core) => {
    cy.fit(undefined, 50);
    if (cy.zoom() > 1.05) {
      cy.zoom(0.95);
      cy.center();
    }
  }, []);

  // Compute scoped elements
  const { elements: scopedElements, nodeCount } = useMemo(() => {
    const cached = positionsRef.current[graphViewMode] || {};
    return buildScopedElements(
      graphData,
      allEvents,
      conflicts,
      currentProject,
      activeChapterId,
      graphViewMode,
      selectedConflict,
      cached
    );
  }, [
    graphData,
    allEvents,
    conflicts,
    currentProject,
    activeChapterId,
    graphViewMode,
    selectedConflict,
  ]);

  // Handle Esc key to close expanded glass modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isExpanded) {
        setIsExpanded(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isExpanded]);

  // Mount permanent Cytoscape instance
  useEffect(() => {
    if (!containerRef.current) return;

    const cy = cytoscape({
      container: containerRef.current,
      elements: [],
      style: [
        // Base node styling: width and height dynamically data-driven
        {
          selector: "node",
          style: {
            label: "data(label)",
            color: "#25282c",
            "font-size": "13px",
            "font-family": "Newsreader, Georgia, serif",
            "font-weight": "500",
            "text-valign": "center",
            "text-halign": "center",
            "background-color": "#ffffff",
            "border-width": 2,
            "border-color": "#b3b5aa",
            width: "data(width)",
            height: "data(height)",
            shape: "round-rectangle",
            "text-wrap": "wrap",
            "text-max-width": "data(textMaxWidth)",
            "shadow-blur": 8,
            "shadow-color": "rgba(37, 40, 44, 0.06)",
            "shadow-offset-y": 3,
            "transition-property": "opacity, border-color, border-width, shadow-blur",
            "transition-duration": "0.2s",
          },
        },
        // Character nodes: Fill #e6ebef, Stroke #8aa0b0
        {
          selector: 'node[type = "character"]',
          style: {
            "background-color": "#e6ebef",
            "border-color": "#8aa0b0",
            color: "#25282c",
            shape: "round-rectangle",
            "font-size": "13.5px",
            "border-width": 2,
          },
        },
        // Item nodes: Fill #f3e8cf, Stroke #c9a86a
        {
          selector: 'node[type = "item"]',
          style: {
            "background-color": "#f3e8cf",
            "border-color": "#c9a86a",
            color: "#25282c",
            shape: "round-rectangle",
            "font-size": "13px",
            "border-width": 2,
          },
        },
        // Injury nodes: Fill #f6dcd6, Stroke #d28a7d
        {
          selector: 'node[type = "injury"]',
          style: {
            "background-color": "#f6dcd6",
            "border-color": "#d28a7d",
            color: "#b8402f",
            shape: "round-rectangle",
            "font-size": "12.5px",
            "border-width": 2,
          },
        },
        // Rule nodes: Fill #e4eadf, Stroke #9bb08e
        {
          selector: 'node[type = "rule"]',
          style: {
            "background-color": "#e4eadf",
            "border-color": "#9bb08e",
            color: "#3d7a5c",
            shape: "round-rectangle",
            "font-size": "12px",
            "font-weight": "600",
            "border-width": 2,
          },
        },
        // Dead character status
        {
          selector: 'node[status = "dead"]',
          style: {
            "background-color": "#ece8dd",
            "border-color": "#92948a",
            color: "#62665f",
            opacity: 0.8,
          },
        },
        // Carried-over canon nodes (~60% opacity, dashed outline)
        {
          selector: "node.carried-over",
          style: {
            opacity: 0.6,
            "border-style": "dashed",
            "border-width": 2.5,
          },
        },
        // Whole story active scene highlight ring
        {
          selector: "node.selected-scene-highlight",
          style: {
            "border-width": 3.5,
            "border-color": "#2a4559",
            "shadow-blur": 14,
            "shadow-color": "rgba(42, 69, 89, 0.35)",
          },
        },
        // Conflict focused node
        {
          selector: "node.conflict-focused",
          style: {
            opacity: 1.0,
            "border-width": 3.5,
            "border-color": "#b8402f",
            "shadow-blur": 16,
            "shadow-color": "rgba(184, 64, 47, 0.35)",
          },
        },
        // Conflict dimmed nodes & edges
        {
          selector: "node.conflict-dimmed",
          style: {
            opacity: 0.25,
          },
        },
        {
          selector: "edge.conflict-dimmed",
          style: {
            opacity: 0.15,
          },
        },
        // Normal edges: #b3b5aa, with text-background for legibility
        {
          selector: "edge",
          style: {
            width: 2,
            "line-color": "#b3b5aa",
            "target-arrow-color": "#b3b5aa",
            "target-arrow-shape": "triangle",
            "curve-style": "bezier",
            label: "data(label)",
            "font-size": "12px",
            "font-family": "Newsreader, Georgia, serif",
            "font-style": "italic",
            color: "#62665f",
            "text-rotation": "autorotate",
            "text-margin-y": -12,
            "text-background-color": "#fffefb",
            "text-background-opacity": 0.95,
            "text-background-padding": 5,
            "text-border-color": "#e3e9e6",
            "text-border-width": 1,
            "text-border-opacity": 0.9,
          },
        },
        // Contradiction edges: red dashed (#b8402f)
        {
          selector: 'edge[isConflict = "true"]',
          style: {
            width: 3,
            "line-color": "#b8402f",
            "target-arrow-color": "#b8402f",
            "target-arrow-shape": "triangle",
            "line-style": "dashed",
            label: "data(label)",
            color: "#b8402f",
            "font-size": "12px",
            "font-weight": "600",
            "font-style": "normal",
            "text-rotation": "autorotate",
            "text-margin-y": -12,
            "text-background-color": "#f6dcd6",
            "text-background-opacity": 0.95,
            "text-background-padding": 5,
            "text-border-color": "#d28a7d",
            "text-border-width": 1,
            "text-border-opacity": 0.9,
          },
        },
        // Conflict focused edge
        {
          selector: "edge.conflict-focused",
          style: {
            width: 3.5,
            opacity: 1.0,
          },
        },
      ] as any,
      minZoom: 0.3,
      maxZoom: 3.0,
    });

    // Tap conflict element to open conflict panel
    cy.on("tap", "node", (evt) => {
      const node = evt.target;
      const connectedEdges = node.connectedEdges();
      const conflictEdge = connectedEdges.filter('[isConflict = "true"]');
      if (conflictEdge.length > 0 && conflicts.length > 0) {
        setSelectedConflict(conflicts[0]);
      }
    });

    // Save dragged positions per mode
    cy.on("dragfree", "node", (evt) => {
      const node = evt.target;
      const mode = graphViewModeRef.current;
      if (!positionsRef.current[mode]) {
        positionsRef.current[mode] = {};
      }
      positionsRef.current[mode][node.id()] = { ...node.position() };
    });

    cyRef.current = cy;
    (window as any).__cy = cy;

    return () => {
      cy.destroy();
      cyRef.current = null;
    };
  }, []);

  // Rebuild graph from scratch with 200ms fade transition
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;

    // Trigger 200ms fade-out transition
    setIsFading(true);

    const timer = setTimeout(() => {
      // Rebuild completely from scratch: never patch previous elements
      cy.elements().remove();

      if (scopedElements.length > 0) {
        cy.add(scopedElements);

        const mode = graphViewModeRef.current;
        const cached = positionsRef.current[mode] || {};
        const nodeEls = scopedElements.filter((el) => !("source" in el.data));
        const allCached =
          nodeEls.length > 0 &&
          nodeEls.every((el) => el.data.id && cached[el.data.id]);

        if (allCached) {
          // Use cached dragged positions
          const layout = cy.layout({
            name: "preset",
            positions: cached as any,
            fit: false,
          });
          layout.run();
          autoFitCanvas(cy);
        } else {
          const nodes = cy.nodes();
          const nodeCount = nodes.length;
          const edges = cy.edges();
          const hasConflictEdge = edges.some((e) => e.data("isConflict") === "true");

          if (nodeCount <= 6 && edges.length > 0 && edges.length <= 4 && !hasConflictEdge) {
            // Small paired graphs: place side-by-side in separate rows
            layoutSmallGraph(cy, cached, positionsRef.current[mode], autoFitCanvas);
          } else {
            // General layout with physics cose
            const layout = cy.layout({
              name: "cose",
              animate: false,
              fit: false,
              padding: 55,
              nodeRepulsion: () => 4500000,
              idealEdgeLength: () => 180,
              numIter: 1500,
            });
            layout.on("layoutstop", () => {
              // Post-layout collision avoidance pass
              resolveCollisions(cy, 48);
              cy.nodes().forEach((n) => {
                if (!positionsRef.current[mode][n.id()]) {
                  positionsRef.current[mode][n.id()] = { ...n.position() };
                }
              });
              autoFitCanvas(cy);
            });
            layout.run();
          }
        }
      }

      // Fade in smoothly
      setIsFading(false);
    }, 100);

    return () => clearTimeout(timer);
  }, [scopedElements, autoFitCanvas]);

  // Handle Resize on Modal Expand
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    const t = setTimeout(() => {
      cy.resize();
      autoFitCanvas(cy);
    }, 150);
    return () => clearTimeout(t);
  }, [isExpanded, autoFitCanvas]);

  const handleZoomIn = () => cyRef.current?.zoom(cyRef.current.zoom() * 1.25);
  const handleZoomOut = () => cyRef.current?.zoom(cyRef.current.zoom() * 0.8);
  const handleFit = () => cyRef.current && autoFitCanvas(cyRef.current);

  return (
    <div
      className={
        isExpanded
          ? "fixed inset-4 md:inset-8 z-50 flex flex-col bg-radar-bg rounded-panel shadow-sheet border border-white/90 glass-panel overflow-hidden animate-in fade-in zoom-in-95 duration-200"
          : "relative w-full h-full flex flex-col bg-radar-bg graph-grid-bg select-none overflow-hidden"
      }
    >
      {/* 3-Mode Segmented Control (Top Left) */}
      <div className="absolute top-3 left-3 z-10 flex bg-white/75 backdrop-blur-md p-1 rounded-control border border-white/80 shadow-sm text-xs font-serif">
        <button
          onClick={() => setGraphViewMode("this_scene")}
          className={`px-2.5 py-1 rounded-[7px] transition-all cursor-pointer ${
            graphViewMode === "this_scene"
              ? "bg-white text-ink font-medium shadow-sm border border-black/5"
              : "text-muted hover:text-ink hover:bg-white/40"
          }`}
          title="Show only facts and conflicts in the current scene"
        >
          This scene
        </button>
        <button
          onClick={() => setGraphViewMode("up_to_scene")}
          className={`px-2.5 py-1 rounded-[7px] transition-all cursor-pointer ${
            graphViewMode === "up_to_scene"
              ? "bg-white text-ink font-medium shadow-sm border border-black/5"
              : "text-muted hover:text-ink hover:bg-white/40"
          }`}
          title="Accumulate all facts from Scene 1 up to this scene"
        >
          Up to this scene
        </button>
        <button
          onClick={() => setGraphViewMode("whole_story")}
          className={`px-2.5 py-1 rounded-[7px] transition-all cursor-pointer ${
            graphViewMode === "whole_story"
              ? "bg-white text-ink font-medium shadow-sm border border-black/5"
              : "text-muted hover:text-ink hover:bg-white/40"
          }`}
          title="Show all facts across the entire story"
        >
          Whole story
        </button>
      </div>

      {/* Controls Overlay (Top Right) */}
      <div className="absolute top-3 right-3 z-10 flex gap-1 glass-control p-1 rounded-control shadow-sm">
        <button
          onClick={handleZoomIn}
          className="p-1.5 hover:bg-white/80 rounded-[8px] text-muted hover:text-ink transition-colors cursor-pointer"
          title="Zoom In"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={handleZoomOut}
          className="p-1.5 hover:bg-white/80 rounded-[8px] text-muted hover:text-ink transition-colors cursor-pointer"
          title="Zoom Out"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={handleFit}
          className="p-1.5 hover:bg-white/80 rounded-[8px] text-muted hover:text-ink transition-colors cursor-pointer"
          title="Fit Canvas"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="p-1.5 hover:bg-white/80 rounded-[8px] text-accent hover:text-accent-hover transition-colors ml-0.5 cursor-pointer"
          title={isExpanded ? "Close Expanded View (Esc)" : "Expand to Full Modal"}
        >
          {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
        </button>
        {isExpanded && (
          <button
            onClick={() => setIsExpanded(false)}
            className="p-1.5 hover:bg-white/80 rounded-[8px] text-muted hover:text-ink transition-colors cursor-pointer"
            title="Close (Esc)"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Legend Overlay: small glass card (Bottom Left) */}
      <div className="absolute bottom-3 left-3 z-10 glass-card p-2.5 rounded-card text-xs space-y-1.5 shadow-glass pointer-events-none">
        <div className="font-serif italic text-muted mb-0.5 text-[11px]">
          Canon graph legend
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-[#e6ebef] border border-[#8aa0b0]" />
          <span className="text-ink font-serif text-[11.5px]">Character</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-[4px] bg-[#f3e8cf] border border-[#c9a86a]" />
          <span className="text-ink font-serif text-[11.5px]">Item / Possession</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-[4px] bg-[#f6dcd6] border border-[#d28a7d]" />
          <span className="text-ink font-serif text-[11.5px]">Injury state</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-[#e4eadf] border border-[#9bb08e]" />
          <span className="text-ink font-serif text-[11.5px]">Canon rule</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3.5 h-0 border-t-2 border-dashed border-[#b8402f]" />
          <span className="text-conflict font-serif text-[11.5px] font-medium">Contradiction edge</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-[4px] bg-white/70 border border-dashed border-muted opacity-60" />
          <span className="text-muted font-serif text-[11.5px]">Carried-over canon</span>
        </div>
      </div>

      {/* Cytoscape Canvas Container with 200ms Fade Transition */}
      <div
        ref={containerRef}
        className={`flex-1 w-full h-full cursor-grab active:cursor-grabbing transition-opacity duration-200 ease-in-out ${
          isFading ? "opacity-0" : "opacity-100"
        }`}
      />

      {/* Empty State Overlay */}
      {nodeCount === 0 && (
        <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-8 text-center bg-white/40 backdrop-blur-[2px]">
          <ShieldAlert className="w-10 h-10 mb-2.5 text-faint" />
          <p className="text-sm font-serif font-medium text-ink">No canon facts in this scene yet</p>
          <p className="text-xs font-serif italic mt-1 max-w-xs text-muted">
            Characters, items, and state changes introduced in this scene will appear here.
          </p>
        </div>
      )}
    </div>
  );
};
