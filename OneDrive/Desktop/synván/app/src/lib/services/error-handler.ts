export enum ErrorSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export enum ErrorCategory {
  VALIDATION = 'VALIDATION',
  AUTHENTICATION = 'AUTHENTICATION',
  AUTHORIZATION = 'AUTHORIZATION',
  NOT_FOUND = 'NOT_FOUND',
  BUSINESS_LOGIC = 'BUSINESS_LOGIC',
  EXTERNAL_SERVICE = 'EXTERNAL_SERVICE',
  DATABASE = 'DATABASE',
  NETWORK = 'NETWORK',
}

export interface ErrorLog {
  id: string
  userId?: string
  severity: ErrorSeverity
  category: ErrorCategory
  message: string
  code?: string
  stack?: string
  context?: Record<string, any>
  endpoint?: string
  method?: string
  ipAddress?: string
  userAgent?: string
  timestamp: Date
  resolved: boolean
  resolvedAt?: Date
}

export class AppError extends Error {
  code: string
  statusCode: number
  severity: ErrorSeverity
  category: ErrorCategory
  context?: Record<string, any>

  constructor(
    message: string,
    code: string,
    statusCode: number = 500,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    category: ErrorCategory = ErrorCategory.BUSINESS_LOGIC,
    context?: Record<string, any>
  ) {
    super(message)
    this.name = 'AppError'
    this.code = code
    this.statusCode = statusCode
    this.severity = severity
    this.category = category
    this.context = context
    Error.captureStackTrace(this, AppError)
  }
}

export class ErrorHandler {
  static async logError(error: Error | AppError, context?: {
    endpoint?: string
    method?: string
    userId?: string
    ipAddress?: string
    userAgent?: string
  }) {
    const errorData: ErrorLog = {
      id: Math.random().toString(36),
      timestamp: new Date(),
      severity: error instanceof AppError ? error.severity : ErrorSeverity.MEDIUM,
      category: error instanceof AppError ? error.category : ErrorCategory.BUSINESS_LOGIC,
      message: error.message,
      code: error instanceof AppError ? error.code : 'INTERNAL_ERROR',
      stack: error.stack,
      context: error instanceof AppError ? error.context : undefined,
      endpoint: context?.endpoint,
      method: context?.method,
      userId: context?.userId,
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
      resolved: false,
    }

    console.error('[ErrorHandler]', JSON.stringify(errorData))

    return errorData
  }

  static createError(
    message: string,
    code: string,
    statusCode: number = 500,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    category: ErrorCategory = ErrorCategory.BUSINESS_LOGIC,
    context?: Record<string, any>
  ): AppError {
    return new AppError(message, code, statusCode, severity, category, context)
  }

  static validationError(message: string, context?: Record<string, any>): AppError {
    return this.createError(
      message,
      'VALIDATION_ERROR',
      400,
      ErrorSeverity.LOW,
      ErrorCategory.VALIDATION,
      context
    )
  }

  static notFoundError(resource: string): AppError {
    return this.createError(
      `${resource} não encontrado`,
      'NOT_FOUND',
      404,
      ErrorSeverity.MEDIUM,
      ErrorCategory.NOT_FOUND
    )
  }

  static unauthorizedError(message: string = 'Não autorizado'): AppError {
    return this.createError(
      message,
      'UNAUTHORIZED',
      401,
      ErrorSeverity.MEDIUM,
      ErrorCategory.AUTHENTICATION
    )
  }

  static forbiddenError(message: string = 'Sem permissão'): AppError {
    return this.createError(
      message,
      'FORBIDDEN',
      403,
      ErrorSeverity.MEDIUM,
      ErrorCategory.AUTHORIZATION
    )
  }

  static databaseError(message: string, context?: Record<string, any>): AppError {
    return this.createError(
      message,
      'DATABASE_ERROR',
      500,
      ErrorSeverity.HIGH,
      ErrorCategory.DATABASE,
      context
    )
  }

  static externalServiceError(serviceName: string, originalError: Error): AppError {
    return this.createError(
      `Erro ao conectar com ${serviceName}`,
      'EXTERNAL_SERVICE_ERROR',
      503,
      ErrorSeverity.HIGH,
      ErrorCategory.EXTERNAL_SERVICE,
      { serviceName, originalError: originalError.message }
    )
  }

  static async handleAsyncError<T>(
    operation: string,
    fn: () => Promise<T>,
    context?: {
      endpoint?: string
      method?: string
      userId?: string
    }
  ): Promise<T> {
    try {
      return await fn()
    } catch (error: any) {
      await this.logError(error, context)
      throw this.createError(
        `Erro em ${operation}: ${error.message}`,
        'OPERATION_FAILED',
        500,
        ErrorSeverity.MEDIUM,
        ErrorCategory.BUSINESS_LOGIC,
        { operation, originalError: error.message }
      )
    }
  }

  static getErrorResponse(error: Error | AppError): {
    error: string
    code: string
    statusCode: number
    message?: string
  } {
    const isAppError = error instanceof AppError
    const statusCode = isAppError ? error.statusCode : 500
    const code = isAppError ? error.code : 'INTERNAL_ERROR'
    const message = isAppError ? error.message : error.message

    return {
      error: isAppError ? error.message : 'Erro interno do servidor',
      code,
      statusCode,
      message,
    }
  }
}
