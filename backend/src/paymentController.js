const logger = require('./logger');
const validator = require('./validators');

// In-memory active transaction tracker to demonstrate concurrency/race condition bug
const activeCardLocks = new Set();
// Store completed payments in memory
const transactionHistory = [];

class PaymentController {

  /**
   * Main Payment Processing Endpoint Controller
   */
  async processPayment(req, res) {
    const correlationId = req.headers['x-correlation-id'] || logger.generateCorrelationId();
    const path = req.originalUrl || '/api/pay';
    const payload = req.body || {};

    logger.info(`Received payment authorization request for amount $${payload.amount || 0}`, {
      correlationId,
      path,
      extra: {
        currency: payload.currency || 'USD',
        cardLast4: payload.cardNumber ? payload.cardNumber.slice(-4) : 'N/A'
      }
    });

    try {
      const {
        cardNumber,
        expMonth,
        expYear,
        cvv,
        amount,
        requestedTotal,
        hasCustomBillingAddress,
        billing_address,
        idempotencyKey,
        triggerBug
      } = payload;

      // HUMAN BUG 5: Race condition & double charge check without atomic locking
      const lockKey = `${cardNumber}_${amount}`;
      if (activeCardLocks.has(lockKey)) {
        const raceError = new Error(`StateConflictException: Concurrent processing lock acquired for card ending in ${cardNumber ? cardNumber.slice(-4) : 'XXXX'}. Potential double-charge detected.`);
        raceError.code = 'ERR_RACE_CONDITION_LOCK';
        logger.error('Payment authorization failed due to concurrent lock conflict', {
          correlationId,
          path,
          error: raceError
        });
        return res.status(409).json({
          status: 'error',
          code: raceError.code,
          message: raceError.message,
          correlationId
        });
      }

      // Acquire Lock
      activeCardLocks.add(lockKey);

      // Simulate network processing delay to widen race condition window
      await new Promise(resolve => setTimeout(resolve, 800));

      // Execute Validations based on incoming payload or explicit trigger flags
      
      // 1. CVV Length Validation
      if (cvv || triggerBug === 'cvv_off_by_one') {
        validator.validateCVV(cvv || '123');
      }

      // 2. Expiration Date Boundary Validation
      if (expMonth && expYear || triggerBug === 'exp_boundary') {
        validator.validateExpirationDate(expMonth || '07', expYear || '2026');
      }

      // 3. Floating Point Precision Check
      if (amount || triggerBug === 'float_precision') {
        // If client sent requestedTotal, validate against computed float
        validator.calculateAndValidateTotal(amount || '19.99', requestedTotal || '21.39');
      }

      // 4. Billing Address Null Pointer Access
      if (hasCustomBillingAddress || triggerBug === 'null_pointer') {
        validator.validateBillingAddress({
          hasCustomBillingAddress: true,
          billing_address: billing_address // If undefined, throws TypeError!
        });
      }

      // 5. Simulate Third-Party Gateway Timeout / Log Serialization Bug
      if (triggerBug === 'gateway_timeout_circular_log') {
        try {
          throw new Error('GatewayTimeoutException: Payment Processor API timed out after 30000ms [Upstream: Stripe/Adyen mock]');
        } catch (gwErr) {
          // HUMAN BUG 6: Developer passes Express `req` object directly to logger metadata!
          // Express `req` contains circular references (req.socket.parser.incoming === req).
          // Logger calling JSON.stringify(req) throws "TypeError: Converting circular structure to JSON"
          logger.error('Failed to communicate with external payment gateway', {
            correlationId,
            path,
            error: gwErr,
            extra: {
              rawRequestObject: req // CIRCULAR REFERENCE BUG HERE!
            }
          });

          throw gwErr;
        }
      }

      // Release Lock
      activeCardLocks.delete(lockKey);

      // Successfully processed transaction
      const transactionId = `txn_${Math.random().toString(36).substring(2, 10)}`;
      const record = {
        transactionId,
        amount: parseFloat(amount),
        status: 'SUCCESS',
        cardLast4: cardNumber ? cardNumber.slice(-4) : '4242',
        timestamp: new Date().toISOString()
      };
      transactionHistory.unshift(record);

      logger.info(`Payment authorized successfully. Transaction ID: ${transactionId}`, {
        correlationId,
        path,
        extra: { transactionId }
      });

      return res.status(200).json({
        status: 'success',
        transactionId,
        message: 'Payment authorized and charged successfully',
        correlationId
      });

    } catch (err) {
      // Ensure lock cleanup on error
      if (payload.cardNumber && payload.amount) {
        activeCardLocks.delete(`${payload.cardNumber}_${payload.amount}`);
      }

      // Log failure to Docker stdout/stderr with full details
      logger.error(`Payment processing failed: ${err.message}`, {
        correlationId,
        path,
        error: err
      });

      return res.status(500).json({
        status: 'error',
        code: err.code || 'ERR_INTERNAL_PAYMENT_FAILURE',
        message: err.message,
        details: err.details || null,
        stack: err.stack,
        correlationId
      });
    }
  }

  /**
   * Fetch Transaction History Endpoint
   */
  getTransactionHistory(req, res) {
    return res.status(200).json({
      status: 'success',
      count: transactionHistory.length,
      data: transactionHistory
    });
  }
}

module.exports = new PaymentController();
