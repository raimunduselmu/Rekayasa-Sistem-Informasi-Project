import { Router } from 'express';
import { handleSubmitLoan } from './loan.controller';
import { loanRateLimiter } from '../../middleware/rate-limit';

const router = Router();

// POST /api/v1/loans - Pengajuan peminjaman barang/ruangan
router.post('/', loanRateLimiter, handleSubmitLoan);

export const loanRoutes = router;