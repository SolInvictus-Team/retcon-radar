"""
backend/tests/test_api.py
API tests for RETCON-RADAR REST endpoints using FastAPI TestClient.
Mocks LLM extraction to run fast and offline.
"""

from unittest.mock import AsyncMock, patch
import pytest
from starlette.testclient import TestClient

from backend.main import app
from backend.schemas import EffortLevel, Event, EventType


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client


def test_health_check(client: TestClient):
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_sample_project_loading(client: TestClient):
    """
    Test loading the sample project (The Courier Protocol).
    """
    response = client.get("/api/projects/courier-protocol")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == "courier-protocol"
    assert data["title"] == "The Courier Protocol"
    assert len(data["chapters"]) == 5
    assert len(data["lore"]["characters"]) >= 3


def test_project_crud(client: TestClient):
    """
    Test project creation, listing, chapter addition, update, and deletion.
    """
    # 1. Create project
    create_resp = client.post(
        "/api/projects",
        json={"title": "Project Nebula"},
    )
    assert create_resp.status_code == 201
    proj_id = create_resp.json()["id"]
    assert proj_id.startswith("proj_")

    # 2. List projects
    list_resp = client.get("/api/projects")
    assert list_resp.status_code == 200
    proj_ids = [p["id"] for p in list_resp.json()]
    assert proj_id in proj_ids

    # 3. Add Chapter
    add_ch_resp = client.post(
        f"/api/projects/{proj_id}/chapters",
        json={"title": "Act I Scene 1", "text": "A lone scout appears at dawn."},
    )
    assert add_ch_resp.status_code == 201
    ch_id = add_ch_resp.json()["id"]
    assert add_ch_resp.json()["index"] == 1

    # 4. Patch Chapter
    patch_ch_resp = client.patch(
        f"/api/projects/{proj_id}/chapters/{ch_id}",
        json={"title": "Act I: Dawn Arrival", "text": "A lone scout arrives."},
    )
    assert patch_ch_resp.status_code == 200
    assert patch_ch_resp.json()["title"] == "Act I: Dawn Arrival"

    # 5. Delete Chapter
    del_resp = client.delete(f"/api/projects/{proj_id}/chapters/{ch_id}")
    assert del_resp.status_code == 200
    assert del_resp.json()["status"] == "ok"

    # Verify project has 0 chapters
    get_resp = client.get(f"/api/projects/{proj_id}")
    assert len(get_resp.json()["chapters"]) == 0


@pytest.mark.asyncio
async def test_analyze_and_timings(client: TestClient):
    """
    Test /api/projects/{id}/analyze with mocked LLM extraction.
    Verifies conflict detection, Cytoscape graph data, and timing measurements.
    """
    # 1. Create project with two scenes
    proj_resp = client.post("/api/projects", json={"title": "Continuity Test Project"})
    proj_id = proj_resp.json()["id"]

    ch1_resp = client.post(
        f"/api/projects/{proj_id}/chapters",
        json={"title": "Scene 1", "text": "Alice suffers a severe arm injury."},
    )
    ch1_id = ch1_resp.json()["id"]

    ch2_resp = client.post(
        f"/api/projects/{proj_id}/chapters",
        json={"title": "Scene 2", "text": "Alice uses her arm heavily."},
    )
    ch2_id = ch2_resp.json()["id"]

    # 2. Mock extractor.extract_chapter_events
    async def mock_extract(text: str, scene_index: int, lore):
        if scene_index == 1:
            events = [
                Event(
                    type=EventType.INJURE,
                    sentence_id="s_1_1",
                    scene_index=1,
                    actor="Alice",
                    body_part="arm",
                    severity=0.9,
                )
            ]
        else:
            events = [
                Event(
                    type=EventType.USE,
                    sentence_id="s_2_1",
                    scene_index=2,
                    actor="Alice",
                    body_part="arm",
                    effort=EffortLevel.HEAVY,
                )
            ]
        return events, ["Alice"], []

    with patch("backend.main.extractor.extract_chapter_events", side_effect=mock_extract):
        analyze_resp = client.post(
            f"/api/projects/{proj_id}/analyze",
            json={"chapter_id": ch2_id, "text": "Alice uses her arm heavily."},
        )

    assert analyze_resp.status_code == 200
    data = analyze_resp.json()

    # Verify conflicts
    assert len(data["conflicts"]) == 1
    conflict = data["conflicts"][0]
    assert conflict["rule"] == "INJURED_PART_HEAVY_USE"
    assert conflict["sentence_id"] == "s_2_1"
    assert conflict["caused_by"]["sentence_id"] == "s_1_1"

    # Verify GraphData
    assert len(data["graph"]["nodes"]) >= 2
    conflict_edges = [e for e in data["graph"]["edges"] if e["data"]["is_conflict"]]
    assert len(conflict_edges) >= 1

    # Verify Dev Timings
    assert "timings" in data
    assert "extraction_ms" in data["timings"]
    assert "engine_ms" in data["timings"]
    assert "total_ms" in data["timings"]
    assert data["timings"]["total_ms"] >= 0.0

    print(
        f"\n[DEV TIMING LOGS] extraction={data['timings']['extraction_ms']:.2f}ms, "
        f"engine={data['timings']['engine_ms']:.2f}ms, "
        f"total={data['timings']['total_ms']:.2f}ms"
    )


@pytest.mark.asyncio
async def test_ripple_endpoint(client: TestClient):
    """
    Test /api/projects/{id}/ripple endpoint.
    """
    proj_resp = client.post("/api/projects", json={"title": "Ripple Test Project"})
    proj_id = proj_resp.json()["id"]

    client.post(
        f"/api/projects/{proj_id}/chapters",
        json={"title": "Scene 1", "text": "Bob loses the key."},
    )
    client.post(
        f"/api/projects/{proj_id}/chapters",
        json={"title": "Scene 2", "text": "Bob uses the key."},
    )

    async def mock_extract(text: str, scene_index: int, lore):
        if scene_index == 1:
            events = [
                Event(
                    type=EventType.TRANSFER,
                    sentence_id="s_1_1",
                    scene_index=1,
                    actor="Bob",
                    target=None,
                    item="key",
                )
            ]
        else:
            events = [
                Event(
                    type=EventType.USE,
                    sentence_id="s_2_1",
                    scene_index=2,
                    actor="Bob",
                    item="key",
                )
            ]
        return events, ["Bob"], ["key"]

    with patch("backend.main.extractor.extract_chapter_events", side_effect=mock_extract):
        ripple_resp = client.post(
            f"/api/projects/{proj_id}/ripple",
            json={"from_scene_index": 1},
        )

    assert ripple_resp.status_code == 200
    data = ripple_resp.json()
    assert "affected_scene_indexes" in data
    assert "new_conflicts" in data
    assert len(data["new_conflicts"]) == 1


def test_conflict_patches_endpoint(client: TestClient):
    """
    Test lazy patch generation endpoint returns 3 distinct options.
    """
    resp = client.post("/api/conflicts/c_test_1/patches")
    assert resp.status_code == 200
    data = resp.json()
    assert data["conflict_id"] == "c_test_1"
    assert len(data["patches"]) == 3
    types = {p["type"] for p in data["patches"]}
    assert "modify_source" in types
    assert "bridge_gap" in types
    assert "override_rule" in types

