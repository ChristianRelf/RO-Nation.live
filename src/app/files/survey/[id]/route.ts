import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getCompanyUser } from "@/lib/company";
import { fileNotFound, streamPrivateFile } from "@/lib/private-file";

export const dynamic = "force-dynamic";
// Node, not edge: this reads the filesystem.
export const runtime = "nodejs";

// The gated file server, for survey attachments.
//
// Separate from /files/[id] because the guard is different, not because the
// serving is: a brand guideline is readable by anyone holding a portal door, and a
// survey answer is not. Answers are read on /company/surveys/[id]/responses, so
// the question this asks is the one that page asks - are you a company user.
//
// Sits at /files/survey/<id> rather than sharing the /files/[id] segment on
// purpose. One route matching two tables would mean one `where` deciding, from an
// opaque id, which of two access rules applied - and the failure mode of getting
// that wrong is serving a stranger's CV to anyone with a portal login.
//
// Unclaimed uploads (responseId null - picked, never submitted) are NOT served.
// They are somebody's abandoned draft, they are about to be culled, and there is
// no results page that wants them.

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  if (!(await getCompanyUser())) return fileNotFound();

  const upload = await prisma.surveyUpload.findFirst({
    where: { id: params.id, responseId: { not: null } },
    select: { storagePath: true, mime: true, filename: true },
  });
  // 404, not 403, and the same 404 a made-up id gets: a 403 here would confirm
  // that the id names a real file somebody really uploaded.
  if (!upload) return fileNotFound();

  return streamPrivateFile(upload);
}
