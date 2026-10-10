// Exportación con nombres de columna en snake_case, listos para pandas.read_csv / read_json.
type Row = Record<string, string | number | boolean | null>;

export function flatten(obj: unknown, prefix = ""): Row {
  const out: Row = {};
  if (Array.isArray(obj)) obj.forEach((v, i) => Object.assign(out, flatten(v, `${prefix}${i}_`)));
  else if (obj && typeof obj === "object") Object.entries(obj).forEach(([k, v]) => Object.assign(out, flatten(v, `${prefix}${k}_`)));
  else out[prefix.slice(0, -1)] = obj as Row[string];
  return out;
}

export function toCSV(rows: Row[]): string {
  const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  const esc = (v: unknown) => { const s = v === null || v === undefined ? "" : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  return [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
}

export function download(filename: string, content: string, mime: string) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
