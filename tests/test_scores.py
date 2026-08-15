"""
Ibn Sina — Paediatric severity scoring truth table.

These are DETERMINISTIC tests. 100% pass rate is the only acceptable result.
If any fail, the scoring code is broken, not the test.
"""


from api.clinical.scores import paediatric_severity
from api.schemas import Vitals


def _vitals(**kwargs) -> Vitals:
    """Helper to construct Vitals with defaults."""
    defaults = {
        "temp_c": 37.0, "hr": 120, "rr": 30, "spo2": 98,
        "sbp": 95, "dbp": 60, "cap_refill_sec": 2.0, "avpu": "A",
        "grunting": False, "nasal_flaring": False, "chest_indrawing": False,
        "head_bobbing": False, "unable_to_drink": False, "convulsions": False,
    }
    defaults.update(kwargs)
    return Vitals(**defaults)


# --- Case 1: Very severe (IBN-001 analogue) ---
class TestVerySevereCAP:
    def test_case1_classification(self):
        v = _vitals(
            temp_c=39.4, hr=148, rr=52, spo2=88,
            cap_refill_sec=3.0, avpu="V",
            grunting=True, nasal_flaring=True, chest_indrawing=True,
            unable_to_drink=True,
        )
        result = paediatric_severity(v, age_months=48)
        assert result.classification == "very_severe"

    def test_case1_hypoxaemia(self):
        v = _vitals(spo2=88)
        result = paediatric_severity(v, age_months=48)
        assert result.hypoxaemia is True

    def test_case1_danger_signs(self):
        v = _vitals(
            spo2=88, grunting=True, unable_to_drink=True,
            cap_refill_sec=3.0, avpu="V",
        )
        result = paediatric_severity(v, age_months=48)
        assert result.who_danger_sign_count >= 3

    def test_case1_idsa_severe(self):
        v = _vitals(spo2=88, rr=52, avpu="V", cap_refill_sec=3.0)
        result = paediatric_severity(v, age_months=48, lab_lactate=2.8)
        assert result.idsa_severe is True


# --- Case 2: Non-severe (IBN-002 analogue) ---
class TestMildCAP:
    def test_case2_classification(self):
        v = _vitals(temp_c=37.9, hr=118, rr=32, spo2=98)
        result = paediatric_severity(v, age_months=24)
        assert result.classification == "non_severe"

    def test_case2_no_danger_signs(self):
        v = _vitals(temp_c=37.9, hr=118, rr=32, spo2=98)
        result = paediatric_severity(v, age_months=24)
        assert result.who_danger_sign_count == 0

    def test_case2_not_hypoxaemic(self):
        v = _vitals(spo2=98)
        result = paediatric_severity(v, age_months=24)
        assert result.hypoxaemia is False

    def test_case2_idsa_not_severe(self):
        v = _vitals(temp_c=37.9, hr=118, rr=32, spo2=98)
        result = paediatric_severity(v, age_months=24)
        assert result.idsa_severe is False


# --- Case 3: Borderline (IBN-003 analogue) ---
class TestBorderlineCAP:
    def test_case3_tachypnoea(self):
        v = _vitals(rr=42, spo2=92, temp_c=38.6)
        result = paediatric_severity(v, age_months=36)
        assert result.tachypnoea_for_age is True

    def test_case3_borderline_spo2(self):
        """SpO2 = 92 is NOT < 92, so should NOT flag hypoxaemia."""
        v = _vitals(spo2=92)
        result = paediatric_severity(v, age_months=36)
        assert result.hypoxaemia is False

    def test_spo2_91_is_hypoxaemia(self):
        v = _vitals(spo2=91)
        result = paediatric_severity(v, age_months=36)
        assert result.hypoxaemia is True


# --- Edge cases ---
class TestEdgeCases:
    def test_infant_rr_threshold_3mo(self):
        """3-month-old: RR upper = 50 (2-12mo bracket); RR 51 = tachypnoea."""
        v = _vitals(rr=51)
        result = paediatric_severity(v, age_months=3)
        assert result.tachypnoea_for_age is True

    def test_infant_normal_rr_3mo(self):
        """3-month-old: RR 49 is normal."""
        v = _vitals(rr=49)
        result = paediatric_severity(v, age_months=3)
        assert result.tachypnoea_for_age is False

    def test_neonate_rr_threshold(self):
        """2-month-old: RR upper = 60 (0-2mo bracket); RR 61 = tachypnoea."""
        v = _vitals(rr=61)
        result = paediatric_severity(v, age_months=2)
        assert result.tachypnoea_for_age is True

    def test_convulsions_trigger_danger(self):
        v = _vitals(convulsions=True)
        result = paediatric_severity(v, age_months=24)
        assert "Convulsions" in result.who_danger_signs

    def test_unresponsive_is_very_severe(self):
        v = _vitals(avpu="U")
        result = paediatric_severity(v, age_months=24)
        assert result.classification == "very_severe"

    def test_normal_child(self):
        v = _vitals()
        result = paediatric_severity(v, age_months=48)
        assert result.classification == "non_severe"
        assert result.who_danger_sign_count == 0
        assert result.idsa_severe is False

    def test_lactate_alone_not_sufficient(self):
        """Elevated lactate alone gives 1 IDSA criterion, not severe."""
        v = _vitals()
        result = paediatric_severity(v, age_months=36, lab_lactate=3.0)
        assert result.idsa_severe is False

    def test_multilobar_plus_hypoxaemia_is_idsa_severe(self):
        v = _vitals(spo2=88)
        result = paediatric_severity(v, age_months=36, multilobar=True)
        assert result.idsa_severe is True
