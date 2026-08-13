"""
Ibn Sina — Frozen state contract for the ED encounter graph.

PAEDIATRIC VERSION: ages 1-5, matching the Kermany chest X-ray dataset.
Severity uses WHO danger signs + PIDS/IDSA criteria, NOT adult CURB-65.

Every agent reads only the fields it declares and writes only the fields
it owns. No agent mutates state in place.
"""

from __future__ import annotations

from operator import add
from typing import Annotated, Literal, Optional

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
    dob: Optional[str] = None
    guardian: Optional[str] = None
    weight_kg: Optional[float] = None


class Insurance(BaseModel):
    provider: Optional[str] = None
    policy_number: Optional[str] = None
    plan: Optional[str] = None
    coverage_status: Literal["active", "expired", "unknown", "self_pay"] = "unknown"
    copay_note: Optional[str] = None


class Vitals(BaseModel):
    temp_c: Optional[float] = None
    hr: Optional[int] = None
    rr: Optional[int] = None
    sbp: Optional[int] = None
    dbp: Optional[int] = None
    spo2: Optional[int] = None
    o2_supplement: Optional[str] = None
    cap_refill_sec: Optional[float] = None
    avpu: Optional[Literal["A", "V", "P", "U"]] = "A"
    weight_kg: Optional[float] = None
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
    result_value: Optional[str] = None
    result_flag: Optional[Literal["low", "normal", "high", "critical"]] = None


class ImagingOrder(BaseModel):
    modality: Literal["CXR", "CT", "US"]
    view: str = "AP"
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
    icd10: Optional[str] = None
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
    clinic_referral: Optional[str] = None
    rationale: str
    severity_basis: str
    follow_up_days: Optional[int] = None
    return_precautions: list[str] = Field(default_factory=list)


class Approval(BaseModel):
    gate: str
    approved_by: str
    approved_at: str
    action: Literal["accept", "edit", "reject"]
    edits: Optional[dict] = None


# ---------------------------------------------------------------------------
# Top-level encounter state — the LangGraph state object.
# ---------------------------------------------------------------------------


class PatientEncounter(BaseModel):
    encounter_id: str = ""

    # Intake
    raw_registration: Optional[str] = None
    patient: Optional[Patient] = None
    insurance: Optional[Insurance] = None
    chief_complaint: Optional[str] = None

    # Triage
    vitals: Optional[Vitals] = None
    esi_level: Optional[int] = None
    red_flags: list[str] = Field(default_factory=list)

    # History
    hpi: Optional[str] = None
    pmh: list[str] = Field(default_factory=list)
    medications: list[str] = Field(default_factory=list)
    allergies: list[str] = Field(default_factory=list)
    family_hx: list[str] = Field(default_factory=list)
    surgical_hx: list[str] = Field(default_factory=list)
    birth_history: Optional[str] = None
    immunisation_status: Optional[str] = None
    developmental_status: Optional[str] = None
    social_hx: Optional[str] = None
    soap_note: Optional[str] = None

    # Orders
    lab_orders: list[LabOrder] = Field(default_factory=list)
    imaging_orders: list[ImagingOrder] = Field(default_factory=list)
    order_rationale: Optional[str] = None

    # Radiology
    cxr_image_path: Optional[str] = None
    cxr_read: Optional[CXRRead] = None

    # Synthesis
    differential: list[DifferentialItem] = Field(default_factory=list)
    final_diagnosis: Optional[str] = None
    severity: Optional[PaediatricSeverity] = None
    disposition: Optional[Disposition] = None
    ed_report_md: Optional[str] = None

    # Audit
    approvals: Annotated[list[Approval], add] = Field(default_factory=list)
    errors: Annotated[list[str], add] = Field(default_factory=list)
    current_node: Optional[str] = None
