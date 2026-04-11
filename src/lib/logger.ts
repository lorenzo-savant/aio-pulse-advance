export interface Logger {
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
  debug(message: string, context?: Record<string, unknown>): void;
}

const isProd = process.env.NODE_ENV === 'production';

function formatDev(level: string, message: string, context?: Record<string, unknown>): string {
  const ts = new Date().toISOString().slice(11, 23);
  const ctx = context ? ` ${JSON.stringify(context)}` : '';
  return `${ts} [${level.toUpperCase()}] ${message}${ctx}`;
}

function logJson(level: string, message: string, context?: Record<string, unknown>): void {
  const entry = { level, message, timestamp: new Date().toISOString(), ...context };
  const line = JSON.stringify(entry);
  if (level === 'error') process.stderr.write(line + '\n');
  else process.stdout.write(line + '\n');
}

export const logger: Logger = {
  info(message, context?) {
    if (isProd) return logJson('info', message, context);
    console.info(formatDev('info', message, context));
  },
  warn(message, context?) {
    if (isProd) return logJson('warn', message, context);
    console.warn(formatDev('warn', message, context));
  },
  error(message, context?) {
    if (isProd) return logJson('error', message, context);
    console.error(formatDev('error', message, context));
  },
  debug(message, context?) {
    if (isProd) return;
    console.debug(formatDev('debug', message, context));
  },
};
