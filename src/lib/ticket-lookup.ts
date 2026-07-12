import "server-only";
import { prisma } from "./db";

// Shared ticket lookup for the in-game API (verify + redeem).
// Returns the ticket (with event + user), null if not found, or "bad_request".
export async function findTicket({
  code,
  robloxId,
  eventId,
}: {
  code: string | null;
  robloxId: string | null;
  eventId: string | null;
}) {
  if (code) {
    return prisma.ticket.findUnique({
      where: { code },
      include: { event: true, user: true },
    });
  }
  if (robloxId && eventId) {
    const user = await prisma.user.findUnique({ where: { robloxId } });
    if (!user) return null;
    return prisma.ticket.findUnique({
      where: { eventId_userId: { eventId, userId: user.id } },
      include: { event: true, user: true },
    });
  }
  return "bad_request" as const;
}
