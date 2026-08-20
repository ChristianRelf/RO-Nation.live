import type {
  PartnerBriefAssetSlot,
  PartnerSiteBrief,
  PartnerSiteBriefAsset,
} from "@prisma/client";
import { PARTNER_FEATURE_CHOICES, cleanFeatures } from "@/lib/partners/registry";

// The site brief: what partner.ronation.live/onboard/site/<uuid> asks, and what comes out
// the other end as a .zip on the company desk.
//
// ---- The brief is shaped like the thing it becomes -------------------------
//
// Every field below has a counterpart in the `Partner` type in lib/partners/registry.ts.
// That is not a coincidence and it is worth protecting: when somebody sits down to add a
// partner site, they open the registry, and the brief should be readable straight down it
// without a translation step. The zip even emits a draft registry entry (below), which is
// only possible because the two agree.
//
// So if you add a field here, ask what it becomes in the registry. If the answer is
// "nothing", it probably belongs in moodNotes - which exists precisely so that the useful
// unstructured half has somewhere to go that is not a new column.
//
// ---- Deliberately not server-only ------------------------------------------
//
// The brief form is a client component (it previews the accent colour and counts
// characters), so the choice lists have to be importable from the browser. The zip
// builder below is only ever called from a route handler; it touches no filesystem and no
// database, taking rows and bytes as arguments, which is what keeps that honest.

/**
 * The look a partner is after, as a direction rather than a font name.
 *
 * Asking "which typeface?" gets either silence or a font RNL does not have a licence for.
 * Partner faces are per-brand and hand-installed anyway (see lib/partners/fonts.ts - Sleep
 * Token's is a self-hosted file with no digits in it), so this asks the question a
 * designer can actually answer and leaves the specific file to the conversation.
 */
export const FONT_DIRECTIONS: readonly { id: string; label: string; blurb: string }[] = [
  {
    id: "condensed",
    label: "Bold and condensed",
    blurb: "Tall, tight, shouty. What our own site uses.",
  },
  {
    id: "serif",
    label: "Elegant serif",
    blurb: "Classical, high contrast, a lot of air around it.",
  },
  {
    id: "geometric",
    label: "Clean geometric",
    blurb: "Modern, even, unfussy. Reads as a brand rather than a poster.",
  },
  {
    id: "display",
    label: "Something decorative",
    blurb: "A character face for headings, with a plain one carrying the body copy.",
  },
  {
    id: "own",
    label: "We have our own font",
    blurb: "You hold the licence and can send us the file. Say which in the notes.",
  },
];

export const FONT_DIRECTION_IDS: readonly string[] = FONT_DIRECTIONS.map((f) => f.id);

export function fontDirectionLabel(id: string | null): string | null {
  return FONT_DIRECTIONS.find((f) => f.id === id)?.label ?? null;
}

/**
 * The files a brief asks for, and what each one has to be.
 *
 * The guidance is lifted from the registry's own field documentation rather than
 * paraphrased, because those notes were written from things that went wrong: a dark logo
 * vanishing into the near-black issuer bar, two enormous emblems stacked on one screen,
 * a partner's shows page carrying RNL's wordmark across every card.
 */
export const BRIEF_ASSET_SLOTS: readonly {
  slot: PartnerBriefAssetSlot;
  label: string;
  blurb: string;
  /** What the registry calls it, so the zip's notes can say where it goes. */
  registryField: string | null;
  required: boolean;
}[] = [
  {
    slot: "LOGO",
    label: "Wordmark",
    blurb:
      "Your name as artwork, WHITE or very light, on a transparent background. It prints on the near-black bar at the top of every ticket, so a dark one disappears. PNG or SVG.",
    registryField: "logoUrl",
    required: true,
  },
  {
    slot: "CREST",
    label: "Emblem",
    blurb:
      "One centred device - a crest, a seal, a sigil - on a transparent background. It is drawn enormous and dim behind the type on your homepage, so no words in it and no photographs.",
    registryField: "crestUrl",
    required: false,
  },
  {
    slot: "BACKDROP",
    label: "Backdrop",
    blurb:
      "Artwork that sits behind the whole site, on every page, under everything you write. Pick one that survives being darkened: a single subject with room around it. Send this OR an emblem, not both - two enormous images on one screen is mush.",
    registryField: "backdropUrl",
    required: false,
  },
  {
    slot: "EVENT_PLACEHOLDER",
    label: "Show placeholder",
    blurb:
      "The stand-in for a show you have not made a poster for yet. Without one, those cards carry OUR artwork with OUR name across them, on your site.",
    registryField: "eventPlaceholderUrl",
    required: false,
  },
  {
    slot: "OTHER",
    label: "Anything else",
    blurb:
      "Posters, past artwork, a brand guideline PDF, photographs of a build. More is better here.",
    registryField: null,
    required: false,
  },
];

export function assetSlotLabel(slot: PartnerBriefAssetSlot): string {
  return BRIEF_ASSET_SLOTS.find((s) => s.slot === slot)?.label ?? String(slot);
}

/** #rrggbb, and nothing else. Three-digit hex is expanded rather than refused. */
export function cleanHex(input: string): string | null {
  const v = input.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(v)) return v.toLowerCase();
  if (/^#[0-9a-fA-F]{3}$/.test(v)) {
    const [, r, g, b] = v.toLowerCase();
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return null;
}

/**
 * What "finished" means, as the list of things still missing.
 *
 * Used in two places that must agree: the progress line the partner sees while filling it
 * in, and the badge staff see on the desk. A brief can be SUBMITTED with things missing -
 * it is a description, not a form to be defeated - so this reports rather than blocks.
 */
export function briefGaps(brief: PartnerSiteBrief, assetCount: number): string[] {
  const gaps: string[] = [];
  if (!brief.siteName) gaps.push("the site's name");
  if (!brief.slug) gaps.push("a subdomain");
  if (!brief.tagline) gaps.push("a tagline");
  if (!brief.description) gaps.push("a description");
  if (!brief.features.length) gaps.push("which features you want");
  if (!brief.accentColour) gaps.push("an accent colour");
  if (!assetCount) gaps.push("at least one file");
  if (!brief.contactName && !brief.contactEmail && !brief.contactDiscord) {
    gaps.push("somebody to ask about it");
  }
  return gaps;
}

// ---------------------------------------------------------------------------
// The .zip
// ---------------------------------------------------------------------------

type BriefWithAssets = PartnerSiteBrief & { assets: PartnerSiteBriefAsset[] };

const line = (label: string, value: unknown): string =>
  `- **${label}:** ${value === null || value === undefined || value === "" ? "_not answered_" : String(value)}`;

/**
 * brief.md - the human half of the archive, and the file somebody actually reads.
 *
 * Markdown rather than a PDF or an HTML page: it opens in every editor, it diffs, and it
 * can be pasted into a Discord thread with the brand's designer without anything being
 * lost. The registry entry below it is a starting point, not a generated artefact -
 * nothing in this codebase reads it back.
 */
function briefMarkdown(brief: BriefWithAssets): string {
  const features = cleanFeatures(brief.features)
    .map((id) => PARTNER_FEATURE_CHOICES.find((f) => f.id === id)?.label ?? id)
    .join(", ");

  const out: string[] = [
    `# ${brief.siteName || brief.label}`,
    "",
    `Site brief, handed in ${brief.submittedAt ? brief.submittedAt.toISOString().slice(0, 10) : "not yet - this is a draft"}.`,
    `Raised by ${brief.issuedByName} on ${brief.createdAt.toISOString().slice(0, 10)}.`,
    "",
    "## The site",
    "",
    line("Name", brief.siteName),
    line("Short name", brief.shortName),
    line("Subdomain", brief.slug ? `${brief.slug}.ronation.live` : null),
    line("Tagline", brief.tagline),
    line("Ticket prefix", brief.ticketPrefix),
    line("Roblox group", brief.robloxGroupUrl),
    line("Features", features || null),
    "",
    "### Description",
    "",
    brief.description || "_not answered_",
    "",
  ];

  if (brief.disclaimer) {
    out.push(
      "### Disclaimer",
      "",
      "> The partner supplied this themselves. Check it before it ships - a tribute or fan",
      "> project on an RNL subdomain with an ambiguous disclaimer is RNL's problem too.",
      "",
      brief.disclaimer,
      "",
    );
  }

  out.push(
    "## Look",
    "",
    line("Accent", brief.accentColour),
    line("Type on accent", brief.accentInkColour),
    line("Type direction", fontDirectionLabel(brief.fontChoice)),
    "",
    "### Notes",
    "",
    brief.moodNotes || "_not answered_",
    "",
  );

  if (brief.referenceUrls.length) {
    out.push("### References", "");
    for (const url of brief.referenceUrls) out.push(`- ${url}`);
    out.push("");
  }

  out.push(
    "## Who to ask",
    "",
    line("Name", brief.contactName),
    line("Email", brief.contactEmail),
    line("Discord", brief.contactDiscord),
    "",
    "## Files",
    "",
  );

  if (brief.assets.length) {
    for (const a of brief.assets) {
      out.push(
        `- \`assets/${zipAssetName(a)}\` - ${assetSlotLabel(a.slot)}, ${a.mime}, ${Math.round(a.size / 1024)} KB`,
      );
    }
  } else {
    out.push("_Nothing attached._");
  }

  out.push("");
  return out.join("\n");
}

/**
 * A draft registry entry, ready to be pasted into lib/partners/registry.ts and edited.
 *
 * It is emitted COMMENTED-OUT and with the asset URLs left as TODOs, on purpose. The files
 * in this archive are on the private volume; they have to be placed under public/brand/ or
 * uploaded before any of these paths exist, and an entry that looks finished is one
 * somebody pastes in without doing that - which serves a partner's site with four broken
 * images on it.
 */
function registryDraft(brief: BriefWithAssets): string {
  const q = (v: string | null) =>
    v ? `"${v.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"` : null;
  const features = cleanFeatures(brief.features);

  const rows: string[] = [
    `  {`,
    `    slug: ${q(brief.slug) ?? '"TODO"'},`,
    `    name: ${q(brief.siteName) ?? '"TODO"'},`,
    `    shortName: ${q(brief.shortName || brief.siteName) ?? '"TODO"'},`,
    `    tagline: ${q(brief.tagline) ?? '"TODO"'},`,
    `    description: ${q(brief.description) ?? '"TODO"'},`,
  ];
  if (brief.disclaimer) rows.push(`    disclaimer: ${q(brief.disclaimer)},`);
  rows.push(
    `    ticketPrefix: ${q(brief.ticketPrefix?.toUpperCase() ?? null) ?? '"TODO"'},`,
  );
  for (const { slot, registryField } of BRIEF_ASSET_SLOTS) {
    if (!registryField) continue;
    const asset = brief.assets.find((a) => a.slot === slot);
    if (asset) rows.push(`    ${registryField}: "TODO: place assets/${zipAssetName(asset)}",`);
  }
  rows.push(
    `    features: [${features.map((f) => `"${f}"`).join(", ")}] as const,`,
  );
  if (brief.robloxGroupUrl) rows.push(`    robloxGroupUrl: ${q(brief.robloxGroupUrl)},`);
  rows.push(`    active: false,`, `  },`);

  return [
    "// A DRAFT. Nothing reads this file - it is here so that adding the partner site is",
    "// reading and editing rather than transcribing.",
    "//",
    "// Before it goes in lib/partners/registry.ts:",
    "//",
    "//   1. Place the files from assets/ and replace every TODO path.",
    "//   2. Check the slug is still free - slugVerdict() was true when they typed it,",
    "//      not necessarily today.",
    "//   3. Add the host to the Caddyfile's site address line, AFTER its DNS record",
    "//      resolves. Caddy asks Let's Encrypt on reload and a failed issuance counts",
    "//      against the weekly limit.",
    "//   4. Leave `active: false` until the site is worth showing. An active slug with",
    "//      no host in the Caddyfile is unreachable; a host with no registry entry",
    "//      serves RNL's site on the partner's domain.",
    "//   5. Write the brand stylesheet (src/styles/brands/) from the colours below.",
    "",
    `// accent: ${brief.accentColour ?? "not answered"}   ink on accent: ${brief.accentInkColour ?? "not answered"}`,
    `// type: ${fontDirectionLabel(brief.fontChoice) ?? "not answered"}`,
    "",
    ...rows,
    "",
  ].join("\n");
}

/** The filename an asset takes inside the archive. Slot-prefixed, so it sorts usefully. */
export function zipAssetName(asset: PartnerSiteBriefAsset): string {
  const ext = asset.filename.includes(".")
    ? asset.filename.slice(asset.filename.lastIndexOf("."))
    : "";
  const stem = asset.filename.slice(0, asset.filename.length - ext.length) || "file";
  return `${asset.slot.toLowerCase()}-${asset.id.slice(-6)}-${stem}${ext}`.replace(
    /[^a-zA-Z0-9._-]/g,
    "-",
  );
}

/**
 * Everything the archive holds except the asset bytes, which the caller reads off disk.
 *
 * Split this way because this module is importable from the browser and reading the
 * private upload volume very much is not. The route handler does the filesystem half.
 */
export function briefZipEntries(brief: BriefWithAssets): { name: string; data: string }[] {
  return [
    { name: "brief.md", data: briefMarkdown(brief) },
    { name: "registry-entry.draft.ts", data: registryDraft(brief) },
    {
      name: "brief.json",
      data: JSON.stringify(
        {
          id: brief.id,
          label: brief.label,
          status: brief.status,
          site: {
            slug: brief.slug,
            name: brief.siteName,
            shortName: brief.shortName,
            tagline: brief.tagline,
            description: brief.description,
            disclaimer: brief.disclaimer,
            ticketPrefix: brief.ticketPrefix,
            robloxGroupUrl: brief.robloxGroupUrl,
            features: cleanFeatures(brief.features),
          },
          look: {
            accentColour: brief.accentColour,
            accentInkColour: brief.accentInkColour,
            fontDirection: brief.fontChoice,
            notes: brief.moodNotes,
            references: brief.referenceUrls,
          },
          contact: {
            name: brief.contactName,
            email: brief.contactEmail,
            discord: brief.contactDiscord,
          },
          assets: brief.assets.map((a) => ({
            file: `assets/${zipAssetName(a)}`,
            slot: a.slot,
            mime: a.mime,
            size: a.size,
            originalFilename: a.filename,
            uploadedBy: a.uploadedBy,
            uploadedAt: a.createdAt,
          })),
          raisedBy: brief.issuedByName,
          createdAt: brief.createdAt,
          submittedAt: brief.submittedAt,
        },
        null,
        2,
      ),
    },
  ];
}
