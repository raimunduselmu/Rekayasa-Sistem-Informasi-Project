# ICMS KMK UNS - Backend demo: Ajukan Peminjaman (SQL Server + Swagger)

Fungsi: `POST /api/v1/loans` (FSD-2.10, TSD 3.3 kartu i). Endpoint publik, tidak bergantung pada user management.

Stack: Node.js 22+ (TSD: 24), TypeScript, Express, **SQL Server** (paket `mssql`), zod, Swagger UI.

## 1. Persiapan SQL Server (sekali saja)

Aplikasi memakai **SQL Authentication** (bukan Windows Authentication). Lakukan di SSMS:

1. Klik kanan nama server, **Properties**, **Security**, pilih **SQL Server and Windows Authentication mode**, OK, lalu restart service SQL Server.
2. Buat login (jalankan sebagai admin):
   ```sql
   CREATE LOGIN icms_app WITH PASSWORD = 'Icms#12345', CHECK_POLICY = OFF;
   ALTER SERVER ROLE dbcreator ADD MEMBER icms_app;
   ```
   (Atau aktifkan login `sa` dan pakai `sa`.)
3. Aktifkan TCP/IP: **SQL Server Configuration Manager**, SQL Server Network Configuration, Protocols for (instance Anda), **TCP/IP = Enabled**. Di tab IP Addresses, bagian **IPAll**, isi TCP Port `1433`. Restart service.
4. Named instance (mis. `SQLEXPRESS`): isi `DB_INSTANCE=SQLEXPRESS` di `.env` dan pastikan service **SQL Server Browser** berjalan.

Tanpa SQL Server terpasang? Alternatif: `docker compose up -d` (lihat `docker-compose.yml`; image x86).

## 2. Menjalankan

```bash
cp .env.example .env          # Windows: copy .env.example .env  (sesuaikan DB_USER dan DB_PASSWORD)
npm install
npm run db:reset              # membuat database "icms", tabel, fn_check_availability, dan data seed
npm run dev                   # server di http://localhost:3000
```

Buka **http://localhost:3000/docs** (Swagger UI). Tes unit tanpa database: `npm test`.

## 3. Demo lewat Swagger

1. Buka `/docs`, pilih **POST /api/v1/loans**, klik **Try it out**.
2. Pada dropdown **Examples** pilih contoh, klik **Execute**. Tanggal contoh otomatis di masa depan (muat ulang halaman untuk memperbarui).
3. Salin `loan_code` dari respons 201, lalu pakai **GET /api/v1/loans/{loanCode}** untuk membaca ulang.
4. Buka SSMS untuk menunjukkan bukti di database (query di bagian 5).

| Contoh di Swagger | Hasil |
|---|---|
| 1. Gereja Kampus + sound system | 201, kode `PJM-DDMMYY-001` |
| 2. Kursi lipat saja | 201 |
| 3. Irisan dengan peminjaman DISETUJUI | 409 `ERR-LOAN-01` |
| 4. Proyektor sedang dipinjam | 409 `ERR-LOAN-01` |
| 5. Bentrok jadwal misa TERBIT | 409 `ERR-LOAN-01` |
| 6. Generator berstatus PEMELIHARAAN | 409 `ERR-LOAN-02` |
| 7. Mikrofon khusus internal | 409 `ERR-LOAN-02` |
| 8. Telepon, email, dan waktu salah | 422 `ERR-VAL-03` + daftar field |
| 9. Ruangan tidak ada | 404 `ERR-DATA-01` |
| Kirim contoh sukses berulang | 429 `ERR-RATE-01` setelah kuota habis |

Versi otomatis: `npm run demo` (terminal lain) menjalankan seluruh skenario dan mencetak PASS/FAIL.

**Rate limit saat latihan dan demo:** default 5 pengajuan sukses per jam per IP, jadi cepat habis saat latihan. Untuk latihan set `RATE_LIMIT_MAX=100`; untuk menunjukkan 429 set `RATE_LIMIT_MAX=3`, restart server. Restart juga mereset hitungan.

**Sebelum demo:** jalankan `npm run db:reset` agar data seed memakai tanggal terbaru dan pengajuan latihan terhapus.

## 4. Struktur berlapis (AC-02: logika bisnis di Service)

| Lapisan | File | Tugas |
|---|---|---|
| Route | `modules/loans/loan.routes.ts` | URL + rate limiter |
| Controller | `loan.controller.ts` | validasi body (zod), HTTP status |
| Service | `loan.service.ts` | aturan bisnis + transaksi (padanan `sp_submit_loan`) |
| Repository | `loan.repository.ts` | seluruh query T-SQL |
| Rules | `loan.rules.ts` | aturan murni (BR-55), mudah diuji |
| DB | `sql/001_schema.sql` | tabel + `fn_check_availability` (TSD 5.2) |
| Docs | `src/docs/openapi.ts` | spesifikasi Swagger (contoh dibuat dinamis) |

| Bagian dokumen | Di kode |
|---|---|
| Request body kartu TSD | `loan.schema.ts` |
| `sp_submit_loan` langkah 1 (validasi waktu) | `loan.schema.ts` (superRefine) |
| langkah 2 (aset boleh dipinjam, BR-55) | `loan.service.ts` + `loan.rules.ts` |
| langkah 3 (bentrok, BR-22, ERR-LOAN-01) | `dbo.fn_check_availability` dipanggil di `loan.repository.ts` |
| langkah 4-5 (kode `PJM-DDMMYY-NNN`, insert, notifikasi) | transaksi di `loan.service.ts`, `shared/loan-code.ts` |
| Rate limit 5/jam/IP (BR-23, ERR-RATE-01) | `middleware/rate-limit.ts` |
| Envelope respons & kode ERR (FSD Bagian 6) | `shared/response.ts`, `shared/errors.ts` |
| Email konfirmasi async (AC-08) | `notifications/mailer.ts` (dipanggil setelah commit) |
| Tautan WA ke penanggung jawab | `shared/whatsapp.ts` |

## 5. Bukti di SSMS

```sql
USE icms;
SELECT loan_code, status, request_type, room_id, start_at, end_at FROM dbo.loan_requests ORDER BY created_at;

SELECT l.loan_code, a.asset_code, a.asset_name
FROM dbo.loan_items i
JOIN dbo.loan_requests l ON l.loan_id = i.loan_id
JOIN dbo.assets a ON a.asset_id = i.asset_id;

SELECT channel, type, title, sent_at FROM dbo.notifications ORDER BY created_at;

-- Fungsi bentrok: hari ke-7 pukul 09:00-11:00 UTC menghasilkan 1 baris (PEMINJAMAN)
DECLARE @d DATETIME2(3) = DATEADD(DAY, 7, CAST(CAST(SYSUTCDATETIME() AS DATE) AS DATETIME2(3)));
SELECT * FROM dbo.fn_check_availability(1, '[]', DATEADD(HOUR, 9, @d), DATEADD(HOUR, 11, @d), NULL);
```

Bukti transaksi: hitung `SELECT COUNT(*) FROM dbo.loan_requests;` sebelum dan sesudah request yang gagal (409/422). Angkanya tidak berubah.

## 6. Perbedaan dengan TSD (dijelaskan saat demo)

- Database memakai SQL Server dan seluruh tipe data mengikuti T-SQL. TSD masih menyebut PostgreSQL + SQL Server dan Drizzle; revisi TSD diperlukan (stack, deployment diagram, tipe data, bagian 5).
- `sp_submit_loan` ditulis di TypeScript (service + transaksi), bukan stored procedure. `fn_check_availability` tetap berupa fungsi database (T-SQL, inline table-valued).
- ID baris dibuat di aplikasi (`randomUUID`), bukan `OUTPUT INSERTED`, supaya tetap berfungsi ketika tabel nanti diberi trigger audit.
- Skema demo hanya subset tabel. FK ke `workflows`, `events`, `periods`, `members` tidak dibuat; `workflow_id` belum diisi sampai modul workflow ada.
- Rate limiter memakai memori proses (TSD: Redis). Antrean BullMQ belum dipasang; email dikirim setelah commit dan kegagalannya hanya dicatat.
- Email: tanpa `SMTP_HOST` isi email dicetak ke konsol server.
- Aset boleh diajukan walau berstatus DIPINJAM/DIGUNAKAN; bentrok dinilai dari jadwal, bukan dari status.
- Tambahan di luar kartu TSD: `wa_link` pada respons 201, `GET /api/v1/loans/{loanCode}`, dan Swagger. Tambahkan ke TSD atau tandai sebagai pelengkap demo. `WA_PIC_NUMBER` di `.env` hanyalah contoh sampai tim memutuskan nomor penanggung jawab.
- Semua timestamp disimpan sebagai UTC; kode pengajuan dan tampilan email memakai WIB.

## 7. Masalah umum

| Gejala | Penyebab / solusi |
|---|---|
| `Login failed for user` | SQL Authentication belum aktif, password salah, atau login `sa` dinonaktifkan |
| `ECONNREFUSED` / `Failed to connect` | TCP/IP belum Enabled atau port bukan 1433; restart service SQL Server |
| `self-signed certificate` | pastikan `DB_TRUST_SERVER_CERT=true` |
| Named instance tidak ketemu | isi `DB_INSTANCE`, jalankan service SQL Server Browser |
| `Cannot open database` | jalankan `npm run db:reset` (membuat database `icms`) |
| `EADDRINUSE :3000` | ganti `PORT` di `.env` |
| Skenario 3, 4, 5 menghasilkan 201 | data seed sudah usang atau terhapus; jalankan `npm run db:reset` |
