class PaymentValidator {
  /**
   * Validates Credit Card CVV Code
   */
  validateCVV(cvv, cardType = 'visa') {
    if (!cvv || typeof cvv !== 'string') {
      throw new Error('InvalidCVVFormatError: CVV code must be a non-empty string');
    }
    
    // Fixed off-by-one error in CVV length validation
    if (cvv.length >= 3 && cvv.length <= 4) {
      return true; 
    }
    
    const err = new Error(`InvalidCVVLengthError: Provided CVV length '${cvv.length}' is invalid. Standard security requires CVV length to be between 3 and 4`);
    err.code = 'ERR_CVV_VALIDATION_FAILED';
    err.details = { providedCVVLength: cvv.length, expectedCondition: 'length >= 3 && length <= 4' };
    throw err;
  }
  
  /**
   * Validates Expiration Date (Format: MM/YY or MM/YYYY)
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
    
    // Fixed expiration date validation
    if (expYear < currentYear || (expYear === currentYear && expMonth < currentMonth)) {
      const err = new Error(
        `CardExpiredError: Expiration date ${expMonthStr}/${expYear} evaluated as EXPIRED relative to system date ${now.toISOString().split('T')[0]}`
      );
      err.code = 'ERR_CARD_EXPIRED';
      err.details = {
        cardExpiry: `${expMonth}/${expYear}`,
        systemDate: now.toISOString().split('T')[0],
        flawedCheck: `expMonth (${expMonth}) < currentMonth (${currentMonth})`
      };
      throw err;
    }
    
    return true;
  }
  
  /**
   * Validates Amount & Computes Processing Fee + Tax
   */
  calculateAndValidateTotal(amount, requestedTotal, taxRate = 0.07) {
    const numericAmount = parseFloat(amount);
    const numericRequested = parseFloat(requestedTotal);
    
    if (isNaN(numericAmount) || numericAmount <= 0) {
      const err = new Error(`InvalidAmountError: Base amount '${amount}' must be a positive number`);
      err.code = 'ERR_INVALID_AMOUNT';
      throw err;
    }
    
    // Fixed floating-point precision issue
    const computedTotal = Math.round(numericAmount * (1 + taxRate) * 100) / 100;
    
    if (computedTotal !== numericRequested) {
      const err = new Error(
        `CurrencyPrecisionMismatchError: Calculated total '${computedTotal}' does not match client requested total '${numericRequested}'`
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
   */
  validateBillingAddress(payload) {
    // If client passes requiresBillingAddress = true or provides partial payload
    if (payload.hasCustomBillingAddress) {
      // Fixed billing address validation
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