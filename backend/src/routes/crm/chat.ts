import { Router, Request, Response } from 'express';
import { prisma } from '../../config/prisma';
import { authMiddleware } from '../../middleware/auth';

const router = Router();

/**
 * GET /crm/chat/:customerId
 * Obtener historial de chat con un cliente
 */
router.get('/:customerId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const { page = 1, limit = 50 } = req.query;

    const communications = await prisma.communication.findMany({
      where: {
        customer_id: customerId,
        channel: 'WEB_CHAT',
      },
      orderBy: {
        created_at: 'desc',
      },
      take: Number(limit),
      skip: (Number(page) - 1) * Number(limit),
      include: {
        sent_by_user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    const total = await prisma.communication.count({
      where: {
        customer_id: customerId,
        channel: 'WEB_CHAT',
      },
    });

    res.json({
      data: communications,
      meta: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    console.error('Error getting chat:', error);
    res.status(500).json({ error: 'Error al obtener chat' });
  }
});

/**
 * POST /crm/chat/:customerId
 * Enviar mensaje a un cliente
 */
router.post('/:customerId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const { message, direction = 'OUTBOUND' } = req.body;

    if (!message || message.trim().length === 0) {
      return res.status(400).json({ error: 'Mensaje requerido' });
    }

    const communication = await prisma.communication.create({
      data: {
        customer_id: customerId,
        direction,
        channel: 'WEB_CHAT',
        message: message.trim(),
        status: 'SENT',
        sent_by_user_id: req.user.id,
      },
      include: {
        sent_by_user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    res.json(communication);
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: 'Error al enviar mensaje' });
  }
});

/**
 * PATCH /crm/chat/:id/read
 * Marcar mensaje como leído
 */
router.patch('/:id/read', authMiddleware, async (req: Request, res: Response) => {
  try {
    const communication = await prisma.communication.update({
      where: { id: req.params.id },
      data: {
        is_read: true,
        read_at: new Date(),
      },
    });

    res.json(communication);
  } catch (error) {
    console.error('Error marking as read:', error);
    res.status(500).json({ error: 'Error al marcar como leído' });
  }
});

/**
 * GET /crm/chat/:customerId/unread
 * Obtener cantidad de mensajes no leídos
 */
router.get('/:customerId/unread', authMiddleware, async (req: Request, res: Response) => {
  try {
    const count = await prisma.communication.count({
      where: {
        customer_id: req.params.customerId,
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
