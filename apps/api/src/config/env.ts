import 'dotenv/config';
import { z } from 'zod';

const bool = (def: 'true' | 'false') => z.enum(['true', 'false']).default(def).transform((v) => v === 'true');

const schema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),

  DB_SERVER: z.string().default('localhost'),
  DB_PORT: z.coerce.number().int().positive().default(1433),
  DB_INSTANCE: z.string().default(''),
  DB_NAME: z.string().regex(/^[A-Za-z0-9_]+$/, 'DB_NAME hanya huruf, angka, dan underscore').default('icms'),
  DB_USER: z.string().min(1, 'DB_USER wajib diisi'),
  DB_PASSWORD: z.string().min(1, 'DB_PASSWORD wajib diisi'),
  DB_ENCRYPT: bool('false'),
  DB_TRUST_SERVER_CERT: bool('true'),

  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(5),
  RATE_LIMIT_WINDOW_MINUTES: z.coerce.number().int().positive().default(60),
  TRUST_PROXY: bool('false'),
  ENABLE_DOCS: bool('true'),

  WA_PIC_NUMBER: z.string().default(''),
  SMTP_HOST: z.string().default(''),
  SMTP_PORT: z.coerce.number().int().default(587),
  SMTP_USER: z.string().default(''),
  SMTP_PASS: z.string().default(''),
  MAIL_FROM: z.string().default('Sarpras KMK UNS <no-reply@kmk-uns.local>'),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Konfigurasi .env tidak valid:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
