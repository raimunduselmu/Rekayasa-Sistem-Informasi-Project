-- Data demo. Tanggal dibuat relatif terhadap hari ini (UTC) supaya skenario demo selalu di masa depan.
-- Jalankan ulang sebelum demo lewat: npm run db:reset

IF NOT EXISTS (SELECT 1 FROM dbo.roles)
  INSERT INTO dbo.roles (role_name) VALUES ('Admin'),('Sarpras'),('PHT'),('Liturgi'),('Bendahara'),('Pastor'),('Umat'),('Tamu');
GO

-- password_hash hanya placeholder (login tidak termasuk demo ini)
IF NOT EXISTS (SELECT 1 FROM dbo.users WHERE user_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1')
  INSERT INTO dbo.users (user_id, full_name, email, phone, division, password_hash, role_id)
  VALUES ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', N'Pengurus Sarpras 1', N'sarpras1@kmk-uns.local', '081200000001', N'Sarana Prasarana',
          '$2b$12$DEMOONLYDEMOONLYDEMOONLYDEMOONLYDEMOONLYDEMOONLYDEMOO', (SELECT role_id FROM dbo.roles WHERE role_name = 'Sarpras'));
IF NOT EXISTS (SELECT 1 FROM dbo.users WHERE user_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2')
  INSERT INTO dbo.users (user_id, full_name, email, phone, division, password_hash, role_id)
  VALUES ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2', N'Pengurus Sarpras 2', N'sarpras2@kmk-uns.local', '081200000002', N'Sarana Prasarana',
          '$2b$12$DEMOONLYDEMOONLYDEMOONLYDEMOONLYDEMOONLYDEMOONLYDEMOO', (SELECT role_id FROM dbo.roles WHERE role_name = 'Sarpras'));
GO

IF NOT EXISTS (SELECT 1 FROM dbo.asset_categories)
  INSERT INTO dbo.asset_categories (category_code, category_name, maintenance_default_days)
  VALUES ('DIEC', N'Elektronik & Multimedia', 180), ('FURN', N'Mebel & Perlengkapan', 365);
GO

-- room_id bernilai 1 (Gereja Kampus) dan 2 (Aula) setelah db:reset; dipakai Swagger dan skrip demo
IF NOT EXISTS (SELECT 1 FROM dbo.rooms)
  INSERT INTO dbo.rooms (room_name, capacity, description)
  VALUES (N'Gereja Kampus', 200, N'Ruang ibadah utama'), (N'Aula Serbaguna', 80, N'Ruang pertemuan dan kegiatan');
GO

DECLARE @diec INT = (SELECT category_id FROM dbo.asset_categories WHERE category_code = 'DIEC');
DECLARE @furn INT = (SELECT category_id FROM dbo.asset_categories WHERE category_code = 'FURN');

IF NOT EXISTS (SELECT 1 FROM dbo.assets WHERE asset_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1')
  INSERT INTO dbo.assets (asset_id, asset_code, asset_name, category_id, location_text, asset_condition, status, is_lendable, source_type, acquired_date)
  VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'DIEC-050126', N'Proyektor Epson', @diec, N'Gudang Sarpras', 'BAIK', 'TERSEDIA', 1, 'KAS', '2026-01-05');
IF NOT EXISTS (SELECT 1 FROM dbo.assets WHERE asset_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2')
  INSERT INTO dbo.assets (asset_id, asset_code, asset_name, category_id, location_text, asset_condition, status, is_lendable, source_type, acquired_date)
  VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', 'DIEC-050226', N'Sound System Portable', @diec, N'Gudang Sarpras', 'BAIK', 'TERSEDIA', 1, 'DONASI', '2026-02-05');
IF NOT EXISTS (SELECT 1 FROM dbo.assets WHERE asset_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3')
  INSERT INTO dbo.assets (asset_id, asset_code, asset_name, category_id, location_text, asset_condition, status, is_lendable, source_type, acquired_date)
  VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3', 'DIEC-100326', N'Generator Listrik 5 kVA', @diec, N'Gudang Sarpras', 'RUSAK_RINGAN', 'PEMELIHARAAN', 1, 'KAS', '2026-03-10');
IF NOT EXISTS (SELECT 1 FROM dbo.assets WHERE asset_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4')
  INSERT INTO dbo.assets (asset_id, asset_code, asset_name, category_id, location_text, asset_condition, status, is_lendable, source_type, acquired_date)
  VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4', 'FURN-150126', N'Kursi Lipat (50 unit)', @furn, N'Aula Serbaguna', 'BAIK', 'TERSEDIA', 1, 'KAS', '2026-01-15');
IF NOT EXISTS (SELECT 1 FROM dbo.assets WHERE asset_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5')
  INSERT INTO dbo.assets (asset_id, asset_code, asset_name, category_id, location_text, asset_condition, status, is_lendable, source_type, acquired_date)
  VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5', 'DIEC-200426', N'Mikrofon Wireless (internal)', @diec, N'Ruang Liturgi', 'BAIK', 'TERSEDIA', 0, 'HIBAH', '2026-04-20');
GO

-- Peminjaman DISETUJUI: Gereja Kampus + proyektor, hari ke-7 pukul 09:00-11:00 UTC
DECLARE @today DATETIME2(3) = CAST(CAST(SYSUTCDATETIME() AS DATE) AS DATETIME2(3));
DECLARE @gereja INT = (SELECT room_id FROM dbo.rooms WHERE room_name = N'Gereja Kampus');

IF NOT EXISTS (SELECT 1 FROM dbo.loan_requests WHERE loan_id = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1')
BEGIN
  INSERT INTO dbo.loan_requests (loan_id, loan_code, request_type, room_id, borrower_name, borrower_phone, borrower_email, borrower_org, purpose,
                                 start_at, end_at, use_facilities, status, current_step)
  VALUES ('cccccccc-cccc-4ccc-8ccc-ccccccccccc1', 'PJM-010126-001', 'RUANGAN', @gereja, N'Seed Peminjam', '081234567890', N'seed@example.com',
          N'UKM Contoh', N'Seminar (data seed)',
          DATEADD(HOUR, 9, DATEADD(DAY, 7, @today)), DATEADD(HOUR, 11, DATEADD(DAY, 7, @today)), 1, 'DISETUJUI', 1);
  INSERT INTO dbo.loan_items (loan_id, asset_id)
  VALUES ('cccccccc-cccc-4ccc-8ccc-ccccccccccc1', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1');
END;

-- Jadwal misa TERBIT: Gereja Kampus, hari ke-9 pukul 08:00-10:00 UTC
IF NOT EXISTS (SELECT 1 FROM dbo.liturgy_schedules WHERE schedule_id = 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1')
  INSERT INTO dbo.liturgy_schedules (schedule_id, title, worship_type, room_id, start_at, end_at, status, period_id)
  VALUES ('dddddddd-dddd-4ddd-8ddd-ddddddddddd1', N'Misa Minggu', 'MISA', @gereja,
          DATEADD(HOUR, 8, DATEADD(DAY, 9, @today)), DATEADD(HOUR, 10, DATEADD(DAY, 9, @today)), 'TERBIT', 1);
GO
