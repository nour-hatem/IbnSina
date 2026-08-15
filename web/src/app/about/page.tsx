import Link from "next/link";
import {
  Stethoscope,
  ShieldCheck,
  ArrowLeft,
  Activity,
  Layers,
  FileCheck2,
  Lock,
  Sparkles,
  ArrowRight,
  BrainCircuit,
  Eye,
  Microscope,
  ClipboardList,
  Info,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex flex-col">
      {/* Navigation Header */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-[var(--color-brand-600)] to-[var(--color-brand-800)] flex items-center justify-center text-white shadow-sm group-hover:scale-105 transition-transform">
              <Stethoscope className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-slate-900 flex items-center gap-2">
                IbnSina <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-[var(--color-brand-50)] text-[var(--color-brand-700)] border border-[var(--color-brand-200)]">v0.1.0</span>
              </h1>
              <p className="text-xs text-slate-500">Paediatric Emergency Decision Support System</p>
            </div>
          </Link>

          <nav className="flex items-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg transition-colors"
            >
              <Activity className="h-4 w-4 text-[var(--color-brand-600)]" />
              Tracking Board
            </Link>
            <Link
              href="/about"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[var(--color-brand-700)] hover:bg-[var(--color-brand-800)] rounded-lg transition-colors shadow-xs"
            >
              <Info className="h-4 w-4" />
              About & Workflow
            </Link>
          </nav>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-6 md:p-10 space-y-10">
        {/* Back Link & Hero */}
        <div className="space-y-4">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-[var(--color-brand-700)] transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Emergency Department Board
          </Link>

          <div className="bg-white p-8 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--color-brand-50)] text-[var(--color-brand-800)] border border-[var(--color-brand-200)] text-xs font-medium">
              <ShieldCheck className="h-4 w-4 text-[var(--color-brand-600)]" />
              Research Prototype &bull; Clinical Decision Support
            </div>
            <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
              About IbnSina & Clinical Architecture
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed max-w-3xl">
              IbnSina is a multi-agent AI system designed to assist emergency clinicians in evaluating, triaging, and managing paediatric patients presenting with acute lower respiratory complaints — specifically Community-Acquired Pneumonia (CAP) in children aged 1 to 5 years.
            </p>

            <div className="p-4 rounded-xl bg-[var(--color-brand-50)]/70 border border-[var(--color-brand-200)] text-xs text-slate-700 space-y-1">
              <span className="font-bold text-[var(--color-brand-900)] block uppercase tracking-wider">
                Clinical Research Disclaimer
              </span>
              <p className="leading-relaxed">
                IbnSina is an experimental research prototype intended solely for demonstration and clinical workflow supervision research. It is <strong>not a certified medical device</strong> and must not be used for actual patient care. All patient encounters managed within this platform use synthetic, anonymized clinical scenarios.
              </p>
            </div>
          </div>
        </div>

        {/* Section 1: The 6-Stage Multi-Agent Workflow */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-[var(--color-brand-100)] text-[var(--color-brand-800)]">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">The 6-Stage Multi-Agent Pipeline</h3>
              <p className="text-xs text-slate-500">How patient encounters progress from initial registration to disposition</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card className="border-slate-200 bg-white">
              <CardHeader className="pb-2">
                <Badge variant="outline" className="w-fit bg-[var(--color-brand-50)] text-[var(--color-brand-800)] border-[var(--color-brand-200)] text-[10px]">
                  Stage 1
                </Badge>
                <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2 mt-1">
                  <ClipboardList className="h-4 w-4 text-[var(--color-brand-600)]" />
                  Intake Agent
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-slate-600 leading-relaxed">
                Parses raw clinical registration notes into structured patient demographics, vitals, and chief complaint statements.
              </CardContent>
            </Card>

            <Card className="border-slate-200 bg-white">
              <CardHeader className="pb-2">
                <Badge variant="outline" className="w-fit bg-[var(--color-brand-100)] text-[var(--color-brand-900)] border-[var(--color-brand-300)] text-[10px]">
                  Stage 2
                </Badge>
                <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2 mt-1">
                  <Activity className="h-4 w-4 text-[var(--color-brand-600)]" />
                  Triage Agent
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-slate-600 leading-relaxed">
                Evaluates vital signs against WHO paediatric reference ranges to assign an initial Emergency Severity Index (ESI 1–5).
              </CardContent>
            </Card>

            <Card className="border-slate-200 bg-white">
              <CardHeader className="pb-2">
                <Badge variant="outline" className="w-fit bg-[var(--color-brand-200)] text-[var(--color-brand-950)] border-[var(--color-brand-400)] text-[10px]">
                  Stage 3
                </Badge>
                <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2 mt-1">
                  <BrainCircuit className="h-4 w-4 text-[var(--color-brand-700)]" />
                  History Agent
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-slate-600 leading-relaxed">
                Synthesizes presenting history into structured Subjective/Objective clinical notes (HPI and SOAP narrative).
              </CardContent>
            </Card>

            <Card className="border-slate-200 bg-white">
              <CardHeader className="pb-2">
                <Badge variant="outline" className="w-fit bg-[var(--color-brand-600)] text-white border-[var(--color-brand-700)] text-[10px]">
                  Stage 4
                </Badge>
                <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2 mt-1">
                  <Microscope className="h-4 w-4 text-[var(--color-brand-600)]" />
                  Orders Agent
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-slate-600 leading-relaxed">
                Generates evidence-based laboratory (CBC, Lactate, Blood Gas) and diagnostic imaging orders (Chest X-Ray).
              </CardContent>
            </Card>

            <Card className="border-slate-200 bg-white">
              <CardHeader className="pb-2">
                <Badge variant="outline" className="w-fit bg-[var(--color-brand-800)] text-white border-[var(--color-brand-900)] text-[10px]">
                  Stage 5
                </Badge>
                <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2 mt-1">
                  <Eye className="h-4 w-4 text-[var(--color-brand-700)]" />
                  Radiology Agent
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-slate-600 leading-relaxed">
                Multimodal vision agent processes uploaded Chest X-Rays, reporting consolidation, effusion, pneumothorax, and confidence.
              </CardContent>
            </Card>

            <Card className="border-slate-200 bg-white">
              <CardHeader className="pb-2">
                <Badge variant="outline" className="w-fit bg-[var(--color-brand-950)] text-white border-[var(--color-brand-800)] text-[10px]">
                  Stage 6
                </Badge>
                <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2 mt-1">
                  <Sparkles className="h-4 w-4 text-[var(--color-brand-600)]" />
                  Synthesis Agent
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-slate-600 leading-relaxed">
                Synthesizes all clinical findings into a final differential diagnosis, working diagnosis, and formatted ED narrative report.
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Section 2: Clinician Approval Gates */}
        <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-6">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-[var(--color-brand-100)] text-[var(--color-brand-800)]">
              <FileCheck2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Human-in-the-Loop Approval Gates</h3>
              <p className="text-xs text-slate-500">Why and when clinician intervention is required</p>
            </div>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed">
            IbnSina enforces strict human supervision. The multi-agent pipeline pauses at <strong>two critical clinical checkpoints</strong> where an attending physician or nurse practitioner must review, edit, approve, or reject recommendations before execution continues:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl border border-[var(--color-brand-300)] bg-[var(--color-brand-50)]/50 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[var(--color-brand-900)] text-xs uppercase tracking-wider">
                  Gate 1: Radiology Gate
                </span>
                <Badge variant="outline" className="bg-[var(--color-brand-100)] text-[var(--color-brand-900)] border-[var(--color-brand-300)] text-[10px]">
                  Orders & Imaging Review
                </Badge>
              </div>
              <p className="text-xs text-slate-700 leading-relaxed">
                Appears after Stage 4 (Orders). Clinicians review requested lab orders, vitals, and upload optional Chest X-Ray JPEG/PNG images. Clicking <strong>Approve & Proceed</strong> triggers the Radiology vision agent.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-[var(--color-brand-300)] bg-[var(--color-brand-50)]/50 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[var(--color-brand-900)] text-xs uppercase tracking-wider">
                  Gate 2: Synthesis Gate
                </span>
                <Badge variant="outline" className="bg-[var(--color-brand-100)] text-[var(--color-brand-900)] border-[var(--color-brand-300)] text-[10px]">
                  Final Assessment Review
                </Badge>
              </div>
              <p className="text-xs text-slate-700 leading-relaxed">
                Appears after Stage 5 (Radiology). Clinicians review the CXR read, image findings, and limitations before authorizing final synthesis. Approving this gate finalizes the ED report narrative and disposition.
              </p>
            </div>
          </div>
        </div>

        {/* Section 3: Safety Principles */}
        <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-[var(--color-brand-100)] text-[var(--color-brand-800)]">
              <Lock className="h-5 w-5" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Safety & Governance Principles</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <span className="font-bold text-slate-900 block">Deterministic Scoring</span>
              <p className="text-slate-600 leading-relaxed">
                Severity (WHO classification & PIDS/IDSA guidelines) is calculated strictly via code rules, never LLM generated.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <span className="font-bold text-slate-900 block">Rule-Based Disposition</span>
              <p className="text-slate-600 leading-relaxed">
                Patient disposition (Discharge, General Ward, PICU) is derived from deterministic severity thresholds.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <span className="font-bold text-slate-900 block">Immutable Audit Log</span>
              <p className="text-slate-600 leading-relaxed">
                Every gate action, timestamp, approving clinician ID, and state mutation is logged persistently.
              </p>
            </div>
          </div>
        </div>

        {/* Call to Action */}
        <div className="p-8 rounded-2xl bg-gradient-to-r from-[var(--color-brand-900)] to-[var(--color-brand-800)] text-white flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-md">
          <div className="space-y-1">
            <h4 className="text-xl font-bold">Ready to explore active encounters?</h4>
            <p className="text-xs text-[var(--color-brand-200)]">
              Experience the multi-agent clinical workflow firsthand using synthetic patient scenarios.
            </p>
          </div>
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-bold text-[var(--color-brand-950)] bg-white hover:bg-slate-100 rounded-xl transition-all shadow-xs shrink-0"
          >
            Open Tracking Board
            <ArrowRight className="h-4 w-4 text-[var(--color-brand-700)]" />
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-4 px-6 text-center text-xs text-slate-400">
        IbnSina Clinical Decision Support Platform &bull; Paediatric Scope (Ages 1–5) &bull; Production Infrastructure
      </footer>
    </div>
  );
}
