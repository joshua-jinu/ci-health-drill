/**
 * Validates a payment amount.
 * @param {number} amount - The amount to validate
 * @returns {boolean} true if valid, false otherwise
 */
function validateAmount(amount) {
  if (typeof amount !== 'number') return false;
  if (isNaN(amount)) return false;
  if (amount <= 0) return false;
  if (amount > 1_000_000) return false; // max $10,000.00 in cents
  return true;
}

module.exports = { validateAmount };

// debug: added logging for prod investigation
