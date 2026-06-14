import os from "os";
export async function runHealthAlerts() {
  const mem = os.freemem() / os.totalmem();
  const alerts: string[] = [];
  if (mem < 0.1) alerts.push("⚠️ Memoria baja (<10%)");
  return { status: alerts.length ? "warning" : "ok", alerts };
}
