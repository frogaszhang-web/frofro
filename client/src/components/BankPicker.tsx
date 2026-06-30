import type { Bank } from "../api.js";

export function BankPicker({ banks, value, onChange }: {
  banks: Bank[]; value: string; onChange: (v: string) => void;
}) {
  return (
    <select
      className="rounded-lg border px-3 py-2 text-sm"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {banks.map((b) => (
        <option key={b.name} value={b.name}>
          {b.name} — {b.tier}{typeof b.match === "number" ? ` (match ${b.match})` : ""}
        </option>
      ))}
    </select>
  );
}
