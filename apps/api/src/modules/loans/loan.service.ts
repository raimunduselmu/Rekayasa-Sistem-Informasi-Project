import { randomUUID } from 'node:crypto';
import { getPool, withTransaction } from '../../db/client';
import { env } from '../../config/env';
import { AppError } from '../../shared/errors';
import { formatPeriodId } from '../../shared/format';

// ----------------------------------------------------------------------
// Types & Stub Helpers Internal (Pengganti modul yang di-import)
// ----------------------------------------------------------------------

export interface SubmitLoanInput {
  request_type: 'RUANGAN' | 'ASET';
  room_id?: string | null;
  asset_ids: string[];
  borrower_name: string;
  borrower_phone: string;
  borrower_email: string;
  borrower_org?: string | null;
  purpose: string;
  start_at: Date;
  end_at: Date;
  use_facilities: boolean;
}

export interface SubmitLoanResult {
  loan_id: string;
  loan_code: string;
  status: string;
  wa_link: string | null;
}

function loanCodePrefix(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `LN-${yyyy}${mm}${dd}`;
}

function formatLoanCode(date: Date, sequence: number): string {
  const prefix = loanCodePrefix(date);
  const seq = String(sequence).padStart(3, '0');
  return `${prefix}-${seq}`;
}

function buildLoanChatMessage(data: {
  loanCode: string;
  borrowerName: string;
  borrowerOrg?: string | null;
  target: string;
  startAt: Date;
  endAt: Date;
}): string {
  return `Halo Admin, saya ${data.borrowerName} ingin mengonfirmasi pengajuan peminjaman ${data.target} dengan kode ${data.loanCode}.`;
}

function buildWaLink(phone: string, text: string): string {
  const cleanPhone = phone ? phone.replace(/\D/g, '') : '';
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
}

async function sendLoanConfirmation(params: {
  to: string;
  loanCode: string;
  borrowerName: string;
  target: string;
  startAt: Date;
  endAt: Date;
  waLink: string | null;
}): Promise<void> {
  console.log(`[Email Service] Sending confirmation email to ${params.to} for loan ${params.loanCode}`);
}

function isAssetLendable(asset: any): boolean {
  return asset.isLendable !== false && asset.status !== 'MAINTENANCE';
}

const repo = {
  async findRoom(pool: any, roomId: string) {
    return { roomId, roomName: 'Aula Utama', isActive: true };
  },
  async findAssets(pool: any, assetIds: string[]) {
    return assetIds.map((id) => ({
      assetId: id,
      assetCode: `AST-${id.slice(0, 4)}`,
      assetName: `Aset ${id}`,
      status: 'AVAILABLE',
      assetCondition: 'GOOD',
      isLendable: true,
    }));
  },
  async lockLoanCodeDay(tx: any, prefix: string) {},
  async checkAvailability(tx: any, params: any) {
    return { available: true, conflicts: [] };
  },
  async nextLoanSequence(tx: any, prefix: string) {
    return 1;
  },
  async insertLoan(tx: any, data: any) {},
  async insertLoanItems(tx: any, loanId: string, assetIds: string[]) {},
  async findSarprasUserIds(tx: any) {
    return ['user-sarpras-01'];
  },
  async insertNotification(tx: any, notif: any) {},
  async markNotificationSent(pool: any, notifId: string) {},
};

// ----------------------------------------------------------------------
// Service Function
// ----------------------------------------------------------------------

/**
 * Ajukan Peminjaman (FSD-2.10). Padanan sp_submit_loan pada TSD 5.1:
 *  1. validasi waktu (di zod)           2. ruangan & aset ada dan boleh dipinjam (BR-55)
 *  3. cek bentrok jadwal (BR-22)        4. transaksi: loan_requests + loan_items + notifications
 *  5. setelah commit: email konfirmasi bersifat asynchronous dan tidak boleh menggagalkan transaksi (AC-08)
 */
export async function submitLoan(input: SubmitLoanInput): Promise<SubmitLoanResult> {
  const pool = await getPool();
  const assetIds = [...new Set(input.asset_ids.map((s) => s.toLowerCase()))];
  const roomId = input.request_type === 'RUANGAN' ? (input.room_id ?? null) : null;

  // Langkah 2: ruangan
  let roomName: string | null = null;
  if (roomId !== null) {
    const room = await repo.findRoom(pool, roomId);
    if (!room || !room.isActive) throw new AppError('ERR-DATA-01', 400);
    roomName = room.roomName;
  }

  // Langkah 2: aset (ada, tidak dihapus, boleh dipinjam)
  const assetRows = assetIds.length ? await repo.findAssets(pool, assetIds) : [];
  const found = new Set(assetRows.map((a) => a.assetId));
  const missing = assetIds.filter((x) => !found.has(x));
  if (missing.length) throw new AppError('ERR-DATA-01', 400);

  const unavailable = assetRows.filter((a) => !isAssetLendable(a));
  if (unavailable.length) {
    throw new AppError('ERR-LOAN-02', 400);
  }

  const parts: string[] = [];
  if (roomName) parts.push(`Ruangan ${roomName}`);
  if (assetRows.length) parts.push(`${roomName ? 'fasilitas/aset' : 'Aset'}: ${assetRows.map((a) => a.assetName).join(', ')}`);
  const target = parts.join(' + ');
  const period = formatPeriodId(input.start_at, input.end_at);

  // Langkah 3-4: satu transaksi (gagal di tengah = tidak ada baris yang tersimpan)
  const created = await withTransaction(async (tx) => {
    const now = new Date();
    const prefix = loanCodePrefix(now);
    await repo.lockLoanCodeDay(tx, prefix);

    const availability = await repo.checkAvailability(tx, {
      roomId,
      assetIds,
      startAt: input.start_at,
      endAt: input.end_at,
    });
    if (!availability.available) throw new AppError('ERR-LOAN-01', 400);

    const seq = await repo.nextLoanSequence(tx, prefix);
    const loanId = randomUUID();
    const loanCode = formatLoanCode(now, seq);

    await repo.insertLoan(tx, {
      loanId,
      loanCode,
      requestType: input.request_type,
      roomId,
      borrowerName: input.borrower_name,
      borrowerPhone: input.borrower_phone,
      borrowerEmail: input.borrower_email,
      borrowerOrg: input.borrower_org || null,
      purpose: input.purpose,
      startAt: input.start_at,
      endAt: input.end_at,
      useFacilities: input.use_facilities,
    });
    await repo.insertLoanItems(tx, loanId, assetIds);

    const sarprasIds = await repo.findSarprasUserIds(tx);
    for (const userId of sarprasIds) {
      await repo.insertNotification(tx, {
        notificationId: randomUUID(),
        recipientUserId: userId,
        recipientEmail: null,
        type: 'LOAN_SUBMITTED',
        title: 'Pengajuan peminjaman baru',
        message: `${input.borrower_name} mengajukan peminjaman ${target} (${period}). Kode: ${loanCode}.`,
        channel: 'APP',
        relatedId: loanId,
      });
    }
    const emailNotificationId = randomUUID();
    await repo.insertNotification(tx, {
      notificationId: emailNotificationId,
      recipientUserId: null,
      recipientEmail: input.borrower_email,
      type: 'LOAN_SUBMITTED',
      title: `Pengajuan peminjaman ${loanCode} diterima`,
      message: `Pengajuan ${target} (${period}) menunggu persetujuan Sarpras.`,
      channel: 'EMAIL',
      relatedId: loanId,
    });

    return { loanId, loanCode, emailNotificationId };
  });

  // Tautan WhatsApp ke penanggung jawab dengan teks chat sudah terisi
  const chat = buildLoanChatMessage({
    loanCode: created.loanCode,
    borrowerName: input.borrower_name,
    borrowerOrg: input.borrower_org,
    target,
    startAt: input.start_at,
    endAt: input.end_at,
  });
  const waLink = buildWaLink(env.WA_PIC_NUMBER || '', chat);

  // Langkah 5: setelah commit, kegagalan email hanya dicatat (AC-08, NFR-010)
  void sendLoanConfirmation({
    to: input.borrower_email,
    loanCode: created.loanCode,
    borrowerName: input.borrower_name,
    target,
    startAt: input.start_at,
    endAt: input.end_at,
    waLink,
  })
    .then(async () => {
      await repo.markNotificationSent(await getPool(), created.emailNotificationId);
    })
    .catch((err) => console.error('[notif] gagal mengirim email konfirmasi:', err));

  return {
    loan_id: created.loanId,
    loan_code: created.loanCode,
    status: 'MENUNGGU',
    wa_link: waLink,
  };
}