# ابن سينا · Ibn Sina — Emergency Department Expert Automation & Decision-Support System
## Implementation Plan (Hackathon MVP → 60 minutes, then roadmap)

> **Ibn Sina** (Avicenna, 980–1037) wrote *Al-Qānūn fī al-Ṭibb* — The Canon of Medicine — the text that
> systematised clinical medicine into an ordered process of history, examination, evidence, and reasoned
> conclusion, and remained the standard reference for six centuries. That is precisely what this system does:
> it does not replace the physician's judgement, it structures the path to it. **Use this in the pitch** — the
> name is not decoration, it is the thesis.

**Repository:** `github.com/nour-hatem/IbnSina`
**Author role:** Medical AI / Biomedical Automation Engineering
**Date:** 2026-08-13
**Team size:** ≤ 4
**Clinical focus (MVP):** Community-acquired pneumonia (CAP), chest X-ray pathway
**Autonomy model:** Recommend-only — every agent output is a *suggestion* a clinician accepts / edits / rejects
**Audience:** Hackathon / competition demo
**Cost constraint:** **Zero paid APIs.** Every component runs on a free tier or locally — see Section 3.5.

> ⚠️ **REGULATORY BANNER — must appear in the UI, the README, and the demo slide.**
> Ibn Sina is a research prototype running on **synthetic patient data**. It is **not** a medical device,
> is **not** CE/FDA cleared, and must **never** be used for real clinical decisions. The chest X-ray reader is a
> general-purpose vision-language model used as a *narrative assistant*, **not a validated pneumonia classifier**.
> All outputs require licensed-clinician review.
>
> 🔒 **Free-tier data policy — read this before you upload anything.** Google's Gemini free tier states that
> submitted data **may be used to improve Google's products**; the same is broadly true of other free
> inference tiers. This is legally incompatible with real patient data under GDPR/HIPAA and any hospital DPA.
> **On free tiers, synthetic data only — no exceptions, not even "just to test."** Real-PHI operation requires
> a paid tier with a zero-retention agreement or fully local inference (Section 3.5, Fallback D).

---

## 1. Reality check on the 60-minute constraint

The requested scope (5+ agents, Supabase, Docker, Render + Vercel, GitHub sync, AgentOps eval) is a **2–3 day build** done cold. It becomes a 60-minute build under three conditions:

1. **Deploy the skeleton first, features second.** A live URL at T+10 with a stub graph beats a perfect local graph at T+60 that has never been deployed. Deployment is the highest-variance task; do it while it's cheap to debug.
2. **Pre-flight everything that isn't code** (Section 10.0). Accounts, keys, and empty repos are created *before* the clock starts. This is not cheating; it's what a real team does.
3. **Three parallel tracks, hard interface contract.** The `PatientEncounter` state schema (Section 5) is frozen at T+5 and never renegotiated. Tracks integrate against the schema, not against each other.

**Cut-list, in the order things get dropped if you fall behind** (decided *now*, not at T+50):

| Order | Cut | Why it's safe to cut |
|---|---|---|
| 1 | AgentOps + CrewAI eval harness | Replace with a `demo_traces.json` file + one screenshot. Judges see evidence, not live telemetry. |
| 2 | Supabase persistence | Fall back to in-memory `dict` + LangGraph `MemorySaver`. Demo works identically for a single encounter. |
| 3 | Vercel frontend | Serve the UI from FastAPI's `StaticFiles` on Render. One deploy target instead of two. |
| 4 | Critic/Safety agent as a separate node | Fold its checks into the Synthesis agent's prompt. |
| 5 | Lab Interpretation as a separate node | Merge into Synthesis. |

**Never cut:** the CXR VLM read, the disposition decision with an explicit severity score, and the clinician-approval gate. Those three *are* the demo.

---

## 2. Clinical workflow → system mapping

The real ED journey you described, and what automates each step:

| # | Real-world step | Actor today | Ibn Sina node | Human gate |
|---|---|---|---|---|
| 1 | Registration: insurance, demographics, chief complaint | Receptionist | `intake_agent` | Receptionist confirms |
| 2 | Triage: vitals, acuity assignment | Triage nurse | `triage_agent` (ESI 1–5) | Nurse confirms ESI |
| 3 | Clerking: HPI, PMH, drug hx, allergies, family hx, prior surgery | ED physician | `history_agent` | Doctor edits SOAP note |
| 4 | Working differential | ED physician | `differential_agent` | Doctor reviews ranked DDx |
| 5 | Order labs + imaging | ED physician | `orders_agent` | **Doctor signs orders** |
| 6 | Radiology read (CXR) | Radiologist | `radiology_agent` (VLM) | Radiologist/doctor overrides |
| 7 | Lab result interpretation | ED physician | `lab_agent` | Doctor reviews flags |
| 8 | Final diagnosis + ED report | ED physician | `synthesis_agent` | **Doctor signs report** |
| 9 | Disposition: admit / observe / discharge to clinic | ED physician | `disposition_agent` (CURB-65 + IDSA/ATS) | **Doctor signs disposition** |

Bolded gates are hard stops in the graph — the LangGraph run **interrupts** and cannot proceed without an approval event. This is the single most important architectural property for clinical credibility, and it is 6 lines of code (`interrupt_before=[...]`).

**Where the value actually is (say this to judges):** not "AI diagnoses pneumonia" — that's a solved and unimpressive claim. The value is **door-to-decision time**. A CAP patient in a typical ED waits on a serial chain: clerking → order entry → lab turnaround → radiology queue → physician re-review → disposition. Ibn Sina collapses the *coordination* latency: orders are drafted the moment the history is structured, the CXR narrative is ready before the physician re-opens the chart, and the disposition score is pre-computed with the evidence attached. Target metric: **median door-to-disposition, minutes.**

---

## 3. Architecture

```
                        ┌───────────────────────────────────────┐
   Browser (Next.js /   │        FastAPI  (Render, Docker)      │
   Streamlit, Vercel)   │                                       │
        │  REST/SSE     │  /encounter          POST  create     │
        ├──────────────►│  /encounter/{id}/run POST  step graph │
        │               │  /encounter/{id}/approve  POST  gate  │
        │               │  /encounter/{id}     GET   state      │
        │               │  /upload/cxr         POST  image      │
        │               └──────────────┬────────────────────────┘
        │                              │
        │                    ┌─────────▼──────────┐
        │                    │   LangGraph app    │
        │                    │  StateGraph over   │
        │                    │  PatientEncounter  │
        │                    └─────────┬──────────┘
        │                              │
        │        ┌─────────────────────┼─────────────────────┐
        │        │                     │                     │
        │  ┌─────▼──────┐     ┌────────▼────────┐   ┌────────▼────────┐
        │  │ Groq llama │     │ LangMem store   │   │ AgentOps        │
        │  │ Gemini VLM │     │ (episodic +     │   │ (traces, quota, │
        │  └────────────┘     │  local embeds)  │   │  latency)       │
        │                     └────────┬────────┘   └─────────────────┘
        │                              │
        │                    ┌─────────▼──────────┐
        └───────────────────►│ Supabase (Postgres │
                             │  + Storage + RLS)  │
                             └────────────────────┘
```

**Stack decisions and the reasoning:**

| Concern | Choice | Why this over the alternative |
|---|---|---|
| Orchestration | **LangGraph** `StateGraph` | Explicit nodes/edges + `interrupt_before` gives auditable, resumable, human-gated flow. CrewAI's role-play autonomy is the wrong shape for a clinical pathway where the sequence is *fixed by protocol*. |
| Agent primitives | **LangChain** LCEL + structured output | Pydantic-validated outputs; no free-text parsing of clinical data. |
| Memory | **LangMem** | Episodic (this encounter) + semantic (patient's prior visits, "had a lobectomy 2019"). This is what makes the history agent look smart in the demo. |
| CXR reading | **Gemini 2.5 / 3 Flash vision** (Google AI Studio free tier) with a constrained radiology prompt | The only *genuinely free* API with production-grade vision. Zero ML infra, zero training time. **Explicitly framed as narrative assistance, not classification.** |
| Eval | **AgentOps** (runtime) + **CrewAI** eval crew (offline judge) | AgentOps = ops telemetry. CrewAI = a small adversarial "clinical reviewer crew" that scores transcripts. Two different jobs; use both, don't conflate. |
| DB | **Supabase** Postgres + Storage + RLS | Managed Postgres, built-in object storage for DICOM/PNG, row-level security maps cleanly to per-encounter access. |
| Deploy | **Render** (Docker, API) + **Vercel** (frontend) | Render runs long-lived Python containers; Vercel is best-in-class for the Next.js edge. Both auto-deploy from GitHub — that *is* your "synchronization". |

---

## 3.5 Free-API strategy — **zero paid services, whole stack**

Every provider below is free at the volume this project needs. Limits verified August 2026; re-check before demo day, free tiers move.

### Inference providers

| Provider | Free limits | Vision? | Use in Ibn Sina |
|---|---|---|---|
| **Google AI Studio (Gemini)** | Gemini 2.5 Flash **15 RPM / 1,500 RPD**; Gemini 3 Flash 10 RPM / 1,500 RPD; Flash-Lite 30 RPM. 1M-token context. No card. | ✅ **Yes** | **Primary.** The CXR reader (vision) + synthesis + disposition. |
| **Groq** | **30 RPM / 14,400 RPD**, 6,000 TPM. Every model, no credit system, no card. Llama 4 Maverick is halved (15 RPM / 500 RPD). | Limited (Llama 4 Scout) | **Workhorse** for the text agents: intake, triage, history, orders. LPU latency is sub-second — it *makes* the door-to-decision story. |
| **OpenRouter** | 20 RPM, **50 RPD** free (→1,000/day permanently after a one-time $10). 28+ free models. | Some | **Fallback only.** 50/day is too thin to build on. |
| **Ollama (local)** — *Fallback D* | Unlimited, offline | LLaVA / Qwen-VL | **Demo insurance**, and the only free path that keeps data on-premise. No network, no quota, no outage, no third-party training on your inputs. |

> ⚠️ **Pro models left the Gemini free tier on 1 April 2026** — free access is **Flash and Flash-Lite only**. Any tutorial telling you to call `gemini-pro` for free is stale. Write Flash into the config from the first commit.

### Routing

| Node | Provider | Model | Why |
|---|---|---|---|
| `intake`, `triage`, `history`, `orders` | Groq | `llama-3.3-70b-versatile` | 14,400 RPD absorbs all iteration; schema-bound work needs speed, not brilliance |
| `radiology` | Gemini | `gemini-2.5-flash` | **Only free vision worth showing.** Non-negotiable |
| `synthesis`, `disposition` | Gemini | `gemini-2.5-flash` | Long context holds the whole encounter; strongest free reasoning |
| Redaction / summarisation for memory | Groq | `llama-3.1-8b-instant` | Cheap, high-volume, trivial task |
| Embeddings (LangMem) | **Local** | `sentence-transformers/all-MiniLM-L6-v2` | Runs on CPU. **No API, no quota, no rate limit** — do not spend a paid or rate-limited call on embeddings |

### The quota budget — do this arithmetic before you build

One encounter = **6 LLM calls** (4 Groq + 2 Gemini).

- Gemini: 1,500 RPD ÷ 2 = **750 encounters/day**. Not the constraint.
- Gemini **15 RPM ÷ 2 = 7 encounters/minute** ← **this is the binding limit.**
- Groq: 14,400 RPD ÷ 4 = 3,600 encounters/day. Never the constraint.

**The real failure mode is not the daily cap — it is three developers hammering the same key during integration testing at T+30 and tripping 15 RPM simultaneously.** Mitigations, in priority order:

1. **One key per developer.** Three Google accounts, three keys in three `.env` files. Free, takes 2 minutes, removes the problem entirely. Do this in pre-flight.
2. **Cache aggressively.** Hash the prompt + image bytes → cache the response to disk. Re-running the same test case must cost **zero** calls. This alone cuts integration-phase usage by ~80%.
3. **Exponential backoff + provider fallback**, wired once in `llm.py` and used by every node.

```python
# api/llm.py — the single choke point every agent calls. Written once, at T+5.
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_groq import ChatGroq

def get_llm(task: str):
    """task: 'fast' | 'reason' | 'vision'. Never construct a model client anywhere else."""
    if task == "vision":
        return ChatGoogleGenerativeAI(model="gemini-2.5-flash", temperature=0.1)
    if task == "reason":
        return ChatGoogleGenerativeAI(model="gemini-2.5-flash", temperature=0.2).with_fallbacks(
            [ChatGroq(model="llama-3.3-70b-versatile", temperature=0.2)]
        )
    return ChatGroq(model="llama-3.3-70b-versatile", temperature=0.1).with_fallbacks(
        [ChatGoogleGenerativeAI(model="gemini-2.5-flash-lite", temperature=0.1)]
    )
```

`.with_fallbacks()` is LangChain-native — a 429 on Groq silently reroutes to Gemini mid-demo and nobody in the audience notices. **This is the highest value-per-line code in the project.**

### Everything else, also free

| Service | Free tier | Watch out for |
|---|---|---|
| Supabase | 500 MB DB, 1 GB storage, unlimited API | **Pauses after 7 days idle** — poke it the morning of the demo |
| Render | 750 h/month web service | **Spins down after 15 min idle**; ~50 s cold start |
| Vercel | Hobby: unlimited static, 100 GB bandwidth | Non-commercial only |
| GitHub | Unlimited public repos + Actions | Fine |
| AgentOps | Free developer tier | Trace retention capped |
| CrewAI | Open source (`pip install crewai`) | Free unless you use their hosted product |
| LangGraph / LangChain / LangMem | Open source | LangSmith tracing is a *separate paid* product — leave `LANGCHAIN_TRACING_V2=false` |

**Total monthly cost: $0.** Say that number out loud to judges — "runs entirely on free tiers" is a real engineering result for a hospital-facing prototype, and it means a resource-limited department could actually pilot it.

---

---

## 4. Agent roster

### 4.1 MVP graph (6 nodes — build this in the hour)

```python
graph = StateGraph(PatientEncounter)
graph.add_node("intake",       intake_agent)        # groq  llama-3.3-70b
graph.add_node("triage",       triage_agent)        # groq  -> ESI 1-5
graph.add_node("history",      history_agent)       # groq  -> SOAP
graph.add_node("orders",       orders_agent)        # groq  -> lab + imaging panel
graph.add_node("radiology",    radiology_agent)     # gemini-2.5-flash (VISION)
graph.add_node("synthesis",    synthesis_agent)     # gemini-2.5-flash -> dx + report + disposition

graph.set_entry_point("intake")
graph.add_edge("intake", "triage")
graph.add_conditional_edges("triage", esi_router, {
    "resuscitation": "synthesis",   # ESI 1-2: bypass to immediate escalation
    "standard":      "history",
})
graph.add_edge("history", "orders")
graph.add_edge("orders", "radiology")
graph.add_edge("radiology", "synthesis")
graph.add_edge("synthesis", END)

app = graph.compile(
    checkpointer=checkpointer,
    interrupt_before=["radiology", "synthesis"],   # doctor signs orders; doctor signs report
)
```

### 4.2 Full graph (post-MVP — 11 nodes)

Adds `differential_agent`, `lab_agent`, `critic_agent` (guardrail: contraindication + hallucination + citation check), `disposition_agent` split out from synthesis, and a `supervisor` router for re-entry when new results arrive.

### 4.3 Node contracts

Every node obeys the same contract — this is what lets three people build in parallel without talking:

```
def node(state: PatientEncounter) -> dict:
    """Reads only the fields it declares. Returns ONLY a partial dict of fields it owns.
       Never mutates state in place. Never raises — on failure returns
       {"errors": [...], "<own_field>": None} so the graph can continue degraded."""
```

| Node | Reads | Owns (writes) | `get_llm()` task |
|---|---|---|---|
| `intake` | `raw_registration` | `patient`, `insurance`, `chief_complaint` | `fast` |
| `triage` | `patient`, `chief_complaint`, `vitals` | `esi_level`, `red_flags` | `fast` |
| `history` | `patient`, `chief_complaint` | `hpi`, `pmh`, `medications`, `allergies`, `family_hx`, `surgical_hx`, `soap_note` | `fast` |
| `orders` | everything clinical | `lab_orders`, `imaging_orders`, `order_rationale` | `fast` |
| `radiology` | `imaging_orders`, `cxr_image_url` | `cxr_findings`, `cxr_impression`, `cxr_confidence` | **`vision`** |
| `synthesis` | all | `differential`, `final_diagnosis`, `severity_scores`, `disposition`, `ed_report_md` | **`reason`** |

---

## 5. State schema — **FROZEN AT T+5, NON-NEGOTIABLE**

`app/schemas.py` — this file is written first and committed before anyone writes an agent.

```python
from typing import Annotated, Literal, Optional
from pydantic import BaseModel, Field
from operator import add

class Patient(BaseModel):
    mrn: str
    full_name: str
    age: int
    sex: Literal["male", "female", "other"]
    national_id_redacted: str = Field(description="last 4 digits only")
    phone: Optional[str] = None

class Insurance(BaseModel):
    provider: Optional[str] = None
    policy_number: Optional[str] = None
    coverage_status: Literal["active", "expired", "unknown", "self_pay"] = "unknown"
    copay_estimate_egp: Optional[float] = None

class Vitals(BaseModel):
    temp_c: Optional[float] = None
    hr: Optional[int] = None
    rr: Optional[int] = None
    sbp: Optional[int] = None
    dbp: Optional[int] = None
    spo2: Optional[int] = None          # room air unless o2_supplement set
    o2_supplement: Optional[str] = None
    gcs: Optional[int] = 15
    confusion: bool = False             # AMT<=8 or new disorientation -> CURB-65 'C'

class LabOrder(BaseModel):
    code: str                            # LOINC where known
    name: str
    priority: Literal["stat", "routine"] = "routine"
    rationale: str
    result_value: Optional[str] = None
    result_flag: Optional[Literal["low", "normal", "high", "critical"]] = None

class ImagingOrder(BaseModel):
    modality: Literal["CXR", "CT", "US"]
    view: str = "PA and lateral"
    rationale: str
    urgency: Literal["stat", "routine"] = "stat"

class CXRRead(BaseModel):
    findings: list[str]
    impression: str
    pneumonia_likelihood: Literal["low", "intermediate", "high"]
    laterality: Optional[Literal["right", "left", "bilateral", "none"]] = None
    multilobar: bool = False
    pleural_effusion: bool = False
    confidence: float = Field(ge=0, le=1)
    limitations: str                     # forces the model to state uncertainty
    model_used: str

class SeverityScores(BaseModel):
    curb65: Optional[int] = None
    curb65_components: dict[str, bool] = {}
    qsofa: Optional[int] = None
    idsa_ats_severe: Optional[bool] = None
    psi_class: Optional[str] = None

class DifferentialItem(BaseModel):
    diagnosis: str
    icd10: Optional[str] = None
    likelihood: Literal["high", "moderate", "low"]
    supporting_evidence: list[str]
    refuting_evidence: list[str]
    cannot_miss: bool = False            # ACS, PE, aortic dissection, etc.

class Disposition(BaseModel):
    decision: Literal["discharge_home", "outpatient_clinic", "observation",
                      "admit_ward", "admit_icu"]
    clinic_referral: Optional[str] = None       # e.g. "Pulmonology"
    rationale: str
    score_basis: str                            # "CURB-65 = 2"
    follow_up_days: Optional[int] = None
    return_precautions: list[str] = []

class Approval(BaseModel):
    gate: str
    approved_by: str
    approved_at: str
    action: Literal["accept", "edit", "reject"]
    edits: Optional[dict] = None

class PatientEncounter(BaseModel):
    encounter_id: str
    raw_registration: Optional[str] = None
    patient: Optional[Patient] = None
    insurance: Optional[Insurance] = None
    chief_complaint: Optional[str] = None
    vitals: Optional[Vitals] = None
    esi_level: Optional[int] = None
    red_flags: list[str] = []
    hpi: Optional[str] = None
    pmh: list[str] = []
    medications: list[str] = []
    allergies: list[str] = []
    family_hx: list[str] = []
    surgical_hx: list[str] = []
    soap_note: Optional[str] = None
    lab_orders: list[LabOrder] = []
    imaging_orders: list[ImagingOrder] = []
    cxr_image_url: Optional[str] = None
    cxr_read: Optional[CXRRead] = None
    differential: list[DifferentialItem] = []
    final_diagnosis: Optional[str] = None
    severity_scores: Optional[SeverityScores] = None
    disposition: Optional[Disposition] = None
    ed_report_md: Optional[str] = None
    approvals: Annotated[list[Approval], add] = []
    errors: Annotated[list[str], add] = []
```

---

## 6. Clinical core — pneumonia (this is the domain content, get it right)

### 6.1 Laboratory workup for suspected CAP

**Tier 1 — order on every suspected pneumonia (the MVP's default panel):**

| Test | LOINC | What it decides |
|---|---|---|
| CBC with differential | 58410-2 | Leukocytosis / left shift (bacterial); **leukopenia < 4,000** is an IDSA/ATS *severe* minor criterion; thrombocytopenia < 100k likewise |
| CRP | 1988-5 | Inflammatory burden; serial trend guides response to therapy |
| **Procalcitonin** | 33959-8 | Bacterial vs viral discrimination; supports antibiotic stewardship (do **not** use alone to withhold antibiotics in severe CAP) |
| Basic metabolic panel (Na, K, Cl, HCO₃, **BUN**, Cr, glucose) | 51990-0 | **BUN ≥ 19 mg/dL (urea > 7 mmol/L) is the "U" in CURB-65**; renal function drives antibiotic dosing |
| Lactate, venous | 2524-7 | Sepsis screen; ≥ 2 mmol/L triggers sepsis bundle |
| Pulse oximetry ± ABG/VBG | 2708-6 / 2703-7 | SpO₂ < 92% RA → admission trigger; **PaO₂/FiO₂ ≤ 250** is a severe-CAP minor criterion |
| Blood glucose | 2345-7 | Hyperglycemia, DKA precipitant |

**Tier 2 — moderate-to-severe, or planned admission:**

| Test | Trigger |
|---|---|
| Blood cultures × 2 sets, **before antibiotics** | Severe CAP, ICU, immunocompromise, cavitary infiltrate |
| Sputum Gram stain + culture | Productive cough + admission; ICU-bound patients |
| *Streptococcus pneumoniae* urinary antigen | Severe CAP |
| *Legionella* urinary antigen | Severe CAP, outbreak, recent travel |
| Respiratory viral PCR panel (influenza A/B, RSV, SARS-CoV-2) | Seasonal / always in current practice |
| LFTs (AST, ALT, bilirubin, albumin) | Baseline before hepatically-cleared antibiotics; albumin in PSI |
| Coagulation (PT/INR, aPTT) | Pre-admission baseline, sepsis/DIC concern |
| HIV screening | Per local guidance; opportunistic-pathogen risk |
| Magnesium, phosphate | ICU admissions |
| Troponin, BNP | When cardiac cause competes with CAP on the differential |

**Time-critical sequencing the `orders_agent` must respect:**
1. Lactate + blood cultures **before** the first antibiotic dose.
2. Antibiotics within **1 hour** if septic shock; within **4 hours** of ED arrival for CAP generally.
3. CXR should not delay antibiotics in a hypotensive patient.

### 6.2 Imaging

- **PA + lateral chest radiograph** is the ED standard for suspected CAP. Portable AP if the patient cannot stand — the agent must record that AP films exaggerate cardiac silhouette and degrade sensitivity.
- **CT chest** if the CXR is negative but suspicion is high, or for complication (empyema, abscess, cavitation, suspected malignancy).
- **Lung ultrasound** as adjunct — higher sensitivity than CXR for consolidation in trained hands.

### 6.3 Severity scoring — the disposition engine

Implement these as **deterministic Python functions, not LLM prompts.** Score arithmetic must never be hallucinated. The LLM explains the score; it does not compute it.

```python
def curb65(v: Vitals, bun_mg_dl: float | None, age: int) -> tuple[int, dict]:
    c = {
        "confusion": v.confusion or (v.gcs is not None and v.gcs < 15),
        "urea_high":  bun_mg_dl is not None and bun_mg_dl >= 19,   # urea > 7 mmol/L
        "rr_ge_30":   v.rr is not None and v.rr >= 30,
        "low_bp":     (v.sbp is not None and v.sbp < 90) or (v.dbp is not None and v.dbp <= 60),
        "age_ge_65":  age >= 65,
    }
    return sum(c.values()), c
```

| CURB-65 | 30-day mortality (approx.) | Recommended disposition |
|---|---|---|
| 0–1 | ~1.5% | **Outpatient** — discharge with oral antibiotics, pulmonology/chest clinic follow-up |
| 2 | ~9% | **Observation unit or ward admission** |
| 3–5 | 15–40% | **Ward with ICU assessment; ≥ 4 → ICU** |

**qSOFA** (≥ 2 → high risk of poor outcome): RR ≥ 22, altered mentation, SBP ≤ 100.

**IDSA/ATS severe CAP** — ICU admission if **1 major** or **≥ 3 minor**:
- *Major:* mechanical ventilation; septic shock requiring vasopressors.
- *Minor:* RR ≥ 30 · PaO₂/FiO₂ ≤ 250 · multilobar infiltrates · confusion · BUN ≥ 20 mg/dL · WBC < 4,000 · platelets < 100,000 · temp < 36 °C · hypotension requiring aggressive fluid resuscitation.

**Override rules the score cannot capture** (the `disposition_agent` must apply these *on top of* CURB-65 — this nuance is what separates a real clinical tool from a calculator):
- SpO₂ < 92% on room air → admit regardless of score.
- Inability to tolerate oral intake / oral antibiotics → admit.
- Failed outpatient antibiotic therapy → admit.
- Significant comorbidity (decompensated CHF, COPD, CKD, immunosuppression, active malignancy) → lower the admission threshold.
- Social factors — homelessness, no caregiver, unreliable follow-up → admit. **CURB-65 systematically under-triages the young:** a 30-year-old scores ≤ 1 almost regardless of how sick they look.

### 6.4 The CXR VLM prompt (the highest-risk component — constrain it hard)

```
You are assisting a radiologist by drafting a STRUCTURED PRELIMINARY read of a chest
radiograph. You are NOT a diagnostic device and your output is NOT a final report.

Rules — violating any of these is a failure:
1. Describe ONLY what is visible. Never infer clinical history from the image.
2. If image quality limits interpretation (rotation, penetration, AP projection,
   incomplete inspiration, motion), you MUST state it in `limitations`.
3. Never output a numeric probability. Use ONLY: low / intermediate / high.
4. If you cannot see a finding clearly, say so. Absence of a statement is not
   evidence of absence.
5. Always report the following search pattern explicitly:
   airway/trachea · lung fields (zone by zone) · pleura/costophrenic angles ·
   cardiac silhouette & mediastinum · bones · soft tissue · lines/tubes/devices.
6. Flag any CRITICAL finding immediately in findings[0]: pneumothorax,
   pneumoperitoneum, malpositioned tube/line, large effusion, suspected mass.

Return JSON matching the CXRRead schema.
```

**Structured self-check at demo time:** run the same image twice and show the outputs are consistent. Judges will ask about reliability; showing you *measured* it is worth more than claiming it.

---

## 7. Data model — Supabase

```sql
-- Run in the Supabase SQL editor. ~2 minutes.
create table patients (
  mrn text primary key,
  full_name text not null,
  age int not null,
  sex text not null,
  phone text,
  created_at timestamptz default now()
);

create table encounters (
  id uuid primary key default gen_random_uuid(),
  mrn text references patients(mrn),
  arrival_at timestamptz default now(),
  chief_complaint text,
  esi_level int,
  status text default 'in_progress',      -- in_progress | awaiting_approval | closed
  state jsonb not null default '{}'::jsonb,   -- full PatientEncounter blob
  updated_at timestamptz default now()
);

create table orders (
  id uuid primary key default gen_random_uuid(),
  encounter_id uuid references encounters(id) on delete cascade,
  kind text not null,                      -- lab | imaging
  code text, name text, priority text, rationale text,
  result_value text, result_flag text,
  signed_by text, signed_at timestamptz
);

create table imaging_studies (
  id uuid primary key default gen_random_uuid(),
  encounter_id uuid references encounters(id) on delete cascade,
  modality text, storage_path text,        -- Supabase Storage object key
  ai_read jsonb, radiologist_read jsonb,
  created_at timestamptz default now()
);

create table audit_log (
  id bigserial primary key,
  encounter_id uuid,
  actor text not null,                     -- 'agent:radiology' | 'user:dr_ahmed'
  action text not null,                    -- proposed | approved | edited | rejected
  node text, payload jsonb,
  at timestamptz default now()
);
create index on audit_log (encounter_id, at desc);

-- Storage bucket for chest films
insert into storage.buckets (id, name, public) values ('cxr', 'cxr', false)
  on conflict do nothing;
```

> **`audit_log` is not optional.** Every agent proposal and every human approval writes a row. This table *is* your safety argument, your evaluation dataset, and your best demo slide. Write to it from a single helper so no node can forget.

**RLS note:** for the hackathon, use the service-role key server-side only and leave RLS permissive. Say out loud in the demo that production requires per-clinician RLS policies keyed to encounter assignment — knowing the gap is worth more than pretending it isn't there.

---

## 8. Repository layout

```
IbnSina/
├── README.md                    # regulatory banner at the top
├── docker-compose.yml           # api + local supabase (optional)
├── .env.example
├── .github/workflows/ci.yml     # ruff + pytest + docker build
├── api/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── main.py                  # FastAPI, CORS, routes, static mount
│   ├── schemas.py               # ← FROZEN CONTRACT (Section 5)
│   ├── graph.py                 # LangGraph wiring + checkpointer
│   ├── agents/
│   │   ├── intake.py  triage.py  history.py
│   │   ├── orders.py  radiology.py  synthesis.py
│   ├── clinical/
│   │   ├── scores.py            # curb65, qsofa, idsa_ats  (pure, unit-tested)
│   │   ├── panels.py            # CAP lab panel definitions (Section 6.1)
│   │   └── rules.py             # disposition override rules (Section 6.3)
│   ├── llm.py                   # ← SINGLE provider router + fallbacks + cache (Section 3.5)
│   ├── memory.py                # LangMem store wiring (local embeddings)
│   ├── db.py                    # Supabase client + audit_log helper
│   └── telemetry.py             # AgentOps init
├── web/                         # Next.js on Vercel  (or streamlit_app.py)
│   └── app/page.tsx             # encounter board + approval buttons
├── eval/
│   ├── cases/                   # synthetic encounters, incl. 3 CAP + 2 distractors
│   ├── crew_reviewer.py         # CrewAI clinical-reviewer crew
│   └── rubric.md
└── tests/test_scores.py         # CURB-65 truth table — MUST pass in CI
```

---

## 9. The 60-minute build — three parallel tracks

**Roles:** **A** = backend/graph · **B** = agents/clinical · **C** = frontend/deploy/data.
If you're 2 people: A absorbs B's node work, C stays whole. If you're 4, D takes eval + demo script + slides from T+20.

### T-15 → T-0: pre-flight (before the clock)
- [ ] GitHub repo created, all three cloned, `main` branch protected off.
- [ ] **A Google AI Studio key AND a Groq key per developer** (`aistudio.google.com/apikey`, `console.groq.com/keys`). Both free, no card. Separate keys = separate rate limits.
- [ ] Supabase project (URL + service key), AgentOps key, Render + Vercel accounts linked to GitHub.
- [ ] **Smoke-test both keys before T+0** — one text call to Groq, one image call to Gemini. A dead key discovered at T+35 costs the demo.
- [ ] *(Optional but recommended)* `ollama pull llava` on one laptop — offline fallback if conference wifi dies.
- [ ] `.env.example` committed with every key name.
- [ ] 3 synthetic CAP cases + 2 distractor cases (CHF exacerbation, PE) written as JSON. **Have real public-domain chest X-ray images downloaded to disk already.**
- [ ] `pip install -U langgraph langchain langchain-google-genai langchain-groq langmem fastapi uvicorn python-multipart supabase agentops pydantic sentence-transformers` verified on each machine.

### T+0 → T+10 · Skeleton and **deploy immediately**
| Who | Task |
|---|---|
| A | `schemas.py` written and pushed. **Announce "schema frozen" in chat.** Everyone pulls. |
| A | `main.py` with `GET /health` and a stub `POST /encounter` returning an empty `PatientEncounter`. |
| C | `Dockerfile` (python:3.12-slim, `uvicorn main:app --host 0.0.0.0 --port $PORT`), push, **connect Render, trigger first deploy.** |
| B | `clinical/scores.py` + `tests/test_scores.py` — CURB-65 truth table. Pure functions, no LLM, no dependencies. |

**Gate at T+10: the Render URL returns `{"status":"ok"}`.** If it doesn't, C stops all other work until it does. A red deploy at T+10 is a scheduling problem; at T+50 it's a failed demo.

### T+10 → T+30 · Agents in parallel
| Who | Task |
|---|---|
| A | `graph.py`: 6 nodes wired, `MemorySaver` checkpointer, `interrupt_before=["radiology","synthesis"]`. Nodes start as pass-through stubs so the graph runs end-to-end from minute 12. |
| A | Routes: `/encounter/{id}/run`, `/approve`, `GET /encounter/{id}`, `POST /upload/cxr`. |
| B | `intake`, `triage`, `history` agents — structured output against the frozen schema. |
| B | `orders` agent seeded from `clinical/panels.py` (do **not** let the LLM invent the lab panel; it *selects* from and justifies the curated panel). |
| C | Frontend: encounter board, JSON state view, three approve buttons, image upload. **Ugly is fine. Working is not optional.** |
| C | Push to Vercel, point `NEXT_PUBLIC_API_URL` at Render. |

### T+30 → T+45 · The two agents that carry the demo
| Who | Task |
|---|---|
| B | `radiology` agent — **Gemini 2.5 Flash vision**, constrained prompt (6.4), `CXRRead` output. Test against your pre-downloaded images. **Cache every successful read to disk immediately.** |
| B | `synthesis` agent — differential + final dx + calls `scores.py` (never computes scores itself) + disposition + markdown ED report. |
| A | Supabase persistence: write `state` jsonb on every node, write `audit_log` on every proposal/approval. |
| A | AgentOps `init()` + session per encounter. |
| C | Approval UX: accept / edit / reject writes back through `/approve` and resumes the graph. |

### T+45 → T+55 · Integrate, seed, rehearse
- Run all 5 synthetic cases end-to-end on the **deployed** URL, not localhost.
- Confirm: ESI-2 case routes past history straight to escalation; CURB-65 = 1 case discharges to pulmonology clinic; CURB-65 = 3 case admits.
- Screenshot the AgentOps trace view. Save `demo_traces.json` as a fallback if the network dies.
- Seed the DB so the board isn't empty on load.

### T+55 → T+60 · Freeze
- **No code changes.** Tag `v0.1.0-mvp`. Re-run the happy path once more on the deployed URL. Charge laptops. Assign who clicks and who talks.

---

## 10. Deployment

### 10.0 `.env.example`
```
# --- Inference (all free tiers) ---
GOOGLE_API_KEY=              # aistudio.google.com/apikey  -- vision + reasoning
GROQ_API_KEY=                # console.groq.com/keys       -- fast text agents
OPENROUTER_API_KEY=          # optional third fallback
OLLAMA_BASE_URL=http://localhost:11434   # offline demo insurance

MODEL_VISION=gemini-2.5-flash
MODEL_REASON=gemini-2.5-flash
MODEL_FAST=llama-3.3-70b-versatile

# --- Data / ops (all free tiers) ---
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
AGENTOPS_API_KEY=
LANGCHAIN_TRACING_V2=false   # LangSmith is PAID - keep this false

# --- App ---
APP_ENV=demo
LLM_CACHE_DIR=.llm_cache     # prompt-hash cache; re-running a case costs 0 calls
CORS_ORIGINS=https://ibnsina.vercel.app,http://localhost:3000
```

> **Each developer uses their own `GOOGLE_API_KEY` and `GROQ_API_KEY`.** Shared keys mean shared rate limits, and three people testing at once will trip 15 RPM and waste 20 minutes debugging a "bug" that is really a 429.

### 10.1 `api/Dockerfile`
```dockerfile
FROM python:3.12-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends gcc && rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
ENV PYTHONUNBUFFERED=1
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
```

### 10.2 Render
- New → Web Service → connect the GitHub repo → **Docker** environment → root directory `api/`.
- Auto-deploy on push to `main` = your GitHub synchronization requirement, satisfied.
- Set env vars in the Render dashboard. **Free tier cold-starts after 15 min idle — hit the URL 2 minutes before you present.** This has killed more hackathon demos than any bug.
- Health check path: `/health`.

### 10.3 Vercel
- Import repo → root directory `web/` → set `NEXT_PUBLIC_API_URL` to the Render URL.
- **CORS is the classic 10-minute time sink.** Add the FastAPI middleware in the first commit, before you need it:
  ```python
  app.add_middleware(CORSMiddleware, allow_origins=os.getenv("CORS_ORIGINS","*").split(","),
                     allow_methods=["*"], allow_headers=["*"])
  ```

### 10.4 CI (`.github/workflows/ci.yml`)
`ruff check` → `pytest tests/` → `docker build`. Keep it under 60 seconds. Its real job during the hour is catching a broken import before Render does.

---

## 11. Observability and evaluation

**Two distinct systems — don't conflate them:**

**AgentOps (runtime telemetry).** `agentops.init(); agentops.start_session(tags=[encounter_id, "ED-CAP"])`. Gives per-node latency, token cost, error rate, and a replayable trace. Screenshot the trace tree — it is the most persuasive single image in your demo.

**CrewAI reviewer crew (offline judgment).** A 3-agent crew that reads completed encounter transcripts and scores them:
- `ClinicalAccuracyReviewer` — is the differential appropriate? does the final dx follow from the evidence?
- `SafetyReviewer` — were any *cannot-miss* diagnoses (ACS, PE, dissection, sepsis) dismissed without justification? were red flags acted on?
- `GuidelineComplianceReviewer` — do the orders match the CAP panel? does disposition match CURB-65 + override rules?

Each returns a 1–5 score with justification, written to `eval/results.json`.

**Metrics to actually report on your slide:**

| Metric | Target | How measured |
|---|---|---|
| Door-to-disposition (simulated) | < 20 min vs ~180 min baseline | Timestamps in `audit_log` |
| Lab panel completeness vs guideline | ≥ 95% | Diff `lab_orders` against `panels.py` |
| CURB-65 computation accuracy | **100%** | `tests/test_scores.py` — deterministic, so anything below 100% is a bug |
| Disposition concordance with clinician | Report honestly | Reviewer crew + manual label on 5 cases |
| Cannot-miss diagnosis recall | **100% on the 5 cases** | Safety reviewer |
| **Cost per encounter** | **$0.00** | Free tiers only — state this explicitly on the slide |
| LLM calls per encounter | ≤ 6 | AgentOps span count |
| Cache hit rate during testing | > 70% | `llm.py` counters |
| 429 rate-limit failures reaching the user | **0** | Fallback chain must absorb them silently |

**A note on honesty that will win you points:** n=5 synthetic cases is not validation, and judges who know clinical AI will test whether you know that. Present it as "the harness is built and here are the first results" rather than "our system is 95% accurate." Overclaiming is the fastest way to lose a technically literate panel.

---

## 12. Memory design (LangMem)

- **Episodic — within encounter:** conversation turns, what the doctor edited or rejected. Powers "the physician overrode the AI's ESI level; keep that in view for later nodes."
- **Semantic — across encounters, keyed by MRN:** prior diagnoses, surgeries, chronic meds, allergies, previous CXR impressions. This is the demo moment: the history agent surfaces *"prior admission 2024-11 for CAP, right lower lobe; penicillin allergy documented"* without anyone typing it.
- **Procedural — org-level:** the hospital's own formulary and admission thresholds, so the system adapts to local protocol rather than dictating one.

**Write policy:** only *clinician-approved* content is promoted to semantic memory. Unapproved agent output stays episodic and dies with the encounter. This one rule prevents the failure mode where a hallucination becomes permanent patient history — mention it explicitly; it's the kind of detail that signals you've thought about clinical safety rather than just wired up a framework.

---

## 13. Safety and guardrails

1. **Recommend-only, enforced structurally**, not by prompt. `interrupt_before` at every consequential gate. An agent literally cannot sign an order.
2. **Deterministic scoring.** CURB-65 / qSOFA / IDSA-ATS are Python. LLMs explain scores; they never compute them.
3. **Cannot-miss checklist.** For chest complaints, the differential *must* explicitly address ACS, PE, pneumothorax, aortic dissection, and sepsis — even if only to rule them out with a reason. Enforced by schema (`cannot_miss` flag) and asserted in tests.
4. **Uncertainty is mandatory output.** `CXRRead.limitations` is a required field. A model that can't say "AP projection, suboptimal inspiration, limited assessment of the left base" is not safe to deploy anywhere.
5. **No numeric probabilities from the VLM.** Ordinal buckets only. A confident-sounding "87%" from an unvalidated model is actively harmful.
6. **Full audit trail.** Every proposal and every human action, timestamped and attributable.
7. **Synthetic data only.** No real PHI touches this system. Redaction helper (`llama-3.1-8b-instant`) strips identifiers before any external call.
8. **Failure is degraded, not fatal.** A node that errors returns `{"errors": [...]}` and the graph continues with that section marked unavailable. A dead radiology agent must not block disposition.

---

## 14. Demo script (5 minutes)

| Time | Beat |
|---|---|
| 0:00 | The problem, in numbers: ED crowding, serial handoffs, median door-to-disposition. Name the metric you're moving. |
| 0:30 | Show the regulatory banner *first*. Say "synthetic data, recommend-only, clinician signs everything." Credibility up front. |
| 1:00 | **Case 1 — 72M, fever, productive cough, RR 32, confused, SBP 88.** Reception intake → triage assigns ESI 2 → red flags fire. |
| 2:00 | History agent pulls prior encounters from LangMem: *"CAP 2024, penicillin allergy."* Doctor edits one line — show the edit persisting. |
| 2:30 | Orders agent drafts the CAP panel **with rationale per test**. Doctor signs. Point out lactate + blood cultures ordered *before* antibiotics. |
| 3:00 | Upload CXR → VLM read → structured findings, `limitations` stated out loud. **Say clearly this is not a validated classifier.** |
| 3:45 | Synthesis: differential with cannot-miss addressed, final dx, **CURB-65 = 4 computed deterministically → admit ICU.** Show the score components. |
| 4:15 | **Case 2 — 34F, mild CAP, CURB-65 = 0** → discharge to pulmonology clinic with return precautions. Same system, opposite decision, transparent reason. |
| 4:45 | AgentOps trace + audit log. Close on the metric and the honest limitations. |

**The moment that wins it:** Case 1 and Case 2 side by side. Anyone can build a demo that always says "admit." Showing the system safely *discharges* the low-risk patient — and explaining exactly which score and which override rules drove it — is what demonstrates a real decision system rather than a chatbot with a stethoscope.

---

## 15. Post-MVP roadmap

| Phase | Work |
|---|---|
| **Week 1** | Full 11-node graph; separate critic agent; real CNN (TorchXRayVision / CheXNet DenseNet-121) alongside the VLM — CNN gives calibrated probability, VLM writes the narrative; HL7 FHIR resource mapping (`Patient`, `Encounter`, `ServiceRequest`, `DiagnosticReport`, `Observation`). |
| **Week 2–4** | Expand beyond CAP: chest pain, abdominal pain, trauma pathways. Retrieval over local hospital protocol PDFs. Clinician feedback loop → LangMem procedural memory. |
| **Month 2–3** | Retrospective validation on de-identified real encounters. Calibration curves, sensitivity/specificity with CIs, subgroup analysis by age and sex. Prospective silent-mode shadow deployment: system runs, nobody sees output, compare to actual clinician decisions. |
| **Regulatory** | Clinical decision support classification review; ISO 13485 / IEC 62304 if pursuing device status; DPIA; local IRB/ethics approval before any real-patient contact. |

---

## 16. Risk register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Render cold start during demo | **High** | High | Warm the URL 2 min before; keep a local uvicorn as backup |
| CORS blocks the Vercel frontend | High | Medium | Middleware in the first commit; test cross-origin at T+15 |
| VLM refuses to read a medical image | Medium | High | Test with your actual images before T+30; frame the prompt as "assisting a radiologist with a preliminary draft"; keep a cached good response in `demo_traces.json` |
| **Free-tier 429 during the demo** | **High** | **High** | `.with_fallbacks()` Groq↔Gemini; per-developer keys; disk cache so demo cases never hit the network twice; Ollama as last resort |
| Gemini free tier changes again (Pro was removed Apr 2026) | Medium | Medium | Model names live in `.env`, never hardcoded — swapping is a config change, not a code change |
| Someone uploads a real patient film "just to test" | Medium | **Severe** | Free tiers train on submitted data. Synthetic images only, checked into the repo. State the rule in the README and out loud at kickoff |
| Schema churn breaks parallel work | Medium | **High** | Freeze at T+5; any change requires a verbal announcement and everyone pulls |
| Supabase auth/RLS eats 15 minutes | Medium | Medium | Service key server-side only, permissive RLS, documented as a known gap |
| Judges challenge clinical validity | **High** | High | Answer honestly: synthetic data, n=5, not validated, harness built. Confidence in your limitations beats defensiveness about them |
| Live API rate limit / outage | Low | High | Recorded 90-second screen capture of a full successful run |

---

## Appendix A — Synthetic case seeds

**Case 1 — severe CAP (expect: admit ICU).** 72M. Fever 39.1 °C, productive cough 4 days, pleuritic right chest pain. RR 32, HR 118, BP 88/54, SpO₂ 86% RA, confused (GCS 14). PMH: COPD, T2DM, HTN. Meds: metformin, tiotropium. Allergy: penicillin (rash). Surgical hx: appendectomy 1985. CXR: right lower lobe consolidation + small effusion. Labs: WBC 18.4, BUN 32, lactate 3.1, PCT 4.8, CRP 210. → **CURB-65 = 5** (confusion, urea, RR, BP, age) · qSOFA 3 · IDSA/ATS severe. Expected: **admit ICU**.

**Case 2 — mild CAP (expect: discharge to clinic).** 34F. Cough 3 days, low-grade fever 37.9 °C, no dyspnea. RR 18, HR 88, BP 118/74, SpO₂ 98% RA, alert. No comorbidity. CXR: small left lingular infiltrate. Labs: WBC 11.2, BUN 12, CRP 42, PCT 0.3. → **CURB-65 = 0**. Expected: **discharge home / pulmonology clinic follow-up 48–72 h, return precautions documented**.

**Case 3 — borderline (expect: observation).** 68M, CURB-65 = 2 (age, RR 30), SpO₂ 93% RA, lives alone. Tests whether the system applies **social-factor override**, not just the raw score.

**Case 4 — distractor, CHF exacerbation.** Dyspnea + bilateral crackles + orthopnea, BNP 1,850, CXR: cardiomegaly, Kerley B lines, bilateral effusions. Tests whether the differential resists anchoring on pneumonia.

**Case 5 — distractor, pulmonary embolism.** Pleuritic pain, tachycardia, SpO₂ 91%, recent long-haul flight, clear CXR. Tests **cannot-miss recall** — the system must raise PE and recommend CTPA / Wells + D-dimer rather than treating a clear film as reassurance.

---

## Appendix B — Answer these before Week 1

1. Which hospital / country? Determines guideline set (IDSA/ATS vs NICE vs local MoH), formulary, and insurance model.
2. Existing HIS/EMR — is there a FHIR or HL7v2 interface, or is this greenfield?
3. Arabic/English bilingual requirement for the clinician-facing UI and the patient-facing discharge summary?
4. Who is the clinical champion — the physician who validates outputs and owns the protocol content? A clinical AI project without a named clinician co-owner does not survive contact with a real department.
5. Data governance: who approves use of de-identified encounters for validation, and under what ethics approval?
