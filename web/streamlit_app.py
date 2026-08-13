"""
Ibn Sina — Streamlit frontend.

Encounter board with patient intake, approval gates, CXR upload, and
live state viewer. Talks to the FastAPI backend.
"""

import json

import requests
import streamlit as st


def _api_error(e: requests.RequestException) -> str:
    try:
        body = e.response.json()
        detail = body.get("detail", str(body))
        return f"{e.response.status_code}: {detail}"
    except Exception:
        return str(e)

API_URL = st.sidebar.text_input("API URL", value="http://localhost:8000")

st.set_page_config(
    page_title="Ibn Sina — ED Decision Support",
    page_icon="🏥",
    layout="wide",
)

# ---- Header ----
st.markdown("""
# 🏥 ابن سينا · Ibn Sina
### Emergency Department Decision Support System

> **Research prototype** — synthetic data only. NOT for clinical use.
> All outputs require licensed-clinician review.
""")

st.divider()

# ---- Sidebar: Active encounters ----
st.sidebar.header("Active Encounters")

if "encounters" not in st.session_state:
    st.session_state.encounters = {}
if "active_encounter" not in st.session_state:
    st.session_state.active_encounter = None


# ---- Tab layout ----
tab_new, tab_active, tab_report = st.tabs(["New Patient", "Active Encounter", "ED Report"])

# ===========================================================================
# TAB 1: NEW PATIENT
# ===========================================================================
with tab_new:
    st.subheader("Patient Registration")

    with st.form("intake_form"):
        col1, col2 = st.columns(2)

        with col1:
            st.markdown("**Patient Demographics**")
            name = st.text_input("Full name", placeholder="e.g. Yousef Mahmoud Ali")
            age_val = st.number_input("Age value", min_value=1, max_value=60, value=4)
            age_unit = st.selectbox("Age unit", ["years", "months"])
            sex = st.selectbox("Sex", ["Male", "Female"])
            guardian = st.text_input("Guardian", placeholder="Mother - name")
            weight = st.number_input("Weight (kg)", min_value=1.0, max_value=50.0, value=16.0, step=0.1)

        with col2:
            st.markdown("**Insurance**")
            ins_provider = st.text_input("Insurance provider", placeholder="NHIA or Self-pay")
            ins_policy = st.text_input("Policy number")
            ins_status = st.selectbox("Coverage", ["active", "self_pay", "expired", "unknown"])

        st.markdown("**Clinical**")
        complaint = st.text_area("Chief complaint", placeholder="Fever and difficulty breathing for 4 days")

        st.markdown("**Vital Signs**")
        vcol1, vcol2, vcol3, vcol4 = st.columns(4)
        temp = vcol1.number_input("Temp (°C)", min_value=34.0, max_value=42.0, value=38.5, step=0.1)
        hr = vcol1.number_input("Heart rate", min_value=40, max_value=250, value=130)
        rr = vcol2.number_input("Resp rate", min_value=8, max_value=80, value=40)
        spo2 = vcol2.number_input("SpO2 (%)", min_value=50, max_value=100, value=95)
        sbp = vcol3.number_input("SBP (mmHg)", min_value=40, max_value=200, value=95)
        dbp = vcol3.number_input("DBP (mmHg)", min_value=20, max_value=130, value=60)
        cap_refill = vcol4.number_input("Cap refill (s)", min_value=0.0, max_value=10.0, value=2.0, step=0.5)
        avpu = vcol4.selectbox("AVPU", ["A", "V", "P", "U"])

        st.markdown("**Danger Signs**")
        dcol1, dcol2, dcol3 = st.columns(3)
        grunting = dcol1.checkbox("Grunting")
        nasal_flaring = dcol1.checkbox("Nasal flaring")
        chest_indrawing = dcol2.checkbox("Chest indrawing")
        head_bobbing = dcol2.checkbox("Head bobbing")
        unable_drink = dcol3.checkbox("Unable to drink")
        convulsions = dcol3.checkbox("Convulsions")

        submitted = st.form_submit_button("Register Patient & Start Assessment", type="primary")

    if submitted and name and complaint:
        age_months = age_val * 12 if age_unit == "years" else age_val
        age_display = f"{age_val} {age_unit}"

        registration = (
            f"Patient: {name}\n"
            f"Age: {age_display} ({age_months} months)\n"
            f"Sex: {sex}\n"
            f"DOB: unknown\n"
            f"Guardian: {guardian}\n"
            f"Weight: {weight} kg\n"
            f"Insurance: {ins_provider} | Policy: {ins_policy} | Status: {ins_status}\n"
            f"Chief complaint: {complaint}"
        )

        vitals = {
            "temp_c": temp, "hr": hr, "rr": rr, "spo2": spo2,
            "sbp": sbp, "dbp": dbp, "cap_refill_sec": cap_refill,
            "avpu": avpu, "weight_kg": weight,
            "grunting": grunting, "nasal_flaring": nasal_flaring,
            "chest_indrawing": chest_indrawing, "head_bobbing": head_bobbing,
            "unable_to_drink": unable_drink, "convulsions": convulsions,
        }

        try:
            resp = requests.post(
                f"{API_URL}/encounter",
                json={"raw_registration": registration, "vitals": vitals},
                timeout=10,
            )
            resp.raise_for_status()
            data = resp.json()
            eid = data["encounter_id"]
            st.session_state.encounters[eid] = {"status": "created", "name": name}
            st.session_state.active_encounter = eid
            st.success(f"Encounter **{eid}** created for {name}")

            # Auto-run the graph
            with st.spinner("Running Ibn Sina agents..."):
                run_resp = requests.post(f"{API_URL}/encounter/{eid}/run", timeout=120)
                run_resp.raise_for_status()
                run_data = run_resp.json()
                st.session_state.encounters[eid] = run_data
                if run_data.get("next"):
                    st.info(f"Graph paused — awaiting approval at: **{', '.join(run_data['next'])}**")
                else:
                    st.success("Assessment complete!")

        except requests.RequestException as e:
            st.error(f"API error: {e}")


# ===========================================================================
# TAB 2: ACTIVE ENCOUNTER
# ===========================================================================
with tab_active:
    eid = st.session_state.active_encounter

    if not eid:
        st.info("No active encounter. Register a patient first.")
    else:
        st.subheader(f"Encounter: {eid}")

        # Refresh state
        col_refresh, col_upload = st.columns([1, 1])
        with col_refresh:
            if st.button("Refresh State"):
                try:
                    resp = requests.get(f"{API_URL}/encounter/{eid}", timeout=10)
                    resp.raise_for_status()
                    st.session_state.encounters[eid] = resp.json()
                except requests.RequestException as e:
                    st.error(f"Error: {e}")

        enc_data = st.session_state.encounters.get(eid, {})
        state = enc_data.get("state", {})
        next_nodes = enc_data.get("next", [])
        status = enc_data.get("status", "unknown")

        # Status badge
        if status == "interrupted":
            st.warning(f"⏸ Awaiting clinician approval at: **{', '.join(next_nodes)}**")
        elif status == "complete":
            st.success("Assessment complete")
        else:
            st.info(f"Status: {status}")

        # CXR upload
        with col_upload:
            uploaded_file = st.file_uploader("Upload Chest X-ray", type=["jpg", "jpeg", "png"])
            if uploaded_file:
                try:
                    files = {"file": (uploaded_file.name, uploaded_file.getvalue(), uploaded_file.type)}
                    resp = requests.post(f"{API_URL}/upload/cxr/{eid}", files=files, timeout=30)
                    resp.raise_for_status()
                    st.success("CXR uploaded")
                except requests.RequestException as e:
                    st.error(f"Upload error: {e}")

        # Approval buttons
        if next_nodes:
            st.subheader("Clinician Approval")
            for node in next_nodes:
                gate_label = {
                    "radiology": "Approve Orders & Proceed to CXR Read",
                    "synthesis": "Approve CXR Read & Proceed to Synthesis",
                }.get(node, f"Approve: {node}")

                acol1, acol2 = st.columns([3, 1])
                with acol1:
                    st.markdown(f"**Gate: `{node}`** — {gate_label}")
                with acol2:
                    if st.button(f"Approve", key=f"approve_{node}"):
                        try:
                            resp = requests.post(
                                f"{API_URL}/encounter/{eid}/approve",
                                json={"gate": node, "approved_by": "clinician", "action": "accept"},
                                timeout=120,
                            )
                            resp.raise_for_status()
                            data = resp.json()
                            st.session_state.encounters[eid] = data
                            st.rerun()
                        except requests.RequestException as e:
                            st.error(f"Approval error: {e}")

        # Continue / resume
        if not next_nodes and status != "complete":
            if st.button("Continue Graph Execution"):
                try:
                    resp = requests.post(f"{API_URL}/encounter/{eid}/run", timeout=120)
                    resp.raise_for_status()
                    data = resp.json()
                    st.session_state.encounters[eid] = data
                    st.rerun()
                except requests.RequestException as e:
                    st.error(f"Error: {e}")

        # State display
        st.subheader("Encounter State")
        if state:
            # Key clinical fields
            view_cols = st.columns(3)
            with view_cols[0]:
                if state.get("patient"):
                    p = state["patient"]
                    st.markdown(f"**Patient:** {p.get('full_name', 'N/A')}")
                    st.markdown(f"**Age:** {p.get('age_display', 'N/A')}")
                    st.markdown(f"**MRN:** {p.get('mrn', 'N/A')}")
                if state.get("esi_level"):
                    esi = state["esi_level"]
                    esi_color = {1: "🔴", 2: "🟠", 3: "🟡", 4: "🟢", 5: "🔵"}.get(esi, "⚪")
                    st.markdown(f"**ESI Level:** {esi_color} {esi}")

            with view_cols[1]:
                if state.get("chief_complaint"):
                    st.markdown(f"**Complaint:** {state['chief_complaint']}")
                if state.get("red_flags"):
                    st.markdown("**Red Flags:**")
                    for flag in state["red_flags"]:
                        st.markdown(f"- ⚠️ {flag}")

            with view_cols[2]:
                if state.get("severity"):
                    sev = state["severity"]
                    cls = sev.get("classification", "unknown")
                    cls_icon = {"very_severe": "🔴", "severe": "🟠", "non_severe": "🟢"}.get(cls, "⚪")
                    st.markdown(f"**Severity:** {cls_icon} {cls}")
                    ds = sev.get("who_danger_signs", [])
                    if ds:
                        st.markdown(f"**Danger signs:** {len(ds)}")
                        for s in ds:
                            st.markdown(f"- {s}")
                if state.get("disposition"):
                    d = state["disposition"]
                    dec = d.get("decision", "pending")
                    dec_icon = {
                        "admit_picu": "🔴", "admit_ward": "🟠",
                        "observation": "🟡", "discharge_home": "🟢",
                        "outpatient_clinic": "🔵",
                    }.get(dec, "⚪")
                    st.markdown(f"**Disposition:** {dec_icon} {dec}")

            # CXR read
            if state.get("cxr_read"):
                st.subheader("Chest X-ray Read")
                cxr = state["cxr_read"]
                st.markdown(f"**Impression:** {cxr.get('impression', 'N/A')}")
                st.markdown(f"**Pneumonia likelihood:** {cxr.get('pneumonia_likelihood', 'N/A')}")
                st.markdown(f"**Limitations:** {cxr.get('limitations', 'N/A')}")
                if cxr.get("findings"):
                    st.markdown("**Findings:**")
                    for f in cxr["findings"]:
                        st.markdown(f"- {f}")

            # Full JSON (collapsible)
            with st.expander("Full state JSON"):
                st.json(state)


# ===========================================================================
# TAB 3: ED REPORT
# ===========================================================================
with tab_report:
    eid = st.session_state.active_encounter
    if not eid:
        st.info("No active encounter.")
    else:
        enc_data = st.session_state.encounters.get(eid, {})
        state = enc_data.get("state", {})
        report = state.get("ed_report_md")

        if report:
            st.subheader(f"ED Report — Encounter {eid}")
            st.markdown(report)

            if state.get("differential"):
                st.subheader("Differential Diagnosis")
                for d in state["differential"]:
                    icon = "🔴" if d.get("cannot_miss") else {"high": "🟠", "moderate": "🟡", "low": "🟢"}.get(d.get("likelihood", ""), "⚪")
                    st.markdown(f"{icon} **{d.get('diagnosis', 'N/A')}** — {d.get('likelihood', 'N/A')}")
                    if d.get("supporting_evidence"):
                        st.markdown(f"  Supporting: {', '.join(d['supporting_evidence'])}")
                    if d.get("cannot_miss"):
                        st.markdown(f"  ⚠️ **Cannot-miss diagnosis**")
        else:
            st.info("No report generated yet. Complete the assessment first.")


# ---- Sidebar encounter list ----
for eid_key, enc_info in st.session_state.encounters.items():
    label = enc_info.get("name", eid_key) if isinstance(enc_info, dict) else eid_key
    status_label = enc_info.get("status", "") if isinstance(enc_info, dict) else ""
    if st.sidebar.button(f"{eid_key}: {label} [{status_label}]", key=f"switch_{eid_key}"):
        st.session_state.active_encounter = eid_key
        st.rerun()
