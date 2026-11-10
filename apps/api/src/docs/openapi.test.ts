import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildOpenApiSpec } from '../src/docs/openapi';
import { utcAt } from '../src/shared/demo-time';

type Example = { summary: string; value: { start_at: string; end_at: string } };
const spec = buildOpenApiSpec() as any;
const post = spec.paths['/api/v1/loans'].post;

test('spesifikasi memuat POST /loans, GET /loans/{loanCode}, dan /health', () => {
  assert.match(spec.openapi, /^3\./);
  assert.ok(post);
  assert.ok(spec.paths['/api/v1/loans/{loanCode}'].get);
  assert.ok(spec.paths['/health'].get);
});

test('POST /loans punya respons sukses dan minimal 2 jenis respons error', () => {
  const codes = Object.keys(post.responses);
  assert.ok(codes.includes('201'));
  assert.ok(['404', '409', '422', '429'].every((c) => codes.includes(c)));
});

test('contoh request memakai tanggal masa depan dan waktu selesai setelah waktu mulai', () => {
  const examples = Object.values(post.requestBody.content['application/json'].examples) as Example[];
  assert.ok(examples.length >= 8);
  for (const ex of examples) {
    const s = new Date(ex.value.start_at).getTime();
    const e = new Date(ex.value.end_at).getTime();
    if (!ex.summary.includes('telepon, email, dan waktu salah')) assert.ok(e > s, ex.summary);
    assert.ok(s > Date.now(), `${ex.summary}: start_at harus di masa depan`);
  }
});

test('utcAt menghasilkan jam UTC yang diminta', () => {
  const iso = utcAt(7, 9, 30, new Date('2026-11-10T15:45:00Z'));
  assert.equal(iso, '2026-11-17T09:30:00.000Z');
});
