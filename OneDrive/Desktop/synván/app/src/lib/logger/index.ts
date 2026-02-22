import { headers } from 'next/headers'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogContext {
  requestId?: string
  userId?: string
  path?: string
  method?: string
  statusCode?: number
  duration?: number
  [key: string]: any
}

interface LogEntry {
  level: LogLevel
  message: string
  timestamp: string
  context?: LogContext
  error?: {
    name: string
    message: string
    stack?: string
    code?: string
  }
}

/**
 * Get the current log level from environment variable
 * Defaults to 'info' in development, 'warn' in production
 */
function getLogLevel(): LogLevel {
  const envLevel = process.env.LOG_LEVEL as LogLevel
  if (envLevel && ['debug', 'info', 'warn', 'error'].includes(envLevel)) {
    return envLevel
  }
  return process.env.NODE_ENV === 'production' ? 'warn' : 'info'
}

/**
 * Check if a log level should be output based on current configuration
 */
function shouldLog(level: LogLevel): boolean {
  const currentLevel = getLogLevel()
  const levels: LogLevel[] = ['debug', 'info', 'warn', 'error']
  const currentIndex = levels.indexOf(currentLevel)
  const msgIndex = levels.indexOf(level)
  return msgIndex >= currentIndex
}

/**
 * Format log entry based on environment
 * - Development: Pretty printed with colors
 * - Production: Structured JSON
 */
function formatLogEntry(entry: LogEntry): string {
  if (process.env.NODE_ENV === 'production') {
    return JSON.stringify(entry)
  }

  // Development: Pretty print
  const colors = {
    debug: '\x1b[36m', // Cyan
    info: '\x1b[32m',  // Green
    warn: '\x1b[33m',  // Yellow
    error: '\x1b[31m', // Red
  }
  const reset = '\x1b[0m'

  const color = colors[entry.level]
  const contextStr = entry.context ? ` ${JSON.stringify(entry.context)}` : ''
  const errorStr = entry.error ? `\n  Error: ${entry.error.message}${entry.error.stack ? `\n  Stack: ${entry.error.stack}` : ''}` : ''

  return `${color}[${entry.level.toUpperCase()}]${reset} ${entry.timestamp} ${entry.message}${contextStr}${errorStr}`
}

/**
 * Core logging function
 */
function log(level: LogLevel, message: string, context?: LogContext, error?: Error): void {
  if (!shouldLog(level)) {
    return
  }

  const entry: LogEntry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    context: Object.keys(context || {}).length > 0 ? context : undefined,
    error: error ? {
      name: error.name,
      message: error.message,
      stack: process.env.NODE_ENV === 'production' ? undefined : error.stack,
      code: (error as any).code,
    } : undefined,
  }

  const formatted = formatLogEntry(entry)

  // Output to appropriate stream
  if (level === 'error') {
    console.error(formatted)
  } else if (level === 'warn') {
    console.warn(formatted)
  } else {
    console.log(formatted)
  }
}

/**
 * Generate a unique request ID
 */
export function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
}

/**
 * Get request ID from headers or generate a new one
 */
export async function getRequestId(): Promise<string> {
  try {
    const headersList = await headers()
    const existingId = headersList.get('x-request-id')
    if (existingId) {
      return existingId
    }
  } catch (e) {
    // Headers might not be available in all contexts
  }
  return generateRequestId()
}

/**
 * Logger API
 */
export const logger = {
  debug: (message: string, context?: LogContext) => log('debug', message, context),
  info: (message: string, context?: LogContext) => log('info', message, context),
  warn: (message: string, context?: LogContext) => log('warn', message, context),
  error: (message: string, context?: LogContext, error?: Error) => log('error', message, context, error),
}

export default logger
