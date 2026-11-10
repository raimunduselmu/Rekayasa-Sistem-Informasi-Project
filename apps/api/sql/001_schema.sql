-- Skema demo (SQL Server 2016+) = SUBSET dari TSD Bagian 4 yang dibutuhkan fungsi "Ajukan Peminjaman".
-- Tipe data: UUID -> UNIQUEIDENTIFIER, TIMESTAMP -> DATETIME2, BOOLEAN -> BIT, TEXT -> NVARCHAR(MAX).
-- FK ke tabel modul lain (workflows, events, periods, members) tidak dibuat karena tabelnya tidak ikut demo.

IF OBJECT_ID(N'dbo.roles', N'U') IS NULL
CREATE TABLE dbo.roles (
  role_id     INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_roles PRIMARY KEY,
  role_name   VARCHAR(20) NOT NULL CONSTRAINT UQ_roles_name UNIQUE
              CONSTRAINT CK_roles_name CHECK (role_name IN ('Admin','Sarpras','PHT','Liturgi','Bendahara','Pastor','Umat','Tamu')),
  description NVARCHAR(MAX) NULL
);
GO

IF OBJECT_ID(N'dbo.users', N'U') IS NULL
CREATE TABLE dbo.users (
  user_id         UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_users_id DEFAULT NEWID() CONSTRAINT PK_users PRIMARY KEY,
  full_name       NVARCHAR(100) NOT NULL,
  email           NVARCHAR(150) NOT NULL CONSTRAINT UQ_users_email UNIQUE,
  phone           VARCHAR(20) NULL,
  division        NVARCHAR(100) NULL,
  password_hash   VARCHAR(255) NOT NULL,
  role_id         INT NOT NULL CONSTRAINT FK_users_role REFERENCES dbo.roles(role_id),
  is_active       BIT NOT NULL CONSTRAINT DF_users_active DEFAULT 1,
  failed_attempts INT NOT NULL CONSTRAINT DF_users_failed DEFAULT 0,
  locked_until    DATETIME2(3) NULL,
  last_login_at   DATETIME2(3) NULL,
  created_at      DATETIME2(3) NOT NULL CONSTRAINT DF_users_created DEFAULT SYSUTCDATETIME(),
  updated_at      DATETIME2(3) NOT NULL CONSTRAINT DF_users_updated DEFAULT SYSUTCDATETIME()
);
GO

IF OBJECT_ID(N'dbo.asset_categories', N'U') IS NULL
CREATE TABLE dbo.asset_categories (
  category_id              INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_asset_categories PRIMARY KEY,
  category_code            VARCHAR(30) NOT NULL CONSTRAINT UQ_asset_categories_code UNIQUE,
  category_name            NVARCHAR(150) NOT NULL,
  maintenance_default_days INT NULL
);
GO

IF OBJECT_ID(N'dbo.rooms', N'U') IS NULL
CREATE TABLE dbo.rooms (
  room_id     INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_rooms PRIMARY KEY,
  room_name   NVARCHAR(150) NOT NULL CONSTRAINT UQ_rooms_name UNIQUE,
  capacity    INT NULL,
  description NVARCHAR(MAX) NULL,
  is_active   BIT NOT NULL CONSTRAINT DF_rooms_active DEFAULT 1
);
GO

IF OBJECT_ID(N'dbo.assets', N'U') IS NULL
CREATE TABLE dbo.assets (
  asset_id          UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_assets_id DEFAULT NEWID() CONSTRAINT PK_assets PRIMARY KEY,
  asset_code        VARCHAR(30) NOT NULL CONSTRAINT UQ_assets_code UNIQUE,
  asset_name        NVARCHAR(150) NOT NULL,
  category_id       INT NOT NULL CONSTRAINT FK_assets_category REFERENCES dbo.asset_categories(category_id),
  location_text     NVARCHAR(100) NOT NULL,
  asset_condition   VARCHAR(20) NOT NULL CONSTRAINT DF_assets_cond DEFAULT 'BAIK'
                    CONSTRAINT CK_assets_cond CHECK (asset_condition IN ('BAIK','RUSAK_RINGAN','RUSAK_BERAT')),
  status            VARCHAR(20) NOT NULL CONSTRAINT DF_assets_status DEFAULT 'TERSEDIA'
                    CONSTRAINT CK_assets_status CHECK (status IN ('TERSEDIA','DIPINJAM','DIGUNAKAN','PEMELIHARAAN','HILANG','NONAKTIF')),
  is_lendable       BIT NOT NULL CONSTRAINT DF_assets_lendable DEFAULT 1,
  source_type       VARCHAR(20) NOT NULL CONSTRAINT CK_assets_source CHECK (source_type IN ('KAS','DONASI','HIBAH')),
  donor_name        NVARCHAR(150) NULL,
  acquired_date     DATE NOT NULL,
  description       NVARCHAR(MAX) NULL,
  photo_path        VARCHAR(255) NULL,
  created_by        UNIQUEIDENTIFIER NULL CONSTRAINT FK_assets_created_by REFERENCES dbo.users(user_id) ON DELETE SET NULL,
  is_deleted        BIT NOT NULL CONSTRAINT DF_assets_deleted DEFAULT 0,
  created_at        DATETIME2(3) NOT NULL CONSTRAINT DF_assets_created DEFAULT SYSUTCDATETIME(),
  updated_at        DATETIME2(3) NOT NULL CONSTRAINT DF_assets_updated DEFAULT SYSUTCDATETIME(),
  acquisition_value DECIMAL(15,2) NULL
);
GO

IF OBJECT_ID(N'dbo.loan_requests', N'U') IS NULL
CREATE TABLE dbo.loan_requests (
  loan_id         UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_loan_id DEFAULT NEWID() CONSTRAINT PK_loan_requests PRIMARY KEY,
  loan_code       VARCHAR(30) NOT NULL CONSTRAINT UQ_loan_code UNIQUE,   -- format PJM-DDMMYY-NNN
  request_type    VARCHAR(20) NOT NULL CONSTRAINT CK_loan_type CHECK (request_type IN ('RUANGAN','ASET')),
  room_id         INT NULL CONSTRAINT FK_loan_room REFERENCES dbo.rooms(room_id) ON DELETE SET NULL,
  borrower_name   NVARCHAR(150) NOT NULL,
  borrower_phone  VARCHAR(20) NOT NULL,
  borrower_email  NVARCHAR(150) NOT NULL,
  borrower_org    NVARCHAR(100) NULL,
  purpose         NVARCHAR(255) NOT NULL,
  start_at        DATETIME2(3) NOT NULL,
  end_at          DATETIME2(3) NOT NULL,
  use_facilities  BIT NOT NULL CONSTRAINT DF_loan_facilities DEFAULT 0,
  status          VARCHAR(20) NOT NULL CONSTRAINT DF_loan_status DEFAULT 'MENUNGGU'
                  CONSTRAINT CK_loan_status CHECK (status IN ('MENUNGGU','DISETUJUI','DITOLAK','DIAMBIL','SELESAI','DIBATALKAN')),
  reviewed_by     UNIQUEIDENTIFIER NULL CONSTRAINT FK_loan_reviewer REFERENCES dbo.users(user_id) ON DELETE SET NULL,
  reviewed_at     DATETIME2(3) NULL,
  reject_reason   NVARCHAR(MAX) NULL,
  handed_over_at  DATETIME2(3) NULL,
  returned_at     DATETIME2(3) NULL,
  return_note     NVARCHAR(MAX) NULL,
  created_at      DATETIME2(3) NOT NULL CONSTRAINT DF_loan_created DEFAULT SYSUTCDATETIME(),
  workflow_id     INT NULL,                  -- FK ke workflows (tidak ikut demo)
  current_step    INT NULL CONSTRAINT DF_loan_step DEFAULT 1,
  event_id        UNIQUEIDENTIFIER NULL,     -- FK ke events (tidak ikut demo)
  CONSTRAINT CK_loan_time CHECK (end_at > start_at)
);
GO

IF OBJECT_ID(N'dbo.loan_items', N'U') IS NULL
CREATE TABLE dbo.loan_items (
  loan_item_id  UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_loan_items_id DEFAULT NEWID() CONSTRAINT PK_loan_items PRIMARY KEY,
  loan_id       UNIQUEIDENTIFIER NOT NULL CONSTRAINT FK_loan_items_loan REFERENCES dbo.loan_requests(loan_id),
  asset_id      UNIQUEIDENTIFIER NOT NULL CONSTRAINT FK_loan_items_asset REFERENCES dbo.assets(asset_id),
  condition_out VARCHAR(20) NULL CONSTRAINT CK_loan_items_out CHECK (condition_out IN ('BAIK','RUSAK_RINGAN','RUSAK_BERAT')),
  condition_in  VARCHAR(20) NULL CONSTRAINT CK_loan_items_in CHECK (condition_in IN ('BAIK','RUSAK_RINGAN','RUSAK_BERAT')),
  CONSTRAINT UQ_loan_items UNIQUE (loan_id, asset_id)
);
GO

IF OBJECT_ID(N'dbo.usage_reports', N'U') IS NULL
CREATE TABLE dbo.usage_reports (
  report_id        UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_usage_id DEFAULT NEWID() CONSTRAINT PK_usage_reports PRIMARY KEY,
  reporter_user_id UNIQUEIDENTIFIER NULL CONSTRAINT FK_usage_user REFERENCES dbo.users(user_id) ON DELETE SET NULL,
  reporter_name    NVARCHAR(150) NOT NULL,
  reporter_phone   VARCHAR(20) NOT NULL,
  division         NVARCHAR(100) NOT NULL,
  activity_name    NVARCHAR(150) NOT NULL,
  room_id          INT NULL CONSTRAINT FK_usage_room REFERENCES dbo.rooms(room_id) ON DELETE SET NULL,
  start_at         DATETIME2(3) NOT NULL,
  planned_end_at   DATETIME2(3) NOT NULL,
  finished_at      DATETIME2(3) NULL,
  status           VARCHAR(20) NOT NULL CONSTRAINT DF_usage_status DEFAULT 'BERLANGSUNG'
                   CONSTRAINT CK_usage_status CHECK (status IN ('BERLANGSUNG','SELESAI')),
  created_at       DATETIME2(3) NOT NULL CONSTRAINT DF_usage_created DEFAULT SYSUTCDATETIME()
);
GO

IF OBJECT_ID(N'dbo.usage_report_items', N'U') IS NULL
CREATE TABLE dbo.usage_report_items (
  report_item_id  UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_usage_items_id DEFAULT NEWID() CONSTRAINT PK_usage_report_items PRIMARY KEY,
  report_id       UNIQUEIDENTIFIER NOT NULL CONSTRAINT FK_usage_items_report REFERENCES dbo.usage_reports(report_id),
  asset_id        UNIQUEIDENTIFIER NOT NULL CONSTRAINT FK_usage_items_asset REFERENCES dbo.assets(asset_id),
  condition_after VARCHAR(20) NULL CONSTRAINT CK_usage_items_cond CHECK (condition_after IN ('BAIK','RUSAK_RINGAN','RUSAK_BERAT'))
);
GO

IF OBJECT_ID(N'dbo.liturgy_schedules', N'U') IS NULL
CREATE TABLE dbo.liturgy_schedules (
  schedule_id  UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_liturgy_id DEFAULT NEWID() CONSTRAINT PK_liturgy_schedules PRIMARY KEY,
  title        NVARCHAR(150) NOT NULL,
  worship_type VARCHAR(20) NOT NULL CONSTRAINT CK_liturgy_type CHECK (worship_type IN ('MISA','IBADAH','DOA','LAINNYA')),
  room_id      INT NOT NULL CONSTRAINT FK_liturgy_room REFERENCES dbo.rooms(room_id),
  start_at     DATETIME2(3) NOT NULL,
  end_at       DATETIME2(3) NOT NULL,
  celebrant_id UNIQUEIDENTIFIER NULL,        -- FK ke members (tidak ikut demo)
  status       VARCHAR(20) NOT NULL CONSTRAINT DF_liturgy_status DEFAULT 'DRAFT'
               CONSTRAINT CK_liturgy_status CHECK (status IN ('DRAFT','TERBIT','BATAL')),
  period_id    INT NOT NULL                  -- FK ke periods (tidak ikut demo)
);
GO

IF OBJECT_ID(N'dbo.notifications', N'U') IS NULL
CREATE TABLE dbo.notifications (
  notification_id   UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_notif_id DEFAULT NEWID() CONSTRAINT PK_notifications PRIMARY KEY,
  recipient_user_id UNIQUEIDENTIFIER NULL CONSTRAINT FK_notif_user REFERENCES dbo.users(user_id) ON DELETE SET NULL,
  recipient_email   NVARCHAR(150) NULL,
  type              VARCHAR(50) NOT NULL,
  title             NVARCHAR(150) NOT NULL,
  message           NVARCHAR(MAX) NOT NULL,
  channel           VARCHAR(20) NOT NULL CONSTRAINT CK_notif_channel CHECK (channel IN ('APP','EMAIL')),
  related_id        VARCHAR(100) NULL,
  is_read           BIT NOT NULL CONSTRAINT DF_notif_read DEFAULT 0,
  sent_at           DATETIME2(3) NULL,
  created_at        DATETIME2(3) NOT NULL CONSTRAINT DF_notif_created DEFAULT SYSUTCDATETIME()
);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'idx_loan_requests_room_time' AND object_id = OBJECT_ID(N'dbo.loan_requests'))
  CREATE INDEX idx_loan_requests_room_time ON dbo.loan_requests (room_id, start_at, end_at);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'idx_loan_requests_status' AND object_id = OBJECT_ID(N'dbo.loan_requests'))
  CREATE INDEX idx_loan_requests_status ON dbo.loan_requests (status);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'idx_loan_items_asset' AND object_id = OBJECT_ID(N'dbo.loan_items'))
  CREATE INDEX idx_loan_items_asset ON dbo.loan_items (asset_id);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'idx_usage_reports_room_time' AND object_id = OBJECT_ID(N'dbo.usage_reports'))
  CREATE INDEX idx_usage_reports_room_time ON dbo.usage_reports (room_id, start_at, planned_end_at);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'idx_liturgy_room_time' AND object_id = OBJECT_ID(N'dbo.liturgy_schedules'))
  CREATE INDEX idx_liturgy_room_time ON dbo.liturgy_schedules (room_id, start_at, end_at);
GO

-- TSD 5.2: fn_check_availability (inline table-valued function).
-- Mengembalikan baris pada setiap bentrokan; tidak ada baris = tersedia.
-- Bentrok jika mulai_A < selesai_B AND selesai_A > mulai_B (BR-19).
-- Pemblokir slot: peminjaman DISETUJUI/DIAMBIL, pemakaian internal BERLANGSUNG, jadwal liturgi TERBIT (BR-20).
-- Pengajuan MENUNGGU tidak memblokir slot. @p_asset_ids berisi array JSON UUID, mis. '["...","..."]' atau '[]'.
CREATE OR ALTER FUNCTION dbo.fn_check_availability (
  @p_room_id         INT,
  @p_asset_ids       NVARCHAR(MAX),
  @p_start_at        DATETIME2(3),
  @p_end_at          DATETIME2(3),
  @p_exclude_loan_id UNIQUEIDENTIFIER
)
RETURNS TABLE
AS RETURN
(
  SELECT CAST('PEMINJAMAN' AS VARCHAR(20)) AS source, lr.start_at, lr.end_at
  FROM dbo.loan_requests lr
  WHERE lr.status IN ('DISETUJUI', 'DIAMBIL')
    AND (@p_exclude_loan_id IS NULL OR lr.loan_id <> @p_exclude_loan_id)
    AND lr.start_at < @p_end_at AND lr.end_at > @p_start_at
    AND (
      (@p_room_id IS NOT NULL AND lr.room_id = @p_room_id)
      OR EXISTS (
        SELECT 1 FROM dbo.loan_items li
        WHERE li.loan_id = lr.loan_id
          AND li.asset_id IN (SELECT CAST(j.value AS UNIQUEIDENTIFIER) FROM OPENJSON(@p_asset_ids) j)
      )
    )
  UNION ALL
  SELECT CAST('PEMAKAIAN_INTERNAL' AS VARCHAR(20)), ur.start_at, ur.planned_end_at
  FROM dbo.usage_reports ur
  WHERE ur.status = 'BERLANGSUNG'
    AND ur.start_at < @p_end_at AND ur.planned_end_at > @p_start_at
    AND (
      (@p_room_id IS NOT NULL AND ur.room_id = @p_room_id)
      OR EXISTS (
        SELECT 1 FROM dbo.usage_report_items ui
        WHERE ui.report_id = ur.report_id
          AND ui.asset_id IN (SELECT CAST(j.value AS UNIQUEIDENTIFIER) FROM OPENJSON(@p_asset_ids) j)
      )
    )
  UNION ALL
  SELECT CAST('LITURGI' AS VARCHAR(20)), ls.start_at, ls.end_at
  FROM dbo.liturgy_schedules ls
  WHERE @p_room_id IS NOT NULL AND ls.room_id = @p_room_id AND ls.status = 'TERBIT'
    AND ls.start_at < @p_end_at AND ls.end_at > @p_start_at
);
GO
