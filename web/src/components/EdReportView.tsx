"use client";

import { useEffect, useState } from "react";
import { getEncounter, ApiError } from "@/lib/api";
import type { PatientEncounter, DifferentialItem } from "@/lib/types";
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
  FileText,
  ShieldCheck,
  AlertCircle,
  Loader2,
  Activity,
  Stethoscope,
  CheckCircle2,
  AlertTriangle,
  Info,
} from "lucide-react";

interface EdReportViewProps {
  encounterId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EdReportView({
  encounterId,
  open,
  onOpenChange,
}: EdReportViewProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [encounterState, setEncounterState] = useState<PatientEncounter | null>(null);
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    if (!open || !encounterId) return;

    async function fetchReportData() {
      try {
        setLoading(true);
        setError(null);
        const detail = await getEncounter(encounterId);

        if (detail.status !== "complete") {
          setError(
            `Encounter is currently in progress (${detail.status.toUpperCase()}). The final Emergency Department (ED) report is only generated once all clinician approval gates are completed.`
          );
          setEncounterState(detail.state);
          setIsComplete(false);
        } else {
          setEncounterState(detail.state);
          setIsComplete(true);
        }
      } catch (err: unknown) {
        if (err instanceof ApiError) {
          setError(err.message);
        } else {
          setError("Failed to load clinical encounter report.");
        }
      } finally {
        setLoading(false);
      }
    }

    fetchReportData();
  }, [encounterId, open]);

  // Helper to parse and render Markdown lines safely without external dependencies
  const renderFormattedMarkdown = (markdownText: string) => {
    if (!markdownText) return null;

    const lines = markdownText.split("\n");
    const elements: React.ReactNode[] = [];

    lines.forEach((line, idx) => {
      const trimmed = line.trim();
      if (!trimmed) {
        elements.push(<div key={idx} className="h-2" />);
        return;
      }

      // Horizontal Rule
      if (trimmed === "---") {
        elements.push(
          <hr key={idx} className="my-3 border-slate-200" />
        );
        return;
      }

      // Headers (### or ## or #)
      if (trimmed.startsWith("#")) {
        const level = trimmed.match(/^#+/)?.[0].length || 1;
        const text = trimmed.replace(/^#+\s*/, "");
        const headerClass =
          level === 1
            ? "text-base font-bold text-[var(--color-brand-900)] mt-3 mb-1"
            : level === 2
            ? "text-sm font-bold text-slate-900 mt-3 mb-1"
            : "text-xs font-semibold text-slate-800 mt-2 mb-1";

        elements.push(
          <div key={idx} className={headerClass}>
            {parseBoldText(text)}
          </div>
        );
        return;
      }

      // Bullet items (- or *)
      if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
        const text = trimmed.replace(/^[-*]\s*/, "");
        elements.push(
          <div key={idx} className="flex items-start gap-2 text-xs text-slate-700 ml-2 my-0.5">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-brand-600)] mt-1.5 shrink-0" />
            <span>{parseBoldText(text)}</span>
          </div>
        );
        return;
      }

      // Default paragraph line
      elements.push(
        <p key={idx} className="text-xs text-slate-700 leading-relaxed my-1">
          {parseBoldText(trimmed)}
        </p>
      );
    });

    return elements;
  };

  // Helper to parse inline **bold text**
  const parseBoldText = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return (
          <strong key={i} className="font-semibold text-slate-900">
            {part.slice(2, -2)}
          </strong>
        );
      }
      return part;
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-white p-6 border-slate-200 text-slate-900 rounded-xl">
        <DialogHeader className="pb-3 border-b border-slate-100">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-[var(--color-brand-100)] text-[var(--color-brand-800)]">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  Emergency Department Final Synthesis Report
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500 font-mono">
                  Encounter ID: {encounterId}
                </DialogDescription>
              </div>
            </div>
            {isComplete && (
              <Badge variant="outline" className="bg-[var(--color-brand-700)] text-white text-xs border-[var(--color-brand-800)]">
                Finalized
              </Badge>
            )}
          </div>
        </DialogHeader>

        {/* Loading State */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-12 gap-3 text-slate-500">
            <Loader2 className="h-8 w-8 animate-spin text-[var(--color-brand-600)]" />
            <p className="text-xs font-medium">Fetching encounter synthesis report...</p>
          </div>
        )}

        {/* Error / In-Progress State */}
        {!loading && error && (
          <div className="p-4 rounded-lg bg-[var(--color-brand-50)] border border-[var(--color-brand-300)] text-[var(--color-brand-950)] text-xs space-y-2 my-4">
            <div className="flex items-center gap-2 font-semibold text-[var(--color-brand-900)]">
              <AlertCircle className="h-4 w-4 text-[var(--color-brand-700)] shrink-0" />
              <span>Report Unavailable</span>
            </div>
            <p className="text-[11px] leading-relaxed text-slate-700">{error}</p>
          </div>
        )}

        {/* Completed Report Content */}
        {!loading && encounterState && isComplete && (
          <div className="space-y-6 pt-3 text-xs">
            {/* Structured Highlights Box (Clinician Executive Summary) */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <Stethoscope className="h-4 w-4 text-[var(--color-brand-700)]" />
                Clinician Summary & Structured Assessments
              </h3>

              {/* 1. Working Diagnosis */}
              <div className="p-3.5 rounded-lg border border-[var(--color-brand-300)] bg-[var(--color-brand-50)]/50 space-y-1">
                <span className="text-[11px] font-semibold text-[var(--color-brand-900)] block uppercase tracking-wider">
                  Final Working Diagnosis
                </span>
                <p className="text-sm font-bold text-slate-900">
                  {encounterState.final_diagnosis || "Diagnosis pending clinical review"}
                </p>
              </div>

              {/* 2. Structured Grid: Severity + Disposition */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Disposition Box */}
                <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-900">Disposition</span>
                    <Badge variant="outline" className="text-[10px] bg-[var(--color-brand-100)] text-[var(--color-brand-900)] border-[var(--color-brand-300)]">
                      <ShieldCheck className="h-3 w-3 mr-1 text-[var(--color-brand-700)]" />
                      Computed (Rule-Based)
                    </Badge>
                  </div>
                  {encounterState.disposition ? (
                    <div>
                      <p className="font-bold text-slate-900 text-xs">
                        {encounterState.disposition.decision}
                      </p>
                      <p className="text-[11px] text-slate-600 mt-1">
                        {encounterState.disposition.rationale}
                      </p>
                    </div>
                  ) : (
                    <p className="text-slate-400 italic">No disposition computed</p>
                  )}
                </div>

                {/* Severity Score Box */}
                <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-900">Severity Assessment</span>
                    <Badge variant="outline" className="text-[10px] bg-[var(--color-brand-100)] text-[var(--color-brand-900)] border-[var(--color-brand-300)]">
                      <ShieldCheck className="h-3 w-3 mr-1 text-[var(--color-brand-700)]" />
                      Computed (Deterministic)
                    </Badge>
                  </div>
                  {encounterState.severity ? (
                    <div className="space-y-1 font-mono text-[11px]">
                      <div>
                        Classification: <span className="font-semibold text-slate-900">{encounterState.severity.classification}</span>
                      </div>
                      <div>
                        Danger Signs ({encounterState.severity.who_danger_sign_count ?? 0}):{" "}
                        <span className="font-semibold text-slate-800">
                          {encounterState.severity.who_danger_signs && encounterState.severity.who_danger_signs.length > 0
                            ? encounterState.severity.who_danger_signs.join(", ")
                            : "None"}
                        </span>
                      </div>
                      <div>
                        PIDS/IDSA Severe:{" "}
                        <span className="font-semibold text-slate-900">
                          {encounterState.severity.idsa_severe ? "Yes" : "No"}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-slate-400 italic">No severity score available</p>
                  )}
                </div>
              </div>

              {/* 3. Ranked Differential Diagnosis */}
              {encounterState.differential && encounterState.differential.length > 0 && (
                <div className="space-y-2">
                  <span className="font-semibold text-slate-900 block">
                    Ranked Differential Diagnosis ({encounterState.differential.length})
                  </span>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {encounterState.differential.map((diff: DifferentialItem, idx: number) => (
                      <div
                        key={idx}
                        className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-900">
                              {idx + 1}. {diff.diagnosis}
                            </span>
                            {diff.icd10 && (
                              <span className="font-mono text-[10px] text-slate-500">[{diff.icd10}]</span>
                            )}
                            {diff.cannot_miss && (
                              <Badge variant="outline" className="bg-[var(--color-brand-100)] text-[var(--color-brand-900)] border-[var(--color-brand-300)] text-[9px] py-0">
                                Cannot-Miss
                              </Badge>
                            )}
                          </div>
                          {diff.supporting_evidence && diff.supporting_evidence.length > 0 && (
                            <p className="text-[11px] text-slate-600">
                              Supporting: {diff.supporting_evidence.join(", ")}
                            </p>
                          )}
                        </div>
                        <Badge
                          variant="secondary"
                          className="shrink-0 text-[10px] uppercase font-mono self-start sm:self-center bg-slate-200 text-slate-800"
                        >
                          Likelihood: {diff.likelihood}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Narrative ED Report (Formatted Markdown Text) */}
            <div className="pt-4 border-t border-slate-200 space-y-3">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="h-4 w-4 text-[var(--color-brand-700)]" />
                Emergency Department Report Narrative
              </h3>
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/40 text-slate-800 font-sans leading-relaxed">
                {encounterState.ed_report_md
                  ? renderFormattedMarkdown(encounterState.ed_report_md)
                  : <p className="text-slate-400 italic">No report narrative generated.</p>}
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg transition-colors cursor-pointer"
          >
            Close Report
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
