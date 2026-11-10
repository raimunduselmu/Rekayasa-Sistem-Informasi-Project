import rateLimit from 'express-rate-limit';

export const createRateLimiter = (windowMs = 15 * 60 * 1000, max = 100) => {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      status: 'fail',
      message: 'Terlalu banyak permintaan dari IP ini, silakan coba lagi nanti.',
    },
  });
};

export const loanRateLimiter = createRateLimiter(15 * 60 * 1000, 30);