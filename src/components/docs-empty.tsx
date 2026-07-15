// The "nothing here yet" panel, shared by every docs area so an empty Runbooks
// reads the same as an empty Guides. One card, one line of reassurance - the areas
// differ only in the words they pass in.

export function DocsEmpty({ title, body }: { title: string; body: string }) {
  return (
    <div className="card mt-10 grid place-items-center px-6 py-20 text-center">
      <p className="font-display text-2xl">{title}</p>
      <p className="mt-2 max-w-md text-sm text-muted">{body}</p>
    </div>
  );
}
