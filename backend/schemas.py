"""
backend/schemas.py
Pydantic v2 models for RETCON-RADAR API contracts, canon engine, and LLM extraction.
"""

from enum import Enum
from typing import Any, Literal, Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


# ============================================================================
# Enums
# ============================================================================

class EventType(str, Enum):
    INJURE = "INJURE"
    USE = "USE"
    TRANSFER = "TRANSFER"
    KILL = "KILL"
    APPEAR = "APPEAR"
    TRAIT_ACTION = "TRAIT_ACTION"


class EffortLevel(str, Enum):
    LIGHT = "light"
    HEAVY = "heavy"


class SeverityLevel(str, Enum):
    HIGH = "high"
    WARNING = "warning"
    INFO = "info"


class ConflictRule(str, Enum):
    INJURED_PART_HEAVY_USE = "INJURED_PART_HEAVY_USE"
    UNOWNED_ITEM_USE = "UNOWNED_ITEM_USE"
    DEAD_CHARACTER_ACTION = "DEAD_CHARACTER_ACTION"
    TRAIT_VIOLATION = "TRAIT_VIOLATION"
    UNOWNED_ITEM_TRANSFER = "UNOWNED_ITEM_TRANSFER"


class PatchType(str, Enum):
    MODIFY_SOURCE = "modify_source"
    BRIDGE_GAP = "bridge_gap"
    OVERRIDE_RULE = "override_rule"


# ============================================================================
# Core Models: Event & Conflict
# ============================================================================

class Event(BaseModel):
    """
    Typed story event produced by the LLM extractor and processed by the canon engine.
    Matches Section 5 of AGENT.md:
      - INJURE(actor, body_part, severity 0..1)
      - USE(actor, body_part | item, effort: light | heavy)
      - TRANSFER(item, from, to) (to = null means lost/destroyed)
      - KILL(target)
      - APPEAR(actor)
      - TRAIT_ACTION(actor, trait_tag, triggered: bool)
    """
    model_config = ConfigDict(
        extra="ignore",
        populate_by_name=True,
        use_enum_values=True
    )

    type: EventType
    sentence_id: str = ""
    scene_index: int = 0
    actor: Optional[str] = None
    target: Optional[str] = None
    body_part: Optional[str] = None
    item: Optional[str] = None
    severity: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    effort: Optional[EffortLevel] = None
    trait_tag: Optional[str] = None
    triggered: Optional[bool] = None
    override: Optional[bool] = False

    @field_validator("type", mode="before")
    @classmethod
    def normalize_type(cls, v: Any) -> Any:
        if isinstance(v, str):
            v_upper = v.strip().upper()
            if v_upper in EventType.__members__:
                return EventType[v_upper]
        return v

    @field_validator("effort", mode="before")
    @classmethod
    def normalize_effort(cls, v: Any) -> Any:
        if isinstance(v, str):
            v_lower = v.strip().lower()
            if v_lower in ("heavy", "hard", "high", "intense"):
                return EffortLevel.HEAVY
            if v_lower in ("light", "low", "easy", "gentle"):
                return EffortLevel.LIGHT
        return None

    @field_validator("severity", mode="before")
    @classmethod
    def normalize_severity(cls, v: Any) -> Any:
        if v is None or v == "":
            return None
        try:
            val = float(v)
            return max(0.0, min(1.0, val))
        except (ValueError, TypeError):
            return None

    @field_validator("triggered", mode="before")
    @classmethod
    def normalize_triggered(cls, v: Any) -> Any:
        if v is None:
            return None
        if isinstance(v, bool):
            return v
        if isinstance(v, str):
            return v.strip().lower() in ("true", "1", "yes")
        return bool(v)

    @field_validator("override", mode="before")
    @classmethod
    def normalize_override(cls, v: Any) -> Any:
        if v is None:
            return False
        if isinstance(v, bool):
            return v
        if isinstance(v, str):
            return v.strip().lower() in ("true", "1", "yes")
        return bool(v)

    @model_validator(mode="before")
    @classmethod
    def harmonize_fields(cls, values: Any) -> Any:
        if isinstance(values, dict):
            # Harmonize INJURE: if target is provided or actor is a projectile/weapon, actor is the victim
            if values.get("type") in ("INJURE", EventType.INJURE):
                target = values.get("target")
                actor = values.get("actor")
                if target and (not actor or str(actor).lower() in ("bullet", "stray bullet", "gunfire", "shrapnel", "blade", "weapon", "explosion", "fire", "attack", "stray gunfire")):
                    values["actor"] = target
                elif not actor and target:
                    values["actor"] = target

            # Harmonize TRANSFER from/to aliases
            if "from" in values and not values.get("actor"):
                values["actor"] = values.get("from")
            elif "from_actor" in values and not values.get("actor"):
                values["actor"] = values.get("from_actor")

            if "to" in values and not values.get("target"):
                values["target"] = values.get("to")
            elif "to_actor" in values and not values.get("target"):
                values["target"] = values.get("to_actor")

            # Clean strings
            for field_name in ("actor", "target", "body_part", "item", "trait_tag", "sentence_id"):
                if field_name in values and values[field_name] is not None:
                    values[field_name] = str(values[field_name]).strip()
        return values


class ConflictCause(BaseModel):
    """Source event that caused the conflict (powers graph source edge)."""
    model_config = ConfigDict(extra="ignore")

    sentence_id: str
    scene_index: int
    event: str


class Conflict(BaseModel):
    """
    Flagged continuity contradiction returned by the engine.
    Matches Section 6 of AGENT.md:
    { id, sentence_id, scene_index, rule, message, caused_by: { sentence_id, scene_index, event }, severity }
    """
    model_config = ConfigDict(extra="ignore")

    id: str
    rule: ConflictRule | str
    sentence_id: str
    scene_index: int
    message: str
    caused_by: Optional[ConflictCause] = None
    severity: SeverityLevel | str = SeverityLevel.HIGH


# ============================================================================
# Core Models: Lore, Chapter, Project
# ============================================================================

class Character(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    name: str
    aliases: list[str] = Field(default_factory=list)
    traits: dict[str, Any] = Field(default_factory=dict)
    description: Optional[str] = None


class CharacterCreate(BaseModel):
    model_config = ConfigDict(extra="ignore")

    name: str
    aliases: list[str] = Field(default_factory=list)
    traits: dict[str, Any] = Field(default_factory=dict)
    description: Optional[str] = None


class Item(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    name: str
    aliases: list[str] = Field(default_factory=list)
    description: Optional[str] = None


class ItemCreate(BaseModel):
    model_config = ConfigDict(extra="ignore")

    name: str
    aliases: list[str] = Field(default_factory=list)
    description: Optional[str] = None


class LoreRule(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    name: str
    description: str
    enabled: bool = True


class Lore(BaseModel):
    model_config = ConfigDict(extra="ignore")

    characters: list[Character] = Field(default_factory=list)
    items: list[Item] = Field(default_factory=list)
    rules: list[LoreRule] = Field(default_factory=list)


class Chapter(BaseModel):
    """A scene in the project."""
    model_config = ConfigDict(extra="ignore")

    id: str
    index: int
    title: str
    text: str = ""


class Project(BaseModel):
    """Top-level project document."""
    model_config = ConfigDict(extra="ignore")

    id: str
    title: str
    chapters: list[Chapter] = Field(default_factory=list)
    lore: Lore = Field(default_factory=Lore)
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


# ============================================================================
# Graph Models (Cytoscape.js compatible)
# ============================================================================

class GraphNodeData(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    label: str
    type: Literal["character", "item", "injury", "rule", "event"]
    status: Optional[str] = None
    scene_index: Optional[int] = None
    sentence_id: Optional[str] = None


class GraphNode(BaseModel):
    model_config = ConfigDict(extra="ignore")
    data: GraphNodeData


class GraphEdgeData(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    source: str
    target: str
    label: Optional[str] = None
    is_conflict: bool = False
    rule: Optional[str] = None
    scene_index: Optional[int] = None


class GraphEdge(BaseModel):
    model_config = ConfigDict(extra="ignore")
    data: GraphEdgeData


class GraphData(BaseModel):
    model_config = ConfigDict(extra="ignore")

    nodes: list[GraphNode] = Field(default_factory=list)
    edges: list[GraphEdge] = Field(default_factory=list)


# ============================================================================
# API Request & Response Schemas
# ============================================================================

class ProjectSummary(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    title: str
    chapter_count: int
    updated_at: Optional[str] = None


class ProjectCreate(BaseModel):
    model_config = ConfigDict(extra="ignore")

    title: str
    lore: Optional[Lore] = None


class ChapterCreate(BaseModel):
    model_config = ConfigDict(extra="ignore")

    title: str
    text: str = ""
    index: Optional[int] = None


class ChapterUpdate(BaseModel):
    model_config = ConfigDict(extra="ignore")

    title: Optional[str] = None
    text: Optional[str] = None
    index: Optional[int] = None


class AnalyzeRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")

    chapter_id: str
    text: str


class AnalyzeResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")

    conflicts: list[Conflict]
    graph: GraphData
    events: list[Event]
    timings: Optional[dict[str, float]] = None
    lore: Optional[Lore] = None
    all_events: Optional[list[Event]] = None


class RippleRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")

    from_scene_index: int


class RippleResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")

    affected_scene_indexes: list[int]
    new_conflicts: list[Conflict]


class PatchSuggestion(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    type: PatchType
    title: str
    description: str
    target_scene_index: Optional[int] = None
    target_sentence_id: Optional[str] = None
    suggested_text: Optional[str] = None


class PatchesResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")

    conflict_id: str
    patches: list[PatchSuggestion]


class ExtractionResult(BaseModel):
    """
    Schema for Gemini structured output in extractor.py.
    Parses loose LLM outputs gracefully:
    - Silently drops invalid events per AGENT.md Section 5.
    - Normalizes strings for discovered entities.
    - Never raises on unexpected or missing optional fields.
    """
    model_config = ConfigDict(extra="ignore")

    events: list[Event] = Field(default_factory=list)
    discovered_characters: list[str] = Field(default_factory=list)
    discovered_items: list[str] = Field(default_factory=list)

    @model_validator(mode="before")
    @classmethod
    def parse_loose_llm_output(cls, data: Any) -> Any:
        if isinstance(data, list):
            data = {"events": data}
        elif not isinstance(data, dict):
            return {"events": [], "discovered_characters": [], "discovered_items": []}

        # Normalize raw events list
        raw_events = data.get("events", [])
        valid_events = []
        if isinstance(raw_events, list):
            for item in raw_events:
                try:
                    if isinstance(item, Event):
                        valid_events.append(item)
                    elif isinstance(item, dict):
                        # Attempt to validate event; drops invalid events silently
                        ev = Event.model_validate(item)
                        valid_events.append(ev)
                except Exception:
                    # Drop invalid events silently per spec
                    continue
        data["events"] = valid_events

        # Normalize discovered characters
        raw_chars = data.get("discovered_characters", [])
        if isinstance(raw_chars, list):
            data["discovered_characters"] = [
                str(c).strip() for c in raw_chars if c and isinstance(c, (str, int)) and str(c).strip()
            ]
        else:
            data["discovered_characters"] = []

        # Normalize discovered items
        raw_items = data.get("discovered_items", [])
        if isinstance(raw_items, list):
            data["discovered_items"] = [
                str(i).strip() for i in raw_items if i and isinstance(i, (str, int)) and str(i).strip()
            ]
        else:
            data["discovered_items"] = []

        return data

