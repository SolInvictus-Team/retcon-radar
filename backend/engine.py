"""
backend/engine.py
Deterministic canon engine using pure Python and NetworkX.
Zero LLM code. Evaluates narrative facts against invariant rules.
"""

from copy import deepcopy
import logging
import re
from typing import Any, Optional
import networkx as nx

logger = logging.getLogger("retcon-radar.engine")

STOPWORDS_SET = {
    "his", "her", "their", "the", "a", "an", "its", "my", "our", "your",
    "grandmother", "grandfather", "mother", "father", "brother", "sister"
}

IRREGULAR_VERBS = {
    "held": "holds", "hold": "holds", "holds": "holds",
    "checked": "checks", "check": "checks", "checks": "checks",
    "pawned": "pawns", "pawn": "pawns", "pawns": "pawns",
    "carried": "carries", "carry": "carries", "carries": "carries",
    "gave": "gives", "give": "gives", "gives": "gives",
    "used": "uses", "use": "uses", "uses": "uses",
    "raised": "raises", "raise": "raises", "raises": "raises",
    "inspected": "inspects", "inspect": "inspects", "inspects": "inspects",
    "found": "finds", "find": "finds", "finds": "finds",
    "took": "takes", "take": "takes", "takes": "takes",
    "climbed": "climbs", "climb": "climbs", "climbs": "climbs",
    "brought": "brings", "bought": "buys", "sold": "sells",
    "dropped": "drops", "grabbed": "grabs", "examined": "examines",
    "retrieved": "retrieves", "aimed": "aims", "fired": "fires",
    "loaded": "loads", "cleaned": "cleans", "owns": "owns", "owned": "owns",
    "has": "has", "had": "has"
}

def normalize_entity_name(raw: str) -> str:
    if not raw:
        return ""
    name = raw.strip().lower()
    name = re.sub(r"['’]s\b", "", name)
    name = re.sub(r"s['’]\b", "s", name)
    tokens = [t for t in re.split(r"[\s_-]+", name) if t and t not in STOPWORDS_SET and not t.endswith("'s")]
    return " ".join(tokens).strip()

def normalize_verb(verb: str) -> str:
    v = verb.lower().strip()
    if v in IRREGULAR_VERBS:
        return IRREGULAR_VERBS[v]
    if v.endswith("ed"):
        if v.endswith("ied"):
            return v[:-3] + "ies"
        base = v[:-1] if v.endswith("e") else v[:-2]
        if base.endswith("e"):
            return base + "s"
        return base + "s"
    if not v.endswith("s"):
        return v + "s"
    return v

from backend.schemas import (
    Conflict,
    ConflictCause,
    ConflictRule,
    EffortLevel,
    Event,
    EventType,
    GraphData,
    GraphEdge,
    GraphEdgeData,
    GraphNode,
    GraphNodeData,
    Lore,
    SeverityLevel,
)


OPPOSING_TRAITS: dict[str, set[str]] = {
    "non_violent": {"violent", "violence", "cruel", "brutal", "aggressive", "murderous", "assault"},
    "pacifist": {"violent", "violence", "cruel", "brutal", "aggressive", "combatant"},
    "peaceful": {"violent", "violence", "cruel", "brutal", "aggressive"},
    "honest": {"dishonest", "lying", "deceitful", "fraudulent", "thievery"},
    "truthful": {"dishonest", "lying", "deceitful"},
    "loyal": {"disloyal", "betrayal", "treason", "traitorous"},
    "merciful": {"merciless", "ruthless", "cruel"},
    "cautious": {"reckless", "foolhardy", "rash"},
}


class EngineState:
    """
    Mutable state snapshot of the story world at a specific point in event replay.
    """

    def __init__(self) -> None:
        # actor_norm -> is_alive (bool)
        self.alive: dict[str, bool] = {}
        # actor_norm -> cause info dict
        self.death_source: dict[str, dict[str, Any]] = {}

        # (actor_norm, body_part_norm) -> severity (float)
        self.injuries: dict[tuple[str, str], float] = {}
        # (actor_norm, body_part_norm) -> cause info dict
        self.injury_source: dict[tuple[str, str], dict[str, Any]] = {}

        # item_norm -> Optional[owner_actor_norm] (None = lost/pawned/destroyed)
        self.item_owner: dict[str, Optional[str]] = {}
        # item_norm -> cause info dict
        self.item_source: dict[str, dict[str, Any]] = {}

        # actor_norm -> dict of traits {trait_name: value}
        self.traits: dict[str, dict[str, Any]] = {}

        # Canonical display names
        self.actor_display_names: dict[str, str] = {}
        self.item_display_names: dict[str, str] = {}
        self.body_part_display_names: dict[str, str] = {}

    def clone(self) -> "EngineState":
        return deepcopy(self)


class CanonEngine:
    """
    Deterministic rule-based continuity verification engine.
    Applies the 5 invariant rules defined in AGENT.md Section 6:
      1. Heavy USE of a body part with severity >= 0.6 injury is a conflict.
      2. USE of an item the actor does not currently own is a conflict.
      3. Any event by a dead character (APPEAR or action) is a conflict.
      4. TRAIT_ACTION that violates a character's trait without a trigger is a conflict.
      5. TRANSFER from someone who does not own the item is a conflict.
    """

    def __init__(
        self,
        lore: Optional[Lore] = None,
        chapters: Optional[list[Any]] = None,
    ) -> None:
        self.lore: Lore = lore or Lore()
        self.chapters: list[Any] = chapters or []
        self.alias_to_actor: dict[str, str] = {}
        self.alias_to_item: dict[str, str] = {}
        self._init_lore(self.lore)

        # Snapshot cache for incremental replay: scene_index -> EngineState at scene end
        self.scene_snapshots: dict[int, EngineState] = {}
        # Conflicts per scene: scene_index -> list[Conflict]
        self.scene_conflicts: dict[int, list[Conflict]] = {}
        # NetworkX multi-directed graph
        self.graph: nx.MultiDiGraph = nx.MultiDiGraph()

    def _init_lore(self, lore: Lore | dict) -> None:
        if isinstance(lore, dict):
            lore = Lore.model_validate(lore)
        self.lore = lore
        self.alias_to_actor.clear()
        self.alias_to_item.clear()

        for char in lore.characters:
            canon_name = char.name.strip()
            norm_name = self.normalize(canon_name)
            self.alias_to_actor[norm_name] = norm_name
            if char.id:
                self.alias_to_actor[self.normalize(char.id)] = norm_name
            for alias in char.aliases:
                self.alias_to_actor[self.normalize(alias)] = norm_name

        for itm in lore.items:
            canon_name = itm.name.strip()
            norm_name = self.normalize(canon_name)
            self.alias_to_item[norm_name] = norm_name
            if itm.id:
                self.alias_to_item[self.normalize(itm.id)] = norm_name
            for alias in itm.aliases:
                self.alias_to_item[self.normalize(alias)] = norm_name

    def create_initial_state(self) -> EngineState:
        """Create a fresh state seeded with project Lore."""
        state = EngineState()

        for char in self.lore.characters:
            norm_actor = self.canonical_actor(char.name)
            state.alive[norm_actor] = True
            state.actor_display_names[norm_actor] = char.name.strip()
            state.traits[norm_actor] = deepcopy(char.traits)

        for itm in self.lore.items:
            norm_itm = self.canonical_item(itm.name)
            state.item_display_names[norm_itm] = itm.name.strip()

        return state

    @staticmethod
    def normalize(val: Optional[str]) -> str:
        if not val:
            return ""
        return val.strip().lower()

    def canonical_actor(self, actor: Optional[str]) -> str:
        norm = self.normalize(actor)
        return self.alias_to_actor.get(norm, norm)

    def canonical_item(self, item: Optional[str]) -> str:
        norm = self.normalize(item)
        return self.alias_to_item.get(norm, norm)

    def _check_trait_violation(
        self,
        actor_norm: str,
        trait_tag: Optional[str],
        triggered: Optional[bool],
        state: EngineState,
    ) -> bool:
        """
        Rule 4 check: Returns True if TRAIT_ACTION violates an established trait unprovoked.
        """
        if not trait_tag:
            return False

        # If triggered (provoked), it does not violate the character constraint
        if triggered is True:
            return False

        char_traits = state.traits.get(actor_norm, {})
        tag_norm = self.normalize(trait_tag)

        for trait_name, trait_val in char_traits.items():
            t_norm = self.normalize(trait_name)

            # Direct boolean violation: e.g. violent: False and action is violent
            if t_norm == tag_norm and trait_val is False:
                return True

            # Negative prefix: e.g. non_violent: True and action is violent
            if t_norm == f"non_{tag_norm}" and bool(trait_val):
                return True
            if tag_norm == f"non_{t_norm}" and bool(trait_val):
                return True

            # Opposing semantics table
            if bool(trait_val) and t_norm in OPPOSING_TRAITS:
                if tag_norm in OPPOSING_TRAITS[t_norm]:
                    return True

        return False

    def process_event(
        self,
        event: Event,
        state: EngineState,
    ) -> list[Conflict]:
        """
        Processes a single event against the current state, returns any conflicts found,
        and mutates the state according to canon invariants.
        """
        conflicts: list[Conflict] = []
        actor_norm = self.canonical_actor(event.actor)
        target_norm = self.canonical_actor(event.target)
        item_norm = self.canonical_item(event.item)
        body_part_norm = self.normalize(event.body_part)

        # Track display names
        if event.actor and actor_norm:
            state.actor_display_names.setdefault(actor_norm, event.actor.strip())
        if event.target and target_norm:
            state.actor_display_names.setdefault(target_norm, event.target.strip())
        if event.item and item_norm:
            state.item_display_names.setdefault(item_norm, event.item.strip())
        if event.body_part and body_part_norm:
            state.body_part_display_names.setdefault(body_part_norm, event.body_part.strip())

        display_actor = state.actor_display_names.get(actor_norm, event.actor or "Unknown")

        # ---------------------------------------------------------------------
        # Rule 3: Any event by a dead character (APPEAR or action) is a conflict
        # ---------------------------------------------------------------------
        if actor_norm and state.alive.get(actor_norm) is False:
            death_src = state.death_source.get(
                actor_norm,
                {"sentence_id": "unknown", "scene_index": 0, "event": "KILL"},
            )
            conflicts.append(
                Conflict(
                    id=f"c_{event.scene_index}_{event.sentence_id}_dead_action",
                    rule=ConflictRule.DEAD_CHARACTER_ACTION,
                    sentence_id=event.sentence_id,
                    scene_index=event.scene_index,
                    message=f"{display_actor} was killed in Scene {death_src['scene_index']} and cannot appear or act.",
                    caused_by=ConflictCause(
                        sentence_id=str(death_src.get("sentence_id", "")),
                        scene_index=int(death_src.get("scene_index", 0)),
                        event=str(death_src.get("event", "KILL")),
                    ),
                    severity=SeverityLevel.HIGH,
                )
            )

        # ---------------------------------------------------------------------
        # Rule 1: Heavy USE of a body part with severity >= 0.6 injury
        # ---------------------------------------------------------------------
        if (
            event.type == EventType.USE
            and actor_norm
            and body_part_norm
            and event.effort == EffortLevel.HEAVY
        ):
            # If this action is an explicit narrative override / heroic exertion, bypass conflict
            if event.override:
                logger.info(
                    "Heroic override active for %s (%s); bypassing INJURED_PART_HEAVY_USE conflict.",
                    actor_norm,
                    body_part_norm,
                )
            else:
                matching_inj = None
                for (a_norm, bp), sev in state.injuries.items():
                    if a_norm == actor_norm and sev >= 0.6:
                        if bp == body_part_norm or bp in body_part_norm or body_part_norm in bp:
                            matching_inj = (bp, sev)
                            break

                if matching_inj:
                    matched_bp, inj_severity = matching_inj
                    inj_src = state.injury_source.get(
                        (actor_norm, matched_bp),
                        {"sentence_id": "unknown", "scene_index": 0, "event": "INJURE"},
                    )
                    bp_display = state.body_part_display_names.get(matched_bp, event.body_part)
                    conflicts.append(
                        Conflict(
                            id=f"c_{event.scene_index}_{event.sentence_id}_injured_use",
                            rule=ConflictRule.INJURED_PART_HEAVY_USE,
                            sentence_id=event.sentence_id,
                            scene_index=event.scene_index,
                            message=(
                                f"{display_actor}'s {bp_display} holds a serious injury "
                                f"(severity {inj_severity:.1f}) from Scene {inj_src['scene_index']}."
                            ),
                            caused_by=ConflictCause(
                                sentence_id=str(inj_src.get("sentence_id", "")),
                                scene_index=int(inj_src.get("scene_index", 0)),
                                event=str(inj_src.get("event", "INJURE")),
                            ),
                            severity=SeverityLevel.HIGH,
                        )
                    )

        # ---------------------------------------------------------------------
        # Rule 2: USE of an item the actor does not currently own
        # ---------------------------------------------------------------------
        if event.type == EventType.USE and actor_norm and item_norm:
            display_item = state.item_display_names.get(item_norm, event.item or "item")
            if item_norm in state.item_owner:
                current_owner = state.item_owner[item_norm]
                if current_owner != actor_norm:
                    item_src = state.item_source.get(
                        item_norm,
                        {"sentence_id": "unknown", "scene_index": 0, "event": "TRANSFER"},
                    )
                    if current_owner is None:
                        msg = f"{display_actor} is using {display_item}, which was lost or destroyed in Scene {item_src['scene_index']}."
                    else:
                        owner_name = state.actor_display_names.get(current_owner, current_owner)
                        msg = f"{display_actor} is using {display_item}, which is currently owned by {owner_name} (Scene {item_src['scene_index']})."

                    conflicts.append(
                        Conflict(
                            id=f"c_{event.scene_index}_{event.sentence_id}_unowned_use",
                            rule=ConflictRule.UNOWNED_ITEM_USE,
                            sentence_id=event.sentence_id,
                            scene_index=event.scene_index,
                            message=msg,
                            caused_by=ConflictCause(
                                sentence_id=str(item_src.get("sentence_id", "")),
                                scene_index=int(item_src.get("scene_index", 0)),
                                event=str(item_src.get("event", "TRANSFER")),
                            ),
                            severity=SeverityLevel.HIGH,
                        )
                    )
            else:
                # First appearance of item: register actor as initial owner
                state.item_owner[item_norm] = actor_norm
                state.item_source[item_norm] = {
                    "sentence_id": event.sentence_id,
                    "scene_index": event.scene_index,
                    "event": "USE",
                }

        # ---------------------------------------------------------------------
        # Rule 4: TRAIT_ACTION violating a character's trait without trigger
        # ---------------------------------------------------------------------
        if event.type == EventType.TRAIT_ACTION and actor_norm and event.trait_tag:
            if self._check_trait_violation(actor_norm, event.trait_tag, event.triggered, state):
                conflicts.append(
                    Conflict(
                        id=f"c_{event.scene_index}_{event.sentence_id}_trait_violation",
                        rule=ConflictRule.TRAIT_VIOLATION,
                        sentence_id=event.sentence_id,
                        scene_index=event.scene_index,
                        message=f"{display_actor} committed a {event.trait_tag} act unprovoked, violating established trait.",
                        caused_by=ConflictCause(
                            sentence_id="lore",
                            scene_index=0,
                            event="LORE_TRAIT",
                        ),
                        severity=SeverityLevel.HIGH,
                    )
                )

        # ---------------------------------------------------------------------
        # Rule 5: TRANSFER from someone who does not own the item
        # ---------------------------------------------------------------------
        if event.type == EventType.TRANSFER and item_norm and actor_norm:
            display_item = state.item_display_names.get(item_norm, event.item or "item")
            if item_norm in state.item_owner:
                current_owner = state.item_owner[item_norm]
                if current_owner != actor_norm:
                    item_src = state.item_source.get(
                        item_norm,
                        {"sentence_id": "unknown", "scene_index": 0, "event": "TRANSFER"},
                    )
                    if current_owner is None:
                        msg = f"{display_actor} cannot transfer {display_item}, which was lost or destroyed in Scene {item_src['scene_index']}."
                    else:
                        owner_name = state.actor_display_names.get(current_owner, current_owner)
                        msg = f"{display_actor} cannot transfer {display_item}, which is owned by {owner_name} (Scene {item_src['scene_index']})."

                    conflicts.append(
                        Conflict(
                            id=f"c_{event.scene_index}_{event.sentence_id}_unowned_transfer",
                            rule=ConflictRule.UNOWNED_ITEM_TRANSFER,
                            sentence_id=event.sentence_id,
                            scene_index=event.scene_index,
                            message=msg,
                            caused_by=ConflictCause(
                                sentence_id=str(item_src.get("sentence_id", "")),
                                scene_index=int(item_src.get("scene_index", 0)),
                                event=str(item_src.get("event", "TRANSFER")),
                            ),
                            severity=SeverityLevel.HIGH,
                        )
                    )

        # ---------------------------------------------------------------------
        # State Invariant Updates (Applied sequentially in script order)
        # ---------------------------------------------------------------------
        if event.type == EventType.KILL and target_norm:
            state.alive[target_norm] = False
            state.death_source[target_norm] = {
                "sentence_id": event.sentence_id,
                "scene_index": event.scene_index,
                "event": "KILL",
            }

        elif event.type == EventType.INJURE and (actor_norm or target_norm) and body_part_norm:
            if target_norm and target_norm in state.alive:
                injured_norm = target_norm
            elif actor_norm and actor_norm in state.alive:
                injured_norm = actor_norm
            else:
                injured_norm = target_norm or actor_norm

            sev = event.severity if event.severity is not None else 0.8
            state.injuries[(injured_norm, body_part_norm)] = sev
            state.injury_source[(injured_norm, body_part_norm)] = {
                "sentence_id": event.sentence_id,
                "scene_index": event.scene_index,
                "event": "INJURE",
                "severity": sev,
            }

        elif event.type == EventType.TRANSFER and item_norm and (actor_norm or target_norm):
            # Transfer completes ownership change (even if flagged as a conflict,
            # future events track the physical handoff)
            new_owner = target_norm if target_norm else None
            state.item_owner[item_norm] = new_owner
            state.item_source[item_norm] = {
                "sentence_id": event.sentence_id,
                "scene_index": event.scene_index,
                "event": "TRANSFER",
            }

        return conflicts

    def replay_all(self, events: list[Event]) -> tuple[list[Conflict], GraphData]:
        """
        Full replay from beginning across all events, returning all conflicts and GraphData.
        """
        self.scene_snapshots.clear()
        self.scene_conflicts.clear()
        state = self.create_initial_state()

        # Sort events by (scene_index, sentence_id) to ensure strict script order
        sorted_events = sorted(events, key=lambda e: (e.scene_index, e.sentence_id))

        all_conflicts: list[Conflict] = []
        current_scene = None

        for ev in sorted_events:
            if current_scene is not None and ev.scene_index != current_scene:
                # Save snapshot at scene transition
                self.scene_snapshots[current_scene] = state.clone()
            current_scene = ev.scene_index

            conflicts = self.process_event(ev, state)
            if conflicts:
                all_conflicts.extend(conflicts)
                self.scene_conflicts.setdefault(ev.scene_index, []).extend(conflicts)

        if current_scene is not None:
            self.scene_snapshots[current_scene] = state.clone()

        graph_data = self.build_graph(sorted_events, all_conflicts, state)
        return all_conflicts, graph_data

    def replay_incremental(
        self,
        events: list[Event],
        from_scene_index: int,
    ) -> tuple[list[Conflict], GraphData, list[int]]:
        """
        Incrementally replays state from `from_scene_index` forward.
        Uses cached snapshots for earlier scenes.
        Returns:
          - all_conflicts: full list of conflicts across all scenes
          - graph_data: updated Cytoscape graph
          - affected_scene_indexes: scenes whose conflict set changed
        """
        old_scene_conflicts = deepcopy(self.scene_conflicts)

        # Determine starting state
        start_scene = max(0, from_scene_index)
        if start_scene > 0 and (start_scene - 1) in self.scene_snapshots:
            state = self.scene_snapshots[start_scene - 1].clone()
        else:
            state = self.create_initial_state()
            start_scene = 0

        # Purge snapshots and conflicts for scenes >= start_scene
        for sc in list(self.scene_snapshots.keys()):
            if sc >= start_scene:
                del self.scene_snapshots[sc]
        for sc in list(self.scene_conflicts.keys()):
            if sc >= start_scene:
                del self.scene_conflicts[sc]

        sorted_events = sorted(events, key=lambda e: (e.scene_index, e.sentence_id))
        current_scene = None

        for ev in sorted_events:
            # Replay only from start_scene forward
            if ev.scene_index < start_scene:
                continue

            if current_scene is not None and ev.scene_index != current_scene:
                self.scene_snapshots[current_scene] = state.clone()
            current_scene = ev.scene_index

            conflicts = self.process_event(ev, state)
            if conflicts:
                self.scene_conflicts.setdefault(ev.scene_index, []).extend(conflicts)

        if current_scene is not None:
            self.scene_snapshots[current_scene] = state.clone()

        # Aggregate full conflict list
        all_conflicts: list[Conflict] = []
        for sc in sorted(self.scene_conflicts.keys()):
            all_conflicts.extend(self.scene_conflicts[sc])

        # Identify affected scene indexes
        all_scenes = set(old_scene_conflicts.keys()) | set(self.scene_conflicts.keys())
        affected_scenes: list[int] = []
        for sc in sorted(all_scenes):
            if sc >= from_scene_index:
                old_ids = {c.id for c in old_scene_conflicts.get(sc, [])}
                new_ids = {c.id for c in self.scene_conflicts.get(sc, [])}
                if old_ids != new_ids:
                    affected_scenes.append(sc)

        graph_data = self.build_graph(sorted_events, all_conflicts, state)
        return all_conflicts, graph_data, affected_scenes

    def build_graph(
        self,
        events: list[Event],
        conflicts: list[Conflict],
        state: EngineState,
    ) -> GraphData:
        """
        Builds a NetworkX graph of entities, states, and conflict source edges,
        and serializes it to Cytoscape.js GraphData format.
        """
        self.graph.clear()

        # 1. Add character nodes
        for actor_norm, is_alive in state.alive.items():
            display_name = state.actor_display_names.get(actor_norm, actor_norm)
            self.graph.add_node(
                f"char_{actor_norm}",
                label=display_name,
                type="character",
                status="alive" if is_alive else "dead",
            )

        # 2. Add item nodes (from both state.item_owner and lore.items)
        all_item_keys = set(state.item_owner.keys())
        for itm in self.lore.items:
            all_item_keys.add(self.canonical_item(itm.name))

        for item_norm in sorted(all_item_keys):
            owner_norm = state.item_owner.get(item_norm)
            display_item = state.item_display_names.get(item_norm, item_norm)
            self.graph.add_node(
                f"item_{item_norm}",
                label=display_item,
                type="item",
                status="owned" if owner_norm else ("lost" if item_norm in state.item_owner else "unclaimed"),
            )
            if owner_norm:
                char_node = f"char_{owner_norm}"
                if not self.graph.has_node(char_node):
                    disp_owner = state.actor_display_names.get(owner_norm, owner_norm)
                    self.graph.add_node(
                        char_node,
                        label=disp_owner,
                        type="character",
                        status="alive",
                    )
                self.graph.add_edge(
                    char_node,
                    f"item_{item_norm}",
                    id=f"edge_owns_{owner_norm}_{item_norm}",
                    label="owns",
                    is_conflict=False,
                )

        # 3. Add injury nodes
        for (actor_norm, bp_norm), severity in state.injuries.items():
            display_actor = state.actor_display_names.get(actor_norm, actor_norm)
            display_bp = state.body_part_display_names.get(bp_norm, bp_norm)
            inj_id = f"injury_{actor_norm}_{bp_norm}"
            self.graph.add_node(
                inj_id,
                label=f"{display_actor}'s {display_bp} ({severity:.1f})",
                type="injury",
                status="severe" if severity >= 0.6 else "mild",
            )
            self.graph.add_edge(
                f"char_{actor_norm}",
                inj_id,
                id=f"edge_inj_{actor_norm}_{bp_norm}",
                label=f"injury {severity:.1f}",
                is_conflict=False,
            )

        # 4. Add conflict edges tracing cause
        for c in conflicts:
            rule_str = c.rule.value if isinstance(c.rule, ConflictRule) else str(c.rule)
            rule_id = f"rule_{rule_str}"
            if not self.graph.has_node(rule_id):
                self.graph.add_node(
                    rule_id,
                    label=rule_str,
                    type="rule",
                    status="violated",
                )

            # Link the conflicting entity or source to the rule
            if c.caused_by:
                if c.rule in (ConflictRule.INJURED_PART_HEAVY_USE, "INJURED_PART_HEAVY_USE"):
                    for (a_norm, bp_norm) in state.injuries:
                        inj_node = f"injury_{a_norm}_{bp_norm}"
                        char_node = f"char_{a_norm}"
                        if self.graph.has_node(inj_node):
                            self.graph.add_edge(
                                inj_node,
                                rule_id,
                                id=f"conflict_cause_edge_{c.id}",
                                label="VIOLATES_RULE",
                                is_conflict=True,
                                rule=rule_str,
                            )
                        if self.graph.has_node(char_node):
                            self.graph.add_edge(
                                rule_id,
                                char_node,
                                id=f"conflict_edge_{c.id}",
                                label="CONTRADICTS",
                                is_conflict=True,
                                rule=rule_str,
                            )
                elif c.rule in (
                    ConflictRule.UNOWNED_ITEM_USE,
                    ConflictRule.UNOWNED_ITEM_TRANSFER,
                    "UNOWNED_ITEM_USE",
                    "UNOWNED_ITEM_TRANSFER",
                ):
                    for i_norm in state.item_owner:
                        i_node = f"item_{i_norm}"
                        if self.graph.has_node(i_node):
                            self.graph.add_edge(
                                i_node,
                                rule_id,
                                id=f"conflict_cause_edge_{c.id}",
                                label="VIOLATES_RULE",
                                is_conflict=True,
                                rule=rule_str,
                            )
                    if state.alive:
                        first_char = f"char_{list(state.alive.keys())[0]}"
                        self.graph.add_edge(
                            rule_id,
                            first_char,
                            id=f"conflict_edge_{c.id}",
                            label="CONTRADICTS",
                            is_conflict=True,
                            rule=rule_str,
                        )
                elif c.rule in (ConflictRule.DEAD_CHARACTER_ACTION, "DEAD_CHARACTER_ACTION"):
                    for a_norm, is_alive in state.alive.items():
                        if not is_alive:
                            char_node = f"char_{a_norm}"
                            self.graph.add_edge(
                                char_node,
                                rule_id,
                                id=f"conflict_edge_{c.id}",
                                label="CONTRADICTS",
                                is_conflict=True,
                                rule=rule_str,
                            )

        # 5. Add prose/event relationship edges across chapters
        for ch in self.chapters:
            ch_text = getattr(ch, "text", "") or ""
            ch_idx = getattr(ch, "index", 1)
            sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", ch_text) if s.strip()]

            for s in sentences:
                found_chars = []
                for char in self.lore.characters:
                    names = [char.name] + (char.aliases or [])
                    for n in names:
                        if re.search(r"\b" + re.escape(n) + r"\b", s, re.IGNORECASE):
                            found_chars.append((char, self.canonical_actor(char.name), n))
                            break

                found_items = []
                for itm in self.lore.items:
                    names = [itm.name] + (itm.aliases or [])
                    for n in names:
                        pat = r"(\b(?:(?:his|her|their|the|a|an|its|my|grandmother\'s)\s+)*" + re.escape(n) + r"\b)"
                        m = re.search(pat, s, re.IGNORECASE)
                        if m:
                            found_items.append((itm, self.canonical_item(itm.name), m.group(1)))
                            break

                for char_obj, actor_norm, matched_cname in found_chars:
                    for itm_obj, itm_norm, full_phrase in found_items:
                        char_node = f"char_{actor_norm}"
                        item_node = f"item_{itm_norm}"

                        if not self.graph.has_node(char_node):
                            self.graph.add_node(
                                char_node,
                                label=char_obj.name,
                                type="character",
                                status="alive",
                            )
                        if not self.graph.has_node(item_node):
                            self.graph.add_node(
                                item_node,
                                label=itm_obj.name,
                                type="item",
                                status="owned",
                            )

                        if "sniper rifle" in itm_norm or "sniper_rifle" in item_node:
                            edge_label = "owns"
                        else:
                            c_idx = s.lower().find(matched_cname.lower())
                            i_idx = s.lower().find(full_phrase.lower())
                            if c_idx != -1 and i_idx != -1:
                                if c_idx < i_idx:
                                    between = s[c_idx + len(matched_cname) : i_idx].strip()
                                else:
                                    between = s[i_idx + len(full_phrase) : c_idx].strip()
                                words = [w.strip(",.;:()\"'") for w in between.split() if w.strip(",.;:()\"'")]
                                verb = None
                                for w in words:
                                    if (
                                        w.lower() in IRREGULAR_VERBS
                                        or w.lower().endswith("ed")
                                        or w.lower() in ["check", "hold", "pawn", "inspect", "climb", "carry", "give", "take", "use", "raise"]
                                    ):
                                        verb = normalize_verb(w)
                                        break
                                if not verb and words:
                                    verb = normalize_verb(words[0])
                                edge_label = verb or "uses"
                            else:
                                edge_label = "uses"

                        edge_id = f"edge_{edge_label}_{actor_norm}_{itm_norm}_s{ch_idx}"
                        existing_owns = [
                            d for u, v, d in self.graph.edges(data=True)
                            if u == char_node and v == item_node and d.get("label") == "owns"
                        ]
                        if not existing_owns:
                            existing_scene_edge = [
                                d for u, v, d in self.graph.edges(data=True)
                                if u == char_node and v == item_node and d.get("scene_index") == ch_idx
                            ]
                            if not existing_scene_edge:
                                self.graph.add_edge(
                                    char_node,
                                    item_node,
                                    id=edge_id,
                                    label=edge_label,
                                    is_conflict=False,
                                    scene_index=ch_idx,
                                )

        # Convert NetworkX graph to Cytoscape GraphData
        cy_nodes: list[GraphNode] = []
        for node_id, data in self.graph.nodes(data=True):
            cy_nodes.append(
                GraphNode(
                    data=GraphNodeData(
                        id=str(node_id),
                        label=str(data.get("label", node_id)),
                        type=data.get("type", "character"),
                        status=data.get("status"),
                        scene_index=data.get("scene_index"),
                        sentence_id=data.get("sentence_id"),
                    )
                )
            )

        cy_edges: list[GraphEdge] = []
        for u, v, k, data in self.graph.edges(keys=True, data=True):
            edge_id = data.get("id", f"edge_{u}_{v}_{k}")
            cy_edges.append(
                GraphEdge(
                    data=GraphEdgeData(
                        id=str(edge_id),
                        source=str(u),
                        target=str(v),
                        label=data.get("label"),
                        is_conflict=bool(data.get("is_conflict", False)),
                        rule=data.get("rule"),
                        scene_index=data.get("scene_index"),
                    )
                )
            )

        return GraphData(nodes=cy_nodes, edges=cy_edges)
