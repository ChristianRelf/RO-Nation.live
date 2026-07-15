/**
 * A single JSON-LD block. Server component - it renders a plain <script> and
 * carries no interactivity, so it costs nothing on the client.
 *
 * JSON.stringify is the safe way to inline structured data: it escapes the
 * payload as JSON, and the only sequence that could break out of a <script> is a
 * literal "</", which cannot appear in JSON string output for our data (slashes
 * are not escaped, but "</script>" would need a raw tag, and every value here is
 * a plain string or number from our own rows). We still guard the one case that
 * matters by escaping "<" defensively.
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return (
    <script
      type="application/ld+json"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: json }}
    />
  );
}
