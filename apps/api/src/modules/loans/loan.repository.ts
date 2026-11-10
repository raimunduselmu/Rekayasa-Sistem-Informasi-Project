import { request, sql, type Exec } from '../../db/client';

export interface RoomRow { roomId: number; roomName: string; isActive: boolean }
export interface AssetRow {
  assetId: string; assetCode: string; assetName: string;
  assetCondition: string; status: string; isLendable: boolean;
}
export interface Conflict { source: string; start_at: string; end_at: string }
export interface LoanSummaryRow {
  loanId: string; loanCode: string; requestType: string; status: string;
  startAt: Date; endAt: Date; purpose: string; useFacilities: boolean; roomName: string | null;
}
export interface NewLoan {
  loanId: string; loanCode: string; requestType: string; roomId: number | null;
  borrowerName: string; borrowerPhone: string; borrowerEmail: string; borrowerOrg: string | null;
  purpose: string; startAt: Date; endAt: Date; useFacilities: boolean;
}
export interface NewNotification {
  notificationId: string; recipientUserId: string | null; recipientEmail: string | null;
  type: string; title: string; message: string; channel: 'APP' | 'EMAIL'; relatedId: string;
}

// SQL Server mengembalikan UNIQUEIDENTIFIER dalam huruf besar; seluruh aplikasi memakai huruf kecil.
const id = (v: unknown) => String(v).toLowerCase();

export const loanRepository = {
  async findRoom(ex: Exec, roomId: number): Promise<RoomRow | null> {
    const r = await request(ex)
      .input('room_id', sql.Int, roomId)
      .query<{ room_id: number; room_name: string; is_active: boolean }>(
        'SELECT room_id, room_name, is_active FROM dbo.rooms WHERE room_id = @room_id',
      );
    const row = r.recordset[0];
    return row ? { roomId: row.room_id, roomName: row.room_name, isActive: row.is_active } : null;
  },

  async findAssets(ex: Exec, ids: string[]): Promise<AssetRow[]> {
    const r = await request(ex)
      .input('ids', sql.NVarChar(sql.MAX), JSON.stringify(ids))
      .query<{
        asset_id: string; asset_code: string; asset_name: string;
        asset_condition: string; status: string; is_lendable: boolean;
      }>(`
        SELECT asset_id, asset_code, asset_name, asset_condition, status, is_lendable
        FROM dbo.assets
        WHERE is_deleted = 0
          AND asset_id IN (SELECT CAST(j.value AS UNIQUEIDENTIFIER) FROM OPENJSON(@ids) j)`);
    return r.recordset.map((a) => ({
      assetId: id(a.asset_id), assetCode: a.asset_code, assetName: a.asset_name,
      assetCondition: a.asset_condition, status: a.status, isLendable: a.is_lendable,
    }));
  },

  // TSD 5.2: fn_check_availability (didefinisikan di sql/001_schema.sql). Tidak ada baris = tersedia.
  async checkAvailability(
    ex: Exec,
    p: { roomId: number | null; assetIds: string[]; startAt: Date; endAt: Date },
  ): Promise<{ available: boolean; conflicts: Conflict[] }> {
    const r = await request(ex)
      .input('room_id', sql.Int, p.roomId)
      .input('asset_ids', sql.NVarChar(sql.MAX), JSON.stringify(p.assetIds))
      .input('start_at', sql.DateTime2(3), p.startAt)
      .input('end_at', sql.DateTime2(3), p.endAt)
      .query<{ source: string; start_at: Date; end_at: Date }>(`
        SELECT source, start_at, end_at
        FROM dbo.fn_check_availability(@room_id, @asset_ids, @start_at, @end_at, NULL)`);
    const conflicts = r.recordset.map((c) => ({
      source: c.source,
      start_at: new Date(c.start_at).toISOString(),
      end_at: new Date(c.end_at).toISOString(),
    }));
    return { available: conflicts.length === 0, conflicts };
  },

  // Kunci per hari agar dua pengajuan bersamaan tidak menghasilkan kode yang sama. Wajib di dalam transaksi.
  async lockLoanCodeDay(tx: Exec, prefix: string): Promise<void> {
    const r = await request(tx)
      .input('resource', sql.NVarChar(200), `loan_code:${prefix}`)
      .query<{ lock_result: number }>(`
        DECLARE @r INT;
        EXEC @r = sp_getapplock @Resource = @resource, @LockMode = 'Exclusive', @LockOwner = 'Transaction', @LockTimeout = 10000;
        SELECT @r AS lock_result;`);
    const code = r.recordset[0]?.lock_result ?? -999;
    if (code < 0) throw new Error(`Gagal memperoleh kunci kode pengajuan (kode ${code})`);
  },

  async nextLoanSequence(ex: Exec, prefix: string): Promise<number> {
    // Format PJM-DDMMYY-NNN: urutan NNN dimulai pada karakter ke-12
    const r = await request(ex)
      .input('prefix', sql.VarChar(20), prefix)
      .query<{ last_seq: number }>(`
        SELECT ISNULL(MAX(CAST(SUBSTRING(loan_code, 12, 10) AS INT)), 0) AS last_seq
        FROM dbo.loan_requests
        WHERE loan_code LIKE @prefix + '%'`);
    return Number(r.recordset[0]?.last_seq ?? 0) + 1;
  },

  // ID dibuat di aplikasi (bukan OUTPUT INSERTED) agar tetap berfungsi saat tabel nanti diberi trigger audit.
  async insertLoan(ex: Exec, v: NewLoan): Promise<void> {
    await request(ex)
      .input('loan_id', sql.UniqueIdentifier, v.loanId)
      .input('loan_code', sql.VarChar(30), v.loanCode)
      .input('request_type', sql.VarChar(20), v.requestType)
      .input('room_id', sql.Int, v.roomId)
      .input('borrower_name', sql.NVarChar(150), v.borrowerName)
      .input('borrower_phone', sql.VarChar(20), v.borrowerPhone)
      .input('borrower_email', sql.NVarChar(150), v.borrowerEmail)
      .input('borrower_org', sql.NVarChar(100), v.borrowerOrg)
      .input('purpose', sql.NVarChar(255), v.purpose)
      .input('start_at', sql.DateTime2(3), v.startAt)
      .input('end_at', sql.DateTime2(3), v.endAt)
      .input('use_facilities', sql.Bit, v.useFacilities)
      .query(`
        INSERT INTO dbo.loan_requests
          (loan_id, loan_code, request_type, room_id, borrower_name, borrower_phone, borrower_email, borrower_org,
           purpose, start_at, end_at, use_facilities, status, current_step)
        VALUES
          (@loan_id, @loan_code, @request_type, @room_id, @borrower_name, @borrower_phone, @borrower_email, @borrower_org,
           @purpose, @start_at, @end_at, @use_facilities, 'MENUNGGU', 1)`);
  },

  async insertLoanItems(ex: Exec, loanId: string, assetIds: string[]): Promise<void> {
    if (assetIds.length === 0) return;
    await request(ex)
      .input('loan_id', sql.UniqueIdentifier, loanId)
      .input('asset_ids', sql.NVarChar(sql.MAX), JSON.stringify(assetIds))
      .query(`
        INSERT INTO dbo.loan_items (loan_id, asset_id)
        SELECT @loan_id, CAST(j.value AS UNIQUEIDENTIFIER) FROM OPENJSON(@asset_ids) j`);
  },

  async findSarprasUserIds(ex: Exec): Promise<string[]> {
    const r = await request(ex).query<{ user_id: string }>(`
      SELECT u.user_id
      FROM dbo.users u JOIN dbo.roles r ON r.role_id = u.role_id
      WHERE r.role_name = 'Sarpras' AND u.is_active = 1`);
    return r.recordset.map((u) => id(u.user_id));
  },

  async insertNotification(ex: Exec, n: NewNotification): Promise<void> {
    await request(ex)
      .input('notification_id', sql.UniqueIdentifier, n.notificationId)
      .input('recipient_user_id', sql.UniqueIdentifier, n.recipientUserId)
      .input('recipient_email', sql.NVarChar(150), n.recipientEmail)
      .input('type', sql.VarChar(50), n.type)
      .input('title', sql.NVarChar(150), n.title)
      .input('message', sql.NVarChar(sql.MAX), n.message)
      .input('channel', sql.VarChar(20), n.channel)
      .input('related_id', sql.VarChar(100), n.relatedId)
      .query(`
        INSERT INTO dbo.notifications
          (notification_id, recipient_user_id, recipient_email, type, title, message, channel, related_id)
        VALUES
          (@notification_id, @recipient_user_id, @recipient_email, @type, @title, @message, @channel, @related_id)`);
  },

  async markNotificationSent(ex: Exec, notificationId: string): Promise<void> {
    await request(ex)
      .input('id', sql.UniqueIdentifier, notificationId)
      .query('UPDATE dbo.notifications SET sent_at = SYSUTCDATETIME() WHERE notification_id = @id');
  },

  // Pelengkap demo: baca ulang pengajuan berdasarkan kode (tanpa data pribadi peminjam).
  async findLoanByCode(ex: Exec, loanCode: string): Promise<{ loan: LoanSummaryRow; assets: { assetCode: string; assetName: string }[] } | null> {
    const r = await request(ex)
      .input('code', sql.VarChar(30), loanCode)
      .query<{
        loan_id: string; loan_code: string; request_type: string; status: string;
        start_at: Date; end_at: Date; purpose: string; use_facilities: boolean; room_name: string | null;
      }>(`
        SELECT lr.loan_id, lr.loan_code, lr.request_type, lr.status, lr.start_at, lr.end_at,
               lr.purpose, lr.use_facilities, rm.room_name
        FROM dbo.loan_requests lr LEFT JOIN dbo.rooms rm ON rm.room_id = lr.room_id
        WHERE lr.loan_code = @code`);
    const row = r.recordset[0];
    if (!row) return null;
    const items = await request(ex)
      .input('loan_id', sql.UniqueIdentifier, row.loan_id)
      .query<{ asset_code: string; asset_name: string }>(`
        SELECT a.asset_code, a.asset_name
        FROM dbo.loan_items li JOIN dbo.assets a ON a.asset_id = li.asset_id
        WHERE li.loan_id = @loan_id ORDER BY a.asset_code`);
    return {
      loan: {
        loanId: id(row.loan_id), loanCode: row.loan_code, requestType: row.request_type, status: row.status,
        startAt: new Date(row.start_at), endAt: new Date(row.end_at), purpose: row.purpose,
        useFacilities: row.use_facilities, roomName: row.room_name,
      },
      assets: items.recordset.map((a) => ({ assetCode: a.asset_code, assetName: a.asset_name })),
    };
  },
};
