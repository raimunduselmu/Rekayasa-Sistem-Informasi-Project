/**
 * Format tanggal ke ISO String singkat (YYYY-MM-DD)
 */
export function formatDateISO(date: Date | string): string {
  const d = new Date(date);
  return d.toISOString().split('T')[0];
}

/**
 * Format rentang waktu/periode pengajuan peminjaman (contoh: "10 Nov 2026 08:00 - 10 Nov 2026 17:00")
 */
export function formatPeriodId(startAt: Date | string, endAt: Date | string): string {
  const start = new Date(startAt);
  const end = new Date(endAt);

  const options: Intl.DateTimeFormatOptions = {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  };

  const startStr = new Intl.DateTimeFormat('id-ID', options).format(start);
  const endStr = new Intl.DateTimeFormat('id-ID', options).format(end);

  return `${startStr} - ${endStr}`;
}

/**
 * Format angka ke mata uang Rupiah (IDR)
 */
export function formatCurrencyIDR(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Normalisasi format nomor WhatsApp / HP ke format standar (misal: 0812... -> 62812...)
 */
export function formatPhoneNumber(phone: string): string {
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('0')) {
    cleaned = '62' + cleaned.slice(1);
  }
  return cleaned;
}