<div align="center">

# 📡 RETCON-RADAR
### The Real-Time Story Compiler & Narrative Continuity Linter

**Writers get spell-check for words. They get nothing for canon. Until now.**

[![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-009688.svg?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![Python 3.11](https://img.shields.io/badge/Python-3.11+-3776AB.svg?logo=python&logoColor=white)](https://www.python.org/)
[![React 18](https://img.shields.io/badge/React-18.2+-61DAFB.svg?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.2+-3178C6.svg?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![NetworkX](https://img.shields.io/badge/Engine-NetworkX%203.2-blue.svg)](https://networkx.org/)
[![Tests](https://img.shields.io/badge/Pytest-20%2F20%20Passing-success.svg?logo=pytest&logoColor=white)](backend/tests/)

*Built by **Team Sol Invictus** · GeNarrative Clash 2026 (Narrative & Screenplay Track)*

[⚡ Quick Start (60 Seconds)](#-quick-start-in-60-seconds) · [🎯 2-Minute Demo Tour](#-2-minute-interactive-demo-tour) · [⚙️ Canon Engine Invariants](#-the-5-canon-engine-invariants) · [🚀 Future Scope](#-future-scope--final-round-roadmap)

</div>

---

## 📖 Table of Contents

1. [The Problem](#-the-problem)
2. [The Solution: A Compiler for Stories](#-the-solution-a-compiler-for-stories)
3. [Quick Start in 60 Seconds](#-quick-start-in-60-seconds)
4. [2-Minute Interactive Demo Tour](#-2-minute-interactive-demo-tour)
5. [Current MVP Status (50% Milestone)](#-current-mvp-status-50-milestone)
6. [The 5 Canon Engine Invariants](#-the-5-canon-engine-invariants)
7. [Future Scope & Final Round Roadmap](#-future-scope--final-round-roadmap)
8. [REST API Reference](#-rest-api-reference)
9. [Testing & Quality Assurance](#-testing--quality-assurance)

---

## 🔥 The Problem

A serialized 10-episode series, novel trilogy, or branching RPG script contains **tens of thousands of narrative dependencies**:
- *Who possesses the cipher key in Scene 7?*
- *Which limb did Kabir injure in the Scene 2 firefight?*
- *Is Dr. Sen still alive after the Scene 3 explosion?*
- *Does a character's sudden violence contradict their established pacifist trait?*

Software developers have linters, type checkers, and compilers. **Writers have a messy Show Bible, sticky notes, and fragile human memory.**

| Class of Error | Example Scenario | Impact |
| :--- | :--- | :--- |
| **Physical Invariant Break** | Scene 2: Kabir shatters his right shoulder. Scene 5: He aims a heavy sniper rifle with that exact shoulder. | Plot holes that break audience immersion |
| **Inventory / Ownership Break** | Scene 3: Meera drops the bronze key in the alley. Scene 6: She unlocks the vault using that same key. | Continuity errors across chapters |
| **Psychological / Trait Drift** | Scenes 1–4: Character is established as a strict pacifist. Scene 5: She fires a weapon unprovoked. | Inconsistent character arcs |

Existing screenplay software (Final Draft, Highland) only formats text, while generative AI tools generate prose blindly without tracking story state. **Neither proves narrative validity.**

---

## 💡 The Solution: A Compiler for Stories

**RETCON-RADAR is an IDE / VS Code for fiction writers.**

```text
       PROSE EDITOR                      CANON SENTINEL (NetworkX)               DIAGNOSTICS & PATCHES
+--------------------------+       +-----------------------------------+       +---------------------------+
| "Kabir raised the sniper | ----> | Replays story chronology          | ----> | RED WAVY UNDERLINE        |
| rifle with his right     |       | Tracks characters, items & state  |       | [INJURED_PART_HEAVY_USE]  |
| shoulder..."             |       | Enforces 5 Non-Negotiable Rules   |       | + 3 Context-Aware Fixes   |
+--------------------------+       +-----------------------------------+       +---------------------------+
```

1. **Three-Pane Studio Workspace:** Scene outline on the left, live screenplay editor in the center, and the interactive **Canon Sentinel** knowledge graph on the right.
2. **Deterministic Replay:** NetworkX replays the timeline from Scene 1 to Scene $N$, maintaining explicit state vectors for all characters, injuries, items, and locations.
3. **Live Red Wavy Underlines:** Decorates the exact violating sentence in real time, just like a spell-checker.
4. **Source Tracing & In-Place Patches:** Traces conflicts back to the exact causal scene (e.g., Scene 2) and offers 3 targeted repairs (`modify_source`, `bridge_gap`, `heroic_override`) that cleanly replace the sentence in-place without ghost lines.

---

## 🚀 Quick Start in 60 Seconds

### Prerequisites
- Python 3.11+
- Node.js 18+

### 1. One-Click Launch
```bash
git clone [https://github.com/adityasinha01/RETCON-RADAR.git](https://github.com/adityasinha01/RETCON-RADAR.git)
cd RETCON-RADAR

# Run the unified startup script
chmod +x start.sh
./start.sh
```

### 2. Open in Your Browser
- **Frontend Studio UI:** [http://localhost:5173](http://localhost:5173)
- **Backend API & Swagger Docs:** [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

---

## 🎯 2-Minute Interactive Demo Tour

Follow these 4 steps using our sample project (*The Courier Protocol*):

1. **Load Sample:** Open [http://localhost:5173](http://localhost:5173) and click **"Try the Demo"** / **"Load The Courier Protocol"**.
2. **Inspect Scene 1 & Scene 2:**
   - In **Scene 1**, Kabir checks his gear and Meera holds her grandmother's bronze key—reflected immediately in the **Canon Sentinel** graph.
   - In **Scene 2**, a stray bullet shatters Kabir's right shoulder (`severity: 0.8`).
3. **Detect Conflict in Scene 5:** Click **"Scene 5: The Sniper's Perch"** in the left sidebar.
   - Notice the **red wavy underline** on: *"He raised the sniper rifle with his right shoulder and took steady aim."*
   - Swapping `right` with `left` clears the warning immediately. Reverting to `right` brings the conflict back.
4. **Apply In-Place Patch:** Click the highlighted sentence to open the diagnostics panel, trace the root cause back to Scene 2, and click **Apply** on **Heroic Exertion Override**:
   - The sentence updates in-place to: *"Through blinding agony, he forced his damaged shoulder to steady the weight, knowing it would tear further."*
   - The red underline vanishes, the status flips to **Canon Consistent**, and the graph contradiction edge clears.

---

## ✅ Current MVP Status (50% Milestone)

This submission represents our **50% working MVP**, featuring the complete frontend studio UI and the core deterministic backend engine running on structured story states:

| Capability | What It Does | Status |
| :--- | :--- | :---: |
| **Deterministic Story Compiler** | Pure Python NetworkX state machine enforcing canon rules | **Ready** |
| **Live Wavy Red Underlines** | Real-time editor decorations mapped to exact sentence offsets | **Ready** |
| **Interactive Canon Sentinel Graph** | Force-directed Cytoscape graph tracking entities, injuries, and items | **Ready** |
| **Root-Cause Diagnostics Panel** | Traces conflicts to their origin scene and explains violated rules | **Ready** |
| **In-Place Patch Synthesis** | 3 context-aware fixes (`modify_source`, `bridge_gap`, `heroic_override`) | **Ready** |
| **Chapter & Lore Management** | Scene navigation, inline editing, and manual lore CRUD | **Ready** |

---

## ⚙️ The 5 Canon Engine Invariants

```mermaid
flowchart TD
    E[Story Event] --> R1{Rule 1: Injured Part Use?}
    R1 -- Injury >= 0.6 & No Override --> C1[Conflict: INJURED_PART_HEAVY_USE]
    R1 -- Pass --> R2{Rule 2: Actor Alive?}
    R2 -- Deceased --> C2[Conflict: DEAD_MAN_ACTING]
    R2 -- Pass --> R3{Rule 3: Item Owned?}
    R3 -- Unowned / Lost --> C3[Conflict: UNOWNED_ITEM_USE]
    R3 -- Pass --> R4{Rule 4: Spatial Presence?}
    R4 -- Disjoint Location --> C4[Conflict: SPATIAL_IMPOSSIBILITY]
    R4 -- Pass --> R5{Rule 5: Trait Consistent?}
    R5 -- Contradicts Trait --> C5[Conflict: TRAIT_PARADOX]
    R5 -- Pass --> OK[🟢 Canon Validated]
```

1. **`INJURED_PART_HEAVY_USE`:** Physical injury severity $\ge 0.6$ prevents heavy physical exertion using that body part without medical treatment or heroic override.
2. **`DEAD_MAN_ACTING`:** Deceased characters cannot perform physical actions or appear alive.
3. **`UNOWNED_ITEM_USE`:** Characters cannot operate or transfer items not in their current inventory.
4. **`SPATIAL_IMPOSSIBILITY`:** Characters cannot act in Location B without an intervening transit event from Location A.
5. **`TRAIT_PARADOX`:** Characters cannot execute actions that contradict established canon traits.

---

## 🚀 Future Scope & Final Round Roadmap

For the remaining 50% in the final hackathon round, we are integrating contextual AI models and expanding RETCON-RADAR into a complete end-to-end writing companion:

- **🟡 Dual-Tier Linting — Red vs. Yellow Wavy Lines:**
  - **Red Wavy Lines (Rule Engine):** Strict deterministic checks for hard facts—injuries, lost/transferred items, sudden location jumps, **Timeline Math** (verifying relative time jumps like *"two days later"* or *"six weeks later"*), and **Knowledge Leak Detection** (flagging when a character knows information they never witnessed or heard).
  - **Yellow Wavy Lines (AI Personality & Voice Guardrails):** LLM-powered checks for out-of-character behavior and dialogue drift, backed by **exact quotes from earlier scenes as proof** (e.g., *"In Scene 2, Kabir stated 'I never touch weapons'"*).
- **🎭 Intentional Twist Manager (Smart Ignore):**
  - Upgrading the Ignore action so authors can mark deliberate rule-breaks as **Intentional Twists** with a custom note (e.g., *"Kabir's dark turn — Act 3 twist"*), replacing the error underline with a subtle twist marker and central twist dashboard.
- **🪪 Clickable Character Profile Cards:**
  - Dedicated character dossiers displaying traits, active injuries, inventory, and relationships—with one-click jumps to the exact scenes where each fact was established.
- **🧵 Unresolved Threads Tracker (Chekhov's Gun):**
  - Automated tracking of introduced setups, clues, and props that haven't paid off yet (e.g., *"What happened to Meera's bronze key from Scene 2?"*).
- **📂 File Import & Continuity Report Export:**
  - Direct `.txt` and `.docx` manuscript imports so writers can bring existing drafts, plus one-click export of full project continuity audits in **PDF** and **Markdown** formats.
- **🌿 Branching Timelines & Ripple-Effect Simulation:**
  - Timeline forking (`Fork A` vs. `Fork B`) to test alternate plotlines safely and preview how editing an early scene cascades across downstream chapters.

---

## 🔌 REST API Reference

Full interactive Swagger documentation is available at `http://127.0.0.1:8000/docs`.

```bash
# Analyze a scene in real-time
curl -X POST "[http://127.0.0.1:8000/api/projects/courier-protocol/analyze](http://127.0.0.1:8000/api/projects/courier-protocol/analyze)" \
     -H "Content-Type: application/json" \
     -d '{
       "chapter_id": "scene_5",
       "text": "Kabir raised the sniper rifle with his right shoulder and took steady aim."
     }'

# Generate 3 context-aware patches
curl -X POST "[http://127.0.0.1:8000/api/conflicts/c_1/patches](http://127.0.0.1:8000/api/conflicts/c_1/patches)" \
     -H "Content-Type: application/json" \
     -d '{ "project_id": "courier-protocol", "chapter_id": "scene_5", "conflict": {...} }'
```

---

## 🧪 Testing & Quality Assurance

All 20 backend unit and integration tests run **100% offline with zero network calls**:

```bash
cd backend
source .venv/bin/activate
pytest -v
```

Frontend production build check:
```bash
npm run build --prefix frontend
```

---

<div align="center">

**RETCON-RADAR: Write boldly. Stay in canon.**

*Built with passion by **Team Sol Invictus**.*

</div>