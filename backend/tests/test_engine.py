"""
backend/tests/test_engine.py
Pytest suite for the deterministic canon engine.
Tests all 5 canon rules and incremental replay using synthetic/generic names.
No LLM, no network, and no API key required.
"""

import pytest
from backend.engine import CanonEngine
from backend.schemas import (
    Character,
    ConflictRule,
    EffortLevel,
    Event,
    EventType,
    Item,
    Lore,
)


@pytest.fixture
def empty_engine() -> CanonEngine:
    return CanonEngine()


@pytest.fixture
def sci_fi_lore() -> Lore:
    return Lore(
        characters=[
            Character(
                id="char_diana",
                name="Diana Prince",
                aliases=["Diana", "Agent Prince"],
                traits={"non_violent": True},
            ),
            Character(
                id="char_evelyn",
                name="Doctor Evelyn",
                aliases=["Dr. Evelyn", "Evelyn"],
                traits={"pacifist": True},
            ),
        ],
        items=[
            Item(id="item_cipher", name="cipher_disc", aliases=["the cipher", "disc"]),
            Item(id="item_plasma", name="plasma_torch", aliases=["torch"]),
        ],
    )


# ============================================================================
# Rule 1 Tests: Injured Body Part Heavy Use
# ============================================================================

def test_rule_1_heavy_use_of_severely_injured_body_part(empty_engine: CanonEngine):
    """
    Rule 1: Heavy USE of a body part with severity >= 0.6 injury is a conflict.
    """
    events = [
        Event(
            type=EventType.INJURE,
            sentence_id="s_1_1",
            scene_index=1,
            actor="Alice",
            body_part="right shoulder",
            severity=0.85,
        ),
        Event(
            type=EventType.USE,
            sentence_id="s_2_3",
            scene_index=2,
            actor="Alice",
            body_part="right shoulder",
            effort=EffortLevel.HEAVY,
        ),
    ]

    conflicts, graph = empty_engine.replay_all(events)

    assert len(conflicts) == 1
    conflict = conflicts[0]
    assert conflict.rule == ConflictRule.INJURED_PART_HEAVY_USE
    assert conflict.sentence_id == "s_2_3"
    assert conflict.scene_index == 2
    assert conflict.caused_by is not None
    assert conflict.caused_by.sentence_id == "s_1_1"
    assert conflict.caused_by.scene_index == 1
    assert conflict.caused_by.event == "INJURE"


def test_rule_1_light_use_or_minor_injury_no_conflict(empty_engine: CanonEngine):
    """
    Light USE or injury severity < 0.6 should not trigger a conflict.
    """
    # Case A: Severe injury, but light use
    events_light = [
        Event(
            type=EventType.INJURE,
            sentence_id="s_1_1",
            scene_index=1,
            actor="Alice",
            body_part="left arm",
            severity=0.9,
        ),
        Event(
            type=EventType.USE,
            sentence_id="s_2_1",
            scene_index=2,
            actor="Alice",
            body_part="left arm",
            effort=EffortLevel.LIGHT,
        ),
    ]
    conflicts_light, _ = empty_engine.replay_all(events_light)
    assert len(conflicts_light) == 0

    # Case B: Minor injury (< 0.6), heavy use
    events_minor = [
        Event(
            type=EventType.INJURE,
            sentence_id="s_1_1",
            scene_index=1,
            actor="Alice",
            body_part="left leg",
            severity=0.3,
        ),
        Event(
            type=EventType.USE,
            sentence_id="s_2_1",
            scene_index=2,
            actor="Alice",
            body_part="left leg",
            effort=EffortLevel.HEAVY,
        ),
    ]
    conflicts_minor, _ = empty_engine.replay_all(events_minor)
    assert len(conflicts_minor) == 0


def test_rule_1_recovery_clears_conflict(empty_engine: CanonEngine):
    """
    A subsequent recovery event lowering injury severity < 0.6 clears future conflicts.
    """
    events = [
        Event(
            type=EventType.INJURE,
            sentence_id="s_1_1",
            scene_index=1,
            actor="Alice",
            body_part="right shoulder",
            severity=0.85,
        ),
        # Recovery in Scene 2
        Event(
            type=EventType.INJURE,
            sentence_id="s_2_1",
            scene_index=2,
            actor="Alice",
            body_part="right shoulder",
            severity=0.1,
        ),
        # Heavy USE in Scene 3
        Event(
            type=EventType.USE,
            sentence_id="s_3_1",
            scene_index=3,
            actor="Alice",
            body_part="right shoulder",
            effort=EffortLevel.HEAVY,
        ),
    ]
    conflicts, _ = empty_engine.replay_all(events)
    assert len(conflicts) == 0


# ============================================================================
# Rule 2 Tests: Unowned Item Use
# ============================================================================

def test_rule_2_use_of_lost_or_pawned_item(empty_engine: CanonEngine):
    """
    Rule 2: USE of an item that was lost/pawned (to=None) is a conflict.
    """
    events = [
        Event(
            type=EventType.TRANSFER,
            sentence_id="s_1_2",
            scene_index=1,
            actor="Bob",
            item="cipher_disc",
            target=None,  # lost or pawned
        ),
        Event(
            type=EventType.USE,
            sentence_id="s_3_4",
            scene_index=3,
            actor="Bob",
            item="cipher_disc",
        ),
    ]

    conflicts, _ = empty_engine.replay_all(events)

    assert len(conflicts) == 1
    conflict = conflicts[0]
    assert conflict.rule == ConflictRule.UNOWNED_ITEM_USE
    assert conflict.sentence_id == "s_3_4"
    assert conflict.scene_index == 3
    assert conflict.caused_by is not None
    assert conflict.caused_by.sentence_id == "s_1_2"
    assert conflict.caused_by.scene_index == 1
    assert conflict.caused_by.event == "TRANSFER"


def test_rule_2_use_of_item_owned_by_someone_else(empty_engine: CanonEngine):
    """
    Rule 2: USE of an item transferred to another actor is a conflict for the previous owner.
    """
    events = [
        Event(
            type=EventType.TRANSFER,
            sentence_id="s_1_1",
            scene_index=1,
            actor="Bob",
            target="Charlie",
            item="plasma_torch",
        ),
        # Bob tries to use plasma_torch in Scene 2
        Event(
            type=EventType.USE,
            sentence_id="s_2_1",
            scene_index=2,
            actor="Bob",
            item="plasma_torch",
        ),
        # Charlie uses plasma_torch in Scene 2 (valid)
        Event(
            type=EventType.USE,
            sentence_id="s_2_2",
            scene_index=2,
            actor="Charlie",
            item="plasma_torch",
        ),
    ]

    conflicts, _ = empty_engine.replay_all(events)

    assert len(conflicts) == 1
    assert conflicts[0].rule == ConflictRule.UNOWNED_ITEM_USE
    assert conflicts[0].sentence_id == "s_2_1"
    assert "Charlie" in conflicts[0].message


# ============================================================================
# Rule 3 Tests: Dead Character Action or Appearance
# ============================================================================

def test_rule_3_dead_character_cannot_act_or_appear(empty_engine: CanonEngine):
    """
    Rule 3: Any event by a dead character (APPEAR or action) is a conflict.
    """
    events = [
        Event(
            type=EventType.KILL,
            sentence_id="s_2_5",
            scene_index=2,
            target="Marcus",
        ),
        Event(
            type=EventType.APPEAR,
            sentence_id="s_4_1",
            scene_index=4,
            actor="Marcus",
        ),
        Event(
            type=EventType.USE,
            sentence_id="s_4_2",
            scene_index=4,
            actor="Marcus",
            item="radio",
        ),
    ]

    conflicts, _ = empty_engine.replay_all(events)

    assert len(conflicts) == 2
    for c in conflicts:
        assert c.rule == ConflictRule.DEAD_CHARACTER_ACTION
        assert c.caused_by is not None
        assert c.caused_by.sentence_id == "s_2_5"
        assert c.caused_by.scene_index == 2
        assert c.caused_by.event == "KILL"


# ============================================================================
# Rule 4 Tests: Trait Action Violation
# ============================================================================

def test_rule_4_trait_violation_unprovoked(sci_fi_lore: Lore):
    """
    Rule 4: TRAIT_ACTION violating a character's trait without trigger is a conflict.
    """
    engine = CanonEngine(lore=sci_fi_lore)
    events = [
        # Diana (non_violent: True) attacks without trigger
        Event(
            type=EventType.TRAIT_ACTION,
            sentence_id="s_2_2",
            scene_index=2,
            actor="Diana",
            trait_tag="violent",
            triggered=False,
        ),
    ]

    conflicts, _ = engine.replay_all(events)

    assert len(conflicts) == 1
    conflict = conflicts[0]
    assert conflict.rule == ConflictRule.TRAIT_VIOLATION
    assert conflict.sentence_id == "s_2_2"
    assert conflict.caused_by is not None
    assert conflict.caused_by.sentence_id == "lore"


def test_rule_4_trait_action_with_trigger_no_conflict(sci_fi_lore: Lore):
    """
    When triggered=True (provocation/self-defense), no conflict should be raised.
    """
    engine = CanonEngine(lore=sci_fi_lore)
    events = [
        Event(
            type=EventType.TRAIT_ACTION,
            sentence_id="s_2_2",
            scene_index=2,
            actor="Diana",
            trait_tag="violent",
            triggered=True,
        ),
    ]

    conflicts, _ = engine.replay_all(events)
    assert len(conflicts) == 0


# ============================================================================
# Rule 5 Tests: Unowned Item Transfer
# ============================================================================

def test_rule_5_transfer_unowned_item(empty_engine: CanonEngine):
    """
    Rule 5: TRANSFER from someone who does not own the item is a conflict.
    """
    events = [
        Event(
            type=EventType.TRANSFER,
            sentence_id="s_1_1",
            scene_index=1,
            actor="Alice",
            target="Bob",
            item="holo_map",
        ),
        # Alice tries to give the holo_map to Charlie in Scene 2
        Event(
            type=EventType.TRANSFER,
            sentence_id="s_2_1",
            scene_index=2,
            actor="Alice",
            target="Charlie",
            item="holo_map",
        ),
    ]

    conflicts, _ = empty_engine.replay_all(events)

    assert len(conflicts) == 1
    conflict = conflicts[0]
    assert conflict.rule == ConflictRule.UNOWNED_ITEM_TRANSFER
    assert conflict.sentence_id == "s_2_1"
    assert conflict.scene_index == 2
    assert conflict.caused_by is not None
    assert conflict.caused_by.sentence_id == "s_1_1"
    assert conflict.caused_by.scene_index == 1
    assert conflict.caused_by.event == "TRANSFER"


# ============================================================================
# Incremental Replay & Graph Tests
# ============================================================================

def test_incremental_replay_ripple(empty_engine: CanonEngine):
    """
    Test incremental replay from an arbitrary scene index correctly recalculates
    conflicts and identifies affected scene indexes.
    """
    # Baseline run
    events_v1 = [
        Event(
            type=EventType.TRANSFER,
            sentence_id="s_1_1",
            scene_index=1,
            actor="Bob",
            target="Charlie",
            item="data_pad",
        ),
        Event(
            type=EventType.USE,
            sentence_id="s_2_1",
            scene_index=2,
            actor="Bob",
            item="data_pad",
        ),
    ]

    conflicts_v1, _ = empty_engine.replay_all(events_v1)
    assert len(conflicts_v1) == 1
    assert conflicts_v1[0].scene_index == 2

    # Writer edits Scene 1: Bob keeps data_pad (no transfer)
    events_v2 = [
        Event(
            type=EventType.APPEAR,
            sentence_id="s_1_1",
            scene_index=1,
            actor="Bob",
        ),
        Event(
            type=EventType.USE,
            sentence_id="s_2_1",
            scene_index=2,
            actor="Bob",
            item="data_pad",
        ),
    ]

    # Replay from scene 1 forward
    conflicts_v2, graph, affected_scenes = empty_engine.replay_incremental(
        events_v2, from_scene_index=1
    )

    # Conflict in Scene 2 resolved
    assert len(conflicts_v2) == 0
    assert 2 in affected_scenes


def test_graph_generation(empty_engine: CanonEngine):
    """
    Graph should contain character nodes, item nodes, injury nodes, and conflict edges.
    """
    events = [
        Event(
            type=EventType.INJURE,
            sentence_id="s_1_1",
            scene_index=1,
            actor="Kira",
            body_part="cybernetic eye",
            severity=0.8,
        ),
        Event(
            type=EventType.USE,
            sentence_id="s_2_1",
            scene_index=2,
            actor="Kira",
            body_part="cybernetic eye",
            effort=EffortLevel.HEAVY,
        ),
    ]

    conflicts, graph = empty_engine.replay_all(events)

    node_ids = {n.data.id for n in graph.nodes}
    assert "char_kira" in node_ids
    assert "injury_kira_cybernetic eye" in node_ids
    assert f"rule_{ConflictRule.INJURED_PART_HEAVY_USE.value}" in node_ids

    # Verify conflict edge
    conflict_edges = [e for e in graph.edges if e.data.is_conflict]
    assert len(conflict_edges) >= 1
    assert conflict_edges[0].data.rule == ConflictRule.INJURED_PART_HEAVY_USE.value


def test_lore_alias_resolution(sci_fi_lore: Lore):
    """
    Events using character aliases should resolve to the canonical character and traits.
    """
    engine = CanonEngine(lore=sci_fi_lore)
    events = [
        # Uses alias "Agent Prince" for "Diana Prince"
        Event(
            type=EventType.TRAIT_ACTION,
            sentence_id="s_1_1",
            scene_index=1,
            actor="Agent Prince",
            trait_tag="violent",
            triggered=False,
        ),
    ]

    conflicts, _ = engine.replay_all(events)
    assert len(conflicts) == 1
    assert conflicts[0].rule == ConflictRule.TRAIT_VIOLATION
    assert "Diana Prince" in conflicts[0].message


def test_rule_1_heroic_override_bypasses_conflict(empty_engine: CanonEngine):
    """
    Explicit heroic exertion override (override=True) should bypass INJURED_PART_HEAVY_USE conflict.
    """
    events = [
        Event(
            type=EventType.INJURE,
            sentence_id="s_2_1",
            scene_index=2,
            actor="Kabir",
            body_part="right shoulder",
            severity=0.85,
        ),
        # Heroic exertion with override=True
        Event(
            type=EventType.USE,
            sentence_id="s_5_1",
            scene_index=5,
            actor="Kabir",
            body_part="right shoulder",
            effort=EffortLevel.HEAVY,
            override=True,
        ),
    ]

    conflicts, _ = empty_engine.replay_all(events)
    assert len(conflicts) == 0


def test_dynamic_item_acquisition_and_graph(empty_engine: CanonEngine):
    """
    Acquiring an item (TRANSFER with actor=None, target="Meera") should update
    item ownership and create an 'owns' edge in the graph.
    """
    events = [
        Event(
            type=EventType.TRANSFER,
            sentence_id="s_3_1",
            scene_index=3,
            actor=None,
            target="Meera",
            item="golden ring",
        )
    ]

    conflicts, graph = empty_engine.replay_all(events)
    assert len(conflicts) == 0

    node_ids = {n.data.id for n in graph.nodes}
    assert "item_golden ring" in node_ids
    assert "char_meera" in node_ids

    owns_edges = [e for e in graph.edges if e.data.label == "owns"]
    assert len(owns_edges) == 1
    assert owns_edges[0].data.source == "char_meera"
    assert owns_edges[0].data.target == "item_golden ring"
