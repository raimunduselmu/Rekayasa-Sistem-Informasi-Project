// Skrip demo: menjalankan skenario Ajukan Peminjaman terhadap server yang sedang berjalan.
// Prasyarat: npm run db:reset  &&  npm run dev   (di terminal lain)
import { utcAt as at } from '../src/shared/demo-time';
import { SEED } from '../src/shared/seed-ids';

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const ROOM_GEREJA = SEED.rooms.gereja;
const ROOM_AULA = SEED.rooms.aula;
const ASSET = SEED.assets;

const base = {
  borrower_name: 'Budi Santoso',
  borrower_phone: '081234567890',
  borrower_email: 'budi@example.com',
  borrower_org: 'UKM Fotografi',
  purpose: 'Pameran foto kampus',
};

function print(json: unknown) {
  console.log(JSON.stringify(json, null, 2).split('\n').map((l) => `      ${l}`).join('\n'));
}

async function post(title: string, expectStatus: number, body: unknown) {
  const res = await fetch(`${BASE}/api/v1/loans`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as Record<string, unknown>;
  const pass = res.status === expectStatus;
  console.log(`\n${pass ? 'PASS' : 'FAIL'}  ${title}`);
  console.log(`      HTTP ${res.status} (diharapkan ${expectStatus})`);
  print(json);
  return { status: res.status, pass, json };
}

const results: boolean[] = [];
const run = async (title: string, expected: number, body: unknown) => {
  const r = await post(title, expected, body);
  results.push(r.pass);
  return r;
};

console.log(`Demo Ajukan Peminjaman -> ${BASE}`);

const first = await run('1. Sukses: Gereja Kampus + sound system (hari ke-14, 09:00-11:00 UTC)', 201, {
  ...base, request_type: 'RUANGAN', room_id: ROOM_GEREJA, asset_ids: [ASSET.sound],
  start_at: at(14, 9), end_at: at(14, 11), use_facilities: true,
});

// Baca ulang hasil lewat endpoint pelengkap
const code = (first.json.data as { loan_code?: string } | undefined)?.loan_code;
if (code) {
  const res = await fetch(`${BASE}/api/v1/loans/${code}`);
  const pass = res.status === 200;
  results.push(pass);
  console.log(`\n${pass ? 'PASS' : 'FAIL'}  1b. Baca ulang pengajuan ${code}`);
  console.log(`      HTTP ${res.status} (diharapkan 200)`);
  print(await res.json());
} else {
  results.push(false);
}

await run('2. Bentrok ruangan dengan peminjaman DISETUJUI (hari ke-7, 10:00-12:00)', 409, {
  ...base, request_type: 'RUANGAN', room_id: ROOM_GEREJA,
  start_at: at(7, 10), end_at: at(7, 12),
});

await run('3. Bentrok aset (proyektor sedang dipinjam hari ke-7, 09:30-10:30)', 409, {
  ...base, request_type: 'ASET', asset_ids: [ASSET.proyektor],
  start_at: at(7, 9, 30), end_at: at(7, 10, 30),
});

await run('4. Bentrok dengan jadwal misa TERBIT (hari ke-9, 08:30-09:30)', 409, {
  ...base, request_type: 'RUANGAN', room_id: ROOM_GEREJA,
  start_at: at(9, 8, 30), end_at: at(9, 9, 30),
});

await run('5. Input tidak valid (telepon, email, waktu terbalik, tanpa ruangan)', 422, {
  ...base, request_type: 'RUANGAN', borrower_phone: 'abc', borrower_email: 'bukan-email',
  start_at: at(20, 11), end_at: at(20, 9),
});

await run('6. Aset sedang pemeliharaan (generator)', 409, {
  ...base, request_type: 'ASET', asset_ids: [ASSET.generator],
  start_at: at(21, 9), end_at: at(21, 11),
});

await run('7. Aset khusus internal (mikrofon, is_lendable = false)', 409, {
  ...base, request_type: 'ASET', asset_ids: [ASSET.mikrofon],
  start_at: at(21, 9), end_at: at(21, 11),
});

await run('8. Ruangan tidak ada', 404, {
  ...base, request_type: 'RUANGAN', room_id: 999,
  start_at: at(22, 9), end_at: at(22, 11),
});

console.log('\n--- 9. Rate limit: kirim pengajuan valid berulang sampai ditolak ---');
const limit = Number(process.env.RATE_LIMIT_MAX ?? 5);
let hit429 = false;
for (let i = 0; i < limit + 3 && !hit429; i++) {
  // pengajuan sukses ke-1 sudah dipakai skenario 1; sisanya (limit - 1) berhasil, berikutnya 429
  const expected = i < limit - 1 ? 201 : 429;
  const r = await post(`9.${i + 1} Pengajuan Aula (hari ke-${30 + i})`, expected, {
    ...base, request_type: 'RUANGAN', room_id: ROOM_AULA,
    start_at: at(30 + i, 9), end_at: at(30 + i, 10),
  });
  hit429 = r.status === 429;
}
results.push(hit429);

const passed = results.filter(Boolean).length;
console.log(`\nRingkasan: ${passed}/${results.length} skenario sesuai harapan.`);
console.log('Catatan: skenario 9 hanya sesuai bila kuota rate limit masih utuh (restart server untuk mereset).');
console.log('Set RATE_LIMIT_MAX yang sama di terminal ini bila nilainya bukan 5 (mis. RATE_LIMIT_MAX=3 npm run demo).');
process.exitCode = passed === results.length ? 0 : 1;
