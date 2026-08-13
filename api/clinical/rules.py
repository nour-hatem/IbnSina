"""
Ibn Sina — Paediatric disposition override rules.

Applied ON TOP of the WHO/PIDS-IDSA severity classification. These rules
capture clinical nuance that no score can quantify.
"""

from __future__ import annotations

from api.schemas import Disposition, PaediatricSeverity, PatientEncounter


def disposition_from_severity(
    severity: PaediatricSeverity,
    encounter: PatientEncounter,
) -> Disposition:
    """Derive disposition from severity + override rules."""

    overrides: list[str] = []
    precautions: list[str] = [
        "Return immediately if breathing difficulty worsens",
        "Return if unable to drink or feed",
        "Return if child becomes unusually drowsy or difficult to wake",
        "Return if fever persists beyond 48 hours despite treatment",
        "Return if new rash appears",
    ]

    # --- Hard admission triggers (any one) ---
    if severity.classification == "very_severe":
        return Disposition(
            decision="admit_picu",
            rationale="WHO classification: very severe pneumonia with multiple danger signs",
            severity_basis=f"WHO danger signs: {', '.join(severity.who_danger_signs)}",
            return_precautions=precautions,
        )

    if severity.hypoxaemia:
        overrides.append("Hypoxaemia (SpO2 < 92%) on room air")

    vitals = encounter.vitals
    if vitals and vitals.unable_to_drink:
        overrides.append("Unable to drink / feed — cannot take oral antibiotics")

    if vitals and vitals.avpu in ("V", "P", "U"):
        overrides.append(f"Altered consciousness (AVPU={vitals.avpu})")

    if vitals and vitals.grunting:
        overrides.append("Grunting respiration")

    # Social factors
    social = encounter.social_hx or ""
    social_lower = social.lower()
    social_risk = False
    if any(term in social_lower for term in [
        "rural", "no transport", "sole carer", "no telephone",
        "homeless", "no caregiver", "unreliable follow-up",
    ]):
        social_risk = True
        overrides.append("Social risk factors limiting safe discharge and follow-up")

    # Age < 6 months
    if encounter.patient and encounter.patient.age_months < 6:
        overrides.append("Age < 6 months — lower threshold for admission")

    # Incomplete immunisation
    if encounter.immunisation_status and "incomplete" in encounter.immunisation_status.lower():
        overrides.append("Incomplete immunisations — higher risk for invasive disease")

    # Prior recurrent LRTI
    pmh_lower = " ".join(encounter.pmh).lower()
    if "recurrent" in pmh_lower and ("respiratory" in pmh_lower or "lrti" in pmh_lower or "pneumonia" in pmh_lower):
        overrides.append("Recurrent lower respiratory infections — needs inpatient workup")

    # Anaemia
    for lab in encounter.lab_orders:
        if lab.name.lower().startswith("haemoglobin") and lab.result_flag == "low":
            overrides.append("Concurrent anaemia — reduced oxygen-carrying capacity")
            break

    # --- Decision logic ---
    if severity.classification == "severe" or len(overrides) >= 2:
        return Disposition(
            decision="admit_ward",
            rationale="Severe classification and/or multiple admission triggers",
            severity_basis=(
                f"WHO classification: {severity.classification}. "
                f"Override triggers: {'; '.join(overrides) if overrides else 'none'}"
            ),
            return_precautions=precautions,
        )

    if len(overrides) == 1 or social_risk:
        return Disposition(
            decision="observation",
            rationale=f"Borderline severity with override factor: {overrides[0] if overrides else 'social risk'}",
            severity_basis=f"WHO classification: {severity.classification}",
            follow_up_days=1,
            return_precautions=precautions,
        )

    # Non-severe, no overrides
    return Disposition(
        decision="discharge_home",
        clinic_referral="Paediatric pulmonology / chest clinic",
        rationale="Non-severe pneumonia, no danger signs, no social risk factors, able to drink",
        severity_basis=f"WHO classification: {severity.classification}, 0 danger signs",
        follow_up_days=2,
        return_precautions=precautions,
    )
