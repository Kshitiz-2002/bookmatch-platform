import { STATUS } from './httpStatus';

export interface ApiError {
  code: string;
  message: string;
  details?: string[];
  stack?: string; // Only in development
}

export interface ApiResponse<T = unknown> {
  status: number;
  message: string;
  data?: T;
  error?: ApiError;
  metadata: {
    timestamp: string;
    [key: string]: unknown;
  };
}

export const createResponse = <T = unknown>(
  status: number,
  options: {
    data?: T;
    error?: Omit<ApiError, 'message'> & { message?: string };
    metadata?: Record<string, unknown>;
  } = {}
): ApiResponse<T> => {
  const statusEntry = Object.entries(STATUS).find(([, code]) => code === status);
  const statusMessage = statusEntry?.[0]?.replace(/_/g, ' ') || 'Unknown Status';
  
  // Build response safely without spreading conflicts
  const response: ApiResponse<T> = {
    status,
    message: options.error?.message || statusMessage,
    metadata: {
      timestamp: new Date().toISOString(),
      ...(options.metadata || {})
    }
  };
  
  if (options.data !== undefined) {
    response.data = options.data;
  }
  
  if (options.error) {
    // Create error object without spreading to prevent overwrites
    response.error = {
      code: options.error.code || 'UNKNOWN_ERROR',
      message: options.error.message || statusMessage,
    };

    // Add optional properties conditionally
    if (options.error.details) {
      response.error.details = options.error.details;
    }
    
    if (process.env.NODE_ENV === 'development' && options.error.stack) {
      response.error.stack = options.error.stack;
    }
  }
  
  return response;
};

/**
 * Predefined response templates for common scenarios
 */
export const Responses = {
  // 2xx Success
  success: <T>(data: T, metadata?: Record<string, unknown>) => 
    createResponse(STATUS.OK, { 
      data, 
      ...(metadata ? { metadata } : {}) 
    }),
  
  created: <T>(data: T, location?: string) => 
    createResponse(STATUS.CREATED, {
      data,
      ...(location ? { metadata: { location } } : {})
    }),
  
  noContent: () => 
    createResponse(STATUS.NO_CONTENT),
  
  // 4xx Client Errors
  badRequest: (error: Omit<ApiError, 'message'> & { message?: string }) => {
    // Create error object explicitly
    const errorObj: ApiError = {
      code: 'BAD_REQUEST',
      message: error.message || 'Invalid request data',
      ...(error.details && { details: error.details }),
      ...(error.stack && { stack: error.stack })
    };
    
    return createResponse(STATUS.BAD_REQUEST, { error: errorObj });
  },
  
  unauthorized: (error?: Omit<ApiError, 'message'> & { message?: string }) => {
    const errorObj: ApiError = {
      code: 'UNAUTHORIZED',
      message: error?.message || 'Authentication required',
      ...(error?.details && { details: error.details }),
      ...(error?.stack && { stack: error.stack })
    };
    
    return createResponse(STATUS.UNAUTHORIZED, { error: errorObj });
  },
  
  forbidden: (error?: Omit<ApiError, 'message'> & { message?: string }) => {
    const errorObj: ApiError = {
      code: 'FORBIDDEN',
      message: error?.message || 'Insufficient permissions',
      ...(error?.details && { details: error.details }),
      ...(error?.stack && { stack: error.stack })
    };
    
    return createResponse(STATUS.FORBIDDEN, { error: errorObj });
  },
  
  notFound: (resource: string = 'resource') => 
    createResponse(STATUS.NOT_FOUND, {
      error: {
        code: 'NOT_FOUND',
        message: `${resource.charAt(0).toUpperCase() + resource.slice(1)} not found`,
        details: [`Could not find ${resource}`]
      }
    }),
  
  conflict: (error: Omit<ApiError, 'message'> & { message?: string }) => {
    const errorObj: ApiError = {
      code: 'CONFLICT',
      message: error.message || 'Resource conflict',
      ...(error.details && { details: error.details }),
      ...(error.stack && { stack: error.stack })
    };
    
    return createResponse(STATUS.CONFLICT, { error: errorObj });
  },
  
  // 5xx Server Errors
  serverError: (error?: Error | (Omit<ApiError, 'message'> & { message?: string })) => {
    const isError = error instanceof Error;
    const errorObj: ApiError = {
      code: 'SERVER_ERROR',
      message: 'Internal server error'
    };

    if (isError) {
      errorObj.message = error.message;
      if (error.stack) errorObj.stack = error.stack;
    } else if (error) {
      if (error.message) errorObj.message = error.message;
      if (error.details) errorObj.details = error.details;
      if (error.stack) errorObj.stack = error.stack;
    }

    return createResponse(STATUS.INTERNAL_SERVER_ERROR, { error: errorObj });
  }
};