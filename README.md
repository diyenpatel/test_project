# ApexPay Enterprise Payment Gateway & Docker Log Inspector

A full-stack Payment Gateway project with modern frontend, Express backend, structured JSON Docker container logging, and realistic production-level edge-case human bugs.

## Architecture & Features

- **Frontend (`http://localhost:3000`)**: Modern UI with live interactive credit card visualizer, payment checkout modal, live Docker container log stream console, and quick-trigger buttons for human bug edge cases.
- **Backend (`http://localhost:5000`)**: Node.js Express service emitting structured JSON log traces to stdout/stderr.
- **Docker Compose**: Orchestrates `payment-backend` and `payment-frontend` services.

---

## 🚀 Quick Start with Docker Compose

1. **Build and Run Containers**:
   ```bash
   docker compose up --build -d
   ```

2. **Stream Live Production Docker Logs**:
   ```bash
   docker compose logs -f payment-backend
   ```

3. **Access Application UI**:
   Open [http://localhost:3000](http://localhost:3000) in your web browser.

---

## 🐛 Engineered Human Developer Edge-Case Bugs

This application intentionally incorporates 6 authentic edge-case bugs commonly introduced by developers:

1. **CVV Off-by-One Range Bug (`> 3` instead of `>= 3`)**:
   - Fails valid 3-digit CVVs (Visa/Mastercard) with `InvalidCVVLengthError`.
2. **Mid-Month Card Expiry Boundary Check**:
   - Compares `expMonth <= currentMonth` in current year, rejecting valid cards expiring in the current month mid-month with `CardExpiredError`.
3. **Floating-Point Precision Mismatch (IEEE 754)**:
   - Evaluates `$19.99 * 1.07 = 21.389300000000003` without rounding, failing strict equality checks against `$21.39` with `CurrencyPrecisionMismatchError`.
4. **Null Reference on Optional Billing Address (`TypeError`)**:
   - Accesses `payload.billing_address.zip_code` without optional chaining when custom billing address object is omitted, triggering `TypeError: Cannot read properties of undefined (reading 'zip_code')`.
5. **Race Condition & Double Charge (Missing Idempotency Lock)**:
   - Rapid double-clicking fires concurrent requests without mutex locking, triggering `StateConflictException`.
6. **Circular JSON Structure Serialization Error**:
   - Passes raw Express `req` object to logger metadata, causing `JSON.stringify` to fail with `TypeError: Converting circular structure to JSON` in Docker stdout logs.
