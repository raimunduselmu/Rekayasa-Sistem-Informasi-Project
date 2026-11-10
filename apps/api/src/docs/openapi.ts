import { utcAt } from '../shared/demo-time';
import { SEED } from '../shared/seed-ids';

const err = (code: string, message: string, errors?: Record<string, unknown>) => ({
  status: 'error',
  error_code: code,
  message,
  ...(errors ? { errors } : {}),
});

const errorContent = (examples: Record<string, { summary: string; value: unknown }>) => ({
  'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' }, examples },
});

// Spesifikasi OpenAPI 3.0. Dibuat saat diminta supaya tanggal pada contoh selalu di masa depan.
// Data contoh bergantung pada sql/002_seed.sql: jalankan `npm run db:reset` sebelum demo.
export function buildOpenApiSpec() {
  const borrower = {
    borrower_name: 'Budi Santoso',
    borrower_phone: '081234567890',
    borrower_email: 'budi@example.com',
    borrower_org: 'UKM Fotografi',
    purpose: 'Pameran foto kampus',
  };

  const requestExamples = {
    '1_sukses_ruangan_dan_fasilitas': {
      summary: '1. Sukses: Gereja Kampus + sound system (hari ke-14)',
      value: {
        ...borrower, request_type: 'RUANGAN', room_id: SEED.rooms.gereja, asset_ids: [SEED.assets.sound],
        start_at: utcAt(14, 9), end_at: utcAt(14, 11), use_facilities: true,
      },
    },
    '2_sukses_aset_saja': {
      summary: '2. Sukses: pinjam kursi lipat saja (hari ke-15)',
      value: {
        ...borrower, request_type: 'ASET', asset_ids: [SEED.assets.kursi],
        start_at: utcAt(15, 9), end_at: utcAt(15, 12),
      },
    },
    '3_bentrok_peminjaman_disetujui': {
      summary: '3. Bentrok: irisan dengan peminjaman DISETUJUI (hari ke-7, 10:00-12:00 UTC)',
      value: {
        ...borrower, request_type: 'RUANGAN', room_id: SEED.rooms.gereja,
        start_at: utcAt(7, 10), end_at: utcAt(7, 12),
      },
    },
    '4_bentrok_aset': {
      summary: '4. Bentrok: proyektor sedang dipinjam (hari ke-7, 09:30-10:30 UTC)',
      value: {
        ...borrower, request_type: 'ASET', asset_ids: [SEED.assets.proyektor],
        start_at: utcAt(7, 9, 30), end_at: utcAt(7, 10, 30),
      },
    },
    '5_bentrok_jadwal_misa': {
      summary: '5. Bentrok: jadwal misa TERBIT (hari ke-9, 08:30-09:30 UTC)',
      value: {
        ...borrower, request_type: 'RUANGAN', room_id: SEED.rooms.gereja,
        start_at: utcAt(9, 8, 30), end_at: utcAt(9, 9, 30),
      },
    },
    '6_aset_pemeliharaan': {
      summary: '6. Gagal: generator berstatus PEMELIHARAAN',
      value: {
        ...borrower, request_type: 'ASET', asset_ids: [SEED.assets.generator],
        start_at: utcAt(21, 9), end_at: utcAt(21, 11),
      },
    },
    '7_aset_khusus_internal': {
      summary: '7. Gagal: mikrofon khusus internal (is_lendable = false)',
      value: {
        ...borrower, request_type: 'ASET', asset_ids: [SEED.assets.mikrofon],
        start_at: utcAt(21, 9), end_at: utcAt(21, 11),
      },
    },
    '8_input_salah': {
      summary: '8. Gagal: telepon, email, dan waktu salah',
      value: {
        ...borrower, request_type: 'RUANGAN', borrower_phone: 'abc', borrower_email: 'bukan-email',
        start_at: utcAt(20, 11), end_at: utcAt(20, 9),
      },
    },
    '9_ruangan_tidak_ada': {
      summary: '9. Gagal: ruangan tidak ada',
      value: {
        ...borrower, request_type: 'RUANGAN', room_id: 999,
        start_at: utcAt(22, 9), end_at: utcAt(22, 11),
      },
    },
  };

  return {
    openapi: '3.0.3',
    info: {
      title: 'ICMS KMK UNS - Ajukan Peminjaman',
      version: '1.1.0',
      description: [
        'Fungsionalitas**Ajukan Peminjaman**.',
      ].join('\n'),
    },
    servers: [{ url: '/' }],
    tags: [
      { name: 'Peminjaman', description: 'Fungsi utama' },
    ],
    paths: {
      '/api/v1/loans': {
        post: {
          tags: ['Peminjaman'],
          summary: 'Ajukan peminjaman ruangan/aset',
          description: 'Satu transaksi: kode `PJM-DDMMYY-NNN`, `loan_requests`, `loan_items`, dan notifikasi. Email konfirmasi dikirim setelah commit.',
          operationId: 'submitLoan',
          requestBody: {
            required: true,
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/SubmitLoanRequest' }, examples: requestExamples },
            },
          },
          responses: {
            '201': {
              description: 'Pengajuan tersimpan dengan status MENUNGGU',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/SubmitLoanSuccess' },
                  example: {
                    status: 'success',
                    data: {
                      loan_id: '3f6c2a0e-8d5b-4c0e-9f43-2d6a5a1b7c90',
                      loan_code: 'PJM-101126-001',
                      status: 'MENUNGGU',
                      wa_link: 'https://wa.me/6281234567890?text=Halo%20Sarpras%20KMK%20UNS...',
                    },
                    message: 'Pengajuan terkirim. Konfirmasi dikirim ke email.',
                  },
                },
              },
            },
            '404': {
              description: 'Ruangan atau aset tidak ditemukan',
              content: errorContent({
                ERR_DATA_01: { summary: 'ERR-DATA-01', value: err('ERR-DATA-01', 'Data yang diminta tidak ditemukan', { room_id: 999 }) },
              }),
            },
            '409': {
              description: 'Jadwal bentrok atau aset tidak tersedia',
              content: errorContent({
                ERR_LOAN_01: {
                  summary: 'ERR-LOAN-01 (bentrok jadwal)',
                  value: err('ERR-LOAN-01', 'Jadwal bentrok dengan kegiatan lain. Pilih waktu lain', {
                    conflicts: [{ source: 'PEMINJAMAN', start_at: '2026-11-17T09:00:00.000Z', end_at: '2026-11-17T11:00:00.000Z' }],
                  }),
                },
                ERR_LOAN_02: {
                  summary: 'ERR-LOAN-02 (aset tidak tersedia)',
                  value: err('ERR-LOAN-02', 'Aset yang dipilih sedang tidak tersedia', {
                    assets: [{ asset_code: 'DIEC-100326', asset_name: 'Generator Listrik 5 kVA', status: 'PEMELIHARAAN', asset_condition: 'RUSAK_RINGAN', is_lendable: true }],
                  }),
                },
              }),
            },
            '422': {
              description: 'Validasi gagal',
              content: errorContent({
                ERR_VAL_03: {
                  summary: 'ERR-VAL-03 (kode mengikuti field pertama yang gagal)',
                  value: err('ERR-VAL-03', 'Masukkan nomor telepon yang valid (contoh: 08123456789)', {
                    fields: {
                      borrower_phone: ['Nomor telepon tidak valid'],
                      borrower_email: ['Email tidak valid'],
                      end_at: ['Waktu selesai harus setelah waktu mulai'],
                    },
                  }),
                },
              }),
            },
            '429': {
              description: 'Melebihi batas pengajuan per IP',
              content: errorContent({
                ERR_RATE_01: { summary: 'ERR-RATE-01', value: err('ERR-RATE-01', 'Terlalu banyak permintaan. Coba lagi beberapa saat lagi') },
              }),
            },
            '503': {
              description: 'Layanan/database tidak tersedia',
              content: errorContent({
                ERR_SYS_01: { summary: 'ERR-SYS-01', value: err('ERR-SYS-01', 'Layanan tidak tersedia. Silakan coba lagi') },
              }),
            },
          },
        },
      },
      '/api/v1/loans/{loanCode}': {
        get: {
          tags: [],
          summary: 'Lihat status pengajuan dari kode',
          description: 'Dipakai untuk menunjukkan hasil `POST /loans` tanpa membuka database. Tidak menampilkan data pribadi peminjam.',
          operationId: 'getLoan',
          parameters: [
            { name: 'loanCode', in: 'path', required: true, schema: { type: 'string', example: 'PJM-101126-001' }, description: 'Kode dari respons 201' },
          ],
          responses: {
            '200': {
              description: 'Pengajuan ditemukan',
              content: {
                'application/json': {
                  example: {
                    status: 'success',
                    data: {
                      loan_code: 'PJM-101126-001', status: 'MENUNGGU', request_type: 'RUANGAN', room: 'Gereja Kampus',
                      assets: [{ asset_code: 'DIEC-050226', asset_name: 'Sound System Portable' }],
                      start_at: '2026-11-24T09:00:00.000Z', end_at: '2026-11-24T11:00:00.000Z',
                      purpose: 'Pameran foto kampus', use_facilities: true,
                    },
                    message: 'Data pengajuan ditemukan',
                  },
                },
              },
            },
            '404': {
              description: 'Kode tidak ditemukan',
              content: errorContent({
                ERR_DATA_01: { summary: 'ERR-DATA-01', value: err('ERR-DATA-01', 'Data yang diminta tidak ditemukan', { loan_code: 'PJM-000000-000' }) },
              }),
            },
          },
        },
      },
      '/health': {
        get: {
          tags: [],
          summary: 'Cek server dan koneksi SQL Server',
          operationId: 'health',
          responses: {
            '200': { description: 'Server dan database aktif', content: { 'application/json': { example: { status: 'ok', database: 'up' } } } },
            '503': { description: 'Database tidak dapat dihubungi', content: { 'application/json': { example: { status: 'error', database: 'down' } } } },
          },
        },
      },
    },
    components: {
      schemas: {
        SubmitLoanRequest: {
          type: 'object',
          required: ['request_type', 'start_at', 'end_at', 'borrower_name', 'borrower_phone', 'borrower_email', 'purpose'],
          properties: {
            request_type: { type: 'string', enum: ['RUANGAN', 'ASET'], description: 'RUANGAN wajib room_id; ASET wajib minimal satu asset_ids' },
            room_id: { type: 'integer', minimum: 1, description: '1 = Gereja Kampus, 2 = Aula Serbaguna (data seed)' },
            asset_ids: { type: 'array', maxItems: 20, items: { type: 'string', format: 'uuid' }, description: 'Untuk RUANGAN: fasilitas/aset tambahan (opsional)' },
            start_at: { type: 'string', format: 'date-time', description: 'ISO 8601, tidak boleh di masa lalu' },
            end_at: { type: 'string', format: 'date-time', description: 'Harus setelah start_at' },
            borrower_name: { type: 'string', minLength: 3, maxLength: 150 },
            borrower_phone: { type: 'string', example: '081234567890', description: 'Nomor ponsel Indonesia (08xx, 628xx, +628xx)' },
            borrower_email: { type: 'string', format: 'email', maxLength: 150 },
            borrower_org: { type: 'string', maxLength: 100 },
            purpose: { type: 'string', minLength: 5, maxLength: 255 },
            use_facilities: { type: 'boolean', default: false },
          },
        },
        SubmitLoanSuccess: {
          type: 'object',
          properties: {
            status: { type: 'string', example: 'success' },
            data: {
              type: 'object',
              properties: {
                loan_id: { type: 'string', format: 'uuid' },
                loan_code: { type: 'string', example: 'PJM-101126-001' },
                status: { type: 'string', example: 'MENUNGGU' },
                wa_link: { type: 'string', nullable: true, description: 'Tautan click-to-chat WA penanggung jawab (null bila WA_PIC_NUMBER kosong)' },
              },
            },
            message: { type: 'string' },
          },
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            status: { type: 'string', example: 'error' },
            error_code: { type: 'string', example: 'ERR-LOAN-01' },
            message: { type: 'string' },
            errors: { type: 'object', additionalProperties: true },
          },
        },
      },
    },
  };
}
