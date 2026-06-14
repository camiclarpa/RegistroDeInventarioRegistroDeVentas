import cron from 'node-cron';
import { prisma } from '../config/prisma';
import nodemailer from 'nodemailer';
import { refreshAllRfm, refreshAgingBuckets, triggerDunningAlerts } from '../services/crmAnalyticsService';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const checkReminders = async () => {
  console.log('🔍 [CRON] Verificando recordatorios pendientes...');

  try {
    const pendingReminders = await prisma.reminders.findMany({
      where: {
        isSent: false,
        dueDate: { lte: new Date() },
      },
      include: {
        customers: {
          select: { name: true, email: true, phone: true },
        },
      },
    });

    console.log(`📬 [CRON] ${pendingReminders.length} recordatorios pendientes`);

    for (const reminder of pendingReminders) {
      try {
        const customer = reminder.customers;
        if (customer?.email && process.env.SMTP_USER) {
          await transporter.sendMail({
            from: `"SIGC-Motos" <${process.env.SMTP_USER}>`,
            to: customer.email,
            subject: `Recordatorio: ${reminder.type}`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #2563eb;">Hola ${customer.name}</h2>
                <p>${reminder.message}</p>
                <p style="color: #6b7280; font-size: 14px;">
                  Fecha programada: ${new Date(reminder.dueDate).toLocaleDateString('es-CO')}
                </p>
                <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
                <p style="color: #9ca3af; font-size: 12px;">
                  Este es un mensaje automático de SIGC-Motos
                </p>
              </div>
            `,
          });
          console.log(`✅ [CRON] Email enviado a ${customer.email}`);
        }

        await prisma.reminders.update({
          where: { id: reminder.id },
          data: { isSent: true } as any,
        });

        await prisma.communication_logs.create({
          data: {
            customerId: reminder.customerId,
            type: 'REMINDER_SENT',
            message: `[Automático] ${reminder.message}`,
            performedBy: 'system',
          } as any,
        });

      } catch (error) {
        console.error(`❌ [CRON] Error procesando recordatorio ${reminder.id}:`, error);
      }
    }

    console.log('✅ [CRON] Verificación completada');
  } catch (error) {
    console.error('❌ [CRON] Error en cron job:', error);
  }
};

const updateRfmDaily = async () => {
  console.log('📊 [CRON] Actualizando segmentación RFM...');
  try {
    const updated = await refreshAllRfm();
    console.log(`✅ [CRON] RFM actualizado para ${updated} clientes`);

    const agingUpdated = await refreshAgingBuckets();
    console.log(`✅ [CRON] Aging buckets actualizados: ${agingUpdated} cuentas`);

    const dunningCount = await triggerDunningAlerts();
    if (dunningCount > 0) {
      console.log(`⚠️  [CRON] ${dunningCount} alertas de cobro generadas`);
    }
  } catch (error) {
    console.error('❌ [CRON] Error actualizando RFM:', error);
  }
};

export const startCronJobs = () => {
  cron.schedule('0 * * * *', checkReminders);
  cron.schedule('0 2 * * *', updateRfmDaily);

  console.log('✅ [CRON] Cron jobs iniciados');
  console.log('   📬 Recordatorios: cada hora');
  console.log('   📊 RFM: diario a las 2:00 AM');
};

