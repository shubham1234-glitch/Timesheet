import { exportToCSV } from "@/app/lib/export";

type Row = { Day: string; Title: string; Hours: string; Member?: string };

export function exportTimesheetCsv(filename: string, rows: Row[]) {
  exportToCSV(filename, [
    { key: "Member", header: "Member" },
    { key: "Day", header: "Day" },
    { key: "Title", header: "Title" },
    { key: "Hours", header: "Hours" },
  ] as any, rows as any);
}


