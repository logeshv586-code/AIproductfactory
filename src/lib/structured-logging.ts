export interface LogContext {
  requestId?: string
  route?: string
  mode?: string
  source?: string
}

type LogLevel = 'info' | 'warn' | 'error'

function write(level: LogLevel, event: string, context: LogContext, fields?: Record<string, unknown>) {
  const payload = {
    ts: new Date().toISOString(),
    level,
    event,
    ...context,
    ...fields,
  }

  const line = JSON.stringify(payload)
  if (level === 'error') {
    console.error(line)
    return
  }
  if (level === 'warn') {
    console.warn(line)
    return
  }
  console.log(line)
}

export function createLogger(context: LogContext) {
  return {
    info(event: string, fields?: Record<string, unknown>) {
      write('info', event, context, fields)
    },
    warn(event: string, fields?: Record<string, unknown>) {
      write('warn', event, context, fields)
    },
    error(event: string, fields?: Record<string, unknown>) {
      write('error', event, context, fields)
    },
  }
}
