"use client";

import { useState } from "react";
import { approveGate, uploadCXR, ApiError } from "@/lib/api";
import type { PatientEncounter } from "@/lib/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  AlertCircle,
  FileText,
  Upload,
  Activity,
  Microscope,
  Eye,
  ShieldAlert,
} from "lucide-react";

interface ClinicalGateApprovalProps {
  encounterId: string;
  gate: "radiology" | "synthesis";
  encounterState: PatientEncounter;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onActionComplete: () => void;
}

export function ClinicalGateApproval({
  encounterId,
  gate,
  encounterState,
  open,
  onOpenChange,
  onActionComplete,
}: ClinicalGateApprovalProps) {
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [notes, setNotes] = useState("");

  const isRadiologyGate = gate === "radiology";

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      setError(null);
      setUploadSuccess(null);
      const res = await uploadCXR(encounterId, file);
      setUploadSuccess(`Chest X-ray image uploaded successfully (${res.cxr_path.split("/").pop()})`);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to upload Chest X-ray image.");
      }
    } finally {
      setUploading(false);
    }
  };

  const handleDecision = async (action: "accept" | "reject") => {
    try {
      setLoading(true);
      setError(null);

      await approveGate(encounterId, {
        gate,
        approved_by: "attending_clinician",
        action,
        edits: notes.trim() ? { clinician_notes: notes.trim() } : null,
      });

      onOpenChange(false);
      onActionComplete();
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError(`Failed to submit gate ${action}. Please try again.`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px] max-h-[90vh] overflow-y-auto bg-white border-slate-200 p-6 rounded-xl space-y-4">
        {/* Header */}
        <DialogHeader className="space-y-1">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-[var(--color-brand-100)] text-[var(--color-brand-900)] border-[var(--color-brand-300)] uppercase text-[10px]">
              Clinician Gate Approval
            </Badge>
            <Badge variant="outline" className="bg-[var(--color-brand-800)] text-white border-[var(--color-brand-900)] capitalize text-[10px]">
              {gate} Stage
            </Badge>
          </div>
          <DialogTitle className="text-xl font-bold text-slate-900 pt-1">
            {isRadiologyGate ? "Approve Orders & Imaging Gate" : "Approve Final Synthesis & Assessment Gate"}
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Encounter ID: <span className="font-mono text-slate-700">{encounterId}</span> — Review AI recommendations before advancing the clinical state graph.
          </DialogDescription>
        </DialogHeader>

        {/* Error Alert */}
        {error && (
          <div className="p-3 rounded-lg bg-[var(--color-brand-50)] border border-[var(--color-brand-300)] text-[var(--color-brand-900)] text-xs flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-[var(--color-brand-700)] shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Success Alert for Image Upload */}
        {uploadSuccess && (
          <div className="p-3 rounded-lg bg-[var(--color-brand-100)] border border-[var(--color-brand-400)] text-[var(--color-brand-950)] text-xs flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-[var(--color-brand-800)] shrink-0" />
            <span>{uploadSuccess}</span>
          </div>
        )}

        {/* Gate 1: Radiology Gate Review Content */}
        {isRadiologyGate && (
          <div className="space-y-4 text-xs text-slate-700">
            {/* Patient & Vitals Summary */}
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-900 flex items-center gap-1.5">
                  <Activity className="h-3.5 w-3.5 text-[var(--color-brand-700)]" />
                  Patient Summary
                </span>
                <span className="text-slate-500 font-mono">
                  {encounterState.patient?.full_name || "Unnamed"} ({encounterState.patient?.age_display || "Age N/A"}, {encounterState.patient?.sex || "Sex N/A"})
                </span>
              </div>
              {encounterState.vitals && (
                <div className="grid grid-cols-4 gap-2 pt-1 border-t border-slate-200/60 font-mono text-[11px]">
                  <div>Temp: <span className="font-semibold">{encounterState.vitals.temp_c ?? "—"}°C</span></div>
                  <div>HR: <span className="font-semibold">{encounterState.vitals.hr ?? "—"} bpm</span></div>
                  <div>RR: <span className="font-semibold">{encounterState.vitals.rr ?? "—"} /min</span></div>
                  <div>SpO2: <span className="font-semibold">{encounterState.vitals.spo2 ?? "—"}%</span></div>
                </div>
              )}
            </div>

            {/* Proposed Imaging Orders */}
            <div className="space-y-2">
              <span className="font-bold text-slate-900 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <Eye className="h-3.5 w-3.5 text-[var(--color-brand-700)]" />
                Proposed Imaging Orders
              </span>
              {encounterState.imaging_orders && encounterState.imaging_orders.length > 0 ? (
                <div className="space-y-1.5">
                  {encounterState.imaging_orders.map((img, idx) => (
                    <div key={idx} className="p-2.5 rounded-lg border border-[var(--color-brand-200)] bg-[var(--color-brand-50)]/40 flex items-start justify-between">
                      <div>
                        <span className="font-semibold text-[var(--color-brand-900)]">{img.modality} ({img.view})</span>
                        <p className="text-[11px] text-slate-600 mt-0.5">{img.rationale}</p>
                      </div>
                      <Badge variant="outline" className="bg-[var(--color-brand-700)] text-white text-[10px]">
                        {img.urgency}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-400 italic">No imaging orders proposed.</p>
              )}
            </div>

            {/* CXR Image Upload Controls */}
            <div className="p-3 rounded-lg border border-dashed border-[var(--color-brand-300)] bg-[var(--color-brand-50)]/30 space-y-2">
              <span className="font-semibold text-slate-900 flex items-center gap-1.5">
                <Upload className="h-3.5 w-3.5 text-[var(--color-brand-700)]" />
                Upload Chest Radiograph (CXR) Image
              </span>
              <p className="text-[11px] text-slate-500">
                Optional: Select a chest X-ray image file for the vision model agent to process during the radiology stage.
              </p>
              <input
                type="file"
                accept="image/jpeg,image/png"
                onChange={handleFileUpload}
                disabled={uploading || loading}
                className="block w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-[var(--color-brand-700)] file:text-white hover:file:bg-[var(--color-brand-800)] file:cursor-pointer"
              />
            </div>

            {/* Proposed Lab Orders */}
            <div className="space-y-2">
              <span className="font-bold text-slate-900 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <Microscope className="h-3.5 w-3.5 text-[var(--color-brand-700)]" />
                Proposed Lab Orders ({encounterState.lab_orders?.length || 0})
              </span>
              {encounterState.lab_orders && encounterState.lab_orders.length > 0 && (
                <div className="max-h-36 overflow-y-auto space-y-1 border border-slate-200 rounded-lg p-2 bg-slate-50/50">
                  {encounterState.lab_orders.map((lab, idx) => (
                    <div key={idx} className="flex items-center justify-between text-[11px] py-1 border-b border-slate-100 last:border-0">
                      <div>
                        <span className="font-medium text-slate-900">{lab.name}</span>
                        <span className="text-slate-400 font-mono ml-2">[{lab.code}]</span>
                      </div>
                      <Badge variant="secondary" className="text-[10px] bg-slate-200 text-slate-800">
                        {lab.priority}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Gate 2: Synthesis Gate Review Content */}
        {!isRadiologyGate && (
          <div className="space-y-4 text-xs text-slate-700">
            {/* Radiology CXR Read Summary */}
            <div className="space-y-2">
              <span className="font-bold text-slate-900 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-[var(--color-brand-700)]" />
                Radiology Vision Preliminary Read
              </span>
              {encounterState.cxr_read ? (
                <div className="p-3 rounded-lg border border-[var(--color-brand-300)] bg-[var(--color-brand-50)]/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-900">
                      Impression: {encounterState.cxr_read.impression}
                    </span>
                    <Badge variant="outline" className="bg-[var(--color-brand-800)] text-white text-[10px]">
                      Likelihood: {encounterState.cxr_read.pneumonia_likelihood}
                    </Badge>
                  </div>

                  <div>
                    <span className="font-medium text-slate-700 block">Findings:</span>
                    <ul className="list-disc list-inside space-y-0.5 text-slate-600 pt-0.5">
                      {encounterState.cxr_read.findings.map((f, i) => (
                        <li key={i}>{f}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="pt-1 border-t border-[var(--color-brand-200)] flex items-center justify-between text-[11px] text-slate-500 font-mono">
                    <span>Model: {encounterState.cxr_read.model_used}</span>
                    <span>Confidence: {(encounterState.cxr_read.confidence * 100).toFixed(0)}%</span>
                  </div>

                  <div className="p-2 rounded bg-white/80 border border-slate-200 text-[11px] text-slate-600 italic">
                    <span className="font-semibold text-slate-700">Limitations: </span>
                    {encounterState.cxr_read.limitations}
                  </div>
                </div>
              ) : (
                <p className="text-slate-400 italic">No radiology read available.</p>
              )}
            </div>

            {/* Accumulated Clinical HPI & SOAP Note */}
            {encounterState.hpi && (
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                <span className="font-semibold text-slate-900 block">History of Present Illness (HPI):</span>
                <p className="text-[11px] text-slate-700">{encounterState.hpi}</p>
              </div>
            )}
          </div>
        )}

        {/* Optional Notes Input */}
        <div className="space-y-1 pt-2 border-t border-slate-200">
          <label htmlFor="clinicianNotes" className="text-xs font-semibold text-slate-700 block">
            Clinician Review Notes (Optional)
          </label>
          <input
            id="clinicianNotes"
            type="text"
            placeholder="Add comments or instructions for the audit trail..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={loading}
            className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:border-[var(--color-brand-500)] outline-none"
          />
        </div>

        {/* Actions Footer (Strict Blue Palette) */}
        <DialogFooter className="pt-3 gap-2">
          <button
            type="button"
            onClick={() => handleDecision("reject")}
            disabled={loading || uploading}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-[var(--color-brand-900)] bg-[var(--color-brand-100)] hover:bg-[var(--color-brand-200)] border border-[var(--color-brand-300)] rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5 text-[var(--color-brand-800)]" />}
            Reject Gate
          </button>
          <button
            type="button"
            onClick={() => handleDecision("accept")}
            disabled={loading || uploading}
            className="inline-flex items-center justify-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-[var(--color-brand-700)] hover:bg-[var(--color-brand-800)] border border-[var(--color-brand-800)] rounded-lg transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            Approve & Proceed
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
