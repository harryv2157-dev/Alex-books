"use client";

import { useRef, useState } from "react";
import { fileToCoverDataUrl } from "@/lib/image";

export default function PhotoPicker({ label, onPicked }: { label: string; onPicked: (dataUrl: string) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <input
        ref={input}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          setBusy(true);
          try {
            onPicked(await fileToCoverDataUrl(file));
          } finally {
            setBusy(false);
          }
        }}
      />
      <button type="button" className="btn" onClick={() => input.current?.click()} disabled={busy}>
        {busy ? "Preparing photo…" : label}
      </button>
    </>
  );
}
