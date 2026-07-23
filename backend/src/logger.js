const crypto = require('crypto');

/**
 * Production Structured JSON Logger for Docker Container Log Aggregation.
 * Writes formatted JSON log lines directly to stdout (INFO/WARN) and stderr (ERROR).
 */
class ProductionLogger {
  constructor() {
    this.serviceName = 'payment-gateway-backend';
  }

  generateCorrelationId() {
    return `req_${crypto.randomBytes(8).toString('hex')}`;
  }

  formatLog(level, message, metadata = {}) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      service: this.serviceName,
      level: level.toUpperCase(),
      correlation_id: metadata.correlationId || 'N/A',
      path: metadata.path || 'internal',
      message: message,
      ...metadata.extra
    };

    if (metadata.error) {
      if (metadata.error instanceof Error) {
        logEntry.error = {
          name: metadata.error.name,
          message: metadata.error.message,
          stack: metadata.error.stack,
          code: metadata.error.code || 'INTERNAL_ERROR'
        };
      } else {
        logEntry.error = metadata.error;
      }
    }

    // HUMAN BUG: Circular reference bug during raw object logging
    // If developer passes raw express `req` or circular third-party API object in extra metadata,
    // JSON.stringify fails with "TypeError: Converting circular structure to JSON"
    try {
      return JSON.stringify(logEntry);
    } catch (err) {
      // Flawed fallback logging attempt: logging the stringification failure itself!
      const fatalErrorEntry = {
        timestamp: new Date().toISOString(),
        service: this.serviceName,
        level: 'FATAL',
        correlation_id: metadata.correlationId || 'N/A',
        path: metadata.path || 'internal',
        message: `LOGGER_SERIALIZATION_FAILURE: Failed to serialize log payload: ${err.message}`,
        error: {
          name: err.name,
          message: err.message,
          stack: err.stack
        }
      };
      return JSON.stringify(fatalErrorEntry);
    }
  }

  info(message, metadata = {}) {
    console.log(this.formatLog('INFO', message, metadata));
  }

  warn(message, metadata = {}) {
    console.warn(this.formatLog('WARN', message, metadata));
  }

  error(message, metadata = {}) {
    console.error(this.formatLog('ERROR', message, metadata));
  }
}

module.exports = new ProductionLogger();
