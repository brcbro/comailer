"use client";

import { useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  countRecipientsInText,
  recipientsToText,
} from "@/lib/parse-recipients";
import {
  parseRecipientsFile,
  RECIPIENT_FILE_ACCEPT,
} from "@/lib/parse-recipients-file";

interface RecipientImportProps {
  value: string;
  onChange: (value: string) => void;
  /** textarea rows */
  rows?: number;
  required?: boolean;
  id?: string;
  placeholder?: string;
  helperText?: string;
}

export function RecipientImport({
  value,
  onChange,
  rows = 6,
  required = true,
  id = "recipients",
  placeholder = "user1@example.com, Alice\nuser2@example.com, Bob",
  helperText = "Paste recipients, or upload a CSV / Excel file (.csv, .xlsx, .xls). Duplicates are skipped.",
}: RecipientImportProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadInfo, setUploadInfo] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const count = countRecipientsInText(value);

  async function handleFile(file: File | null) {
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    setUploadInfo(null);
    try {
      const rows = await parseRecipientsFile(file);
      if (rows.length === 0) {
        throw new Error("No valid email addresses found in that file.");
      }
      onChange(recipientsToText(rows));
      setUploadInfo(`Loaded ${rows.length.toLocaleString()} recipient(s) from ${file.name}`);
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : "Failed to read file");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <label
          htmlFor={id}
          className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block"
        >
          Recipients (paste or upload CSV / Excel)
        </label>
        <span className="text-xs font-bold text-primary bg-primary/10 px-2.5 py-0.5 rounded-full border border-primary/20 w-fit">
          {count.toLocaleString()} valid email(s)
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept={RECIPIENT_FILE_ACCEPT}
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
        />
        <button
          type="button"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-surface-container border border-outline-variant/30 text-on-surface hover:bg-surface-container-high hover:border-primary/30 transition-colors cursor-pointer disabled:opacity-50"
        >
          {uploading ? (
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
          ) : (
            <span className="material-symbols-outlined text-base text-primary">upload_file</span>
          )}
          <span>{uploading ? "Reading file…" : "Upload CSV / Excel"}</span>
        </button>
        {value && (
          <button
            type="button"
            onClick={() => {
              onChange("");
              setUploadInfo(null);
              setUploadError(null);
            }}
            className="inline-flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-bold text-on-surface-variant hover:text-error hover:bg-error-container/30 transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-base">delete_sweep</span>
            Clear
          </button>
        )}
      </div>

      {uploadInfo && (
        <p className="text-[11px] text-primary font-semibold flex items-center gap-1">
          <span className="material-symbols-outlined text-sm">check_circle</span>
          {uploadInfo}
        </p>
      )}
      {uploadError && (
        <p className="text-[11px] text-error font-semibold flex items-center gap-1">
          <span className="material-symbols-outlined text-sm">error</span>
          {uploadError}
        </p>
      )}

      <textarea
        id={id}
        required={required && count === 0}
        rows={rows}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setUploadError(null);
        }}
        placeholder={placeholder}
        className="w-full p-3.5 bg-surface-container border border-outline-variant/30 rounded-2xl text-on-surface font-mono text-xs focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 leading-relaxed resize-y min-h-[120px] max-h-[220px] scrollbar-theme"
      />

      <p className="text-[11px] text-on-surface-variant leading-relaxed">{helperText}</p>
      <p className="text-[10px] text-on-surface-variant/80">
        Excel/CSV tip: include an <span className="font-mono">email</span> column (and optional{" "}
        <span className="font-mono">name</span> column). One row per recipient.
      </p>
    </div>
  );
}
