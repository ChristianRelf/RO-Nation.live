import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCompanyUser } from "@/lib/company";
import { slugify } from "@/lib/utils";
import { absoluteUrl } from "@/lib/url";

export const dynamic = "force-dynamic";

/**
 * Escape a value for CSV.
 *
 * The leading apostrophe on =, +, - and @ is deliberate: without it, a
 * respondent could type `=cmd|...` into a text answer and Excel would treat the
 * cell as a formula when you open the export. Quote everything else and double
 * any embedded quotes.
 */
function cell(value: string) {
  const v = value ?? "";
  const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return `"${safe.replace(/"/g, '""')}"`;
}

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  // A GET handler has no layout to hide behind - it must check for itself.
  const user = await getCompanyUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorised" }, { status: 403 });
  }

  const survey = await prisma.survey.findUnique({
    where: { id: params.id },
    include: {
      questions: { orderBy: { order: "asc" } },
      responses: {
        orderBy: { createdAt: "asc" },
        include: { answers: true },
      },
    },
  });

  if (!survey) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  // Attachments, for the FILE_UPLOAD columns. A spreadsheet is for working from,
  // so the cell carries a LINK rather than just the filename the answer's `value`
  // already holds - absolute, because a relative path in a downloaded CSV has
  // nothing to resolve against. The links are still gated: opening one without a
  // Studio session gets the same 404 as a made-up id.
  const attachments = new Map(
    (
      await prisma.surveyUpload.findMany({
        where: { question: { surveyId: survey.id }, responseId: { not: null } },
        select: { id: true, filename: true },
      })
    ).map((u) => [u.id, u]),
  );

  const header = [
    "Roblox username",
    "Submitted at",
    ...survey.questions.map((q) => q.prompt),
  ];

  const rows = survey.responses.map((r) => {
    const byQuestion = new Map(r.answers.map((a) => [a.questionId, a]));
    return [
      r.robloxUsername,
      r.createdAt.toISOString(),
      ...survey.questions.map((q) => {
        const a = byQuestion.get(q.id);
        if (!a) return "";
        if (q.type === "CHECKBOXES") return a.values.join("; ");
        if (q.type === "FILE_UPLOAD") {
          return a.values
            .map((id) => {
              const file = attachments.get(id);
              if (!file) return "(file no longer available)";
              return `${file.filename} ${absoluteUrl(`/files/survey/${file.id}`)}`;
            })
            .join("; ");
        }
        return a.value;
      }),
    ];
  });

  const csv = [header, ...rows]
    .map((row) => row.map((v) => cell(String(v))).join(","))
    .join("\r\n");

  const filename = `${slugify(survey.title) || "survey"}-${survey.code}.csv`;

  // The BOM makes Excel open UTF-8 correctly instead of mangling accents.
  return new NextResponse("﻿" + csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}
