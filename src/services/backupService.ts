import { prisma } from "../config/prisma";
import { exec } from "child_process";
import { promisify } from "util";
import { logger } from "../config/logger";

const execAsync = promisify(exec);

export async function triggerBackup(triggeredBy: string) {
  const rec = await prisma.system_backups.create({
    data: {
      type: "FULL",
      status: "RUNNING",
      triggered_by: triggeredBy,
      started_at: new Date()
    } as any,
  });

  try {
    await execAsync("bash /opt/SIGH_MOTOS/scripts/pg-backup.sh");
    await prisma.system_backups.update({
      where: { id: rec.id },
      data: {
        status: "COMPLETED",
        completed_at: new Date()
      } as any,
    });
  } catch (e) {
    await prisma.system_backups.update({
      where: { id: rec.id },
      data: { status: "FAILED" } as any,
    });
    logger.error("[backup] Failed:", e);
    throw e;
  }

  return rec;
}

