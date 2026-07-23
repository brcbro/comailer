"use client";

import {
  parseRecipientsText,
  parseSheetRows,
  type RecipientRow,
} from "@/lib/parse-recipients";

/** Parse a CSV or Excel (.xlsx / .xls) upload — client only (keeps xlsx out of the Worker bundle). */
export async function parseRecipientsFile(file: File): Promise<RecipientRow[]> {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";

  if (ext === "csv" || file.type === "text/csv") {
    return parseRecipientsText(await file.text());
  }

  if (ext === "xlsx" || ext === "xls" || ext === "xlsm") {
    const XLSX = await import("xlsx");
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) return [];

    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: "",
      raw: false,
    });

    if (rows.length === 0) {
      const matrix = XLSX.utils.sheet_to_json<(string | number)[]>(sheet, {
        header: 1,
        defval: "",
        raw: false,
      }) as (string | number)[][];
      const text = matrix.map((row) => row.map(String).join(",")).join("\n");
      return parseRecipientsText(text);
    }

    return parseSheetRows(rows);
  }

  throw new Error("Unsupported file type. Upload a .csv, .xlsx, or .xls file.");
}

export const RECIPIENT_FILE_ACCEPT =
  ".csv,.xlsx,.xls,.xlsm,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
