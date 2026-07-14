/**
 * Move every clothing template off the public volume.
 *
 *   npm run merch:privatise
 *
 * Run this ONCE, on the deploy that introduces MerchProduct.texturePath. Until it has
 * run, existing shirts still have their template sitting on the volume Caddy serves at
 * /uploads/rnl/<uuid>.png - and that URL keeps working, and keeps handing the product
 * away, whatever the application does or does not render. Taking the <img> off the page
 * is not the fix; taking the file off the public disk is.
 *
 * What it does, per product with a public textureUrl:
 *
 *   1. copies the bytes to PRIVATE_UPLOAD_DIR (the volume Caddy cannot see)
 *   2. sets texturePath to the new location
 *   3. clears textureUrl
 *   4. deletes the public file
 *
 * In that order, deliberately: the row does not stop pointing at the old file until the
 * new one is written, and the old file is not deleted until the row has stopped pointing
 * at it. Interrupt it at any point and you have a duplicate, never a missing shirt.
 *
 * Idempotent - a second run finds nothing to do. Safe to leave in the deploy notes.
 *
 * It runs INSIDE the container, because that is the only place both volumes exist:
 *
 *   docker compose exec web npm run merch:privatise
 */

import { copyFile, mkdir, unlink } from "fs/promises";
import path from "path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Restated rather than imported from lib/uploads.ts, which opens with `import
// "server-only"` - a module that exists to make itself unimportable outside a React
// server component, and a script run by tsx is not one. Keep these in step with it; they
// are read from the same environment the container already sets in docker-compose.yml.
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads");
const PRIVATE_UPLOAD_DIR =
  process.env.PRIVATE_UPLOAD_DIR || path.join(process.cwd(), "private-uploads");
const UPLOAD_URL_PREFIX = "/uploads";

/** lib/uploads.ts's resolveInRoot, for the same reason. */
function resolveInRoot(root: string, storagePath: string): string | null {
  const base = path.resolve(root);
  const target = path.resolve(base, storagePath);
  if (target !== base && !target.startsWith(base + path.sep)) return null;
  return target;
}

async function main() {
  const products = await prisma.merchProduct.findMany({
    where: { textureUrl: { not: null } },
    select: { id: true, name: true, textureUrl: true, texturePath: true },
  });

  if (products.length === 0) {
    console.log("Nothing to do - no product has a public textureUrl.");
    return;
  }

  console.log(`${products.length} product(s) with a public template.\n`);

  let moved = 0;
  let skipped = 0;
  let failed = 0;

  for (const p of products) {
    const url = p.textureUrl as string;

    // A template that is already private. The column is stale; just clear it.
    if (p.texturePath) {
      await prisma.merchProduct.update({
        where: { id: p.id },
        data: { textureUrl: null },
      });
      console.log(`  = ${p.name} - already private, cleared the dead URL.`);
      skipped++;
      continue;
    }

    // Somebody pasted a remote URL into the old free-text field. There is nothing to
    // move - the bytes are on someone else's server - and nothing to protect. It cannot
    // be rescued automatically: the file has to be uploaded through the admin, which now
    // puts it straight onto the private volume.
    if (!url.startsWith(`${UPLOAD_URL_PREFIX}/`)) {
      console.log(`  ! ${p.name} - textureUrl is remote (${url}).`);
      console.log(`      Re-upload the template in /company/merch. Leaving it alone.`);
      skipped++;
      continue;
    }

    const storagePath = url.slice(UPLOAD_URL_PREFIX.length + 1); // "rnl/<uuid>.png"

    const from = resolveInRoot(UPLOAD_DIR, storagePath);
    const to = resolveInRoot(PRIVATE_UPLOAD_DIR, storagePath);
    if (!from || !to) {
      console.error(`  ✗ ${p.name} - refusing a path that escapes its root: ${url}`);
      failed++;
      continue;
    }

    try {
      await mkdir(path.dirname(to), { recursive: true });
      await copyFile(from, to);

      await prisma.merchProduct.update({
        where: { id: p.id },
        data: { texturePath: storagePath, textureUrl: null },
      });

      // Only now. The row is already reading from the private copy, so this cannot
      // orphan a live product - and if it fails, the worst case is a stale file on the
      // public volume that nothing references, which the next run will not see because
      // textureUrl is already null. So it is reported loudly rather than swallowed.
      try {
        await unlink(from);
      } catch (err) {
        console.warn(
          `  ⚠ ${p.name} - moved, but the PUBLIC copy could not be deleted: ${from}`,
        );
        console.warn(`      DELETE IT BY HAND. It is still downloadable. (${err})`);
      }

      console.log(`  → ${p.name} - now private (${storagePath}).`);
      moved++;
    } catch (err) {
      console.error(`  ✗ ${p.name} - could not move ${storagePath}: ${err}`);
      console.error(`      The row is unchanged and the file is where it was.`);
      failed++;
    }
  }

  console.log(`\n${moved} moved, ${skipped} skipped, ${failed} failed.`);

  if (failed > 0) process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
