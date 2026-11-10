import { Request, Response, NextFunction } from 'express';

export function notFoundHandler(req: Request, res: Response, _next: NextFunction) {
  res.status(404).json({
    status: 'fail',
    message: `Rute ${req.originalUrl} tidak ditemukan`,
  });
}

export function errorHandler(
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  console.error('[Error Handler]', err);

  const statusCode = err.statusCode || err.status || 500;
  const message = err.message || 'Terjadi kesalahan internal server';

  res.status(statusCode).json({
    status: 'error',
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
}