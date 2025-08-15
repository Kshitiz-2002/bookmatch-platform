export class HttpException extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  
  constructor(
    message: string,
    statusCode: number = 500,
    isOperational: boolean = true
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    
    Error.captureStackTrace(this, this.constructor);
  }
}

// Specific error types
export class NotFoundException extends HttpException {
  constructor(message: string = 'Resource not found') {
    super(message, 404);
  }
}

export class ForbiddenException extends HttpException {
  constructor(message: string = 'Access denied') {
    super(message, 403);
  }
}

export class UnauthorizedException extends HttpException {
  constructor(message: string = 'Unauthorized') {
    super(message, 401);
  }
}

export class ValidationException extends HttpException {
  constructor(message: string = 'Validation failed', public readonly errors: any[] = []) {
    super(message, 400);
  }
}

export class ConflictException extends HttpException {
  constructor(message: string = 'Resource conflict') {
    super(message, 409);
  }
}