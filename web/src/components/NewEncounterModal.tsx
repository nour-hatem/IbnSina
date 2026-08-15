"use client";

import { useState } from "react";
import { createEncounter, ApiError } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Loader2, AlertCircle } from "lucide-react";

interface NewEncounterModalProps {
  onCreated?: () => void;
}

export function NewEncounterModal({ onCreated }: NewEncounterModalProps) {
  const [open, setOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [age, setAge] = useState("");
  const [ageUnit, setAgeUnit] = useState<"years" | "months">("years");
  const [sex, setSex] = useState<"male" | "female" | "other">("male");
  const [chiefComplaint, setChiefComplaint] = useState("");
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetForm = () => {
    setFullName("");
    setAge("");
    setAgeUnit("years");
    setSex("male");
    setChiefComplaint("");
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !age || !chiefComplaint.trim()) {
      setError("Please complete all required fields.");
      return;
    }

    const numAge = Number(age);
    if (isNaN(numAge) || numAge <= 0) {
      setError("Please enter a valid age.");
      return;
    }

    const ageInMonths = ageUnit === "years" ? numAge * 12 : numAge;

    // Structured, deterministic registration string preventing intake agent parse bugs
    const rawRegistration = `${fullName.trim()}, ${numAge} ${ageUnit} old (${ageInMonths} months), ${sex} child presenting with chief complaint: ${chiefComplaint.trim()}`;

    try {
      setLoading(true);
      setError(null);
      await createEncounter({ raw_registration: rawRegistration });
      setOpen(false);
      resetForm();
      if (onCreated) {
        onCreated();
      }
    } catch (err: any) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError(err?.message || "Failed to create encounter. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(val) => { setOpen(val); if (!val) resetForm(); }}>
      <DialogTrigger className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-[var(--color-brand-700)] hover:bg-[var(--color-brand-800)] border border-[var(--color-brand-800)] rounded-lg transition-colors shadow-xs cursor-pointer">
        <Plus className="h-4 w-4" />
        New Encounter
      </DialogTrigger>

      <DialogContent className="sm:max-w-[480px] bg-white border-slate-200 p-6 rounded-xl">
        <DialogHeader className="space-y-1">
          <DialogTitle className="text-lg font-bold text-slate-900">
            Register Paediatric Encounter
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Enter patient details to initialize multi-agent triage and diagnostic supervision.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {error && (
            <div className="p-3 rounded-lg bg-[var(--color-brand-50)] border border-[var(--color-brand-300)] text-[var(--color-brand-900)] text-xs flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-[var(--color-brand-700)] shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Full Name */}
          <div className="space-y-1.5">
            <Label htmlFor="fullName" className="text-xs font-semibold text-slate-700">
              Patient Full Name *
            </Label>
            <Input
              id="fullName"
              placeholder="e.g. Tariq Al-Mansoor"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              disabled={loading}
              className="border-slate-200 focus:border-[var(--color-brand-500)] text-sm"
              required
            />
          </div>

          {/* Age & Unit */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="age" className="text-xs font-semibold text-slate-700">
                Age *
              </Label>
              <Input
                id="age"
                type="number"
                min="1"
                max="120"
                placeholder="e.g. 3"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                disabled={loading}
                className="border-slate-200 focus:border-[var(--color-brand-500)] text-sm"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ageUnit" className="text-xs font-semibold text-slate-700">
                Unit
              </Label>
              <Select
                value={ageUnit}
                onValueChange={(val) => {
                  if (val) setAgeUnit(val as "years" | "months");
                }}
                disabled={loading}
              >
                <SelectTrigger id="ageUnit" className="border-slate-200 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="years">Years</SelectItem>
                  <SelectItem value="months">Months</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Sex */}
          <div className="space-y-1.5">
            <Label htmlFor="sex" className="text-xs font-semibold text-slate-700">
              Biological Sex *
            </Label>
            <Select
              value={sex}
              onValueChange={(val) => {
                if (val) setSex(val as "male" | "female" | "other");
              }}
              disabled={loading}
            >
              <SelectTrigger id="sex" className="border-slate-200 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="female">Female</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Chief Complaint */}
          <div className="space-y-1.5">
            <Label htmlFor="chiefComplaint" className="text-xs font-semibold text-slate-700">
              Chief Complaint & Symptoms *
            </Label>
            <Textarea
              id="chiefComplaint"
              placeholder="e.g. 3-day history of high fever (39°C), persistent cough, and mild shortness of breath."
              value={chiefComplaint}
              onChange={(e) => setChiefComplaint(e.target.value)}
              disabled={loading}
              rows={3}
              className="border-slate-200 focus:border-[var(--color-brand-500)] text-sm"
              required
            />
          </div>

          <DialogFooter className="pt-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-[var(--color-brand-700)] hover:bg-[var(--color-brand-800)] rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Initialize Encounter"
              )}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
