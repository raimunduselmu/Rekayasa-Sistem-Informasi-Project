import { z } from 'zod';

export const createLoanSchema = z.object({
  borrowerName: z.string({ required_error: 'Nama peminjam wajib diisi' }).min(3, 'Nama minimal 3 karakter'),
  borrowerContact: z.string({ required_error: 'Kontak/No. HP wajib diisi' }).min(8, 'Nomor kontak tidak valid'),
  borrowerOrganization: z.string().optional(),
  purpose: z.string({ required_error: 'Tujuan peminjaman wajib diisi' }).min(5, 'Tujuan peminjaman minimal 5 karakter'),
  startDate: z.string({ required_error: 'Tanggal mulai wajib diisi' }),
  endDate: z.string({ required_error: 'Tanggal selesai wajib diisi' }),
  items: z
    .array(
      z.object({
        itemId: z.string({ required_error: 'ID Barang wajib diisi' }),
        quantity: z.number().int().positive('Jumlah barang harus lebih dari 0'),
      })
    )
    .min(1, 'Minimal satu barang harus dipinjam'),
});

export const updateLoanStatusSchema = z.object({
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'RETURNED', 'CANCELLED'], {
    required_error: 'Status baru wajib diisi',
  }),
  notes: z.string().optional(),
});

export type CreateLoanInput = z.infer<typeof createLoanSchema>;
export type UpdateLoanStatusInput = z.infer<typeof updateLoanStatusSchema>;