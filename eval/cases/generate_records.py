"""
Ibn Sina - synthetic paediatric ED patient records (PDF) for RAG ingestion.

Generates 5 text-extractable PDFs + manifest.csv mapping each record to a
chest radiograph in the Kermany et al. dataset (CC BY 4.0).

ALL PATIENTS ARE FICTIONAL. No real PHI. Ages 1-5 to match the source images.

Deliberately ABSENT from the PDFs: final diagnosis, disposition, and the
image ground-truth label. Those are what the agents must derive - putting
them in the source documents would leak the answer to the RAG retriever.
They live in manifest.csv, which is for the evaluation harness only.

Usage:  python eval/cases/generate_records.py
"""

import csv
import os

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    KeepTogether,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "records")
MANIFEST = os.path.join(os.path.dirname(os.path.abspath(__file__)), "manifest.csv")

INK = colors.HexColor("#1a1a1a")
ACCENT = colors.HexColor("#0f4c81")
MUTED = colors.HexColor("#f2f4f7")
WARN = colors.HexColor("#b42318")

# --------------------------------------------------------------------------
# Case data. Paediatric CAP + two distractors that probe known failure modes.
# --------------------------------------------------------------------------

CASES = [
    {
        "mrn": "IBN-001",
        "name": "Yousef Mahmoud Ali",
        "age": "4 years",
        "age_years": 4,
        "sex": "Male",
        "dob": "2022-03-11",
        "arrival": "2026-08-13 21:42",
        "guardian": "Mother - Hoda Ali (present, primary historian)",
        "insurance": {
            "Provider": "National Health Insurance Authority (NHIA)",
            "Policy number": "NHIA-4471-88213",
            "Plan": "Family - Category B",
            "Coverage status": "Active, verified at registration",
            "Co-payment": "EGP 50 ED attendance; imaging covered",
            "Referral required": "No (emergency presentation)",
        },
        "complaint": "Fever and difficulty breathing for 4 days, worsening today",
        "vitals": [
            ("Temperature (axillary)", "39.4 C", "HIGH"),
            ("Respiratory rate", "52 /min", "HIGH"),
            ("Heart rate", "148 /min", "HIGH"),
            ("SpO2 (room air)", "88 %", "CRITICAL"),
            ("Blood pressure", "92/58 mmHg", "Normal"),
            ("Capillary refill", "3 seconds", "PROLONGED"),
            ("Weight", "16.2 kg", "50th centile"),
            ("AVPU", "V - responds to voice", "REDUCED"),
        ],
        "exam": [
            "Marked subcostal and intercostal recession; audible grunting at rest.",
            "Nasal flaring present. Head bobbing noted intermittently.",
            "Reduced air entry right lower zone with bronchial breathing and coarse crackles.",
            "Dullness to percussion right base.",
            "No stridor. No wheeze. No rash. Neck supple, no meningism.",
            "Refusing all oral fluids for the past 12 hours. Dry mucous membranes.",
            "Last wet nappy approximately 9 hours ago.",
        ],
        "hpi": (
            "Four days of fever up to 39.5 C, initially with dry cough that has become "
            "productive. Progressive tachypnoea over the last 48 hours. Today the mother "
            "noted grunting, chest indrawing and reluctance to feed. Reduced activity and "
            "increasing drowsiness since this morning. Two episodes of vomiting after "
            "coughing. No diarrhoea, no rash, no seizure. No recent travel. Attends "
            "nursery; two classmates recently unwell with fever and cough."
        ),
        "history": {
            "Birth history": "Term (39+2), spontaneous vaginal delivery, birth weight 3.2 kg. No NICU admission.",
            "Developmental": "Milestones age-appropriate. Attends nursery. Speech and gait normal.",
            "Immunisations": "Up to date per national schedule EXCEPT PCV13 booster (missed, due age 12 months). BCG, OPV/IPV, pentavalent, MMR all documented.",
            "Past medical history": "Two prior episodes of wheeze with viral URTI (ages 2 and 3), no maintenance inhaler. Otherwise well.",
            "Past surgical history": "None.",
            "Prior hospital admissions": "None.",
            "Current medications": "Paracetamol 15 mg/kg PRN (last dose 4 hours ago). Ibuprofen given by mother yesterday.",
            "Allergies": "No known drug allergies.",
            "Family history": "Father has asthma. Maternal grandfather - type 2 diabetes. No TB contact known.",
            "Social history": "Lives with both parents and two siblings, Cairo. Household smoker (father, smokes indoors). Biomass cooking fuel not used.",
        },
        "labs": [
            ("White cell count", "21.3 x10^9/L", "4.0-12.0", "HIGH"),
            ("Neutrophils", "82 %", "30-60", "HIGH"),
            ("Lymphocytes", "12 %", "30-60", "LOW"),
            ("Haemoglobin", "10.2 g/dL", "11.5-14.5", "LOW"),
            ("Platelets", "418 x10^9/L", "150-450", "Normal"),
            ("C-reactive protein", "168 mg/L", "<5", "HIGH"),
            ("Procalcitonin", "6.2 ng/mL", "<0.5", "HIGH"),
            ("Sodium", "132 mmol/L", "135-145", "LOW"),
            ("Potassium", "4.1 mmol/L", "3.5-5.1", "Normal"),
            ("Urea", "7.8 mmol/L", "2.5-6.5", "HIGH"),
            ("Creatinine", "38 umol/L", "20-50", "Normal"),
            ("Venous lactate", "2.8 mmol/L", "<2.0", "HIGH"),
            ("Blood glucose", "6.4 mmol/L", "3.5-7.0", "Normal"),
            ("Blood culture", "Collected pre-antibiotic; result pending", "-", "PENDING"),
            ("Respiratory viral PCR", "Negative for influenza A/B, RSV, SARS-CoV-2", "Negative", "Normal"),
        ],
        "imaging_order": "Chest radiograph, AP projection, STAT. Indication: suspected lower respiratory tract infection with hypoxaemia.",
        "image_file": "chest_xray/test/PNEUMONIA/person3_bacteria_10.jpeg",
        "notes": "Child unable to stand for PA film; AP supine obtained. Inspiration adequate. Mild rotation to the right.",
    },
    {
        "mrn": "IBN-002",
        "name": "Malak Tarek Hassan",
        "age": "2 years",
        "age_years": 2,
        "sex": "Female",
        "dob": "2024-05-02",
        "arrival": "2026-08-13 11:15",
        "guardian": "Both parents present",
        "insurance": {
            "Provider": "MedCare Egypt - Corporate Scheme",
            "Policy number": "MCE-2210-55907",
            "Plan": "Dependant cover under parent policy",
            "Coverage status": "Active",
            "Co-payment": "EGP 100 ED attendance",
            "Referral required": "No",
        },
        "complaint": "Cough and runny nose for 3 days with low-grade fever",
        "vitals": [
            ("Temperature (axillary)", "37.9 C", "Mildly raised"),
            ("Respiratory rate", "32 /min", "Normal for age"),
            ("Heart rate", "118 /min", "Normal for age"),
            ("SpO2 (room air)", "98 %", "Normal"),
            ("Blood pressure", "98/60 mmHg", "Normal"),
            ("Capillary refill", "<2 seconds", "Normal"),
            ("Weight", "12.4 kg", "50th centile"),
            ("AVPU", "A - alert", "Normal"),
        ],
        "exam": [
            "Alert, playful, smiling and interactive throughout assessment.",
            "No recession, no nasal flaring, no grunting. No accessory muscle use.",
            "Clear rhinorrhoea. Mild pharyngeal erythema, tonsils not enlarged.",
            "Scattered coarse crackles left mid zone; no focal dullness.",
            "No wheeze. Air entry equal bilaterally.",
            "Well hydrated. Drinking normally. Nappies wet as usual.",
            "No rash. No lymphadenopathy.",
        ],
        "hpi": (
            "Three days of coryza and dry cough following an upper respiratory illness in "
            "her older brother. Low-grade fever, maximum 38.0 C, responding well to "
            "paracetamol. Feeding and drinking normally. Playing as usual between "
            "coughing bouts. Sleeping through the night. No breathing difficulty reported "
            "by parents at any point. No vomiting, no diarrhoea, no rash. No known "
            "TB contact."
        ),
        "history": {
            "Birth history": "Term (40+0), elective caesarean section, birth weight 3.4 kg. Uncomplicated.",
            "Developmental": "Normal milestones. Two-word phrases. Walking since 13 months.",
            "Immunisations": "Fully up to date per national schedule, including PCV13.",
            "Past medical history": "Nil significant. One episode of otitis media age 18 months, resolved with oral amoxicillin.",
            "Past surgical history": "None.",
            "Prior hospital admissions": "None.",
            "Current medications": "Paracetamol PRN only.",
            "Allergies": "No known drug allergies.",
            "Family history": "Older brother currently with URTI symptoms. No asthma, no TB, no immunodeficiency.",
            "Social history": "Lives with parents and one sibling. No household smokers. Attends nursery 3 days per week.",
        },
        "labs": [
            ("White cell count", "9.8 x10^9/L", "4.0-12.0", "Normal"),
            ("Neutrophils", "34 %", "30-60", "Normal"),
            ("Lymphocytes", "58 %", "30-60", "Normal"),
            ("Haemoglobin", "12.1 g/dL", "11.5-14.5", "Normal"),
            ("Platelets", "295 x10^9/L", "150-450", "Normal"),
            ("C-reactive protein", "18 mg/L", "<5", "Mildly raised"),
            ("Procalcitonin", "0.12 ng/mL", "<0.5", "Normal"),
            ("Sodium", "138 mmol/L", "135-145", "Normal"),
            ("Urea", "3.9 mmol/L", "2.5-6.5", "Normal"),
            ("Venous lactate", "1.1 mmol/L", "<2.0", "Normal"),
            ("Respiratory viral PCR", "Positive - rhinovirus/enterovirus", "Negative", "POSITIVE"),
            ("Blood culture", "Not indicated - not collected", "-", "N/A"),
        ],
        "imaging_order": "Chest radiograph, AP projection, routine. Indication: persistent cough with focal auscultatory findings.",
        "image_file": "chest_xray/test/PNEUMONIA/person1_virus_6.jpeg",
        "notes": "Good inspiration. No rotation. Technically adequate film.",
    },
    {
        "mrn": "IBN-003",
        "name": "Omar Sami Abdelrahman",
        "age": "3 years",
        "age_years": 3,
        "sex": "Male",
        "dob": "2023-01-26",
        "arrival": "2026-08-13 19:05",
        "guardian": "Mother only - father working abroad",
        "insurance": {
            "Provider": "Uninsured - self pay",
            "Policy number": "N/A",
            "Plan": "N/A",
            "Coverage status": "Self-pay. Referred to social work for subsidy assessment.",
            "Co-payment": "Full cost; family reports financial hardship",
            "Referral required": "No",
        },
        "complaint": "Fever and cough for 5 days, breathing faster since yesterday",
        "vitals": [
            ("Temperature (axillary)", "38.6 C", "HIGH"),
            ("Respiratory rate", "42 /min", "HIGH"),
            ("Heart rate", "132 /min", "Raised"),
            ("SpO2 (room air)", "92 %", "BORDERLINE LOW"),
            ("Blood pressure", "95/60 mmHg", "Normal"),
            ("Capillary refill", "2 seconds", "Normal"),
            ("Weight", "13.1 kg", "10th-25th centile"),
            ("AVPU", "A - alert", "Normal"),
        ],
        "exam": [
            "Alert and interactive but tires with exertion.",
            "Mild subcostal recession. No grunting, no nasal flaring.",
            "Coarse crackles right lower zone. Reduced air entry right base.",
            "No dullness to percussion. No wheeze.",
            "Taking oral fluids in small volumes; mother reports reduced appetite.",
            "Mildly dry mucous membranes. Nappies wet but less than usual.",
            "No rash. No hepatosplenomegaly.",
        ],
        "hpi": (
            "Five days of fever and productive cough. Seen at a local pharmacy on day 3 "
            "and given an unspecified oral syrup with no improvement. Tachypnoea noted by "
            "mother since yesterday. Reduced appetite but still drinking. No vomiting. "
            "No chest pain reported. Mother reports the child seems 'more tired than "
            "usual' but is still playing intermittently. No TB contact known, though "
            "a neighbour was treated for TB two years ago."
        ),
        "history": {
            "Birth history": "Preterm 35+4, spontaneous vaginal delivery, birth weight 2.3 kg. 6 days in special care for feeding support.",
            "Developmental": "Mild speech delay, otherwise appropriate. Not yet in nursery.",
            "Immunisations": "Incomplete - pentavalent 3rd dose and PCV13 booster not received. No documented measles booster.",
            "Past medical history": "Recurrent lower respiratory infections - 3 episodes in the past 18 months, all managed as outpatient. Mild iron deficiency anaemia diagnosed 6 months ago, iron course not completed.",
            "Past surgical history": "None.",
            "Prior hospital admissions": "None (neonatal special care only).",
            "Current medications": "Nil regular. Ferrous sulphate previously prescribed, discontinued by family.",
            "Allergies": "No known drug allergies.",
            "Family history": "No asthma. Neighbour treated for pulmonary TB 2 years ago - contact status not formally traced.",
            "Social history": "IMPORTANT: Family resides approximately 65 km from this hospital in a rural village. No private transport. No public transport available after 20:00. Mother is sole carer for four children under 8; father works abroad and is not contactable today. No telephone at home; mother uses a neighbour's phone. Household uses biomass fuel for cooking indoors.",
        },
        "labs": [
            ("White cell count", "15.6 x10^9/L", "4.0-12.0", "HIGH"),
            ("Neutrophils", "71 %", "30-60", "HIGH"),
            ("Lymphocytes", "22 %", "30-60", "LOW"),
            ("Haemoglobin", "9.6 g/dL", "11.5-14.5", "LOW"),
            ("Platelets", "381 x10^9/L", "150-450", "Normal"),
            ("C-reactive protein", "92 mg/L", "<5", "HIGH"),
            ("Procalcitonin", "1.8 ng/mL", "<0.5", "HIGH"),
            ("Sodium", "136 mmol/L", "135-145", "Normal"),
            ("Urea", "5.2 mmol/L", "2.5-6.5", "Normal"),
            ("Venous lactate", "1.6 mmol/L", "<2.0", "Normal"),
            ("Blood glucose", "5.1 mmol/L", "3.5-7.0", "Normal"),
            ("Respiratory viral PCR", "Negative", "Negative", "Normal"),
            ("Blood culture", "Collected pre-antibiotic; result pending", "-", "PENDING"),
        ],
        "imaging_order": "Chest radiograph, AP projection, urgent. Indication: fever with tachypnoea and focal signs; assess for consolidation.",
        "image_file": "chest_xray/test/PNEUMONIA/person8_bacteria_37.jpeg",
        "notes": "AP film. Slightly shallow inspiration. No significant rotation.",
    },
    {
        "mrn": "IBN-004",
        "name": "Layla Ahmed Mostafa",
        "age": "14 months",
        "age_years": 1,
        "sex": "Female",
        "dob": "2025-06-04",
        "arrival": "2026-08-13 16:30",
        "guardian": "Mother present",
        "insurance": {
            "Provider": "National Health Insurance Authority (NHIA)",
            "Policy number": "NHIA-9932-10475",
            "Plan": "Family - Category A",
            "Coverage status": "Active",
            "Co-payment": "EGP 50 ED attendance",
            "Referral required": "No",
        },
        "complaint": "Noisy breathing and cough for 2 days",
        "vitals": [
            ("Temperature (axillary)", "37.6 C", "Mildly raised"),
            ("Respiratory rate", "46 /min", "Raised"),
            ("Heart rate", "138 /min", "Raised"),
            ("SpO2 (room air)", "94 %", "Borderline"),
            ("Blood pressure", "94/56 mmHg", "Normal"),
            ("Capillary refill", "<2 seconds", "Normal"),
            ("Weight", "9.8 kg", "50th centile"),
            ("AVPU", "A - alert", "Normal"),
        ],
        "exam": [
            "Alert, mildly irritable but consolable. Interactive with mother.",
            "Mild subcostal recession. No grunting.",
            "WIDESPREAD BILATERAL EXPIRATORY WHEEZE with prolonged expiratory phase.",
            "Fine inspiratory crackles heard diffusely, no focal consolidation.",
            "NO focal dullness. Air entry symmetrical.",
            "Profuse clear rhinorrhoea. Feeding at approximately 70 percent of normal volume.",
            "Adequate hydration. Nappies wet.",
        ],
        "hpi": (
            "Two days of coryza progressing to cough and audible wheeze. Low-grade fever. "
            "Feeding reduced but maintained at roughly two-thirds of normal intake. No "
            "apnoea, no cyanosis, no colour change episodes. Older sibling has a cold. "
            "Presentation during peak seasonal respiratory virus activity. No prior "
            "wheeze episodes. No choking episode reported. No sudden onset."
        ),
        "history": {
            "Birth history": "Term (38+5), spontaneous vaginal delivery, birth weight 3.0 kg. Uncomplicated.",
            "Developmental": "Normal. Cruising, few words.",
            "Immunisations": "Up to date for age.",
            "Past medical history": "First episode of wheeze. No prior respiratory admissions. No eczema.",
            "Past surgical history": "None.",
            "Prior hospital admissions": "None.",
            "Current medications": "Paracetamol PRN. No inhalers.",
            "Allergies": "No known drug allergies.",
            "Family history": "Mother had childhood asthma, resolved. Older sibling currently with URTI.",
            "Social history": "Lives with parents and one sibling. No household smokers. Not in nursery.",
        },
        "labs": [
            ("White cell count", "8.2 x10^9/L", "6.0-17.0", "Normal"),
            ("Neutrophils", "38 %", "25-55", "Normal"),
            ("Lymphocytes", "52 %", "35-65", "Normal"),
            ("Haemoglobin", "11.8 g/dL", "10.5-13.5", "Normal"),
            ("Platelets", "342 x10^9/L", "150-450", "Normal"),
            ("C-reactive protein", "9 mg/L", "<5", "Marginally raised"),
            ("Procalcitonin", "0.08 ng/mL", "<0.5", "Normal"),
            ("Sodium", "139 mmol/L", "135-145", "Normal"),
            ("Urea", "3.2 mmol/L", "2.5-6.5", "Normal"),
            ("Venous lactate", "1.0 mmol/L", "<2.0", "Normal"),
            ("Respiratory viral PCR", "POSITIVE - respiratory syncytial virus (RSV)", "Negative", "POSITIVE"),
            ("Blood culture", "Not indicated - not collected", "-", "N/A"),
        ],
        "imaging_order": "Chest radiograph, AP projection, routine. Indication: wheeze with borderline saturations; exclude focal consolidation.",
        "image_file": "chest_xray/test/NORMAL/NORMAL2-IM-0222-0001.jpeg",
        "notes": "AP film, adequate inspiration. Hyperinflation may be present; assess carefully.",
    },
    {
        "mrn": "IBN-005",
        "name": "Adam Khaled Nasser",
        "age": "2 years",
        "age_years": 2,
        "sex": "Male",
        "dob": "2024-02-19",
        "arrival": "2026-08-13 22:50",
        "guardian": "Both parents present, highly anxious",
        "insurance": {
            "Provider": "Allianz Egypt - Private",
            "Policy number": "ALZ-EG-77410-3",
            "Plan": "Comprehensive family",
            "Coverage status": "Active",
            "Co-payment": "Nil - direct billing",
            "Referral required": "No",
        },
        "complaint": "Sudden choking while eating nuts 6 hours ago, persistent cough since",
        "vitals": [
            ("Temperature (axillary)", "36.9 C", "Normal - AFEBRILE"),
            ("Respiratory rate", "38 /min", "Mildly raised"),
            ("Heart rate", "124 /min", "Mildly raised"),
            ("SpO2 (room air)", "93 %", "Borderline"),
            ("Blood pressure", "96/58 mmHg", "Normal"),
            ("Capillary refill", "<2 seconds", "Normal"),
            ("Weight", "12.8 kg", "50th-75th centile"),
            ("AVPU", "A - alert", "Normal"),
        ],
        "exam": [
            "Alert, active, in no distress at rest. Speaking in normal short sentences.",
            "SUDDEN-ONSET history. Well until the choking episode 6 hours ago.",
            "ASYMMETRICAL FINDINGS: reduced air entry over the RIGHT hemithorax.",
            "MONOPHONIC wheeze localised to the right, not responding to salbutamol trial.",
            "Left side clear with normal air entry.",
            "No recession at rest; mild recession on exertion. No grunting, no stridor.",
            "AFEBRILE throughout. Feeding and drinking normally. Well hydrated.",
        ],
        "hpi": (
            "Previously entirely well. Six hours ago, whilst eating peanuts unsupervised, "
            "the child had a sudden violent coughing and choking episode witnessed by his "
            "older cousin, with transient facial redness. The acute episode settled after "
            "approximately two minutes, but a persistent intermittent cough has continued "
            "since. NO fever at any point. NO preceding coryza, and NO preceding illness "
            "of any kind. Parents report he has otherwise been behaving and playing "
            "normally. A trial of nebulised salbutamol in the department produced no "
            "measurable change in air entry or saturations."
        ),
        "history": {
            "Birth history": "Term (39+4), spontaneous vaginal delivery, birth weight 3.5 kg. Uncomplicated.",
            "Developmental": "Normal milestones. Speaking in short sentences.",
            "Immunisations": "Fully up to date.",
            "Past medical history": "Entirely well. No respiratory illness of note. No wheeze ever. No atopy.",
            "Past surgical history": "None.",
            "Prior hospital admissions": "None.",
            "Current medications": "None.",
            "Allergies": "No known drug allergies. No known food allergies.",
            "Family history": "No asthma, no atopy, no cystic fibrosis, no immunodeficiency.",
            "Social history": "Lives with parents, only child. No household smokers. Nuts routinely present in the home.",
        },
        "labs": [
            ("White cell count", "9.1 x10^9/L", "4.0-12.0", "Normal"),
            ("Neutrophils", "44 %", "30-60", "Normal"),
            ("Lymphocytes", "48 %", "30-60", "Normal"),
            ("Haemoglobin", "12.4 g/dL", "11.5-14.5", "Normal"),
            ("Platelets", "268 x10^9/L", "150-450", "Normal"),
            ("C-reactive protein", "5 mg/L", "<5", "Normal"),
            ("Procalcitonin", "0.05 ng/mL", "<0.5", "Normal"),
            ("Sodium", "140 mmol/L", "135-145", "Normal"),
            ("Urea", "3.6 mmol/L", "2.5-6.5", "Normal"),
            ("Venous lactate", "1.2 mmol/L", "<2.0", "Normal"),
            ("Respiratory viral PCR", "Negative", "Negative", "Normal"),
            ("Blood culture", "Not indicated - not collected", "-", "N/A"),
        ],
        "imaging_order": (
            "Chest radiograph, AP inspiratory projection, urgent. Indication: acute onset respiratory "
            "symptoms following a witnessed choking episode, with unilateral reduced air entry on the right."
        ),
        "image_file": "chest_xray/test/NORMAL/IM-0115-0001.jpeg",
        "notes": "Inspiratory AP film only. Expiratory film requested but not yet performed.",
    },
]

# manifest ground truth - NOT present in any PDF
TRUTH = {
    "IBN-001": ("PNEUMONIA", "bacterial", "admit_ward_consider_picu", "no",
                "Severe CAP: hypoxaemia 88%, grunting, unable to drink, reduced consciousness"),
    "IBN-002": ("PNEUMONIA", "viral", "discharge_home", "no",
                "Mild viral CAP: no hypoxaemia, no distress, feeding well, low PCT"),
    "IBN-003": ("PNEUMONIA", "bacterial", "observation_or_admit", "no",
                "Moderate CAP; social factors (65km, no transport, sole carer) drive admission"),
    "IBN-004": ("NORMAL", "n/a", "discharge_home", "no",
                "Bronchiolitis (RSV+) with CLEAR film - must NOT be called pneumonia"),
    "IBN-005": ("NORMAL", "n/a", "admit_for_bronchoscopy", "yes",
                "CANNOT-MISS: foreign body aspiration. Normal film is falsely reassuring"),
}


def build_pdf(case):
    styles = getSampleStyleSheet()
    body = ParagraphStyle("body", parent=styles["Normal"], fontSize=9,
                          leading=12.5, textColor=INK, spaceAfter=4)
    h1 = ParagraphStyle("h1", parent=styles["Normal"], fontSize=14,
                        leading=17, textColor=ACCENT, fontName="Helvetica-Bold",
                        alignment=TA_CENTER, spaceAfter=2)
    sub = ParagraphStyle("sub", parent=styles["Normal"], fontSize=8,
                         leading=10, textColor=colors.grey, alignment=TA_CENTER)
    h2 = ParagraphStyle("h2", parent=styles["Normal"], fontSize=10.5,
                        leading=13, textColor=colors.white,
                        fontName="Helvetica-Bold", spaceAfter=0)
    banner = ParagraphStyle("banner", parent=styles["Normal"], fontSize=8.5,
                            leading=11, textColor=WARN,
                            fontName="Helvetica-Bold", alignment=TA_CENTER)

    path = os.path.join(OUT_DIR, f"{case['mrn']}_{case['name'].split()[0]}.pdf")
    doc = SimpleDocTemplate(
        path, pagesize=A4,
        leftMargin=16 * mm, rightMargin=16 * mm,
        topMargin=14 * mm, bottomMargin=14 * mm,
        title=f"Ibn Sina ED Record {case['mrn']}",
        author="Ibn Sina - synthetic data generator",
        subject="SYNTHETIC paediatric emergency department record. Not real patient data.",
    )
    s = []

    def section(title, flowables):
        bar = Table([[Paragraph(title, h2)]], colWidths=[178 * mm])
        bar.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), ACCENT),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ("TOPPADDING", (0, 0), (-1, -1), 3),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ]))
        s.append(Spacer(1, 7))
        s.append(KeepTogether([bar, Spacer(1, 4)] + flowables))

    def kv_table(pairs, widths=(52 * mm, 126 * mm)):
        rows = [[Paragraph(f"<b>{k}</b>", body), Paragraph(str(v), body)]
                for k, v in pairs]
        t = Table(rows, colWidths=list(widths))
        t.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("ROWBACKGROUNDS", (0, 0), (-1, -1), [colors.white, MUTED]),
            ("LINEBELOW", (0, 0), (-1, -2), 0.25, colors.HexColor("#dfe3e8")),
            ("LEFTPADDING", (0, 0), (-1, -1), 5),
            ("RIGHTPADDING", (0, 0), (-1, -1), 5),
            ("TOPPADDING", (0, 0), (-1, -1), 3),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ]))
        return t

    def flag_table(header, rows, widths):
        data = [[Paragraph(f"<b>{h}</b>", body) for h in header]]
        for r in rows:
            data.append([Paragraph(str(c), body) for c in r])
        t = Table(data, colWidths=list(widths), repeatRows=1)
        style = [
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#dde5ee")),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, MUTED]),
            ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#dfe3e8")),
            ("LEFTPADDING", (0, 0), (-1, -1), 5),
            ("RIGHTPADDING", (0, 0), (-1, -1), 5),
            ("TOPPADDING", (0, 0), (-1, -1), 2.5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5),
        ]
        for i, r in enumerate(rows, start=1):
            flag = str(r[-1]).upper()
            if flag in ("HIGH", "LOW", "CRITICAL", "PROLONGED", "REDUCED",
                        "POSITIVE", "BORDERLINE LOW"):
                style.append(("TEXTCOLOR", (len(r) - 1, i), (len(r) - 1, i), WARN))
                style.append(("FONTNAME", (len(r) - 1, i), (len(r) - 1, i),
                              "Helvetica-Bold"))
        t.setStyle(TableStyle(style))
        return t

    # ---- header ----
    s.append(Paragraph("IBN SINA EMERGENCY DEPARTMENT", h1))
    s.append(Paragraph("Paediatric Encounter Record - Clinical Data Sheet", sub))
    s.append(Spacer(1, 5))
    warn = Table([[Paragraph(
        "SYNTHETIC RECORD - FICTIONAL PATIENT - NOT REAL PATIENT DATA<br/>"
        "Generated for research prototype evaluation. Not for clinical use.", banner)]],
        colWidths=[178 * mm])
    warn.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.8, WARN),
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#fef3f2")),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    s.append(warn)

    section("1. PATIENT IDENTIFICATION AND DEMOGRAPHICS", [kv_table([
        ("Medical record number", case["mrn"]),
        ("Patient name", case["name"]),
        ("Date of birth", case["dob"]),
        ("Age at presentation", case["age"]),
        ("Sex", case["sex"]),
        ("Accompanying guardian", case["guardian"]),
        ("ED arrival date/time", case["arrival"]),
        ("Mode of arrival", "Ambulatory, brought by family"),
    ])])

    section("2. INSURANCE AND ADMINISTRATIVE",
            [kv_table(list(case["insurance"].items()))])

    section("3. PRESENTING COMPLAINT", [
        kv_table([("Chief complaint", case["complaint"])]),
        Spacer(1, 3),
        Paragraph("<b>History of presenting illness</b>", body),
        Paragraph(case["hpi"], body),
    ])

    section("4. TRIAGE OBSERVATIONS AND VITAL SIGNS", [
        flag_table(["Parameter", "Value", "Interpretation"],
                   case["vitals"], (62 * mm, 46 * mm, 70 * mm))])

    section("5. CLINICAL EXAMINATION FINDINGS",
            [Paragraph(f"- {line}", body) for line in case["exam"]])

    section("6. PAST MEDICAL, DRUG, FAMILY AND SOCIAL HISTORY",
            [kv_table(list(case["history"].items()), (46 * mm, 132 * mm))])

    section("7. LABORATORY RESULTS", [
        Paragraph("<i>Results available at the time of clinician review.</i>", body),
        Spacer(1, 3),
        flag_table(["Investigation", "Result", "Reference range", "Flag"],
                   case["labs"], (54 * mm, 60 * mm, 32 * mm, 32 * mm))])

    section("8. IMAGING REQUEST AND LINKED STUDY", [
        kv_table([
            ("Imaging order", case["imaging_order"]),
            ("Linked image file", case["image_file"]),
            ("Image source", "Kermany et al. chest X-ray dataset (CC BY 4.0)"),
            ("Radiographer notes", case["notes"]),
            ("Radiology report", "NOT YET REPORTED - awaiting interpretation"),
        ])])

    section("9. RECORD STATUS", [kv_table([
        ("Diagnosis", "NOT YET ESTABLISHED - pending clinician assessment"),
        ("Disposition", "NOT YET DECIDED - pending clinician assessment"),
        ("Record completeness", "Registration, triage, clerking, labs and imaging request complete"),
        ("Data classification", "SYNTHETIC - fictional patient, safe for third-party API processing"),
    ])])

    doc.build(s)
    return path


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    rows = []
    for case in CASES:
        path = build_pdf(case)
        t = TRUTH[case["mrn"]]
        rows.append({
            "mrn": case["mrn"],
            "patient_name": case["name"],
            "age_years": case["age_years"],
            "sex": case["sex"],
            "record_pdf": os.path.relpath(path, os.path.dirname(MANIFEST)).replace("\\", "/"),
            "image_path": case["image_file"],
            "image_class": t[0],
            "pneumonia_subtype": t[1],
            "expected_disposition": t[2],
            "cannot_miss": t[3],
            "evaluation_note": t[4],
        })
        print(f"  wrote {os.path.basename(path)}")

    with open(MANIFEST, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)
    print(f"  wrote {os.path.basename(MANIFEST)}  ({len(rows)} records)")


if __name__ == "__main__":
    main()
