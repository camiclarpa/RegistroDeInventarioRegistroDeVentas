import pino from 'pino';

const level = process.env.LOG_LEVEL || 'info';

export const logger = pino({
  level,
  formatters: {
    level: (label) => {
      return { level: label };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  base: {
    service: process.env.SERVICE_NAME || 'sigc-motos',
    environment: process.env.NODE_ENV || 'development',
  },
  redact: {
    paths: ['req.headers.authorization', 'req.headers.cookie', 'user.password'],
    censor: '***REDACTED***',
  },
});

// Middleware para logging de requests
export const requestLogger = (req: any, res: any, next: any) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info({
      req: {
        method: req.method,
        url: req.url,
        ip: req.ip,
        userAgent: req.get('user-agent'),
      },
      res: {
        statusCode: res.statusCode,
      },
      duration_ms: duration,
    }, `${req.method} ${req.url} - ${res.statusCode}`);
  });
  
  next();
};
