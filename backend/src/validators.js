class PaymentValidator {
  /*
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
    
    // Corrected logic: If the expiration year is less than the current year, or if the expiration year is the same but the expiration month is less than the current month, then the card has expired.
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
}