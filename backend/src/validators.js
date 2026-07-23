/**
 * Business & Validation Logic for Payment Gateway
 * Note: Contains real-world human edge-case developer bugs for production logging.
 */

class PaymentValidator {
  
  /**
   * Validates Credit Card CVV Code
   * HUMAN BUG 1: Off-by-one strict inequality operator (`> 3` instead of `>= 3`).
   * Developers commonly confuse minimum length checks.
   */
  validateCVV(cvv, cardType = 'visa') {
    if (!cvv || typeof cvv !== 'string') {
      throw new Error('InvalidCVVFormatError: CVV code must be a non-empty string');
    }

    // Fix: Changed to `>= 3` to allow for 3-digit CVVs
    if (cvv.length >= 3 && cvv.length <= 4) {
      return true; 
    }

    const err = new Error(`InvalidCVVLengthError: Provided CVV length '${cvv.length}' is invalid. Standard security requires CVV length to be between 3 and 4`);
    err.code = 'ERR_CVV_VALIDATION_FAILED';
    err.details = { providedCVVLength: cvv.length, expectedCondition: 'length >= 3 and length <= 4' };
    throw err;
  }

  /**
   * Validates Expiration Date (Format: MM/YY or MM/YYYY)
   * HUMAN BUG 2: Month-level comparison flaw.
   * Developer checked if expMonth <= currentMonth in the current year, marking cards expiring in the current month as ALREADY EXPIRED!
   */
  validateExpirationDate(expMonthStr, expYearStr) {
    const expMonth = parseInt(expMonthStr, 10);
    let expYear = parseInt(expYearStr, 10);
    if (expYear < 100) expYear += 2000;

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // 1-indexed (July = 7)

    if (isNaN(expMonth) || isNaN(expYear) || expMonth < 1 || expMonth > 12) {
      const err = new Error(`InvalidDateFormatError: Expiration date '${expMonthStr}/${expYearStr}' is malformed`);
      err.code = 'ERR_INVALID_EXPIRY_FORMAT';
      throw err;
    }

    // HUMAN BUG: Developer wrote `<=` for current month in current year!
    // Real business rule: Card is valid until the VERY LAST DAY of the expiration month.
    // Flawed code: If current date is July 23, 2026 and card expires 07/2026,
    // (expYear === currentYear && expMonth <= currentMonth) triggers TRUE, declaring the card EXPIRED mid-month!
    if (expYear < currentYear || (expYear === currentYear && expMonth < currentMonth)) {
      const err = new Error(
        `CardExpiredError: Expiration date ${expMonthStr}/${expYear} evaluated as EXPIRED relative to system date ${now.toISOString().split('T')[0]}`
      );
      err.code = 'ERR_CARD_EXPIRED';
      err.details = {
        cardExpiry: `${expMonth}/${expYear}`,
        systemDate: now.toISOString().split('T')[0],
        flawedCheck: `expMonth (${expMonth}) <= currentMonth (${currentMonth})`
      };
      throw err;
    }

    return true;
  }

  /**
   * Validates Amount & Computes Processing Fee + Tax
   * HUMAN BUG 3: Floating-Point Precision Mismatch (IEEE 754 float math).
   * Developer used standard JavaScript binary floating point arithmetic for money.
   */
  calculateAndValidateTotal(amount, requestedTotal, taxRate = 0.07) {
    const numericAmount = parseFloat(amount);
    const numericRequested = parseFloat(requestedTotal);

    if (isNaN(numericAmount) || numericAmount <= 0) {
      const err = new Error(`InvalidAmountError: Base amount '${amount}' must be a positive number`);
      err.code = 'ERR_INVALID_AMOUNT';
      throw err;
    }

    // HUMAN BUG: Floating point arithmetic flaw (19.99 * 1.07 = 21.389300000000003)
    // No Math.round or cents conversion used!
    const computedTotal = numericAmount * (1 + taxRate);

    // Exact strict equality check without epsilon tolerance or rounding
    if (computedTotal !== numericRequested) {
      const err = new Error(
        `CurrencyPrecisionMismatchError: Calculated total '${computedTotal}' (IEEE 754 float) does not match client requested total '${numericRequested}'`
      );
      err.code = 'ERR_PRECISION_MISMATCH';
      err.details = {
        baseAmount: numericAmount,
        taxRate: taxRate,
        computedFloat: computedTotal,
        clientRequested: numericRequested,
        precisionDelta: Math.abs(computedTotal - numericRequested)
      };
      throw err;
    }

    return computedTotal;
  }

  /**
   * Validates Billing Address Details
   * HUMAN BUG 4: Unchecked optional nested property access (`billing_address.zip_code`).
   * When user unchecks "Use shipping address as billing address" or passes empty billing_address,
   * code attempts to access zip_code directly on null/undefined!
   */
  validateBillingAddress(payload) {
    // If client passes requiresBillingAddress = true or provides partial payload
    if (payload.hasCustomBillingAddress) {
      // HUMAN BUG: Developer forgot optional chaining (`payload.billing_address?.zip_code`)
      // If billing_address is null or undefined, this throws uncaught TypeError!
      const zipCode = payload.billing_address?.zip_code;
      
      if (!zipCode || zipCode.trim().length < 5) {
        const err = new Error('InvalidBillingAddressError: Postal/ZIP code must be at least 5 characters');
        err.code = 'ERR_INVALID_ZIP';
        throw err;
      }
    }
    return true;
  }
}

module.exports = new PaymentValidator();