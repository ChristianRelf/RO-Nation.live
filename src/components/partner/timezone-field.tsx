"use client";

import { useEffect, useState } from "react";

// The timezone box on the onboarding details step.
//
// A client component for one reason: the browser is the only thing that knows the answer,
// and the server cannot guess it. Intl.DateTimeFormat().resolvedOptions().timeZone returns
// the IANA name ("Europe/London") that every calendar and every scheduling tool speaks.
//
// ---- Why it fills in rather than locking in --------------------------------
//
// It is a text input with a suggestion, not a detected value. Somebody may run their shows
// in a timezone they are not currently sitting in - a tour, a holiday, a partner whose crew
// is somewhere else - and a field that silently records where their laptop was is a field
// that is wrong in exactly the cases that matter.
//
// It only fills an EMPTY box. A stored answer is never overwritten by the browser's guess,
// or coming back to this step on holiday would quietly rewrite it.
export function TimezoneField({
  name,
  defaultValue,
  className,
}: {
  name: string;
  defaultValue: string;
  className: string;
}) {
  const [value, setValue] = useState(defaultValue);
  const [guessed, setGuessed] = useState(false);

  useEffect(() => {
    if (defaultValue) return;
    try {
      const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (zone) {
        setValue(zone);
        setGuessed(true);
      }
    } catch {
      // Intl is universal, but a locked-down browser can still refuse. An empty box is a
      // perfectly good outcome here - the field is optional.
    }
  }, [defaultValue]);

  return (
    <>
      <input
        name={name}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setGuessed(false);
        }}
        maxLength={60}
        className={className}
        placeholder="Europe/London"
      />
      {guessed ? (
        <span className="mt-1 block text-[11px] text-faint">
          Guessed from your browser. Change it if your shows run somewhere else.
        </span>
      ) : null}
    </>
  );
}
