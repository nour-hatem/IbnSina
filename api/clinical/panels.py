"""
Ibn Sina — Standard lab panel definitions for suspected paediatric CAP.

The orders_agent SELECTS from these curated panels; it does NOT invent labs.
"""

from __future__ import annotations

from api.schemas import ImagingOrder, LabOrder

TIER1_CAP_LABS: list[LabOrder] = [
    LabOrder(
        code="58410-2", name="CBC with differential", priority="stat",
        rationale="Assess leukocytosis / left shift (bacterial) or leukopenia (severe infection)"
    ),
    LabOrder(
        code="1988-5", name="C-reactive protein (CRP)", priority="stat",
        rationale="Inflammatory burden; serial trend guides response to therapy"
    ),
    LabOrder(
        code="33959-8", name="Procalcitonin", priority="stat",
        rationale="Bacterial vs viral discrimination; supports antibiotic stewardship"
    ),
    LabOrder(
        code="51990-0", name="Basic metabolic panel (Na, K, Cl, HCO3, urea, creatinine, glucose)",
        priority="stat",
        rationale="Electrolyte status, renal function for antibiotic dosing, dehydration assessment"
    ),
    LabOrder(
        code="2524-7", name="Venous lactate", priority="stat",
        rationale="Sepsis screen; >=2 mmol/L triggers sepsis bundle"
    ),
    LabOrder(
        code="2345-7", name="Blood glucose", priority="stat",
        rationale="Hypoglycaemia risk in febrile unwell children; DKA screen"
    ),
]

TIER2_CAP_LABS: list[LabOrder] = [
    LabOrder(
        code="600-7", name="Blood cultures x 2 sets (before antibiotics)", priority="stat",
        rationale="Severe CAP, ICU-bound, immunocompromised, or toxic appearance"
    ),
    LabOrder(
        code="87040-6", name="Respiratory viral PCR panel (influenza A/B, RSV, SARS-CoV-2)",
        priority="routine",
        rationale="Viral aetiology identification; guides antiviral and isolation decisions"
    ),
    LabOrder(
        code="1742-6", name="AST/ALT/Bilirubin", priority="routine",
        rationale="Baseline liver function before hepatically-cleared antibiotics"
    ),
    LabOrder(
        code="6301-6", name="Coagulation (PT/INR, aPTT)", priority="routine",
        rationale="Pre-admission baseline if sepsis or DIC concern"
    ),
]

CAP_IMAGING: list[ImagingOrder] = [
    ImagingOrder(
        modality="CXR", view="AP",
        rationale="Standard first-line imaging for suspected lower respiratory tract infection",
        urgency="stat",
    ),
]


def get_cap_panel(severe: bool = False) -> tuple[list[LabOrder], list[ImagingOrder]]:
    """Return the appropriate lab + imaging panel for suspected CAP."""
    labs = list(TIER1_CAP_LABS)
    if severe:
        labs.extend(TIER2_CAP_LABS)
    return labs, list(CAP_IMAGING)
