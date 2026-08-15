export interface Patient {
  mrn: string;
  full_name: string;
  age_months: number;
  age_display: string;
  sex: "male" | "female" | "other";
  dob?: string | null;
  guardian?: string | null;
  weight_kg?: number | null;
}

export interface Insurance {
  provider?: string | null;
  policy_number?: string | null;
  plan?: string | null;
  coverage_status: "active" | "expired" | "unknown" | "self_pay";
  copay_note?: string | null;
}

export interface Vitals {
  temp_c?: number | null;
  hr?: number | null;
  rr?: number | null;
  sbp?: number | null;
  dbp?: number | null;
  spo2?: number | null;
  o2_supplement?: string | null;
  cap_refill_sec?: number | null;
  avpu?: "A" | "V" | "P" | "U" | null;
  weight_kg?: number | null;
  grunting?: boolean;
  nasal_flaring?: boolean;
  chest_indrawing?: boolean;
  head_bobbing?: boolean;
  unable_to_drink?: boolean;
  convulsions?: boolean;
}

export interface LabOrder {
  code: string;
  name: string;
  priority: "stat" | "routine";
  rationale: string;
  result_value?: string | null;
  result_flag?: "low" | "normal" | "high" | "critical" | null;
}

export interface ImagingOrder {
  modality: "CXR" | "CT" | "US";
  view: string;
  rationale: string;
  urgency: "stat" | "routine";
}

export interface CXRRead {
  findings: string[];
  impression: string;
  pneumonia_likelihood: "low" | "intermediate" | "high";
  laterality?: "right" | "left" | "bilateral" | "none" | null;
  multilobar?: boolean;
  pleural_effusion?: boolean;
  confidence: number;
  limitations: string;
  model_used: string;
}

export interface PaediatricSeverity {
  who_danger_signs?: string[];
  who_danger_sign_count?: number;
  classification?: "non_severe" | "severe" | "very_severe";
  tachypnoea_for_age?: boolean;
  hypoxaemia?: boolean;
  idsa_severe_criteria?: string[];
  idsa_severe?: boolean;
  components?: Record<string, boolean>;
}

// Alias for backwards compatibility
export type SeverityScores = PaediatricSeverity;

export interface DifferentialItem {
  diagnosis: string;
  icd10?: string | null;
  likelihood: "high" | "moderate" | "low";
  supporting_evidence: string[];
  refuting_evidence: string[];
  cannot_miss?: boolean;
}

export interface Disposition {
  decision:
    | "discharge_home"
    | "outpatient_clinic"
    | "observation"
    | "admit_ward"
    | "admit_picu";
  clinic_referral?: string | null;
  rationale: string;
  severity_basis: string;
  follow_up_days?: number | null;
  return_precautions?: string[];
}

export interface Approval {
  gate: string;
  approved_by: string;
  approved_at: string;
  action: "accept" | "edit" | "reject";
  edits?: Record<string, any> | null;
}

export interface PatientEncounter {
  encounter_id: string;

  // Intake
  raw_registration?: string | null;
  patient?: Patient | null;
  insurance?: Insurance | null;
  chief_complaint?: string | null;

  // Triage
  vitals?: Vitals | null;
  esi_level?: number | null;
  red_flags?: string[];

  // History
  hpi?: string | null;
  pmh?: string[];
  medications?: string[];
  allergies?: string[];
  family_hx?: string[];
  surgical_hx?: string[];
  birth_history?: string | null;
  immunisation_status?: string | null;
  developmental_status?: string | null;
  social_hx?: string | null;
  soap_note?: string | null;

  // Orders
  lab_orders?: LabOrder[];
  imaging_orders?: ImagingOrder[];
  order_rationale?: string | null;

  // Radiology
  cxr_image_path?: string | null;
  cxr_read?: CXRRead | null;

  // Synthesis
  differential?: DifferentialItem[];
  final_diagnosis?: string | null;
  severity?: PaediatricSeverity | null;
  disposition?: Disposition | null;
  ed_report_md?: string | null;

  // Audit
  approvals?: Approval[];
  errors?: string[];
  current_node?: string | null;
}

// API Endpoint Request/Response Payloads
export interface CreateEncounterRequest {
  raw_registration: string;
  vitals?: Partial<Vitals> | null;
}

export interface CreateEncounterResponse {
  encounter_id: string;
  status: string;
}

export interface GetEncounterResponse {
  encounter_id: string;
  state: PatientEncounter;
  next: string[];
  status: "not_started" | "interrupted" | "complete";
}

export interface RunEncounterResponse {
  encounter_id: string;
  state: PatientEncounter;
  next: string[];
  status: "interrupted" | "complete";
}

export interface ApproveGateRequest {
  gate: string;
  approved_by?: string;
  action?: "accept" | "edit" | "reject";
  edits?: Record<string, any> | null;
}

export interface ApproveGateResponse {
  encounter_id: string;
  state: PatientEncounter;
  next: string[];
  status: "interrupted" | "complete" | "rejected";
}

export interface UploadCXRResponse {
  encounter_id: string;
  cxr_path: string;
  status: string;
}

export interface EncounterSummary {
  encounter_id: string;
  updated_at: string;
  patient_name: string | null;
  esi_level: number | null;
  chief_complaint: string | null;
  current_node: string | null;
  disposition: string | null;
}
