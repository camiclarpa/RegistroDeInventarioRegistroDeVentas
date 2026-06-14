import app from './app';
import { logger } from './config/logger';

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  logger.info(`🚀 Servidor corriendo en el puerto ${PORT}`);
  logger.info(`📡 PID: ${process.pid}`);
});
