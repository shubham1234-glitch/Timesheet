import { exportToCSV } from "@/app/lib/export";
import { LeaveRow } from "@/app/types/domain";

export function exportLeaveCsv(filename: string, rows: LeaveRow[]) {
  exportToCSV(filename, [
    { key: "fromDate", header: "From Date" },
    { key: "toDate", header: "To Date" },
    { key: "type", header: "Type" },
    { key: "days", header: "Days" },
    { key: "status", header: "Status" },
    { key: "reason", header: "Reason" },
    { key: "approver", header: "Approver" },
  ] as any, rows as any, { forceTextKeys: ["fromDate", "toDate"] as any });
}


