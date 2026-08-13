"""
Ibn Sina — Demo runner.
Runs the full pipeline on the severe CAP case and prints results.
"""

import json
import os
import sys

from dotenv import load_dotenv

load_dotenv()

from api.graph import build_graph
from api.schemas import Approval

CXR = os.path.join(
    os.path.dirname(__file__), "..",
    "chest_xray", "chest_xray", "test", "PNEUMONIA",
    "person100_bacteria_475.jpeg",
)

if not os.path.exists(CXR):
    alt = input(f"CXR not found at {CXR}\nEnter path to a chest X-ray image: ").strip()
    if not alt or not os.path.exists(alt):
        print("No valid image path. Exiting.")
        sys.exit(1)
    CXR = alt

graph, _ = build_graph()
config = {"configurable": {"thread_id": "demo-001"}}

initial = {
    "encounter_id": "demo-001",
    "raw_registration": (
        "Patient: Yousef Mahmoud Ali\nMRN: IBN-001\n"
        "Age: 4 years (48 months)\nSex: Male\n"
        "Guardian: Mother - Hoda Ali\nWeight: 16.2 kg\n"
        "Insurance: NHIA | Policy: NHIA-4471-88213 | Status: active\n"
        "Chief complaint: Fever and difficulty breathing for 4 days, worsening today"
    ),
    "vitals": {
        "temp_c": 39.4, "hr": 148, "rr": 52, "spo2": 88,
        "sbp": 92, "dbp": 58, "cap_refill_sec": 3.0, "avpu": "V",
        "grunting": True, "nasal_flaring": True, "chest_indrawing": True,
        "head_bobbing": True, "unable_to_drink": True, "convulsions": False,
    },
    "cxr_image_path": CXR,
}

print("=" * 60)
print("IBN SINA — Severe Paediatric CAP Demo")
print("=" * 60)

# Phase 1
print("\n[Phase 1] intake -> triage -> history -> orders ...")
for event in graph.stream(initial, config, stream_mode="values"):
    pass
snap = graph.get_state(config)
print(f"  Paused at: {list(snap.next)}")

# Phase 2
print("\n[Phase 2] Approving orders -> radiology (CXR vision read) ...")
graph.update_state(
    config,
    {"approvals": [Approval(gate="radiology", approved_by="dr_ahmed", approved_at="now", action="accept")]},
)
for event in graph.stream(None, config, stream_mode="values"):
    pass
snap = graph.get_state(config)
print(f"  Paused at: {list(snap.next)}")

# Phase 3
print("\n[Phase 3] Approving CXR -> synthesis + disposition ...")
graph.update_state(
    config,
    {"approvals": [Approval(gate="synthesis", approved_by="dr_ahmed", approved_at="now", action="accept")]},
)
for event in graph.stream(None, config, stream_mode="values"):
    pass
snap = graph.get_state(config)
status = "COMPLETE" if not snap.next else list(snap.next)
print(f"  Status: {status}")

# Results
vals = snap.values

def _to_dict(obj):
    if hasattr(obj, "model_dump"):
        return obj.model_dump()
    if isinstance(obj, dict):
        return {k: _to_dict(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_to_dict(i) for i in obj]
    return obj

d = _to_dict(vals)

print("\n" + "=" * 60)
print("RESULTS")
print("=" * 60)

p = d.get("patient") or {}
print(f"\nPatient:     {p.get('full_name', '?')} | {p.get('age_display', '?')} | MRN: {p.get('mrn', '?')}")
print(f"ESI Level:   {d.get('esi_level', '?')}")
print(f"Complaint:   {d.get('chief_complaint', '?')}")

rf = d.get("red_flags") or []
print(f"\nRed Flags ({len(rf)}):")
for f in rf:
    print(f"  - {f}")

labs = d.get("lab_orders") or []
print(f"\nLab Orders ({len(labs)}):")
for l in labs:
    print(f"  [{l['priority']}] {l['name']}")

cxr = d.get("cxr_read") or {}
print(f"\n--- CXR READ (Gemini Vision) ---")
print(f"Pneumonia:   {cxr.get('pneumonia_likelihood', '?')}")
print(f"Laterality:  {cxr.get('laterality', '?')}")
print(f"Impression:  {cxr.get('impression', '?')}")
print(f"Limitations: {cxr.get('limitations', '?')}")

print(f"\n--- CLINICAL ASSESSMENT ---")
print(f"Final Dx:    {d.get('final_diagnosis', '?')}")

sev = d.get("severity") or {}
print(f"\nWHO Classification: {sev.get('classification', '?')}")
ds = sev.get("who_danger_signs") or []
print(f"Danger Signs ({sev.get('who_danger_sign_count', 0)}):")
for s in ds:
    print(f"  - {s}")
print(f"IDSA Severe: {sev.get('idsa_severe', '?')}")

disp = d.get("disposition") or {}
print(f"\nDISPOSITION: {disp.get('decision', '?')}")
print(f"  Rationale: {disp.get('rationale', '?')}")
print(f"  Basis:     {disp.get('severity_basis', '?')}")

diff = d.get("differential") or []
print(f"\nDifferential ({len(diff)}):")
for dx in diff:
    cm = " *** CANNOT-MISS ***" if dx.get("cannot_miss") else ""
    print(f"  [{dx['likelihood']}] {dx['diagnosis']}{cm}")

if d.get("ed_report_md"):
    print(f"\n--- ED REPORT ---")
    print(d["ed_report_md"][:1000])

errs = d.get("errors") or []
if errs:
    print(f"\nErrors: {errs}")
