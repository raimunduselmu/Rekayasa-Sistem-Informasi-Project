-- Hapus seluruh objek demo (dipakai oleh: npm run db:reset). SQL Server 2016+.
IF OBJECT_ID(N'dbo.fn_check_availability', N'IF') IS NOT NULL DROP FUNCTION dbo.fn_check_availability;
GO
DROP TABLE IF EXISTS dbo.notifications;
DROP TABLE IF EXISTS dbo.loan_items;
DROP TABLE IF EXISTS dbo.usage_report_items;
DROP TABLE IF EXISTS dbo.usage_reports;
DROP TABLE IF EXISTS dbo.liturgy_schedules;
DROP TABLE IF EXISTS dbo.loan_requests;
DROP TABLE IF EXISTS dbo.assets;
DROP TABLE IF EXISTS dbo.asset_categories;
DROP TABLE IF EXISTS dbo.rooms;
DROP TABLE IF EXISTS dbo.users;
DROP TABLE IF EXISTS dbo.roles;
GO
