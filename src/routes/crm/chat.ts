import { Router, Request, Response } from 'express';
import { prisma } from '../../config/prisma';

const router = Router();

router.get('/:customerId', async (req: Request, res: Response) => {
  try {
    const customerId = String(req.params.customerId);
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 50;

    const communications = await prisma.communications.findMany({
      where: {
        customer_id: customerId,
        channel: 'WEB_CHAT',
      },
      orderBy: { created_at: 'desc' },
      take: limit,
      skip: (page - 1) * limit,
    });

    const total = await prisma.communications.count({
      where: { customer_id: customerId, channel: 'WEB_CHAT' },
    });

    res.json({
      data: communications,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error getting chat:', error);
    res.status(500).json({ error: 'Error al obtener chat' });
  }
});

router.post('/:customerId', async (req: Request, res: Response) => {
  try {
    const customerId = String(req.params.customerId);
    const { message, direction = 'OUTBOUND', userId = 'system' } = req.body;

    if (!message || message.trim().length === 0) {
      return res.status(400).json({ error: 'Mensaje requerido' });
    }

    const communication = await prisma.communications.create({
      data: {
        customer_id: customerId,
        direction,
        channel: 'WEB_CHAT',
        message: message.trim(),
        status: 'SENT',
        sent_by_user_id: userId,
      } as any,
    });

    res.json(communication);
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: 'Error al enviar mensaje' });
  }
});

router.patch('/:id/read', async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const communication = await prisma.communications.update({
      where: { id: id },
      data: { is_read: true, read_at: new Date() } as any,
    });
    res.json(communication);
  } catch (error) {
    console.error('Error marking as read:', error);
    res.status(500).json({ error: 'Error al marcar como leído' });
  }
});

router.get('/:customerId/unread', async (req: Request, res: Response) => {
  try {
    const customerId = String(req.params.customerId);
    const count = await prisma.communications.count({
      where: {
        customer_id: customerId,
        channel: 'WEB_CHAT',
        direction: 'INBOUND',
        is_read: false,
      },
    });
    res.json({ count });
  } catch (error) {
    console.error('Error getting unread count:', error);
    res.status(500).json({ error: 'Error al obtener mensajes no leídos' });
  }
});

export default router;

