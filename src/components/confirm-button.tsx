"use client";

export function ConfirmButton({
  children,
  className,
  message = "Are you sure? This can't be undone.",
  disabled,
}: {
  children: React.ReactNode;
  className?: string;
  message?: string;
  /**
   * For a form that is already submitting. Added when the ticket buttons started
   * using this instead of keeping a second confirm implementation of their own:
   * they wrap it in useFormStatus, and a confirm that can be clicked twice while
   * the first submit is in flight asks the question twice and sends it twice.
   */
  disabled?: boolean;
}) {
  return (
    <button
      className={className}
      disabled={disabled}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
