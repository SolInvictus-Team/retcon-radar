"""
backend/main.py
FastAPI application for RETCON-RADAR.
Implements the REST API contract defined in AGENTS.md Section 7.
"""

from contextlib import asynccontextmanager
import logging
import time
from typing import Optional

from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from backend.engine import CanonEngine
from backend.extractor import extractor
from backend.patches import patch_generator
from backend.schemas import (
    AnalyzeRequest,
    AnalyzeResponse,
    Character,
    CharacterCreate,
    Chapter,
    ChapterCreate,
    ChapterUpdate,
    Conflict,
    ConflictCause,
    Event,
    GraphData,
    Item,
    ItemCreate,
    PatchesResponse,
    Project,
    ProjectCreate,
    ProjectSummary,
    RippleRequest,
    RippleResponse,
)
from backend.store import store

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("retcon-radar.api")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ensure sample project is ready
    try:
        store.get_project("courier-protocol")
        logger.info("Initialized RETCON-RADAR backend. Sample project ready.")
    except Exception as e:
        logger.warning("Could not pre-load sample project: %s", e)
    yield


app = FastAPI(
    title="RETCON-RADAR API",
    description="The Story Compiler: real-time continuity linter for TV, novels and games.",
    version="1.0.0",
    lifespan=lifespan,
)

# Enable CORS for frontend development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# In-memory store of extracted events per chapter: project_id -> {chapter_id: list[Event]}
project_chapter_events: dict[str, dict[str, list[Event]]] = {}
# Active conflicts cache: conflict_id -> (Conflict, project_id)
active_conflicts: dict[str, tuple[Conflict, str]] = {}


# ============================================================================
# Project Endpoints
# ============================================================================

@app.get("/api/projects", response_model=list[ProjectSummary])
async def list_projects() -> list[ProjectSummary]:
    """Lists all projects with high-level summary metadata."""
    return store.list_projects()


@app.post("/api/projects", response_model=Project, status_code=status.HTTP_201_CREATED)
async def create_project(payload: ProjectCreate) -> Project:
    """Creates a new empty story project."""
    return store.create_project(payload)


@app.get("/api/projects/{project_id}", response_model=Project)
async def get_project(project_id: str) -> Project:
    """Retrieves a project by ID."""
    project = store.get_project(project_id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project '{project_id}' not found.",
        )
    return project


class BulkDeleteProjectsRequest(BaseModel):
    project_ids: list[str]


@app.delete("/api/projects/{project_id}", response_model=list[ProjectSummary])
async def delete_project(project_id: str) -> list[ProjectSummary]:
    """
    Deletes a project by ID and cascades cleanup:
    removes project file, clears in-memory events, active conflicts, and graph state.
    Returns the updated project list.
    """
    store.delete_project(project_id)
    # Cascade cleanup in memory
    project_chapter_events.pop(project_id, None)
    to_del = [cid for cid, val in active_conflicts.items() if val[1] == project_id]
    for cid in to_del:
        active_conflicts.pop(cid, None)

    return store.list_projects()


@app.post("/api/projects/delete", response_model=list[ProjectSummary])
async def bulk_delete_projects(payload: BulkDeleteProjectsRequest) -> list[ProjectSummary]:
    """
    Bulk deletes multiple projects by ID and cascades cleanup.
    Returns the updated project list.
    """
    for pid in payload.project_ids:
        store.delete_project(pid)
        project_chapter_events.pop(pid, None)
        to_del = [cid for cid, val in active_conflicts.items() if val[1] == pid]
        for cid in to_del:
            active_conflicts.pop(cid, None)

    return store.list_projects()


@app.post("/api/projects/restore", response_model=Project)
async def restore_project(payload: Project) -> Project:
    """Restores a project from an undo snapshot and persists to disk."""
    return store.restore_project(payload)


@app.post("/api/projects/sample", response_model=Project)
async def load_sample_project_endpoint() -> Project:
    """Recreates/loads the sample project from sample templates."""
    return store.load_sample_project()


# ============================================================================
# Chapter Endpoints
# ============================================================================

@app.post(
    "/api/projects/{project_id}/chapters",
    response_model=Chapter,
    status_code=status.HTTP_201_CREATED,
)
async def add_chapter(project_id: str, payload: ChapterCreate) -> Chapter:
    """Adds a new scene chapter to a project."""
    chapter = store.add_chapter(project_id, payload)
    if not chapter:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project '{project_id}' not found.",
        )
    return chapter


@app.patch("/api/projects/{project_id}/chapters/{chapter_id}", response_model=Chapter)
async def update_chapter(
    project_id: str,
    chapter_id: str,
    payload: ChapterUpdate,
) -> Chapter:
    """Updates a chapter's title, text, or index."""
    chapter = store.update_chapter(project_id, chapter_id, payload)
    if not chapter:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Chapter '{chapter_id}' in project '{project_id}' not found.",
        )
    if payload.text is not None and project_id in project_chapter_events:
        project_chapter_events[project_id].pop(chapter_id, None)
    return chapter


@app.delete("/api/projects/{project_id}/chapters/{chapter_id}")
async def delete_chapter(project_id: str, chapter_id: str) -> dict[str, str]:
    """Deletes a chapter and re-indexes remaining scenes."""
    success = store.delete_chapter(project_id, chapter_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Chapter '{chapter_id}' in project '{project_id}' not found.",
        )
    if project_id in project_chapter_events:
        project_chapter_events[project_id].pop(chapter_id, None)
    return {"status": "ok", "deleted_id": chapter_id}


# ============================================================================
# Manual Lore Entity Management Endpoints
# ============================================================================

@app.post("/api/projects/{project_id}/lore/characters", response_model=Character, status_code=status.HTTP_201_CREATED)
async def add_character(project_id: str, payload: CharacterCreate) -> Character:
    """Adds a new character to project lore."""
    char = store.add_character(project_id, payload)
    if not char:
        raise HTTPException(status_code=404, detail=f"Project '{project_id}' not found.")
    return char


@app.delete("/api/projects/{project_id}/lore/characters/{char_id}")
async def delete_character(project_id: str, char_id: str) -> dict[str, str]:
    """Deletes a character from project lore."""
    success = store.delete_character(project_id, char_id)
    if not success:
        raise HTTPException(status_code=404, detail=f"Character '{char_id}' not found.")
    return {"status": "ok", "deleted_id": char_id}


@app.post("/api/projects/{project_id}/lore/items", response_model=Item, status_code=status.HTTP_201_CREATED)
async def add_item(project_id: str, payload: ItemCreate) -> Item:
    """Adds a new item to project lore."""
    item = store.add_item(project_id, payload)
    if not item:
        raise HTTPException(status_code=404, detail=f"Project '{project_id}' not found.")
    return item


@app.delete("/api/projects/{project_id}/lore/items/{item_id}")
async def delete_item(project_id: str, item_id: str) -> dict[str, str]:
    """Deletes an item from project lore."""
    success = store.delete_item(project_id, item_id)
    if not success:
        raise HTTPException(status_code=404, detail=f"Item '{item_id}' not found.")
    return {"status": "ok", "deleted_id": item_id}


# ============================================================================
# Continuity Analysis & Ripple Endpoints
# ============================================================================

@app.post("/api/projects/{project_id}/analyze", response_model=AnalyzeResponse)
async def analyze_scene(project_id: str, payload: AnalyzeRequest) -> AnalyzeResponse:
    """
    Extracts events for changed text and executes the canon engine.
    Returns: { conflicts, graph, events, timings }.
    """
    t0 = time.perf_counter()

    project = store.get_project(project_id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project '{project_id}' not found.",
        )

    # 1. Update target chapter text in store
    store.update_chapter(project_id, payload.chapter_id, ChapterUpdate(text=payload.text))
    project = store.get_project(project_id)

    # 2. Extract events for changed text and re-use cached chapter events
    t_extract_start = time.perf_counter()
    if project_id not in project_chapter_events:
        project_chapter_events[project_id] = {}

    target_chapter = next((c for c in project.chapters if c.id == payload.chapter_id), None)
    target_scene_index = target_chapter.index if target_chapter else 1

    # Extract target chapter
    events_for_target, _, _ = await extractor.extract_chapter_events(
        text=payload.text,
        scene_index=target_scene_index,
        lore=project.lore,
    )
    project_chapter_events[project_id][payload.chapter_id] = events_for_target

    # Ensure all chapters in the project have extracted events
    sorted_chapters = sorted(project.chapters, key=lambda c: c.index)
    for ch in sorted_chapters:
        cached_evs = project_chapter_events[project_id].get(ch.id)
        if cached_evs is None or (len(cached_evs) == 0 and len(ch.text.strip()) > 0):
            evs, _, _ = await extractor.extract_chapter_events(
                text=ch.text,
                scene_index=ch.index,
                lore=project.lore,
            )
            project_chapter_events[project_id][ch.id] = evs

    # Combine all events across chapters in script order
    all_events = []
    for ch in sorted_chapters:
        all_events.extend(project_chapter_events[project_id].get(ch.id, []))

    chapter_events = project_chapter_events[project_id].get(payload.chapter_id, [])

    # Save any auto-discovered Lore items/characters back to store
    store.update_project(project_id, project)
    t_extract_end = time.perf_counter()

    # 3. Deterministic Canon Engine execution
    t_engine_start = time.perf_counter()
    engine = CanonEngine(lore=project.lore, chapters=project.chapters)
    conflicts, graph = engine.replay_all(all_events)
    t_engine_end = time.perf_counter()

    # Track active conflicts for lazy patch generation
    for c in conflicts:
        active_conflicts[c.id] = (c, project_id)

    # 4. Dev timing logs
    extract_ms = round((t_extract_end - t_extract_start) * 1000, 2)
    engine_ms = round((t_engine_end - t_engine_start) * 1000, 2)
    total_ms = round((time.perf_counter() - t0) * 1000, 2)

    logger.info(
        "TIMING [/api/projects/%s/analyze]: extraction=%.2fms, engine=%.2fms, total=%.2fms",
        project_id,
        extract_ms,
        engine_ms,
        total_ms,
    )

    return AnalyzeResponse(
        conflicts=conflicts,
        graph=graph,
        events=chapter_events,
        all_events=all_events,
        timings={
            "extraction_ms": extract_ms,
            "engine_ms": engine_ms,
            "total_ms": total_ms,
        },
        lore=project.lore,
    )


@app.post("/api/projects/{project_id}/ripple", response_model=RippleResponse)
async def ripple_analysis(project_id: str, payload: RippleRequest) -> RippleResponse:
    """
    Downstream impact analysis: re-checks from a scene forward and reports
    which scene indices were affected by earlier edits.
    """
    project = store.get_project(project_id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project '{project_id}' not found.",
        )

    # Collect events across chapters
    all_events = []
    sorted_chapters = sorted(project.chapters, key=lambda c: c.index)
    for ch in sorted_chapters:
        events, _, _ = await extractor.extract_chapter_events(
            text=ch.text,
            scene_index=ch.index,
            lore=project.lore,
        )
        all_events.extend(events)

    engine = CanonEngine(lore=project.lore, chapters=project.chapters)
    # Perform baseline replay to build snapshots
    engine.replay_all(all_events)

    # Execute incremental ripple
    new_conflicts, _, affected_scenes = engine.replay_incremental(
        events=all_events,
        from_scene_index=payload.from_scene_index,
    )

    return RippleResponse(
        affected_scene_indexes=affected_scenes,
        new_conflicts=new_conflicts,
    )


# ============================================================================
# Lazy Patches Endpoint (On-demand)
# ============================================================================

@app.post("/api/conflicts/{conflict_id}/patches", response_model=PatchesResponse)
@app.post("/api/projects/{project_id}/conflicts/{conflict_id}/patches", response_model=PatchesResponse)
async def get_conflict_patches(conflict_id: str, project_id: Optional[str] = None) -> PatchesResponse:
    """
    Generates 3 context-aware patches on demand for a conflict.
    """
    conflict = None
    target_project_id = project_id

    if conflict_id in active_conflicts:
        conflict, found_proj_id = active_conflicts[conflict_id]
        target_project_id = target_project_id or found_proj_id

    if not target_project_id:
        all_projs = store.list_projects()
        target_project_id = all_projs[0].id if all_projs else "courier-protocol"

    project = store.get_project(target_project_id) or store.get_project("courier-protocol")
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No project found to generate patches against.",
        )

    if not conflict:
        # Reconstruct fallback conflict if not found in active session cache
        conflict = Conflict(
            id=conflict_id,
            rule="INJURED_PART_HEAVY_USE",
            sentence_id="s_5_2",
            scene_index=5,
            message="Contradiction detected.",
            caused_by=ConflictCause(sentence_id="s_2_1", scene_index=2, event="INJURE"),
        )

    return patch_generator.generate_patches(
        conflict=conflict,
        project=project,
        lore=project.lore,
    )


# Health check
@app.get("/api/health")
async def health_check() -> dict[str, str]:
    return {"status": "ok", "app": "RETCON-RADAR"}

