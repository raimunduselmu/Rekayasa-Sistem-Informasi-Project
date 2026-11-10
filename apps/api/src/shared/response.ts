import { Response } from 'express';

export function sendSuccess<T>(
  res: Response,
  data: T,
  message = 'Berhasil',
  statusCode = 200
) {
  return res.status(statusCode).json({
    status: 'success',
    message,
    data,
  });
}

export function sendCreated<T>(
  res: Response,
  data: T,
  message = 'Data berhasil dibuat'
) {
  return sendSuccess(res, data, message, 201);
}

export function sendError(
  res: Response,
  message = 'Terjadi kesalahan',
  statusCode = 400,
  errors: any = null
) {
  return res.status(statusCode).json({
    status: 'fail',
    message,
    ...(errors && { errors }),
  });
}