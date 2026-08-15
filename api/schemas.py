"""
Ibn Sina — Frozen state contract for the ED encounter graph.

PAEDIATRIC VERSION: ages 1-5, matching the Kermany chest X-ray dataset.
Severity uses WHO danger signs + PIDS/IDSA criteria, NOT adult CURB-65.

Every agent reads only the fields it declares and writes only the fields
it owns. No agent mutates state in place.
"""

from __future__ import annotations

from operator import add
from typing import Annotated, Literal

from pydantic import BaseModel, Field

# ---------------------------------------------------------------------------
# Sub-models
# ---------------------------------------------------------------------------


class Patient(BaseModel):
    mrn: str
    full_name: str
    age_months: int = Field(description="Age in months for paediatric dosing")
    age_display: str = Field(description="Human-readable, e.g. '4 years'")
    sex: Literal["male", "female", "other"]
    dob: str | None = None
    guardian: str | None = None
    weight_kg: float | None = None


class Insurance(BaseModel):
    provider: str | None = None
    policy_number: str | None = None
    plan: str | None = None
    coverage_status: Literal["active", "expired", "unknown", "self_pay"] = "unknown"
    copay_note: str | None = None


class Vitals(BaseModel):
    temp_c: float | None = None
    hr: int | None = None
    rr: int | None = None
    sbp: int | None = None
    dbp: int | None = None
    spo2: int | None = None
    o2_supplement: str | None = None
    cap_refill_sec: float | None = None
    avpu: Literal["A", "V", "P", "U"] | None = "A"
    weight_kg: float | None = None
    grunting: bool = False
    nasal_flaring: bool = False
    chest_indrawing: bool = False
    head_bobbing: bool = False
    unable_to_drink: bool = False
    convulsions: bool = False


class LabOrder(BaseModel):
    code: str
    name: str
    priority: Literal["stat", "routine"] = "routine"
    rationale: str
    result_value: str | None = None
    result_flag: Literal["low", "normal", "high", "critical"] | None = None


class ImagingOrder(BaseModel):
    modality: Literal["CXR", "CT", "US"]
    view: str = "AP"
    rationale: str
    urgency: Literal["stat", "routine"] = "stat"


class CXRRead(BaseModel):
    findings: list[str]
    impression: str
    pneumonia_likelihood: Literal["low", "intermediate", "high"]
    laterality: Literal["right", "left", "bilateral", "none"] | None = None
    multilobar: bool = False
    pleural_effusion: bool = False
    confidence: float = Field(ge=0, le=1)
    limitations: str
    model_used: str


class PaediatricSeverity(BaseModel):
    who_danger_signs: list[str] = Field(default_factory=list)
    who_danger_sign_count: int = 0
    classification: Literal["non_severe", "severe", "very_severe"] = "non_severe"
    tachypnoea_for_age: bool = False
    hypoxaemia: bool = False
    idsa_severe_criteria: list[str] = Field(default_factory=list)
    idsa_severe: bool = False
    components: dict[str, bool] = Field(default_factory=dict)


class DifferentialItem(BaseModel):
    diagnosis: str
    icd10: str | None = None
    likelihood: Literal["high", "moderate", "low"]
    supporting_evidence: list[str]
    refuting_evidence: list[str]
    cannot_miss: bool = False


class Disposition(BaseModel):
    decision: Literal[
        "discharge_home",
        "outpatient_clinic",
        "observation",
        "admit_ward",
        "admit_picu",
    ]
    clinic_referral: str | None = None
    rationale: str
    severity_basis: str
    follow_up_days: int | None = None
    return_precautions: list[str] = Field(default_factory=list)


class Approval(BaseModel):
    gate: str
    approved_by: str
    approved_at: str
    action: Literal["accept", "edit", "reject"]
    edits: dict | None = None


# ---------------------------------------------------------------------------
# Top-level encounter state — the LangGraph state object.
# ---------------------------------------------------------------------------


class PatientEncounter(BaseModel):
    encounter_id: str = ""

    # Intake
    raw_registration: str | None = None
    patient: Patient | None = None
    insurance: Insurance | None = None
    chief_complaint: str | None = None

    # Triage
    vitals: Vitals | None = None
    esi_level: int | None = None
    red_flags: list[str] = Field(default_factory=list)

    # History
    hpi: str | None = None
    pmh: list[str] = Field(default_factory=list)
    medications: list[str] = Field(default_factory=list)
    allergies: list[str] = Field(default_factory=list)
    family_hx: list[str] = Field(default_factory=list)
    surgical_hx: list[str] = Field(default_factory=list)
    birth_history: str | None = None
    immunisation_status: str | None = None
    developmental_status: str | None = None
    social_hx: str | None = None
    soap_note: str | None = None

    # Orders
    lab_orders: list[LabOrder] = Field(default_factory=list)
    imaging_orders: list[ImagingOrder] = Field(default_factory=list)
    order_rationale: str | None = None

    # Radiology
    cxr_image_path: str | None = None
    cxr_read: CXRRead | None = None

    # Synthesis
    differential: list[DifferentialItem] = Field(default_factory=list)
    final_diagnosis: str | None = None
    severity: PaediatricSeverity | None = None
    disposition: Disposition | None = None
    ed_report_md: str | None = None

    # Audit
    approvals: Annotated[list[Approval], add] = Field(default_factory=list)
    errors: Annotated[list[str], add] = Field(default_factory=list)
    current_node: str | None = None
