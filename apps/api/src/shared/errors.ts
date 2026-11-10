export class AppError extends Error {
  public readonly statusCode: number;
  public readonly details?: any;
  public readonly isOperational: boolean;

  constructor(message: string, statusCodeOrDetails: number | any = 400, details?: any) {
    super(message);
    
    if (typeof statusCodeOrDetails === 'number') {
      this.statusCode = statusCodeOrDetails;
      this.details = details;
    } else {
      this.statusCode = 400;
      this.details = statusCodeOrDetails;
    }

    this.isOperational = true;
    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}