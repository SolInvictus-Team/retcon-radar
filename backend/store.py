"""
backend/store.py
JSON file persistence and in-memory cache for RETCON-RADAR projects.
"""

from datetime import datetime, timezone
import json
import logging
from pathlib import Path
from typing import Optional
from uuid import uuid4

from backend.schemas import (
    Character,
    CharacterCreate,
    Chapter,
    ChapterCreate,
    ChapterUpdate,
    Item,
    ItemCreate,
    Lore,
    Project,
    ProjectCreate,
    ProjectSummary,
)

logger = logging.getLogger("retcon-radar.store")

# Resolve paths relative to this file
BACKEND_DIR = Path(__file__).resolve().parent
DATA_DIR = BACKEND_DIR / "data"
PROJECTS_DIR = DATA_DIR / "projects"
SAMPLES_DIR = DATA_DIR / "samples"


class ProjectStore:
    """
    Manages loading, saving, and caching story projects.
    """

    def __init__(self) -> None:
        self.projects_dir = PROJECTS_DIR
        self.samples_dir = SAMPLES_DIR
        self.projects_dir.mkdir(parents=True, exist_ok=True)
        self.samples_dir.mkdir(parents=True, exist_ok=True)

        self._cache: dict[str, Project] = {}
        self._load_all_from_disk()

    def _load_all_from_disk(self) -> None:
        """Loads all existing project JSON files from disk into cache."""
        for file_path in self.projects_dir.glob("*.json"):
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    project = Project.model_validate(data)
                    self._cache[project.id] = project
            except Exception as e:
                logger.error("Failed to load project %s: %s", file_path, e)

    def _save_to_disk(self, project: Project) -> None:
        """Persists a project to its JSON file."""
        file_path = self.projects_dir / f"{project.id}.json"
        try:
            with open(file_path, "w", encoding="utf-8") as f:
                f.write(project.model_dump_json(indent=2))
        except Exception as e:
            logger.error("Failed to write project %s: %s", file_path, e)

    def list_projects(self) -> list[ProjectSummary]:
        """Lists all projects with high-level summary info."""
        summaries: list[ProjectSummary] = []
        for p in self._cache.values():
            summaries.append(
                ProjectSummary(
                    id=p.id,
                    title=p.title,
                    chapter_count=len(p.chapters),
                    updated_at=p.updated_at,
                )
            )
        # Sort newest first
        summaries.sort(key=lambda s: s.updated_at or "", reverse=True)
        return summaries

    def get_project(self, project_id: str) -> Optional[Project]:
        """Retrieves a project by ID. Falls back to sample files if not found."""
        if project_id in self._cache:
            return self._cache[project_id]

        # Check if project exists on disk in projects dir
        proj_file = self.projects_dir / f"{project_id}.json"
        if proj_file.is_file():
            try:
                with open(proj_file, "r", encoding="utf-8") as f:
                    project = Project.model_validate(json.load(f))
                    self._cache[project.id] = project
                    return project
            except Exception as e:
                logger.error("Error reading project file %s: %s", proj_file, e)

        # Check sample files
        sample_file = self.samples_dir / f"{project_id.replace('-', '_')}.json"
        if not sample_file.is_file():
            sample_file = self.samples_dir / "courier_protocol.json"

        if sample_file.is_file() and project_id in ("courier-protocol", "courier_protocol"):
            try:
                with open(sample_file, "r", encoding="utf-8") as f:
                    project = Project.model_validate(json.load(f))
                    self._cache[project.id] = project
                    self._save_to_disk(project)
                    return project
            except Exception as e:
                logger.error("Error loading sample project from %s: %s", sample_file, e)

        return None

    def create_project(self, data: ProjectCreate | dict) -> Project:
        """Creates and stores a new project."""
        if isinstance(data, dict):
            data = ProjectCreate.model_validate(data)

        project_id = f"proj_{uuid4().hex[:8]}"
        now = datetime.now(timezone.utc).isoformat()

        project = Project(
            id=project_id,
            title=data.title,
            chapters=[],
            lore=data.lore if data.lore is not None else Lore(),
            created_at=now,
            updated_at=now,
        )

        self._cache[project.id] = project
        self._save_to_disk(project)
        return project

    def delete_project(self, project_id: str) -> bool:
        """Removes a project by ID from cache and disk."""
        deleted = False
        if project_id in self._cache:
            del self._cache[project_id]
            deleted = True

        file_path = self.projects_dir / f"{project_id}.json"
        if file_path.is_file():
            try:
                file_path.unlink()
                deleted = True
            except Exception as e:
                logger.error("Failed to delete project file %s: %s", file_path, e)

        # Also check hyphen / underscore variants (e.g. courier-protocol vs courier_protocol)
        alt_file = self.projects_dir / f"{project_id.replace('-', '_')}.json"
        if alt_file.is_file() and alt_file != file_path:
            try:
                alt_file.unlink()
                deleted = True
            except Exception as e:
                logger.error("Failed to delete alt project file %s: %s", alt_file, e)

        return deleted

    def delete_projects(self, project_ids: list[str]) -> list[str]:
        """Bulk deletes projects by IDs. Returns list of successfully deleted IDs."""
        deleted_ids = []
        for pid in project_ids:
            if self.delete_project(pid):
                deleted_ids.append(pid)
        return deleted_ids

    def restore_project(self, project: Project | dict) -> Project:
        """Restores a project object into cache and writes to disk."""
        if isinstance(project, dict):
            project = Project.model_validate(project)
        self._cache[project.id] = project
        self._save_to_disk(project)
        return project

    def update_project(self, project_id: str, data: dict | Project) -> Optional[Project]:
        """Updates project metadata, chapters, or lore."""
        project = self.get_project(project_id)
        if not project:
            return None

        if isinstance(data, Project):
            project.title = data.title
            project.chapters = data.chapters
            project.lore = data.lore
        elif isinstance(data, dict):
            if "title" in data and data["title"] is not None:
                project.title = data["title"]
            if "chapters" in data and data["chapters"] is not None:
                project.chapters = [
                    ch if isinstance(ch, Chapter) else Chapter.model_validate(ch)
                    for ch in data["chapters"]
                ]
            if "lore" in data and data["lore"] is not None:
                project.lore = (
                    data["lore"]
                    if isinstance(data["lore"], Lore)
                    else Lore.model_validate(data["lore"])
                )

        project.updated_at = datetime.now(timezone.utc).isoformat()
        self._cache[project.id] = project
        self._save_to_disk(project)
        return project

    def add_chapter(self, project_id: str, chapter_data: ChapterCreate | dict) -> Optional[Chapter]:
        """Adds a scene chapter to the project."""
        project = self.get_project(project_id)
        if not project:
            return None

        if isinstance(chapter_data, dict):
            chapter_data = ChapterCreate.model_validate(chapter_data)

        chapter_id = f"scene_{uuid4().hex[:6]}"
        next_index = len(project.chapters) + 1 if chapter_data.index is None else chapter_data.index

        chapter = Chapter(
            id=chapter_id,
            index=next_index,
            title=chapter_data.title,
            text=chapter_data.text or "",
        )

        project.chapters.append(chapter)
        project.updated_at = datetime.now(timezone.utc).isoformat()
        self._save_to_disk(project)
        return chapter

    def update_chapter(
        self,
        project_id: str,
        chapter_id: str,
        update_data: ChapterUpdate | dict,
    ) -> Optional[Chapter]:
        """Updates title, text, or index of a specific chapter."""
        project = self.get_project(project_id)
        if not project:
            return None

        if isinstance(update_data, dict):
            update_data = ChapterUpdate.model_validate(update_data)

        target_chapter = None
        for ch in project.chapters:
            if ch.id == chapter_id:
                target_chapter = ch
                break

        if not target_chapter:
            return None

        if update_data.title is not None:
            target_chapter.title = update_data.title
        if update_data.text is not None:
            target_chapter.text = update_data.text
        if update_data.index is not None:
            target_chapter.index = update_data.index

        project.updated_at = datetime.now(timezone.utc).isoformat()
        self._save_to_disk(project)
        return target_chapter

    def delete_chapter(self, project_id: str, chapter_id: str) -> bool:
        """Removes a chapter by ID and re-indexes remaining scenes."""
        project = self.get_project(project_id)
        if not project:
            return False

        orig_len = len(project.chapters)
        project.chapters = [ch for ch in project.chapters if ch.id != chapter_id]

        if len(project.chapters) == orig_len:
            return False

        # Re-index remaining chapters sequentially starting at 1
        for idx, ch in enumerate(project.chapters, start=1):
            ch.index = idx

        project.updated_at = datetime.now(timezone.utc).isoformat()
        self._save_to_disk(project)
        return True

    def add_character(self, project_id: str, data: CharacterCreate | dict) -> Optional[Character]:
        project = self.get_project(project_id)
        if not project:
            return None
        if isinstance(data, dict):
            data = CharacterCreate.model_validate(data)
        char_id = f"char_{uuid4().hex[:6]}"
        char = Character(
            id=char_id,
            name=data.name,
            aliases=data.aliases,
            traits=data.traits,
            description=data.description,
        )
        project.lore.characters.append(char)
        project.updated_at = datetime.now(timezone.utc).isoformat()
        self._save_to_disk(project)
        return char

    def delete_character(self, project_id: str, char_id: str) -> bool:
        project = self.get_project(project_id)
        if not project:
            return False
        orig_len = len(project.lore.characters)
        project.lore.characters = [c for c in project.lore.characters if c.id != char_id]
        if len(project.lore.characters) == orig_len:
            return False
        project.updated_at = datetime.now(timezone.utc).isoformat()
        self._save_to_disk(project)
        return True

    def add_item(self, project_id: str, data: ItemCreate | dict) -> Optional[Item]:
        project = self.get_project(project_id)
        if not project:
            return None
        if isinstance(data, dict):
            data = ItemCreate.model_validate(data)
        item_id = f"item_{uuid4().hex[:6]}"
        item = Item(
            id=item_id,
            name=data.name,
            aliases=data.aliases,
            description=data.description,
        )
        project.lore.items.append(item)
        project.updated_at = datetime.now(timezone.utc).isoformat()
        self._save_to_disk(project)
        return item

    def delete_item(self, project_id: str, item_id: str) -> bool:
        project = self.get_project(project_id)
        if not project:
            return False
        orig_len = len(project.lore.items)
        project.lore.items = [i for i in project.lore.items if i.id != item_id]
        if len(project.lore.items) == orig_len:
            return False
        project.updated_at = datetime.now(timezone.utc).isoformat()
        self._save_to_disk(project)
        return True

    def load_sample_project(self, sample_name: str = "courier_protocol.json") -> Project:
        """Loads and persists the sample project."""
        sample_path = self.samples_dir / sample_name
        if not sample_path.is_file():
            raise FileNotFoundError(f"Sample project file not found at {sample_path}")

        with open(sample_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            project = Project.model_validate(data)
            project.updated_at = datetime.now(timezone.utc).isoformat()
            self._cache[project.id] = project
            self._save_to_disk(project)
            return project


# Global default store instance
store = ProjectStore()
