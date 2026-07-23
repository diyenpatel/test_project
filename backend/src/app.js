const express = require('express');
const cors = require('cors');
const logger = require('./logger');
const paymentController = require('./paymentController');

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS for frontend requests
app.use(cors());

// In-memory ring buffer for recent log output (to render in live log UI alongside docker logs)
const logRingBuffer = [];
const MAX_LOG_BUFFER = 100;

// Intercept console.log and console.error to push to ring buffer for UI streaming
const originalStdout = process.stdout.write.bind(process.stdout);
const originalStderr = process.stderr.write.bind(process.stderr);

process.stdout.write = (chunk, encoding, callback) => {
  try {
    const line = chunk.toString();
    if (line.trim().startsWith('{')) {
      logRingBuffer.push(JSON.parse(line.trim()));
      if (logRingBuffer.length > MAX_LOG_BUFFER) logRingBuffer.shift();
    }
  } catch (e) {}
  return originalStdout(chunk, encoding, callback);
};

process.stderr.write = (chunk, encoding, callback) => {
  try {
    const line = chunk.toString();
    if (line.trim().startsWith('{')) {
      logRingBuffer.push(JSON.parse(line.trim()));
      if (logRingBuffer.length > MAX_LOG_BUFFER) logRingBuffer.shift();
    }
  } catch (e) {}
  return originalStderr(chunk, encoding, callback);
};

// Express JSON middleware
app.use(express.json());

// Incoming Request Logger Middleware
app.use((req, res, next) => {
  const correlationId = logger.generateCorrelationId();
  req.headers['x-correlation-id'] = correlationId;
  res.setHeader('X-Correlation-ID', correlationId);

  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info(`HTTP ${req.method} ${req.originalUrl} finished with status ${res.statusCode} in ${duration}ms`, {
      correlationId,
      path: req.originalUrl,
      extra: { method: req.method, statusCode: res.statusCode, durationMs: duration }
    });
  });

  next();
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'UP',
    service: 'payment-gateway-backend',
    timestamp: new Date().toISOString()
  });
});

// Payment API Routes
app.post('/api/pay', (req, res) => paymentController.processPayment(req, res));
app.get('/api/transactions', (req, res) => paymentController.getTransactionHistory(req, res));

// Endpoint to fetch live logs (matches Docker stdout/stderr)
app.get('/api/logs/recent', (req, res) => {
  res.status(200).json({
    status: 'success',
    logs: logRingBuffer
  });
});

// Global Unhandled Error Handler
app.use((err, req, res, next) => {
  const correlationId = req.headers['x-correlation-id'] || 'N/A';
  logger.error(`Unhandled Global Express Exception: ${err.message}`, {
    correlationId,
    path: req.originalUrl,
    error: err
  });

  res.status(500).json({
    status: 'error',
    code: 'ERR_UNHANDLED_EXCEPTION',
    message: err.message,
    stack: err.stack,
    correlationId
  });
});

// Start Server
app.listen(PORT, () => {
  logger.info(`Payment Gateway Service started and listening on port ${PORT}`, {
    path: 'startup',
    extra: { port: PORT, env: process.env.NODE_ENV || 'production' }
  });
});
