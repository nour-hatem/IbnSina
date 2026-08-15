# Ibn Sina — Paediatric ED Decision-Support System

Agentic AI system for emergency department triage and clinical decision support, scoped to paediatric patients (ages 1–5) presenting with suspected community-acquired pneumonia.

> **Research prototype. Not a medical device.** Runs on synthetic patient data only. Every AI-generated recommendation requires clinician review and approval before it takes effect. No output from this system should be used for real clinical decisions.

## Live deployment

- App: https://ibn-sina-lemon.vercel.app
- API: https://ibnsina-production.up.railway.app

## What it does

A LangGraph state machine walks a patient encounter through six stages — intake, triage, history, orders, radiology, synthesis — mirroring how a real paediatric ED visit unfolds. Two stages require explicit clinician approval before the graph continues: radiology review and final synthesis. Severity scoring (WHO paediatric danger signs, PIDS/IDSA criteria) is computed with deterministic Python functions, never by the language model, so a clinical score can never be hallucinated.

### LangGraph Encounter Workflow

1. **`intake`**: Parses free-text registration strings (`raw_registration`) into structured `patient` demographics (`full_name`, `age_months`, `sex`, `mrn`), `insurance` status, and initial `chief_complaint`.
2. **`triage`**: Evaluates vital signs against age-specific paediatric reference ranges, evaluates WHO paediatric danger signs, assigns an Emergency Severity Index (ESI levels 1–5), and identifies red flags. Contains conditional routing logic: ESI 1 (resuscitation) bypasses standard nodes directly to `synthesis`.
3. **`history`**: Synthesizes a structured paediatric HPI, medical history (PMH, family, birth, immunisations, developmental status), and initial SOAP note.
4. **`orders`**: Proposes evidence-based LOINC lab orders (CBC, CRP, procalcitonin, blood cultures, lactate) and AP chest X-ray imaging requests with clinical rationale.
5. **`radiology`** *(Human-in-the-Loop Approval Gate: `interrupt_before=["radiology"]`)*: Accepts uploaded chest X-ray images (`cxr_image_path`) and uses Gemini 2.5 Flash vision inference to generate narrative radiological findings and explicit limitation disclaimers.
6. **`synthesis`** *(Human-in-the-Loop Approval Gate: `interrupt_before=["synthesis"]`)*: Aggregates accumulated encounter data (vitals, HPI, labs, CXR report) to generate a differential diagnosis, PIDS/IDSA severity score, and disposition recommendation (`admit_ward`, `admit_picu`, `discharge`).

## Architecture

- **Backend**: FastAPI + LangGraph, deployed on Railway via Docker
- **Frontend**: Next.js (App Router) + TypeScript + Tailwind, deployed on Vercel
- **Database**: Supabase (Postgres) for encounter state and audit logging
- **Inference**: Groq (Llama 3.3 70B) for text agents, Gemini 2.5 Flash for chest X-ray reading and final synthesis — free-tier only, zero paid inference

## API Reference

| Method | Endpoint | Purpose | Key Request / Response Fields |
|---|---|---|---|
| `GET` | `/health` | Server liveness check | Response: `{ status, service, version }` |
| `GET` | `/encounters` | List active encounters for board tracking | Response: `{ encounters: [{ encounter_id, patient_name, esi_level, chief_complaint, current_node, disposition }] }` |
| `POST` | `/encounter` | Register a new patient encounter | Request: `{ raw_registration, vitals? }`<br>Response: `{ encounter_id, status: "created" }` |
| `GET` | `/encounter/{id}` | Retrieve full encounter state and graph status | Response: `{ encounter_id, state, next, status: "interrupted" \| "complete" }` |
| `POST` | `/encounter/{id}/run` | Execute graph forward to next interrupt gate or completion | Response: `{ encounter_id, state, next, status }` |
| `POST` | `/encounter/{id}/approve` | Record clinician gate approval/edits and resume execution | Request: `{ gate, approved_by, action, edits? }`<br>Response: `{ encounter_id, state, next, status }` |
| `POST` | `/upload/cxr/{id}` | Upload chest X-ray image for radiology node | Request: `file: UploadFile` (multipart/form-data)<br>Response: `{ encounter_id, cxr_path, status: "uploaded" }` |

## Local development

Requires Docker and a `.env` file (see `.env.example` for required keys).

```bash
docker compose up
```

- API: http://localhost:8000
- Web: http://localhost:3000

### Environment variables

| Variable | Description | Source / Obtain From |
|---|---|---|
| `GOOGLE_API_KEY` | API key for Gemini 2.5 Flash (vision CXR reading & synthesis) | [Google AI Studio](https://aistudio.google.com/apikey) |
| `GROQ_API_KEY` | API key for fast text LLM inference (`llama-3.3-70b-versatile`) | [Groq Console](https://console.groq.com/keys) |
| `MODEL_VISION` | Vision model identifier (`gemini-3.6-flash`) | Project default |
| `MODEL_REASON` | Clinical reasoning model identifier (`gemini-3.6-flash`) | Project default |
| `MODEL_FAST` | Fast text model identifier (`llama-3.3-70b-versatile`) | Project default |
| `SUPABASE_URL` | Supabase project URL (`https://<project>.supabase.co`) | Supabase Project Settings → API |
| `SUPABASE_SERVICE_KEY` | Supabase service role key for backend state persistence | Supabase Project Settings → API |
| `AGENTOPS_API_KEY` | Telemetry API key for agent execution tracking | [AgentOps Console](https://agentops.ai) |
| `LANGCHAIN_TRACING_V2` | Toggle for LangChain V2 tracing (`true` / `false`) | Optional debugging flag |
| `CORS_ORIGINS` | Comma-separated allowed origin URLs for CORS | Local/Production origin URLs |

## Project status

Backend agent pipeline and clinical scoring are complete and tested. Frontend is in active development — encounter board and intake form are live; clinician approval and diagnostic report views are in progress.

## Safety design

- Every clinical score (severity, disposition) is computed by pure Python, not the LLM
- The graph cannot proceed past radiology or synthesis without an explicit clinician approval event
- Every agent proposal and every human decision is written to an audit log
- The chest X-ray reader is framed as a narrative assistant to a radiologist, not a diagnostic classifier, and is required to state its own limitations on every read
