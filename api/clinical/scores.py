"""
Ibn Sina — Paediatric severity scoring.

ALL SCORING IS DETERMINISTIC PYTHON. The LLM explains scores; it never
computes them. Unit-tested in tests/test_scores.py.

References:
- WHO Pocket Book of Hospital Care for Children (2nd ed., 2013)
- PIDS/IDSA Guidelines for CAP in Infants and Children (2011)
- BTS Guidelines for the Management of CAP in Children (2011)
"""

from __future__ import annotations

from api.schemas import PaediatricSeverity, Vitals

# Age-stratified normal respiratory rates (WHO)
_RR_UPPER = {
    2: 60,    # 0-2 months
    12: 50,   # 2-12 months
    60: 40,   # 1-5 years
    144: 30,  # 5-12 years
    216: 20,  # >12 years
}


def _rr_upper_for_age(age_months: int) -> int:
    for cutoff, limit in sorted(_RR_UPPER.items()):
        if age_months <= cutoff:
            return limit
    return 20


# Age-stratified tachycardia thresholds
_HR_UPPER = {
    12: 160,
    24: 150,
    60: 140,
    144: 120,
    216: 100,
}


def _hr_upper_for_age(age_months: int) -> int:
    for cutoff, limit in sorted(_HR_UPPER.items()):
        if age_months <= cutoff:
            return limit
    return 100


def paediatric_severity(
    vitals: Vitals,
    age_months: int,
    lab_wbc: float | None = None,
    lab_lactate: float | None = None,
    multilobar: bool = False,
    pleural_effusion: bool = False,
) -> PaediatricSeverity:
    """Compute WHO danger-sign classification + PIDS/IDSA severe criteria.

    Returns a PaediatricSeverity with all components filled in.
    """
    danger_signs: list[str] = []
    components: dict[str, bool] = {}

    # --- WHO General Danger Signs (any one = very severe) ---
    components["unable_to_drink"] = vitals.unable_to_drink
    if vitals.unable_to_drink:
        danger_signs.append("Unable to drink or breastfeed")

    components["convulsions"] = vitals.convulsions
    if vitals.convulsions:
        danger_signs.append("Convulsions")

    components["lethargy"] = vitals.avpu in ("P", "U")
    if vitals.avpu in ("P", "U"):
        danger_signs.append(f"Abnormally sleepy / unconscious (AVPU={vitals.avpu})")

    components["stridor_at_rest"] = False  # populated from exam findings if available

    # --- WHO Pneumonia-specific severity markers ---
    rr_upper = _rr_upper_for_age(age_months)
    tachypnoea = vitals.rr is not None and vitals.rr > rr_upper
    components["tachypnoea_for_age"] = tachypnoea

    components["chest_indrawing"] = vitals.chest_indrawing
    if vitals.chest_indrawing:
        danger_signs.append("Lower chest wall indrawing")

    components["grunting"] = vitals.grunting
    if vitals.grunting:
        danger_signs.append("Grunting")

    components["nasal_flaring"] = vitals.nasal_flaring
    if vitals.nasal_flaring:
        danger_signs.append("Nasal flaring")

    components["head_bobbing"] = vitals.head_bobbing
    if vitals.head_bobbing:
        danger_signs.append("Head bobbing")

    hypoxaemia = vitals.spo2 is not None and vitals.spo2 < 92
    components["hypoxaemia_spo2_lt_92"] = hypoxaemia
    if hypoxaemia:
        danger_signs.append(f"Hypoxaemia (SpO2 {vitals.spo2}% < 92%)")

    components["high_fever"] = vitals.temp_c is not None and vitals.temp_c >= 39.0
    components["hypothermia"] = vitals.temp_c is not None and vitals.temp_c < 35.5

    # Tachycardia for age
    hr_upper = _hr_upper_for_age(age_months)
    components["tachycardia_for_age"] = vitals.hr is not None and vitals.hr > hr_upper

    # Poor perfusion
    poor_perfusion = vitals.cap_refill_sec is not None and vitals.cap_refill_sec >= 3
    components["poor_perfusion"] = poor_perfusion
    if poor_perfusion:
        danger_signs.append(f"Poor perfusion (CRT {vitals.cap_refill_sec}s)")

    # --- PIDS/IDSA severe CAP criteria (paediatric) ---
    idsa_criteria: list[str] = []
    if hypoxaemia:
        idsa_criteria.append("SpO2 < 92% on room air")
    if vitals.rr is not None and vitals.rr > rr_upper + 10:
        idsa_criteria.append(f"RR significantly above age threshold ({vitals.rr} vs upper {rr_upper})")
    if vitals.avpu in ("V", "P", "U"):
        idsa_criteria.append(f"Altered mental status (AVPU={vitals.avpu})")
    if multilobar:
        idsa_criteria.append("Multilobar infiltrates")
    if pleural_effusion:
        idsa_criteria.append("Pleural effusion / empyema")
    if lab_lactate is not None and lab_lactate >= 2.0:
        idsa_criteria.append(f"Elevated lactate ({lab_lactate} mmol/L)")
    if poor_perfusion:
        idsa_criteria.append(f"Prolonged capillary refill ({vitals.cap_refill_sec}s)")

    # --- Classification ---
    if len(danger_signs) >= 2 or vitals.avpu in ("P", "U"):
        classification = "very_severe"
    elif len(danger_signs) >= 1 or vitals.chest_indrawing or hypoxaemia:
        classification = "severe"
    elif tachypnoea:
        classification = "non_severe"
    else:
        classification = "non_severe"

    return PaediatricSeverity(
        who_danger_signs=danger_signs,
        who_danger_sign_count=len(danger_signs),
        classification=classification,
        tachypnoea_for_age=tachypnoea,
        hypoxaemia=hypoxaemia,
        idsa_severe_criteria=idsa_criteria,
        idsa_severe=len(idsa_criteria) >= 2,
        components=components,
    )
