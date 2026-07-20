"use client";

// Opens the browser's print dialog, from which "Save as PDF" produces the file. A
// client island on an otherwise server-rendered document - the only interactive bit.
export function PrintButton({ label = "Print / Save as PDF" }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-lg bg-black px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-80"
    >
      {label}
    </button>
  );
}
