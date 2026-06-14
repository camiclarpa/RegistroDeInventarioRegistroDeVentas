import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { AuthController } from './controllers/AuthControllerClean';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'auth-service', timestamp: new Date().toISOString() });
});

// Rutas de autenticación
app.post('/api/v1/auth/login', AuthController.login);
app.get('/api/v1/auth/verify', AuthController.verify);

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🔐 Auth service running on port ${PORT}`);
});
