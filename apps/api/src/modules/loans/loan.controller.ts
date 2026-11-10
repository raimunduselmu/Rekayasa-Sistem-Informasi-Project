import { Request, Response, NextFunction } from 'express';
import { submitLoan } from './loan.service';
import { sendCreated } from '../../shared/response';

export async function handleSubmitLoan(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await submitLoan(req.body);
    return sendCreated(res, result, 'Pengajuan peminjaman berhasil dibuat');
  } catch (error) {
    next(error);
  }
}