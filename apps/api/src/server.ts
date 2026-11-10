import { env } from './config/env';
import { closePool, getPool } from './db/client';
import { createApp } from './app';

async function bootstrap() {
  try {
    await getPool(); // gagal cepat dengan pesan jelas bila SQL Server tidak dapat dihubungi
  } catch (err) {
    console.error('Tidak dapat terhubung ke SQL Server. Periksa DB_* di .env, TCP/IP, dan SQL Authentication (lihat README).');
    console.error(err);
    process.exit(1);
  }

  const app = createApp();
  const server = app.listen(env.PORT, () => {
    console.log(`ICMS Loan API berjalan di http://localhost:${env.PORT}`);
    if (env.ENABLE_DOCS) console.log(`   Swagger UI : http://localhost:${env.PORT}/docs`);
    console.log(`   POST http://localhost:${env.PORT}/api/v1/loans`);
    console.log(`   GET  http://localhost:${env.PORT}/health`);
  });

  for (const sig of ['SIGINT', 'SIGTERM'] as const) {
    process.on(sig, () => {
      console.log(`${sig} diterima, menutup server...`);
      server.close(() => {
        void closePool().finally(() => process.exit(0));
      });
    });
  }
}

void bootstrap();