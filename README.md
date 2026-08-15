# Ibn Sina (ابن سينا) — Paediatric ED Decision-Support System

[![FastAPI](https://img.shields.io/badge/FastAPI-0.1.0-009688.svg?style=flat&logo=fastapi)](https://fastapi.tiangolo.com/)
[![LangGraph](https://img.shields.io/badge/LangGraph-Agentic%20Workflow-FF6F61.svg?style=flat)](https://langchain-ai.github.io/langgraph/)
[![Next.js](https://img.shields.io/badge/Next.js-15%20App%20Router-000000.svg?style=flat&logo=next.js)](https://nextjs.org/)
[![Chakra UI](https://img.shields.io/badge/Chakra%20UI-v3-319795.svg?style=flat&logo=chakraui)](https://chakra-ui.com/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E.svg?style=flat&logo=supabase)](https://supabase.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

An agentic AI system for emergency department triage, clinical decision support, and diagnostic synthesis, scoped to paediatric patients (ages 1–5) presenting with suspected **Community-Acquired Pneumonia (CAP)**.

> ⚠️ **RESEARCH PROTOTYPE. NOT A MEDICAL DEVICE.**  
> Runs on synthetic patient data only. Every AI-generated recommendation requires explicit clinician review and approval before taking effect. No output from this system should be used for real clinical decisions.

---

## 🌐 Live Deployments

- 🎨 **Web Frontend Application**: [https://ibn-sina-lemon.vercel.app](https://ibn-sina-lemon.vercel.app)
- ⚙️ **FastAPI Backend API**: [https://ibnsina-production.up.railway.app](https://ibnsina-production.up.railway.app)
- 📖 **Interactive OpenAPI Docs**: [https://ibnsina-production.up.railway.app/docs](https://ibnsina-production.up.railway.app/docs)

---

## 💡 What It Does

Ibn Sina automates and standardises the paediatric ED encounter workflow using a **LangGraph multi-agent state machine** across six distinct stages. It integrates deterministic clinical scoring, multi-modal vision models for radiological analysis, persistent state check-pointing, and human-in-the-loop (HITL) approval gates.

```mermaid
graph TD
    A[Raw Registration Text] --> B[1. Intake Agent]
    B --> C[2. Triage Agent]
    C -->|ESI <= 1 Resuscitation| G[6. Synthesis Agent]
    C -->|ESI 2-5 Standard| D[3. History Agent]
    D --> E[4. Orders Agent]
    E --> F{Gate 1: Radiology Approval}
    F -->|Clinician Approved| H[5. Radiology Agent + Gemini CXR Vision]
    H --> I{Gate 2: Synthesis Approval}
    I -->|Clinician Approved| G
    G --> J[Complete ED Synthesis Report & Disposition]
```

### LangGraph Encounter Workflow Stages

1. **`intake`**: Parses free-text registration notes into structured patient demographics (`full_name`, `age_months`, `sex`, `mrn`), `insurance` metadata, and initial `chief_complaint`.
2. **`triage`**: Evaluates vital signs against age-stratified paediatric reference ranges (WHO / PIDS), computes an Emergency Severity Index (**ESI Levels 1–5**), and flags clinical red flags. 
   - *Conditional Routing*: ESI 1 (resuscitation) bypasses intermediate nodes directly to `synthesis` for rapid escalation.
3. **`history`**: Synthesizes a structured paediatric HPI, medical history (PMH, family, birth, immunisations, developmental status), and initial SOAP note.
4. **`orders`**: Proposes evidence-based LOINC lab orders (CBC, CRP, Procalcitonin, Blood Cultures, Lactate) and AP chest X-ray requests with explicit clinical rationale.
5. **`radiology`** *(HITL Gate: `interrupt_before=["radiology"]`)*: Accepts uploaded chest X-ray DICOM/JPEG images (`cxr_image_path`) and uses Gemini Flash vision inference to generate narrative radiological findings, pneumonia likelihood estimations, and explicit clinical limitation disclaimers.
6. **`synthesis`** *(HITL Gate: `interrupt_before=["synthesis"]`)*: Aggregates accumulated encounter data to compute PIDS/IDSA severity scores, differential diagnoses, disposition (`admit_ward`, `admit_picu`, `discharge_home`), and an end-to-end markdown ED Synthesis Report.

---

## 🛡️ Clinical Safety & Zero-Hallucination Design

- **Pure Python Severity Computation**: All severity classifications (WHO Paediatric Danger Signs, PIDS/IDSA CAP severity criteria, age-based tachycardia and tachypnoea thresholds) are computed using **100% deterministic Python logic** (`api/clinical/scores.py`). The LLM only explains the clinical score; it never calculates it.
- **Human-in-the-Loop (HITL) Enforcement**: The LangGraph state machine cannot progress past `radiology` or `synthesis` without explicit clinician review, approval, or modification.
- **Comprehensive Audit Trail**: Every agent step, clinical computation, CXR upload, and clinician approval/edit action is logged into an immutable audit table in PostgreSQL (`api/db.py`).
- **Narrative Radiologist Assistant Framing**: The multi-modal chest X-ray analyzer is strictly framed as a narrative decision-support assistant to a board-certified radiologist, required to explicitly state its diagnostic limitations on every inference.

---

## 🛠️ Technology Stack

| Layer | Technologies & Tools |
|---|---|
| **Backend Framework** | Python 3.14+, FastAPI, Pydantic v2, Uvicorn |
| **Agentic Workflow** | LangGraph StateGraph, LangChain Core |
| **Frontend Framework** | Next.js 15 (App Router), TypeScript, React 19 |
| **UI Design System** | Chakra UI v3, Lucide React Icons, Emotion |
| **Database & Persistence** | Supabase (PostgreSQL), `PostgresSaver` via `psycopg` connection pool |
| **AI / LLM Stack** | **Groq** (`llama-3.3-70b-versatile`) for fast text agents<br>**Google Gemini** (`gemini-2.5-flash` / `gemini-3.6-flash`) for multi-modal CXR vision & clinical synthesis |
| **Telemetry & Tracing** | AgentOps SDK |
| **Infrastructure & CI/CD** | Railway (API via Docker/Nixpacks with `libpq5`), Vercel (Web Frontend) |

---

## 📡 API Reference

| Method | Endpoint | Purpose | Request Payload / Response |
|---|---|---|---|
| `GET` | `/health` | Server liveness check | `{ status: "ok", service: "ibn-sina", version: "0.1.0" }` |
| `GET` | `/encounters` | List active encounters for ED tracking board | `{ encounters: [{ encounter_id, patient_name, esi_level, chief_complaint, current_node, disposition }] }` |
| `POST` | `/encounter` | Register a new patient encounter | Request: `{ raw_registration: str, vitals?: dict }`<br>Response: `{ encounter_id, status: "created" }` |
| `GET` | `/encounter/{id}` | Retrieve full encounter state and graph status | Response: `{ encounter_id, state, next, status: "interrupted" \| "complete" }` |
| `POST` | `/encounter/{id}/run` | Execute graph forward to next interrupt gate or completion | Response: `{ encounter_id, state, next, status }` |
| `POST` | `/encounter/{id}/approve` | Record clinician approval/edits and resume graph execution | Request: `{ gate: str, approved_by: str, action: "accept" \| "edit" \| "reject", edits?: dict }`<br>Response: `{ encounter_id, state, next, status }` |
| `POST` | `/upload/cxr/{id}` | Upload chest X-ray image for radiology vision node | Request: `file: UploadFile` (multipart/form-data)<br>Response: `{ encounter_id, cxr_path, status: "uploaded" }` |

---

## 💻 Local Development Setup

### Prerequisites

- Python 3.10+
- Node.js 18+ & npm
- Docker & Docker Compose (optional, for containerised run)

### 1. Clone & Set Up Environment Variables

```bash
git clone https://github.com/nour-hatem/IbnSina.git
cd IbnSina
cp .env.example .env
```

Configure your `.env` file with the required keys:

```ini
GOOGLE_API_KEY=your_google_ai_studio_key
GROQ_API_KEY=your_groq_console_key
MODEL_VISION=gemini-2.5-flash
MODEL_REASON=gemini-2.5-flash
MODEL_FAST=llama-3.3-70b-versatile
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your_supabase_service_key
SUPABASE_DB_URL=postgresql://postgres:password@db.your-project.supabase.co:5432/postgres
CORS_ORIGINS=http://localhost:3000
```

### 2. Run with Docker Compose

```bash
docker compose up --build
```

- **Frontend App**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Documentation**: http://localhost:8000/docs

---

### 3. Run Manually (Development Mode)

#### Backend (FastAPI + LangGraph)

```bash
# Create and activate virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r api/requirements.txt

# Run FastAPI dev server
uvicorn api.main:app --reload --port 8000
```

#### Frontend (Next.js 15)

```bash
cd web
npm install
npm run dev
```

---

## 🧪 Testing & Validation

### Python Unit Tests (Clinical Scoring & Graph State)

```bash
# Run pytest suite
python -m pytest
```

The test suite covers:
- **`tests/test_scores.py`**: Validates age-adjusted WHO danger signs, tachycardia/tachypnoea thresholds, and PIDS/IDSA severe CAP classifications across 19 clinical test cases.
- **`tests/test_graph.py`**: Verifies LangGraph compilation, node wiring, and state initialization.

### Frontend Linting & Type Checks

```bash
cd web
npm run lint
```

---

## 📂 Project Structure

```
IbnSina/
├── api/                        # FastAPI Backend & LangGraph State Machine
│   ├── agents/                 # Clinical agent node handlers
│   │   ├── intake.py           # Registration text parsing agent
│   │   ├── triage.py           # Vitals & ESI triage agent
│   │   ├── history.py          # Paediatric HPI & SOAP note agent
│   │   ├── orders.py           # LOINC lab & CXR ordering agent
│   │   ├── radiology.py        # Gemini vision multi-modal CXR analyzer
│   │   └── synthesis.py        # Final diagnostic & disposition agent
│   ├── clinical/               # Deterministic Python clinical algorithms
│   │   └── scores.py           # WHO danger signs & PIDS/IDSA scoring
│   ├── db.py                   # Supabase Postgres persistence & audit logs
│   ├── graph.py                # LangGraph StateGraph wiring & checkpointer
│   ├── llm.py                  # LangChain model factory (Groq & Gemini)
│   ├── main.py                 # FastAPI endpoints & CORS configuration
│   ├── schemas.py              # Pydantic data models & state schema
│   └── telemetry.py            # AgentOps tracing initialization
├── web/                        # Next.js 15 App Router Frontend
│   ├── src/
│   │   ├── app/                # Next.js routes (Encounter Board, About Page)
│   │   ├── components/         # Chakra UI clinical components
│   │   │   ├── EncounterBoard.tsx
│   │   │   ├── NewEncounterModal.tsx
│   │   │   ├── ClinicalGateApproval.tsx
│   │   │   ├── CXRUploader.tsx
│   │   │   └── EdReportView.tsx
│   │   ├── lib/                # API client, types, & state utilities
│   │   └── theme/              # Custom Chakra UI theme definitions
├── tests/                      # Automated test suite (Pytest)
├── eval/                       # Synthetic paediatric evaluation case records
├── docker-compose.yml          # Local container orchestration
└── README.md                   # Project documentation
```

---

## 📜 License

Distributed under the MIT License. See `LICENSE` for details.
