import sql from 'mssql';
import { env } from '../config/env';

// Konfigurasi koneksi SQL Server (SQL Authentication). `database` dapat ditimpa untuk migrasi (master).
export function buildConfig(database: string = env.DB_NAME): sql.config {
  return {
    server: env.DB_SERVER,
    // port dan instanceName tidak boleh dipakai bersamaan
    port: env.DB_INSTANCE ? undefined : env.DB_PORT,
    database,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    options: {
      instanceName: env.DB_INSTANCE || undefined,
      encrypt: env.DB_ENCRYPT,
      trustServerCertificate: env.DB_TRUST_SERVER_CERT,
    },
    pool: { max: 10, min: 0, idleTimeoutMillis: 30_000 },
    connectionTimeout: 15_000,
    requestTimeout: 30_000,
  };
}

export type Exec = sql.ConnectionPool | sql.Transaction;

let poolPromise: Promise<sql.ConnectionPool> | null = null;

export function getPool(): Promise<sql.ConnectionPool> {
  if (!poolPromise) {
    const pool = new sql.ConnectionPool(buildConfig());
    poolPromise = pool.connect().catch((err) => {
      poolPromise = null; // coba lagi pada request berikutnya
      throw err;
    });
  }
  return poolPromise;
}

export async function closePool(): Promise<void> {
  if (!poolPromise) return;
  const pool = await poolPromise;
  poolPromise = null;
  await pool.close();
}

// Request di atas koneksi biasa atau di dalam transaksi.
export function request(ex: Exec): sql.Request {
  return ex instanceof sql.Transaction ? new sql.Request(ex) : new sql.Request(ex);
}

// Satu transaksi: commit bila berhasil, rollback bila ada error (error dilempar ulang).
export async function withTransaction<T>(fn: (tx: sql.Transaction) => Promise<T>): Promise<T> {
  const pool = await getPool();
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    const result = await fn(tx);
    await tx.commit();
    return result;
  } catch (err) {
    try {
      await tx.rollback();
    } catch {
      // transaksi sudah di-rollback oleh SQL Server
    }
    throw err;
  }
}

export { sql };
