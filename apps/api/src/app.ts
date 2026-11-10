import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import { env } from './config/env';
import { getPool } from './db/client';
import { buildOpenApiSpec } from './docs/openapi';
import { errorHandler, notFoundHandler } from './middleware/error-handler';
import { requestLogger } from './middleware/request-logger';
import { loanRoutes } from './modules/loans/loan.routes';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  if (env.TRUST_PROXY) app.set('trust proxy', 1); // di belakang Nginx: IP klien dari X-Forwarded-For

  app.use(
    helmet({
      // 'upgrade-insecure-requests' dimatikan agar Swagger UI tetap termuat lewat http://localhost
      contentSecurityPolicy: { useDefaults: true, directives: { 'upgrade-insecure-requests': null } },
    }),
  );
  app.use(cors());
  app.use(express.json({ limit: '100kb' }));
  app.use(requestLogger);

  // Health check endpoint dengan struktur respon formal
  app.get('/health', async (_req, res) => {
    try {
      const pool = await getPool();
      await pool.request().query('SELECT 1 AS ok');
      
      res.status(200).json({
        status: 'success',
        message: 'Server dan database terhubung dengan baik',
        database: 'up',
        service: 'ICMS Loan API',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(503).json({
        status: 'error',
        message: 'Gagal terhubung ke basis data SQL Server',
        database: 'down',
        service: 'ICMS Loan API',
        timestamp: new Date().toISOString(),
      });
    }
  });

  if (env.ENABLE_DOCS) {
    // Spesifikasi dibuat ulang tiap diminta agar tanggal pada contoh selalu di masa depan.
    app.get('/docs.json', (_req, res) => res.json(buildOpenApiSpec()));
    app.use(
      '/docs',
      swaggerUi.serve,
      swaggerUi.setup(undefined, {
        customSiteTitle: 'ICMS KMK UNS - Ajukan Peminjaman',
        swaggerOptions: { url: '/docs.json', displayRequestDuration: true, tryItOutEnabled: true },
      }),
    );
    app.get('/', (_req, res) => res.redirect('/docs'));
  }

  app.use('/api/v1/loans', loanRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}