"use client";

import { useEffect, useState } from "react";
import { NewEncounterModal } from "@/components/NewEncounterModal";
import { ClinicalGateApproval } from "@/components/ClinicalGateApproval";
import { EdReportView } from "@/components/EdReportView";
import { listEncounters, getEncounter, runEncounterStep, ApiError } from "@/lib/api";
import type { EncounterSummary, PatientEncounter } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { User, Activity, Clock, CheckCircle2, AlertCircle, RefreshCw, ShieldAlert, Play, ArrowRight, Loader2, FileText } from "lucide-react";

function getEsiBadgeStyle(esi: number | null) {
  if (esi === null) return "bg-slate-100 text-slate-700 border-slate-200";
  switch (esi) {
    case 1:
      return "bg-[var(--color-brand-950)] text-white border-[var(--color-brand-800)] font-semibold shadow-sm";
    case 2:
      return "bg-[var(--color-brand-800)] text-white border-[var(--color-brand-700)] font-medium";
    case 3:
      return "bg-[var(--color-brand-600)] text-white border-[var(--color-brand-500)]";
    case 4:
      return "bg-[var(--color-brand-100)] text-[var(--color-brand-900)] border-[var(--color-brand-300)]";
    case 5:
      return "bg-[var(--color-brand-50)] text-[var(--color-brand-800)] border-[var(--color-brand-200)]";
    default:
      return "bg-slate-100 text-slate-700 border-slate-200";
  }
}

function getNodeBadgeStyle(node: string | null) {
  if (!node) return "bg-slate-100 text-slate-600 border-slate-200";
  switch (node.toLowerCase()) {
    case "intake":
      return "bg-[var(--color-brand-50)] text-[var(--color-brand-700)] border-[var(--color-brand-200)]";
    case "triage":
      return "bg-[var(--color-brand-100)] text-[var(--color-brand-800)] border-[var(--color-brand-300)]";
    case "history":
      return "bg-[var(--color-brand-200)] text-[var(--color-brand-900)] border-[var(--color-brand-400)]";
    case "orders":
      return "bg-[var(--color-brand-600)] text-white border-[var(--color-brand-700)]";
    case "radiology":
      return "bg-[var(--color-brand-800)] text-white border-[var(--color-brand-900)]";
    case "synthesis":
      return "bg-[var(--color-brand-950)] text-white border-[var(--color-brand-800)]";
    default:
      return "bg-slate-100 text-slate-600 border-slate-200";
  }
}

function formatTimestamp(isoStr: string) {
  try {
    const date = new Date(isoStr);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return isoStr;
  }
}

export function EncounterBoard() {
  const [encounters, setEncounters] = useState<EncounterSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Active approval modal state
  const [selectedEncounter, setSelectedEncounter] = useState<{
    id: string;
    gate: "radiology" | "synthesis";
    state: PatientEncounter;
  } | null>(null);
  const [approvalOpen, setApprovalOpen] = useState(false);
  const [steppingId, setSteppingId] = useState<string | null>(null);

  // ED Synthesis Report modal state
  const [reportEncounterId, setReportEncounterId] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);

  const handleOpenReport = (encounterId: string) => {
    setReportEncounterId(encounterId);
    setReportOpen(true);
  };

  const fetchBoardData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await listEncounters();
      setEncounters(res.encounters || []);
    } catch (err: any) {
      setError(err?.message || "Failed to load active encounters");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBoardData();
  }, []);

  const handleOpenGateModal = async (encounterId: string, suggestedGate?: "radiology" | "synthesis") => {
    try {
      setSteppingId(encounterId);
      const detail = await getEncounter(encounterId);
      const nextGate = detail.next?.[0] as "radiology" | "synthesis" | undefined;
      const targetGate = nextGate || suggestedGate || "radiology";

      setSelectedEncounter({
        id: encounterId,
        gate: targetGate,
        state: detail.state,
      });
      setApprovalOpen(true);
    } catch (err: any) {
      setError(err?.message || "Failed to fetch encounter details");
    } finally {
      setSteppingId(null);
    }
  };

  const handleRunStep = async (encounterId: string) => {
    try {
      setSteppingId(encounterId);
      const res = await runEncounterStep(encounterId);
      if (res.next && res.next.length > 0) {
        const nextGate = res.next[0] as "radiology" | "synthesis";
        setSelectedEncounter({
          id: encounterId,
          gate: nextGate,
          state: res.state,
        });
        setApprovalOpen(true);
      }
      await fetchBoardData();
    } catch (err: any) {
      setError(err?.message || "Failed to step encounter forward");
    } finally {
      setSteppingId(null);
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200/80 shadow-xs">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Activity className="h-5 w-5 text-[var(--color-brand-600)]" />
            Paediatric Emergency Department Tracking
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Real-time multi-agent decision support tracking active clinical encounters.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <NewEncounterModal onCreated={fetchBoardData} />
          <button
            onClick={fetchBoardData}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh Board
          </button>
        </div>
      </div>

      {/* Error View */}
      {error && (
        <div className="p-4 rounded-lg bg-[var(--color-brand-50)] border border-[var(--color-brand-300)] text-[var(--color-brand-900)] text-sm flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-[var(--color-brand-700)] shrink-0" />
          <div>
            <p className="font-semibold">Error Loading Board</p>
            <p className="text-xs text-[var(--color-brand-800)]">{error}</p>
          </div>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="border-slate-200">
              <CardHeader className="space-y-2">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </CardHeader>
              <CardContent className="space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
              </CardContent>
              <CardFooter>
                <Skeleton className="h-6 w-24" />
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && encounters.length === 0 && (
        <div className="text-center py-16 px-4 bg-white rounded-xl border border-dashed border-slate-300">
          <div className="mx-auto h-12 w-12 rounded-full bg-[var(--color-brand-50)] flex items-center justify-center text-[var(--color-brand-600)] mb-4">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <h3 className="text-base font-semibold text-slate-900">No Active Encounters</h3>
          <p className="text-sm text-slate-500 max-w-sm mx-auto mt-1">
            The emergency board is clear. New paediatric registrations will appear here in real time.
          </p>
        </div>
      )}

      {/* Encounter Grid */}
      {!loading && !error && encounters.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {encounters.map((enc) => {
            const isPendingApproval = enc.current_node === "orders" || enc.current_node === "radiology";
            const isStepping = steppingId === enc.encounter_id;
            const targetGate = enc.current_node === "radiology" ? "synthesis" : "radiology";

            return (
              <Card
                key={enc.encounter_id}
                className="group hover:border-[var(--color-brand-300)] transition-all duration-200 shadow-xs hover:shadow-md bg-white overflow-hidden border-slate-200 flex flex-col justify-between"
              >
                <div>
                  <CardHeader className="pb-3 border-b border-slate-100">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="p-2 rounded-lg bg-[var(--color-brand-50)] text-[var(--color-brand-700)]">
                          <User className="h-4 w-4" />
                        </div>
                        <div>
                          <CardTitle className="text-base font-bold text-slate-900 group-hover:text-[var(--color-brand-700)] transition-colors">
                            {enc.patient_name || "Unnamed Patient"}
                          </CardTitle>
                          <CardDescription className="text-xs font-mono text-slate-400 mt-0.5">
                            ID: {enc.encounter_id}
                          </CardDescription>
                        </div>
                      </div>
                      <Badge variant="outline" className={`shrink-0 ${getEsiBadgeStyle(enc.esi_level)}`}>
                        {enc.esi_level ? `ESI ${enc.esi_level}` : "ESI Pending"}
                      </Badge>
                    </div>
                  </CardHeader>

                  <CardContent className="pt-4 space-y-3">
                    <div>
                      <span className="text-xs font-medium text-slate-400 uppercase tracking-wider block mb-1">
                        Chief Complaint
                      </span>
                      <p className="text-sm text-slate-700 font-medium line-clamp-2">
                        {enc.chief_complaint || "No complaint recorded"}
                      </p>
                    </div>

                    {/* Pending Approval Badge Banner */}
                    {isPendingApproval && (
                      <div className="p-2.5 rounded-lg bg-[var(--color-brand-50)] border border-[var(--color-brand-300)] flex items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-1.5 font-semibold text-[var(--color-brand-900)]">
                          <ShieldAlert className="h-4 w-4 text-[var(--color-brand-700)]" />
                          Pending Clinician Approval
                        </div>
                        <button
                          onClick={() => handleOpenGateModal(enc.encounter_id, targetGate)}
                          disabled={isStepping}
                          className="px-2.5 py-1 text-[11px] font-semibold text-white bg-[var(--color-brand-700)] hover:bg-[var(--color-brand-800)] rounded-md transition-colors cursor-pointer"
                        >
                          Review & Gate
                        </button>
                      </div>
                    )}

                    {enc.disposition && (
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                        <span className="text-xs text-slate-500">Disposition</span>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs bg-slate-100 text-slate-800 font-medium">
                            {enc.disposition.replace(/_/g, " ")}
                          </Badge>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </div>

                <CardFooter className="pt-3 pb-3 bg-slate-50/60 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <div className="flex items-center gap-1.5">
                    <Activity className="h-3.5 w-3.5 text-slate-400" />
                    <span className="font-medium">Stage:</span>
                    <Badge variant="outline" className={`text-[11px] capitalize ${getNodeBadgeStyle(enc.current_node)}`}>
                      {enc.current_node || "Unstarted"}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-2">
                    {enc.disposition || enc.current_node === "synthesis" ? (
                      <button
                        onClick={() => handleOpenReport(enc.encounter_id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-[var(--color-brand-900)] bg-[var(--color-brand-100)] hover:bg-[var(--color-brand-200)] border border-[var(--color-brand-300)] rounded-md transition-colors cursor-pointer"
                      >
                        <FileText className="h-3.5 w-3.5 text-[var(--color-brand-700)]" />
                        View ED Report
                      </button>
                    ) : (
                      <button
                        onClick={() => handleRunStep(enc.encounter_id)}
                        disabled={isStepping}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-[var(--color-brand-900)] bg-[var(--color-brand-50)] hover:bg-[var(--color-brand-100)] border border-[var(--color-brand-200)] rounded-md transition-colors cursor-pointer disabled:opacity-50"
                      >
                        {isStepping ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Play className="h-3 w-3 text-[var(--color-brand-700)]" />
                        )}
                        Run Step
                      </button>
                    )}
                    <div className="flex items-center gap-1 text-slate-400 font-mono">
                      <Clock className="h-3.5 w-3.5" />
                      {formatTimestamp(enc.updated_at)}
                    </div>
                  </div>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}

      {/* Clinical Gate Approval Dialog */}
      {selectedEncounter && (
        <ClinicalGateApproval
          encounterId={selectedEncounter.id}
          gate={selectedEncounter.gate}
          encounterState={selectedEncounter.state}
          open={approvalOpen}
          onOpenChange={setApprovalOpen}
          onActionComplete={fetchBoardData}
        />
      )}

      {/* ED Synthesis Report Dialog */}
      {reportEncounterId && (
        <EdReportView
          encounterId={reportEncounterId}
          open={reportOpen}
          onOpenChange={setReportOpen}
        />
      )}
    </div>
  );
}
