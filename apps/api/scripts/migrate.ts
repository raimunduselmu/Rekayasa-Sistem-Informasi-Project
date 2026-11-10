import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sql from 'mssql';
import { env } from '../src/config/env';
import { buildConfig } from '../src/db/client';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'sql');
const files = ['001_schema.sql', '002_seed.sql'];
if (process.argv.includes('--reset')) files.unshift('000_reset.sql');

// Driver tidak mengenal "GO" (pemisah batch SSMS), jadi file dipecah per baris GO.
const batches = (text: string) => text.split(/^\s*GO\s*$/gim).map((s) => s.trim()).filter(Boolean);

async function ensureDatabase(): Promise<void> {
  const master = new sql.ConnectionPool(buildConfig('master'));
  await master.connect();
  try {
    await master.request().query(`IF DB_ID(N'${env.DB_NAME}') IS NULL CREATE DATABASE [${env.DB_NAME}]`);
  } finally {
    await master.close();
  }
}

try {
  await ensureDatabase();
  const pool = new sql.ConnectionPool(buildConfig());
  await pool.connect();
  try {
    for (const f of files) {
      for (const batch of batches(readFileSync(join(dir, f), 'utf8'))) {
        await pool.request().batch(batch);
      }
      console.log(`OK  ${f}`);
    }
  } finally {
    await pool.close();
  }
  console.log(`Database "${env.DB_NAME}" siap.`);
} catch (err) {
  console.error('Migrasi gagal:', err);
  process.exitCode = 1;
}
