"use client";

import { useEffect, useState, useRef } from "react";
import { uploadCXR, ApiError } from "@/lib/api";
import {
  Upload,
  FileImage,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
} from "lucide-react";

interface CXRUploaderProps {
  encounterId: string;
  onUploadComplete?: (cxrPath: string) => void;
  disabled?: boolean;
}

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export function CXRUploader({
  encounterId,
  onUploadComplete,
  disabled = false,
}: CXRUploaderProps) {
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadedPath, setUploadedPath] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Clean up object URL on unmount or preview URL change
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const validateFile = (file: File): string | null => {
    const validTypes = ["image/jpeg", "image/png"];
    if (!validTypes.includes(file.type)) {
      return "Invalid file type. Only JPEG (.jpg, .jpeg) and PNG (.png) images are accepted.";
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
      return `File size (${sizeMB} MB) exceeds maximum allowed limit of 10 MB.`;
    }
    return null;
  };

  const processAndUploadFile = async (file: File) => {
    setError(null);

    // Validate before uploading
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    // Revoke old object URL if exists
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    // Create preview
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    setSelectedFile(file);

    try {
      setUploading(true);
      const res = await uploadCXR(encounterId, file);
      setUploadedPath(res.cxr_path);
      if (onUploadComplete) {
        onUploadComplete(res.cxr_path);
      }
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to upload Chest Radiograph. Please try again.");
      }
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processAndUploadFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled && !uploading) {
      setDragActive(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (disabled || uploading) return;

    const file = e.dataTransfer.files?.[0];
    if (file) {
      processAndUploadFile(file);
    }
  };

  const triggerSelect = () => {
    if (!disabled && !uploading && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <div className="space-y-2 text-xs">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png"
        onChange={handleFileChange}
        disabled={disabled || uploading}
        className="hidden"
      />

      {/* Drop zone / Upload box */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={triggerSelect}
        className={`relative p-4 rounded-xl border-2 border-dashed transition-all duration-200 cursor-pointer flex flex-col items-center justify-center gap-2 ${
          dragActive
            ? "border-[var(--color-brand-600)] bg-[var(--color-brand-100)]/60"
            : uploadedPath
            ? "border-[var(--color-brand-400)] bg-[var(--color-brand-50)]/40 hover:bg-[var(--color-brand-50)]"
            : "border-[var(--color-brand-300)] bg-[var(--color-brand-50)]/20 hover:bg-[var(--color-brand-50)]/50"
        } ${disabled || uploading ? "opacity-60 cursor-not-allowed" : ""}`}
      >
        {/* Uploading Spinner State */}
        {uploading ? (
          <div className="flex flex-col items-center gap-2 py-3 text-[var(--color-brand-800)]">
            <Loader2 className="h-6 w-6 animate-spin text-[var(--color-brand-600)]" />
            <span className="font-medium text-xs">Uploading Chest Radiograph...</span>
            <span className="text-[11px] text-slate-500">{selectedFile?.name}</span>
          </div>
        ) : uploadedPath && previewUrl ? (
          /* Upload Success & Preview State */
          <div className="w-full flex flex-col sm:flex-row items-center gap-4 py-1">
            <div className="relative shrink-0 w-24 h-24 rounded-lg overflow-hidden border border-[var(--color-brand-300)] bg-slate-900 flex items-center justify-center shadow-xs">
              <img
                src={previewUrl}
                alt="CXR Preview"
                className="w-full h-full object-cover"
              />
            </div>

            <div className="flex-1 text-center sm:text-left space-y-1">
              <div className="flex items-center justify-center sm:justify-start gap-1.5 text-[var(--color-brand-900)] font-semibold">
                <CheckCircle2 className="h-4 w-4 text-[var(--color-brand-700)] shrink-0" />
                <span>Radiograph Uploaded</span>
              </div>
              <p className="text-[11px] font-mono text-slate-600 truncate max-w-[280px]">
                {selectedFile?.name || uploadedPath.split("/").pop()}
              </p>
              <p className="text-[10px] text-slate-500">
                Processed & attached for Radiology Vision Agent
              </p>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  triggerSelect();
                }}
                disabled={disabled || uploading}
                className="inline-flex items-center gap-1 mt-1 px-2.5 py-1 text-[11px] font-medium text-[var(--color-brand-800)] bg-[var(--color-brand-100)] hover:bg-[var(--color-brand-200)] border border-[var(--color-brand-300)] rounded-md transition-colors cursor-pointer"
              >
                <RefreshCw className="h-3 w-3" />
                Replace Image
              </button>
            </div>
          </div>
        ) : (
          /* Default Idle / Drag-and-Drop Prompt State */
          <div className="flex flex-col items-center gap-1.5 py-2 text-center">
            <div className="p-2 rounded-full bg-[var(--color-brand-100)] text-[var(--color-brand-800)]">
              <Upload className="h-5 w-5" />
            </div>
            <div>
              <span className="font-semibold text-slate-900">
                Click to browse
              </span>{" "}
              <span className="text-slate-500">or drag and drop chest X-ray</span>
            </div>
            <p className="text-[11px] text-slate-400">
              Supports JPEG and PNG formats (max 10 MB)
            </p>
          </div>
        )}
      </div>

      {/* Inline Error Display (Blue-only palette) */}
      {error && (
        <div className="p-2.5 rounded-lg bg-[var(--color-brand-50)] border border-[var(--color-brand-300)] text-[var(--color-brand-950)] text-xs flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-[var(--color-brand-700)] shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
