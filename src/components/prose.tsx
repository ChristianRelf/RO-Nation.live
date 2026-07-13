import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

// Long-form text, written in Markdown by staff, rendered to the page.
//
// It is one component because the two blogs used to be two implementations, and
// they did not agree: RNL's split on blank lines (so paragraphs worked), while a
// partner's split on EVERY newline, so a soft-wrapped paragraph shattered into a
// separate <p> per line. The editor's own hint — "blank lines start a new
// paragraph" — was true on exactly one of the two sites. Anything that renders a
// body now comes through here, so that cannot happen again.
//
// ---- Why this is not an XSS hole -------------------------------------------
//
// The body has never been sanitised on the way in. Until now that was fine,
// because React escapes everything it renders and the body was printed as plain
// text — the escaping WAS the defence. A markdown renderer that emitted an HTML
// string and set it with dangerouslySetInnerHTML would quietly delete that
// defence, and a post body is written by staff today but is exactly the kind of
// field that gets opened up later.
//
// So this renderer builds REACT ELEMENTS. It never produces an HTML string, and
// there is no dangerouslySetInnerHTML anywhere in it:
//
//   • Raw HTML in the source is NOT parsed. `rehype-raw` is deliberately not
//     installed, so `<script>alert(1)</script>` in a post body renders as those
//     literal characters on the page. Do not add it.
//   • `javascript:` and `data:` URLs in links and images are stripped by
//     react-markdown's default urlTransform. Left at the default on purpose.
//   • Every element it can emit is in the map below. Anything not in the map
//     falls through to react-markdown's own safe default.
//
// If somebody ever needs real HTML in a post, that is a new feature with a new
// threat model — a sanitiser, an allowlist, and a reason. It is not a one-line
// plugin addition.

const components = {
  // Links. An external one opens in a new tab and carries rel="noreferrer", so a
  // post cannot hand the opener a window.opener handle to play with.
  a: ({ href, children }: { href?: string; children?: React.ReactNode }) => {
    const external = Boolean(href && /^https?:\/\//i.test(href));
    return (
      <a
        href={href}
        {...(external ? { target: "_blank", rel: "noreferrer noopener" } : {})}
        className="text-accent underline underline-offset-4 transition-colors hover:text-fg"
      >
        {children}
      </a>
    );
  },

  // Images are constrained rather than trusted. A post can reference any URL, so
  // it is lazy-loaded and capped to the column — an author pasting a 4000px photo
  // should not be able to blow the layout out.
  img: ({ src, alt }: { src?: string; alt?: string }) =>
    src ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt ?? ""}
        loading="lazy"
        className="my-8 h-auto w-full border border-line"
      />
    ) : null,

  // A table that is wider than the column scrolls INSIDE itself. Without this the
  // whole page scrolls sideways on a phone, which is a far worse bug than a table
  // being a bit awkward to read.
  table: ({ children }: { children?: React.ReactNode }) => (
    <div className="my-6 overflow-x-auto border border-line">
      <table className="w-full min-w-[480px] text-left text-sm">{children}</table>
    </div>
  ),
};

/**
 * Render `content` as Markdown.
 *
 * Everything a writer actually reaches for works: headings, bold, italic, links,
 * lists, quotes, code, tables, strikethrough and task lists (the last four are
 * GitHub-flavoured, via remark-gfm). Paragraphs are blank-line separated, which
 * is what the editor has always claimed.
 *
 * Styling lives in the `.prose` class in globals.css rather than here, so it can
 * be re-dressed per brand the way every other shared class is — see the note
 * there.
 */
export function Prose({
  content,
  className,
}: {
  content: string;
  className?: string;
}) {
  return (
    <div className={cn("prose", className)}>
      <Markdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </Markdown>
    </div>
  );
}
