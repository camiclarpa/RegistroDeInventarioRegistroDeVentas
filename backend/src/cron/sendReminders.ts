import cron from 'node-cron';
import { prisma } from '../config/prisma';
import nodemailer from 'nodemailer';

// Configurar transporter de email (usar variables de entorno)
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

/**
 * Cron Job: Verifica recordatorios vencidos cada hora
 * Marca como enviados y envía email de notificación
 */
const checkReminders = async () => {
  console.log('🔍 Verificando recordatorios pendientes...');

  try {
    // Buscar recordatorios vencidos no enviados
    const pendingReminders = await prisma.reminder.findMany({
      where: {
        isSent: false,
        dueDate: {
          lte: new Date(),
        },
      },
      include: {
        customer: {
          select: {
            name: true,
            email: true,
            phone: true,
          },
        },
      },
    });

    console.log(` ${pendingReminders.length} recordatorios pendientes`);

    for (const reminder of pendingReminders) {
      try {
        // Enviar email si el cliente tiene email
        if (reminder.customer.email) {
          await transporter.sendMail({
            from: `"SIGC-Motos" <${process.env.SMTP_USER}>`,
            to: reminder.customer.email,
            subject: `Recordatorio: ${reminder.type}`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #2563eb;">Hola ${reminder.customer.name}</h2>
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
          console.log(`✅ Email enviado a ${reminder.customer.email}`);
        }

        // Marcar recordatorio como enviado
        await prisma.reminder.update({
          where: { id: reminder.id },
          data: { isSent: true },
        });

        // Registrar en comunicaciones
        await prisma.communication.create({
          data: {
            customer_id: reminder.customerId,
            direction: 'OUTBOUND',
            channel: 'EMAIL',
            message: reminder.message,
            status: 'SENT',
            sent_by_user_id: 'system',
          },
        });

      } catch (error) {
        console.error(`❌ Error procesando recordatorio ${reminder.id}:`, error);
      }
    }

    console.log('✅ Verificación de recordatorios completada');
  } catch (error) {
    console.error('❌ Error en cron job de recordatorios:', error);
  }
};

/**
 * Cron Job: Verificar clientes inactivos (cada 24 horas)
 */
const checkInactiveCustomers = async () => {
  console.log(' Verificando clientes inactivos...');

  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const inactiveCustomers = await prisma.customer.findMany({
      where: {
        isActive: true,
        lastPurchaseAt: {
          lt: thirtyDaysAgo,
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
        lastPurchaseAt: true,
      },
    });

    console.log(`😴 ${inactiveCustomers.length} clientes inactivos`);

    // Crear recordatorio automático para cada cliente inactivo
    for (const customer of inactiveCustomers) {
      const existingReminder = await prisma.reminder.findFirst({
        where: {
          customerId: customer.id,
          type: 'INACTIVE_CUSTOMER',
          isSent: false,
        },
      });

      if (!existingReminder && customer.email) {
        await prisma.reminder.create({
          data: {
            customerId: customer.id,
            type: 'INACTIVE_CUSTOMER',
            message: `Hola ${customer.name}, te extrañamos! Han pasado más de 30 días desde tu última compra. Tenemos promociones especiales para ti.`,
            dueDate: new Date(),
            isSent: false,
          },
        });
        console.log(`📝 Recordatorio creado para ${customer.name}`);
      }
    }

    console.log('✅ Verificación de clientes inactivos completada');
  } catch (error) {
    console.error('❌ Error en cron job de clientes inactivos:', error);
  }
};

/**
 * Iniciar todos los cron jobs
 */
export const startCronJobs = () => {
  // Verificar recordatorios cada hora (minuto 0)
  cron.schedule('0 * * * *', checkReminders, {
    scheduled: true,
    timezone: 'America/Bogota',
  });

  // Verificar clientes inactivos cada día a las 8 AM
  cron.schedule('0 8 * * *', checkInactiveCustomers, {
    scheduled: true,
    timezone: 'America/Bogota',
  });

  console.log('✅ Cron jobs iniciados');
  console.log('    Recordatorios: cada hora');
  console.log('   😴 Clientes inactivos: diario 8 AM');
};
