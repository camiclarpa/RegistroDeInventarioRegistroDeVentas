import 'dotenv/config';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import app from './app';
import { logger } from './config/logger';
import { prisma } from './config/prisma';

const PORT = process.env.PORT || 3000;

// Iniciar servidor directamente
app.listen(PORT, () => {
  logger.info(`🚀 SIGC-Motos API running on port ${PORT}`);
});

// Manejar cierre graceful
process.on('SIGINT', async () => {
  logger.info('Shutting down...');
  await prisma.$disconnect();
  process.exit(0);
});
