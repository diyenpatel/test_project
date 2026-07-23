const API_BASE = 'http://localhost:5000/api';

// DOM Elements
const cardNumberInput = document.getElementById('cardNumber');
const cardHolderInput = document.getElementById('cardHolder');
const expMonthInput = document.getElementById('expMonth');
const expYearInput = document.getElementById('expYear');
const cvvInput = document.getElementById('cvv');
const amountInput = document.getElementById('amount');
const requestedTotalInput = document.getElementById('requestedTotal');
const hasCustomBillingInput = document.getElementById('hasCustomBillingAddress');

const displayCardNumber = document.getElementById('displayCardNumber');
const displayName = document.getElementById('displayName');
const displayExpiry = document.getElementById('displayExpiry');
const cardBrandLogo = document.getElementById('cardBrandLogo');
const btnAmount = document.getElementById('btnAmount');

const payButton = document.getElementById('payButton');
const logConsole = document.getElementById('logConsole');
const clearLogsBtn = document.getElementById('clearLogsBtn');

// Bug Preset Buttons
const triggerCvvBug = document.getElementById('triggerCvvBug');
const triggerExpBug = document.getElementById('triggerExpBug');
const triggerFloatBug = document.getElementById('triggerFloatBug');
const triggerNullAddressBug = document.getElementById('triggerNullAddressBug');
const triggerRaceBug = document.getElementById('triggerRaceBug');
const triggerCircularLogBug = document.getElementById('triggerCircularLogBug');

// Live Input Event Listeners for Credit Card Visualizer
cardNumberInput.addEventListener('input', (e) => {
  let val = e.target.value.replace(/\D/g, '');
  if (val.length > 16) val = val.substring(0, 16);
  const formatted = val.replace(/(.{4})/g, '$1 ').trim();
  e.target.value = formatted;
  displayCardNumber.textContent = formatted || '•••• •••• •••• 4242';

  // Simple brand detection
  if (val.startsWith('4')) cardBrandLogo.textContent = 'VISA';
  else if (val.startsWith('5')) cardBrandLogo.textContent = 'MASTERCARD';
  else if (val.startsWith('3')) cardBrandLogo.textContent = 'AMEX';
  else cardBrandLogo.textContent = 'CARD';
});

cardHolderInput.addEventListener('input', (e) => {
  displayName.textContent = e.target.value.toUpperCase() || 'ALEX MORGAN';
});

const updateExpiryDisplay = () => {
  const m = expMonthInput.value || '07';
  const y = (expYearInput.value || '2026').slice(-2);
  displayExpiry.textContent = `${m}/${y}`;
};

expMonthInput.addEventListener('input', updateExpiryDisplay);
expYearInput.addEventListener('input', updateExpiryDisplay);

amountInput.addEventListener('input', (e) => {
  const val = parseFloat(e.target.value) || 0;
  // Calculate total with 7% tax
  const total = (val * 1.07).toFixed(2);
  requestedTotalInput.value = total;
  btnAmount.textContent = total;
});

// Primary Pay Button Handler
payButton.addEventListener('click', async () => {
  await sendPaymentRequest();
});

// Clear Logs Button
clearLogsBtn.addEventListener('click', () => {
  logConsole.innerHTML = '';
});

// API Helper Function
async function sendPaymentRequest(overridePayload = {}) {
  const payload = {
    cardNumber: cardNumberInput.value.replace(/\s/g, ''),
    cardHolder: cardHolderInput.value,
    expMonth: expMonthInput.value,
    expYear: expYearInput.value,
    cvv: cvvInput.value,
    amount: amountInput.value,
    requestedTotal: requestedTotalInput.value,
    hasCustomBillingAddress: hasCustomBillingInput.checked,
    billing_address: hasCustomBillingInput.checked ? { zip_code: '90210', city: 'Los Angeles' } : undefined,
    ...overridePayload
  };

  try {
    const res = await fetch(`${API_BASE}/pay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    fetchLogs();
    return data;
  } catch (err) {
    console.error('Fetch error:', err);
    fetchLogs();
  }
}

// Preset Bug Triggers Setup
triggerCvvBug.addEventListener('click', () => {
  cvvInput.value = '123'; // Standard 3-digit CVV
  sendPaymentRequest({ triggerBug: 'cvv_off_by_one' });
});

triggerExpBug.addEventListener('click', () => {
  expMonthInput.value = '07';
  expYearInput.value = '2026';
  updateExpiryDisplay();
  sendPaymentRequest({ triggerBug: 'exp_boundary' });
});

triggerFloatBug.addEventListener('click', () => {
  amountInput.value = '19.99';
  requestedTotalInput.value = '21.39'; // Exact rounded, but 19.99 * 1.07 = 21.389300000000003
  sendPaymentRequest({ triggerBug: 'float_precision' });
});

triggerNullAddressBug.addEventListener('click', () => {
  hasCustomBillingInput.checked = true;
  // Send hasCustomBillingAddress = true but NO billing_address object
  sendPaymentRequest({ triggerBug: 'null_pointer', billing_address: undefined });
});

triggerRaceBug.addEventListener('click', () => {
  const currentCard = cardNumberInput.value.replace(/\s/g, '');
  const currentAmount = amountInput.value;
  // Fire two requests simultaneously
  sendPaymentRequest({ cardNumber: currentCard, amount: currentAmount });
  sendPaymentRequest({ cardNumber: currentCard, amount: currentAmount });
});

triggerCircularLogBug.addEventListener('click', () => {
  sendPaymentRequest({ triggerBug: 'gateway_timeout_circular_log' });
});

// Live Docker Log Terminal Polling
let seenLogIds = new Set();

async function fetchLogs() {
  try {
    const res = await fetch(`${API_BASE}/logs/recent`);
    if (!res.ok) return;
    const result = await res.json();
    const logs = result.logs || [];

    logs.forEach(log => {
      const logKey = `${log.timestamp}_${log.message}`;
      if (!seenLogIds.has(logKey)) {
        seenLogIds.add(logKey);
        renderLogEntry(log);
      }
    });
  } catch (err) {
    // Backend offline or compiling
  }
}

function renderLogEntry(log) {
  const div = document.createElement('div');
  const level = log.level || 'INFO';
  div.className = `log-entry ${level}`;

  const timeStr = new Date(log.timestamp).toLocaleTimeString();

  let html = `
    <div class="log-meta">
      <span class="log-level ${level}">${level}</span>
      <span>${log.service || 'backend'}</span>
      <span>Correlation: ${log.correlation_id || 'N/A'}</span>
      <span>${timeStr}</span>
    </div>
    <div class="log-json">${escapeHtml(JSON.stringify(log, null, 2))}</div>
  `;

  if (log.error && log.error.stack) {
    html += `<div class="log-stack">STACK TRACE:\n${escapeHtml(log.error.stack)}</div>`;
  }

  div.innerHTML = html;
  logConsole.appendChild(div);
  logConsole.scrollTop = logConsole.scrollHeight;
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Initial fetch and 1-second interval log polling
fetchLogs();
setInterval(fetchLogs, 1000);
