import { prisma } from "../config/prisma";

export async function pruneOldNotifications(days: number) {
  const res = await prisma.notifications.deleteMany({
    where: {
      is_read: true,
      created_at: { lt: new Date(Date.now() - days * 86400000) }
    }
  });
  return { deleted: res.count };
}

