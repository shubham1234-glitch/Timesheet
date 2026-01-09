export type CsvColumn<T> = { key: keyof T; header: string };

export function exportToCSV<T extends Record<string, any>>(
  filename: string,
  columns: CsvColumn<T>[],
  rows: T[],
  options?: { forceTextKeys?: (keyof T)[] }
) {
  const forceSet = new Set(options?.forceTextKeys as (keyof T)[] | undefined);

  const escape = (val: any, forceText?: boolean) => {
    if (val === null || val === undefined) return "";
    const s = String(val).replace(/"/g, '""');
    const quoted = /[",\n]/.test(s) ? `"${s}"` : s;
    return forceText ? `="${quoted}"` : quoted;
  };

  const header = columns.map(c => escape(c.header)).join(",");
  const lines = rows.map(r => columns
    .map(c => escape(r[c.key] as any, forceSet?.has(c.key)))
    .join(",")
  );
  const csv = [header, ...lines].join("\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", filename.endsWith('.csv') ? filename : `${filename}.csv`);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}


