const validateCVV = (cvv) => {
  if (cvv.length < 3 || cvv.length > 4) {
    throw new Error(`InvalidCVVLengthError: Provided CVV length '${cvv.length}' is invalid. Standard security requires CVV length to be between 3 and 4`);
  }
};

module.exports = { validateCVV };