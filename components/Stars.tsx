"use client";

export default function Stars({ value, onChange }: { value: number | null; onChange?: (v: number) => void }) {
  return (
    <div className={`stars ${onChange ? "stars-input" : ""}`} role={onChange ? "radiogroup" : undefined}>
      {[1, 2, 3, 4, 5].map((n) =>
        onChange ? (
          <button
            type="button"
            key={n}
            className={n <= (value ?? 0) ? "on" : ""}
            onClick={() => onChange(n === value ? 0 : n)}
            aria-label={`${n} star${n === 1 ? "" : "s"}`}
          >
            ★
          </button>
        ) : (
          <span key={n} className={n <= (value ?? 0) ? "on" : ""}>
            ★
          </span>
        ),
      )}
    </div>
  );
}
