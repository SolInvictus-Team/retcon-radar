/**
 * frontend/src/types.ts
 * Type definitions matching backend schemas.
 */

export type EventType =
  | "INJURE"
  | "USE"
  | "TRANSFER"
  | "KILL"
  | "APPEAR"
  | "TRAIT_ACTION";

export type EffortLevel = "light" | "heavy";
export type SeverityLevel = "high" | "warning" | "info";

export type ConflictRule =
  | "INJURED_PART_HEAVY_USE"
  | "UNOWNED_ITEM_USE"
  | "DEAD_CHARACTER_ACTION"
  | "TRAIT_VIOLATION"
  | "UNOWNED_ITEM_TRANSFER";

export type PatchType = "modify_source" | "bridge_gap" | "override_rule";

export interface Event {
  type: EventType;
  sentence_id: string;
  scene_index: number;
  actor?: string | null;
  target?: string | null;
  body_part?: string | null;
  item?: string | null;
  severity?: number | null;
  effort?: EffortLevel | null;
  trait_tag?: string | null;
  triggered?: boolean | null;
  override?: boolean | null;
}

export interface ConflictCause {
  sentence_id: string;
  scene_index: number;
  event: string;
}

export interface Conflict {
  id: string;
  rule: ConflictRule | string;
  sentence_id: string;
  scene_index: number;
  message: string;
  caused_by?: ConflictCause | null;
  severity: SeverityLevel | string;
}

export interface Character {
  id: string;
  name: string;
  aliases: string[];
  traits: Record<string, any>;
  description?: string | null;
}

export interface Item {
  id: string;
  name: string;
  aliases: string[];
  description?: string | null;
}

export interface LoreRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
}

export interface Lore {
  characters: Character[];
  items: Item[];
  rules: LoreRule[];
}

export interface Chapter {
  id: string;
  index: number;
  title: string;
  text: string;
}

export interface Project {
  id: string;
  title: string;
  chapters: Chapter[];
  lore: Lore;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface ProjectSummary {
  id: string;
  title: string;
  chapter_count: number;
  updated_at?: string | null;
}

export interface GraphNodeData {
  id: string;
  label: string;
  type: "character" | "item" | "injury" | "rule" | "event";
  status?: string | null;
  scene_index?: number | null;
  sentence_id?: string | null;
}

export interface GraphNode {
  data: GraphNodeData;
}

export interface GraphEdgeData {
  id: string;
  source: string;
  target: string;
  label?: string | null;
  is_conflict?: boolean;
  rule?: string | null;
  scene_index?: number | null;
}

export interface GraphEdge {
  data: GraphEdgeData;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface DevTimings {
  extraction_ms: number;
  engine_ms: number;
  total_ms: number;
}

export type GraphViewMode = "this_scene" | "up_to_scene" | "whole_story";

export interface AnalyzeResponse {
  conflicts: Conflict[];
  graph: GraphData;
  events: Event[];
  timings?: DevTimings;
  lore?: Lore;
  all_events?: Event[];
}

export interface RippleResponse {
  affected_scene_indexes: number[];
  new_conflicts: Conflict[];
}

export interface PatchSuggestion {
  id: string;
  type: PatchType;
  title: string;
  description: string;
  target_scene_index?: number | null;
  target_sentence_id?: string | null;
  suggested_text?: string | null;
}

export interface PatchesResponse {
  conflict_id: string;
  patches: PatchSuggestion[];
}

