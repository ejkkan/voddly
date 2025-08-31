// Simple logging utility for React Native
const isDev = __DEV__;

class Logger {
  private prefix: string = '[App]';

  info(message: string, data?: any) {
    if (isDev) {
      console.log(`${this.prefix} INFO: ${message}`, data || '');
    }
  }

  error(message: string, data?: any) {
    console.error(`${this.prefix} ERROR: ${message}`, data || '');
  }

  warn(message: string, data?: any) {
    if (isDev) {
      console.warn(`${this.prefix} WARN: ${message}`, data || '');
    }
  }

  debug(message: string, data?: any) {
    if (isDev) {
      console.log(`${this.prefix} DEBUG: ${message}`, data || '');
    }
  }
}

const log = new Logger();
export default log;
