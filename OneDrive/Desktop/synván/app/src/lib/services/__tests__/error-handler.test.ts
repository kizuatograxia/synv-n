import {
  ErrorHandler,
  ErrorSeverity,
  ErrorCategory,
} from '@/lib/services/error-handler'

export interface AppError extends Error {
  code: string
  statusCode: number
  severity: ErrorSeverity
  category: ErrorCategory
  context?: Record<string, any>
}

describe('ErrorHandler', () => {
  describe('createError', () => {
    it('should create validation error', () => {
      const error = ErrorHandler.createError(
        'Test error',
        'TEST_CODE',
        400,
        ErrorSeverity.LOW,
        ErrorCategory.VALIDATION,
        { field: 'test' }
      )

      expect(error.message).toBe('Test error')
      expect(error.code).toBe('TEST_CODE')
      expect(error.statusCode).toBe(400)
      expect(error.severity).toBe(ErrorSeverity.LOW)
      expect(error.category).toBe(ErrorCategory.VALIDATION)
      expect(error.context).toEqual({ field: 'test' })
    })

    it('should create not found error', () => {
      const error = ErrorHandler.notFoundError('Test resource')

      expect(error.message).toBe('Test resource não encontrado')
      expect(error.code).toBe('NOT_FOUND')
      expect(error.statusCode).toBe(404)
      expect(error.severity).toBe(ErrorSeverity.MEDIUM)
      expect(error.category).toBe(ErrorCategory.NOT_FOUND)
    })
  })

  describe('validationError', () => {
    it('should create validation error', () => {
      const error = ErrorHandler.validationError('Field inválido', {
        field: 'email'
      })

      expect(error.code).toBe('VALIDATION_ERROR')
      expect(error.statusCode).toBe(400)
      expect(error.severity).toBe(ErrorSeverity.LOW)
      expect(error.category).toBe(ErrorCategory.VALIDATION)
      expect(error.context).toEqual({ field: 'email' })
    })
  })

  describe('unauthorizedError', () => {
    it('should create unauthorized error', () => {
      const error = ErrorHandler.unauthorizedError('Sessão expirada')

      expect(error.code).toBe('UNAUTHORIZED')
      expect(error.statusCode).toBe(401)
      expect(error.severity).toBe(ErrorSeverity.MEDIUM)
      expect(error.category).toBe(ErrorCategory.AUTHENTICATION)
    })
  })

  describe('forbiddenError', () => {
    it('should create forbidden error', () => {
      const error = ErrorHandler.forbiddenError('Sem permissão')

      expect(error.code).toBe('FORBIDDEN')
      expect(error.statusCode).toBe(403)
      expect(error.severity).toBe(ErrorSeverity.MEDIUM)
      expect(error.category).toBe(ErrorCategory.AUTHORIZATION)
    })
  })

  describe('databaseError', () => {
    it('should create database error', () => {
      const error = ErrorHandler.databaseError('Falha ao salvar dados')

      expect(error.code).toBe('DATABASE_ERROR')
      expect(error.statusCode).toBe(500)
      expect(error.severity).toBe(ErrorSeverity.HIGH)
      expect(error.category).toBe(ErrorCategory.DATABASE)
    })
  })

  describe('externalServiceError', () => {
    it('should create external service error', () => {
      const originalError = new Error('Connection timeout')
      const error = ErrorHandler.externalServiceError('Payment Gateway', originalError)

      expect(error.code).toBe('EXTERNAL_SERVICE_ERROR')
      expect(error.statusCode).toBe(503)
      expect(error.severity).toBe(ErrorSeverity.HIGH)
      expect(error.category).toBe(ErrorCategory.EXTERNAL_SERVICE)
      expect(error.context).toEqual({
        serviceName: 'Payment Gateway',
        originalError: originalError.message,
      })
    })
  })

  describe('handleAsyncError', () => {
    it('should handle async error successfully', async () => {
      const mockFn = jest.fn().mockRejectedValue(new Error('Async failed'))

      await expect(
        ErrorHandler.handleAsyncError('testOperation', mockFn)
      ).rejects.toThrow()

      expect(mockFn).toHaveBeenCalled()
    })
  })

  describe('getErrorResponse', () => {
    it('should format AppError correctly', () => {
      const appError = ErrorHandler.createError(
        'Custom error',
        'CUSTOM_CODE',
        418,
        ErrorSeverity.MEDIUM,
        ErrorCategory.BUSINESS_LOGIC,
        { userId: 'user1' }
      )

      const response = ErrorHandler.getErrorResponse(appError)

      expect(response).toEqual({
        error: 'Custom error',
        code: 'CUSTOM_CODE',
        statusCode: 418,
        message: 'Custom error',
      })
    })

    it('should format regular Error correctly', () => {
      const error = new Error('Regular error')

      const response = ErrorHandler.getErrorResponse(error)

      expect(response).toEqual({
        error: 'Erro interno do servidor',
        code: 'INTERNAL_ERROR',
        statusCode: 500,
        message: 'Regular error',
      })
    })
  })
})
