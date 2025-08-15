// src/errors/ForbiddenError.ts
import { ErrorCodes } from '../constants/errors';

/**
 * HTTP Status Code for Forbidden responses
 */
const FORBIDDEN_STATUS_CODE = 403;

/**
 * ForbiddenError - Custom error class for 403 Forbidden responses
 * 
 * Represents an error where the client does not have permission to access the requested resource.
 * This is different from 401 Unauthorized which indicates authentication is required.
 * 
 * Best Practices:
 * 1. Extend native Error class for proper stack traces
 * 2. Include machine-readable error code
 * 3. Provide detailed error metadata
 * 4. Support i18n with default messages
 * 5. Log additional context for debugging
 */
export class ForbiddenError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly timestamp: string;
  public readonly metadata: Record<string, unknown>;
  public readonly isOperational: boolean;
  
  /**
   * Create a ForbiddenError
   * 
   * @param message - Human-readable error message
   * @param errorCode - Machine-readable error code (default: FORBIDDEN)
   * @param metadata - Additional error context
   */
  constructor(
    message: string = 'Access to this resource is forbidden',
    errorCode: string = ErrorCodes.FORBIDDEN,
    metadata: Record<string, unknown> = {}
  ) {
    super(message);
    
    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ForbiddenError);
    }
    
    this.name = 'ForbiddenError';
    this.statusCode = FORBIDDEN_STATUS_CODE;
    this.code = errorCode;
    this.timestamp = new Date().toISOString();
    this.metadata = { ...metadata };
    this.isOperational = true;
    
    // Add additional debug context
    this.metadata.debug = {
      errorType: this.name,
      statusCode: this.statusCode,
      errorCode: this.code,
      timestamp: this.timestamp
    };
  }
  
  /**
   * Serialize error for API response
   */
  toJSON() {
    return {
      error: {
        name: this.name,
        code: this.code,
        message: this.message,
        statusCode: this.statusCode,
        ...(Object.keys(this.metadata).length > 0 ? { metadata: this.metadata } : {})
      },
      timestamp: this.timestamp
    };
  }
  
  /**
   * Create a ForbiddenError from another error
   * 
   * @param error - Original error to wrap
   * @param context - Additional context information
   */
  static fromError(
    error: Error,
    context: Record<string, unknown> = {}
  ): ForbiddenError {
    return new ForbiddenError(
      error.message || 'Access forbidden',
      ErrorCodes.PERMISSION_DENIED,
      {
        originalError: error.name,
        stack: error.stack,
        ...context
      }
    );
  }
  
  /**
   * Create a ForbiddenError for missing role
   * 
   * @param requiredRole - Role required for access
   * @param userRoles - User's current roles
   */
  static forMissingRole(
    requiredRole: string,
    userRoles: string[] = []
  ): ForbiddenError {
    return new ForbiddenError(
      `Access requires ${requiredRole} role`,
      ErrorCodes.MISSING_ROLE,
      {
        requiredRole,
        userRoles
      }
    );
  }
  
  /**
   * Create a ForbiddenError for resource ownership
   * 
   * @param resourceType - Type of resource being accessed
   * @param resourceId - ID of the resource
   * @param userId - User ID attempting access
   */
  static forResourceOwnership(
    resourceType: string,
    resourceId: string,
    userId: string
  ): ForbiddenError {
    return new ForbiddenError(
      `You don't own this ${resourceType}`,
      ErrorCodes.RESOURCE_OWNERSHIP,
      {
        resourceType,
        resourceId,
        userId
      }
    );
  }
}

// Augment global Error interface
declare global {
  interface Error {
    toJSON?(): Record<string, unknown>;
  }
}