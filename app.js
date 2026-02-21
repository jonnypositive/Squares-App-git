const STORAGE_KEY = "football-squares-registrants-v1";
const QUARTERS = [1, 2, 3, 4];

const homeTeamInput = document.getElementById("homeTeam");
const awayTeamInput = document.getElementById("awayTeam");
const randomizeBtn = document.getElementById("randomizeBtn");
const clearBtn = document.getElementById("clearBtn");
const randomAssignBtn = document.getElementById("randomAssignBtn");
const revealDigitsBtn = document.getElementById("revealDigitsBtn");
const hideDigitsToggle = document.getElementById("hideDigitsToggle");
const baseSquareValueSelect = document.getElementById("baseSquareValue");
const otherSquareValueLabel = document.getElementById("otherSquareValueLabel");
const otherSquareValueInput = document.getElementById("otherSquareValue");
const autoRecalcToggle = document.getElementById("autoRecalcToggle");
const autoFormulaSelect = document.getElementById("autoFormulaSelect");
const squareValueSummary = document.getElementById("squareValueSummary");
const adminMessage = document.getElementById("adminMessage");
const board = document.getElementById("squaresBoard");
const quarterRows = document.getElementById("quarterRows");
const winnerText = document.getElementById("winnerText");
const payoutPercentSummary = document.getElementById("payoutPercentSummary");

const registrationForm = document.getElementById("registrationForm");
const registrantNameInput = document.getElementById("registrantName");
const registrantEmailInput = document.getElementById("registrantEmail");
const registrantPhoneInput = document.getElementById("registrantPhone");
const registrantPaymentAppSelect = document.getElementById("registrantPaymentApp");
const registrantPaymentUsernameInput = document.getElementById("registrantPaymentUsername");
const registrantsBody = document.getElementById("registrantsBody");
const registrationMessage = document.getElementById("registrationMessage");
const clearRegistrantsBtn = document.getElementById("clearRegistrantsBtn");

const bulkSubjectInput = document.getElementById("bulkSubject");
const bulkBodyInput = document.getElementById("bulkBody");
const composeBulkEmailBtn = document.getElementById("composeBulkEmailBtn");
const copyEmailsBtn = document.getElementById("copyEmailsBtn");
const bulkEmailMessage = document.getElementById("bulkEmailMessage");

let rowDigits = shuffledDigits();
let colDigits = shuffledDigits();
let picks = Array.from({ length: 10 }, () => Array(10).fill(""));
let registrants = loadRegistrants();
let hideDigitsEnabled = false;
let digitsRevealed = true;
let quarterPayoutPercentages = { 1: 25, 2: 25, 3: 25, 4: 25 };
let quarterWinnerResults = {};

function shuffledDigits() {
  const digits = Array.from({ length: 10 }, (_, i) => i);
  for (let i = digits.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [digits[i], digits[j]] = [digits[j], digits[i]];
  }
  return digits;
}

function shuffledCopy(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function getTeamNames() {
  const home = homeTeamInput.value.trim() || "Home";
  const away = awayTeamInput.value.trim() || "Away";
  return { home, away };
}

function getPaymentAppLabel(app) {
  const labels = {
    venmo: "Venmo",
    paypal: "PayPal",
    cashapp: "Cash App",
    zelle: "Zelle",
  };
  return labels[app] || app;
}

function generatePaymentUrl(app, rawUsername) {
  const username = (rawUsername || "").trim();
  if (!username) {
    return "";
  }

  if (app === "venmo") {
    const venmoHandle = username.startsWith("@") ? username.slice(1) : username;
    return `https://venmo.com/${encodeURIComponent(venmoHandle)}`;
  }

  if (app === "paypal") {
    return `https://paypal.me/${encodeURIComponent(username)}`;
  }

  if (app === "cashapp") {
    const cashTag = username.replace(/^\$/, "");
    return `https://cash.app/$${encodeURIComponent(cashTag)}`;
  }

  if (app === "zelle") {
    if (username.includes("@")) {
      return `mailto:${encodeURIComponent(username)}`;
    }
    const digits = username.replace(/[^\d+]/g, "");
    if (digits) {
      return `tel:${digits}`;
    }
    return "https://www.zellepay.com/";
  }

  return "";
}

function getBaseSquareValue() {
  if (baseSquareValueSelect.value === "other") {
    const otherValue = Number(otherSquareValueInput.value);
    if (!Number.isFinite(otherValue) || otherValue <= 0) {
      return null;
    }
    return otherValue;
  }
  return Number(baseSquareValueSelect.value);
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

function getRegisteredSquareCount() {
  let count = 0;
  for (let row = 0; row < 10; row += 1) {
    for (let col = 0; col < 10; col += 1) {
      if (picks[row][col]) {
        count += 1;
      }
    }
  }
  return count;
}

function updateSquareValueSummary() {
  const baseValue = getBaseSquareValue();
  const registrantCount = registrants.length;
  const autoEnabled = autoRecalcToggle.checked;

  if (baseSquareValueSelect.value === "other") {
    otherSquareValueLabel.hidden = false;
  } else {
    otherSquareValueLabel.hidden = true;
  }

  if (baseValue === null) {
    squareValueSummary.textContent = "Enter a valid amount for Other square value.";
    refreshQuarterWinnerDisplays();
    return;
  }

  if (!autoEnabled) {
    squareValueSummary.textContent = `Current square value: ${formatCurrency(baseValue)} per square.`;
    refreshQuarterWinnerDisplays();
    return;
  }

  const totalPool = baseValue * registrantCount;
  const registeredSquareCount = getRegisteredSquareCount();
  const useRegisteredOnly = autoFormulaSelect.value === "registeredOnly";
  const divisor = useRegisteredOnly ? registeredSquareCount : 100;

  if (divisor <= 0) {
    squareValueSummary.textContent =
      "Auto square value unavailable: no registered squares yet for the selected formula.";
    refreshQuarterWinnerDisplays();
    return;
  }

  const autoValue = totalPool / divisor;
  const formulaLabel = useRegisteredOnly ? "registered squares" : "100 total squares";
  squareValueSummary.textContent = `Auto square value: ${formatCurrency(autoValue)} each (Formula: ${formulaLabel}, Divisor: ${divisor}, Registrant count: ${registrantCount}, Total pool: ${formatCurrency(totalPool)}).`;
  refreshQuarterWinnerDisplays();
}

function getTotalRegisteredFunds() {
  const baseValue = getBaseSquareValue();
  if (baseValue === null) {
    return null;
  }
  return baseValue * registrants.length;
}

function getQuarterPayoutPercent(quarter) {
  const raw = quarterPayoutPercentages[quarter];
  return Number.isFinite(raw) ? raw : 0;
}

function calculateQuarterWinnings(quarter) {
  const totalFunds = getTotalRegisteredFunds();
  if (totalFunds === null) {
    return null;
  }
  return (totalFunds * getQuarterPayoutPercent(quarter)) / 100;
}

function updatePayoutPercentSummary() {
  const totalPercent = QUARTERS.reduce((sum, quarter) => sum + getQuarterPayoutPercent(quarter), 0);
  const formattedTotal = Number(totalPercent.toFixed(2));
  if (formattedTotal === 100) {
    payoutPercentSummary.textContent = "Quarter payout percentages total 100%.";
    return;
  }
  payoutPercentSummary.textContent = `Quarter payout percentages currently total ${formattedTotal}%.`;
}

function setQuarterWinnerDisplay(quarter) {
  const winnerInput = quarterRows.querySelector(`input[data-quarter-winner="${quarter}"]`);
  if (!winnerInput) {
    return;
  }

  const result = quarterWinnerResults[quarter];
  if (!result) {
    winnerInput.value = "";
    return;
  }

  const winnings = calculateQuarterWinnings(quarter);
  const winningsText = winnings === null ? "Amount unavailable" : formatCurrency(winnings);
  winnerInput.value = `${result.owner} - ${winningsText}`;
}

function refreshQuarterWinnerDisplays() {
  QUARTERS.forEach((quarter) => setQuarterWinnerDisplay(quarter));
}

function clearQuarterWinners() {
  quarterWinnerResults = {};
  refreshQuarterWinnerDisplays();
}

function renderBoard() {
  const { home, away } = getTeamNames();
  const showDigits = !hideDigitsEnabled || digitsRevealed;

  board.innerHTML = "";

  const topHeader = document.createElement("tr");
  const corner = document.createElement("th");
  corner.className = "axis-label";
  corner.textContent = showDigits ? `${home} \\ ${away}` : `${home} \\ ${away} (hidden)`;
  topHeader.appendChild(corner);

  colDigits.forEach((digit) => {
    const th = document.createElement("th");
    th.textContent = showDigits ? String(digit) : "?";
    topHeader.appendChild(th);
  });

  board.appendChild(topHeader);

  for (let row = 0; row < 10; row += 1) {
    const tr = document.createElement("tr");

    const rowHeader = document.createElement("th");
    rowHeader.textContent = showDigits ? String(rowDigits[row]) : "?";
    tr.appendChild(rowHeader);

    for (let col = 0; col < 10; col += 1) {
      const td = document.createElement("td");
      td.dataset.row = String(row);
      td.dataset.col = String(col);

      const pick = picks[row][col];
      if (pick) {
        td.classList.add("picked");
        td.textContent = pick;
      }

      td.addEventListener("click", () => {
        const current = picks[row][col];
        const response = window.prompt(
          current
            ? "Update player name/initials (leave blank to clear):"
            : "Enter player name/initials for this square:",
          current
        );

        if (response === null) {
          return;
        }

        picks[row][col] = response.trim();
        clearQuarterWinners();
        clearWinnerHighlight();
        renderBoard();
        updateSquareValueSummary();
      });

      tr.appendChild(td);
    }

    board.appendChild(tr);
  }
}

function renderQuarterRows() {
  const { home, away } = getTeamNames();
  const priorQuarterState = readQuarterState();
  quarterRows.innerHTML = "";

  QUARTERS.forEach((quarter) => {
    const row = document.createElement("div");
    row.className = "quarter-row";

    const title = document.createElement("div");
    title.className = "quarter-title";
    title.textContent = `Q${quarter}`;

    const homeLabel = document.createElement("label");
    homeLabel.innerHTML = `<span>${home} score</span>`;
    const homeInput = document.createElement("input");
    homeInput.type = "number";
    homeInput.min = "0";
    homeInput.step = "1";
    homeInput.placeholder = "0";
    homeInput.dataset.team = "home";
    homeInput.dataset.quarter = String(quarter);
    homeInput.value = priorQuarterState[quarter]?.home ?? "";
    homeLabel.appendChild(homeInput);

    const awayLabel = document.createElement("label");
    awayLabel.innerHTML = `<span>${away} score</span>`;
    const awayInput = document.createElement("input");
    awayInput.type = "number";
    awayInput.min = "0";
    awayInput.step = "1";
    awayInput.placeholder = "0";
    awayInput.dataset.team = "away";
    awayInput.dataset.quarter = String(quarter);
    awayInput.value = priorQuarterState[quarter]?.away ?? "";
    awayLabel.appendChild(awayInput);

    const payoutLabel = document.createElement("label");
    payoutLabel.innerHTML = "<span>Payout %</span>";
    const payoutInput = document.createElement("input");
    payoutInput.type = "number";
    payoutInput.min = "0";
    payoutInput.step = "0.01";
    payoutInput.placeholder = "25";
    payoutInput.dataset.payoutQuarter = String(quarter);
    const payoutValue = Number(priorQuarterState[quarter]?.payout ?? getQuarterPayoutPercent(quarter));
    quarterPayoutPercentages[quarter] = Number.isFinite(payoutValue) && payoutValue >= 0 ? payoutValue : 0;
    payoutInput.value = String(quarterPayoutPercentages[quarter]);
    payoutInput.addEventListener("input", () => {
      const value = Number(payoutInput.value);
      quarterPayoutPercentages[quarter] = Number.isFinite(value) && value >= 0 ? value : 0;
      updatePayoutPercentSummary();
      setQuarterWinnerDisplay(quarter);
    });
    payoutLabel.appendChild(payoutInput);

    const winnerLabel = document.createElement("label");
    winnerLabel.innerHTML = "<span>Winning Square</span>";
    const winnerInput = document.createElement("input");
    winnerInput.type = "text";
    winnerInput.readOnly = true;
    winnerInput.placeholder = "Winner appears after highlight";
    winnerInput.dataset.quarterWinner = String(quarter);
    winnerLabel.appendChild(winnerInput);

    const actions = document.createElement("div");
    actions.className = "buttons";
    const highlightBtn = document.createElement("button");
    highlightBtn.type = "button";
    highlightBtn.className = "small";
    highlightBtn.textContent = `Highlight Q${quarter}`;
    highlightBtn.addEventListener("click", () => highlightWinnerByQuarter(quarter));
    actions.appendChild(highlightBtn);

    const announceBtn = document.createElement("button");
    announceBtn.type = "button";
    announceBtn.className = "small secondary";
    announceBtn.textContent = `Announce Q${quarter} Winner`;
    announceBtn.addEventListener("click", () => announceQuarterWinner(quarter));
    actions.appendChild(announceBtn);

    row.appendChild(title);
    row.appendChild(homeLabel);
    row.appendChild(awayLabel);
    row.appendChild(payoutLabel);
    row.appendChild(winnerLabel);
    row.appendChild(actions);

    quarterRows.appendChild(row);
  });

  updatePayoutPercentSummary();
  refreshQuarterWinnerDisplays();
}

function readQuarterState() {
  const state = {};
  quarterRows.querySelectorAll("input[data-quarter]").forEach((input) => {
    const quarter = Number(input.dataset.quarter);
    const team = input.dataset.team;
    if (!state[quarter]) {
      state[quarter] = { home: "", away: "", payout: getQuarterPayoutPercent(quarter) };
    }
    state[quarter][team] = input.value;
  });
  quarterRows.querySelectorAll("input[data-payout-quarter]").forEach((input) => {
    const quarter = Number(input.dataset.payoutQuarter);
    if (!state[quarter]) {
      state[quarter] = { home: "", away: "", payout: getQuarterPayoutPercent(quarter) };
    }
    const payout = Number(input.value);
    state[quarter].payout = Number.isFinite(payout) && payout >= 0 ? payout : 0;
  });
  return state;
}

function clearWinnerHighlight() {
  winnerText.textContent = "";
  board.querySelectorAll("td.winner").forEach((cell) => {
    cell.classList.remove("winner");
  });
}

function getQuarterOutcome(quarter) {
  const homeInput = quarterRows.querySelector(`input[data-quarter="${quarter}"][data-team="home"]`);
  const awayInput = quarterRows.querySelector(`input[data-quarter="${quarter}"][data-team="away"]`);

  if (hideDigitsEnabled && !digitsRevealed) {
    return { error: "Digits are hidden. Reveal digits before checking winners." };
  }

  const homeScore = Number(homeInput?.value);
  const awayScore = Number(awayInput?.value);

  if (!Number.isInteger(homeScore) || homeScore < 0 || !Number.isInteger(awayScore) || awayScore < 0) {
    return { error: `Enter valid non-negative whole-number scores for Q${quarter}.` };
  }

  const homeDigit = homeScore % 10;
  const awayDigit = awayScore % 10;

  const row = rowDigits.indexOf(homeDigit);
  const col = colDigits.indexOf(awayDigit);

  const winnerCell = board.querySelector(`td[data-row="${row}"][data-col="${col}"]`);

  if (!winnerCell) {
    return { error: `Q${quarter} winner square could not be found.` };
  }

  const owner = picks[row][col] || "Unclaimed";
  return { owner, homeDigit, awayDigit, row, col, winnerCell };
}

function highlightWinnerByQuarter(quarter) {
  clearWinnerHighlight();
  const outcome = getQuarterOutcome(quarter);
  if (outcome.error) {
    winnerText.textContent = outcome.error;
    return;
  }

  outcome.winnerCell.classList.add("winner");
  quarterWinnerResults[quarter] = {
    owner: outcome.owner,
    homeDigit: outcome.homeDigit,
    awayDigit: outcome.awayDigit,
  };
  setQuarterWinnerDisplay(quarter);

  const { home, away } = getTeamNames();
  const winnings = calculateQuarterWinnings(quarter);
  const winningsText = winnings === null ? "Amount unavailable" : formatCurrency(winnings);
  winnerText.textContent = `Q${quarter}: ${home} digit ${outcome.homeDigit}, ${away} digit ${outcome.awayDigit} -> ${outcome.owner} (${winningsText}).`;
}

async function sendBulkEmailRequest(recipients, subject, body) {
  const response = await fetch("/api/send-bulk-email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      recipients,
      subject,
      body,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || "Unable to send bulk email.");
  }
  return payload;
}

async function announceQuarterWinner(quarter) {
  const emails = getRegistrantEmails();
  if (!emails.length) {
    winnerText.textContent = "No registrant emails available for winner announcement.";
    return;
  }

  if (!quarterWinnerResults[quarter]) {
    highlightWinnerByQuarter(quarter);
  }

  const result = quarterWinnerResults[quarter];
  if (!result) {
    return;
  }
  if (result.owner === "Unclaimed") {
    winnerText.textContent = `Q${quarter} winning square is unclaimed. Set an owner before announcing.`;
    return;
  }

  const winnings = calculateQuarterWinnings(quarter);
  if (winnings === null) {
    winnerText.textContent = "Set a valid base square value before sending winner announcements.";
    return;
  }

  const { home, away } = getTeamNames();
  const subject = `Q${quarter} Winner Announcement - Football Squares by Jonny+`;
  const body = `Q${quarter} winner: ${result.owner}\nWinning digits: ${home} ${result.homeDigit}, ${away} ${result.awayDigit}\nAmount won: ${formatCurrency(winnings)}\n\nThanks for playing Football Squares by Jonny+!`;

  try {
    const payload = await sendBulkEmailRequest(emails, subject, body);
    winnerText.textContent = `Q${quarter} winner announcement sent to ${payload.sent || emails.length} registrants.`;
  } catch (error) {
    winnerText.textContent = error.message;
  }
}

function randomAssignRegistrantsToSquares() {
  adminMessage.textContent = "";

  if (!registrants.length) {
    adminMessage.textContent = "No registrants available to assign.";
    return;
  }

  const capacity = 100;
  const shuffledRegistrants = shuffledCopy(registrants);
  const shuffledSquares = shuffledCopy(Array.from({ length: capacity }, (_, index) => index));
  const assignCount = Math.min(shuffledRegistrants.length, capacity);

  picks = Array.from({ length: 10 }, () => Array(10).fill(""));
  for (let index = 0; index < assignCount; index += 1) {
    const square = shuffledSquares[index];
    const row = Math.floor(square / 10);
    const col = square % 10;
    picks[row][col] = shuffledRegistrants[index].name;
  }

  if (hideDigitsEnabled) {
    digitsRevealed = true;
  }

  clearQuarterWinners();
  clearWinnerHighlight();
  renderBoard();
  updateSquareValueSummary();

  const extraCount = registrants.length - assignCount;
  if (extraCount > 0) {
    adminMessage.textContent = `Assigned ${assignCount} registrants. ${extraCount} registrants were not assigned because the board is full.`;
    return;
  }

  adminMessage.textContent = `Assigned ${assignCount} registrants to random squares.`;
}

function loadRegistrants() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .filter((item) => item && item.name && item.email && item.phone)
      .map((item) => {
        const paymentApp = item.paymentApp || "venmo";
        const paymentUsername = item.paymentUsername || "";
        const paymentUrl = item.paymentUrl || generatePaymentUrl(paymentApp, paymentUsername);
        return { ...item, paymentApp, paymentUsername, paymentUrl };
      });
  } catch {
    return [];
  }
}

function saveRegistrants() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(registrants));
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function renderRegistrants() {
  registrantsBody.innerHTML = "";

  if (!registrants.length) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 5;
    td.className = "empty-row";
    td.textContent = "No participants registered yet.";
    tr.appendChild(td);
    registrantsBody.appendChild(tr);
    updateSquareValueSummary();
    return;
  }

  registrants.forEach((registrant) => {
    const tr = document.createElement("tr");

    const nameTd = document.createElement("td");
    nameTd.textContent = registrant.name;

    const emailTd = document.createElement("td");
    emailTd.textContent = registrant.email;

    const phoneTd = document.createElement("td");
    phoneTd.textContent = registrant.phone;

    const paymentTd = document.createElement("td");
    const paymentAppLabel = getPaymentAppLabel(registrant.paymentApp || "venmo");
    const paymentHandle = registrant.paymentUsername || "";
    const paymentUrl = registrant.paymentUrl || generatePaymentUrl(registrant.paymentApp, registrant.paymentUsername);
    if (paymentUrl) {
      const paymentLink = document.createElement("a");
      paymentLink.href = paymentUrl;
      paymentLink.target = "_blank";
      paymentLink.rel = "noopener noreferrer";
      paymentLink.textContent = `${paymentAppLabel}: ${paymentHandle}`;
      paymentTd.appendChild(paymentLink);
    } else {
      paymentTd.textContent = `${paymentAppLabel}: ${paymentHandle}`;
    }

    const registeredTd = document.createElement("td");
    const registeredDate = new Date(registrant.registeredAt);
    registeredTd.textContent = Number.isNaN(registeredDate.getTime())
      ? "-"
      : registeredDate.toLocaleString();

    tr.appendChild(nameTd);
    tr.appendChild(emailTd);
    tr.appendChild(phoneTd);
    tr.appendChild(paymentTd);
    tr.appendChild(registeredTd);

    registrantsBody.appendChild(tr);
  });

  updateSquareValueSummary();
}

function getRegistrantEmails() {
  const unique = new Set();
  registrants.forEach((item) => {
    const email = item.email.trim();
    if (email) {
      unique.add(email);
    }
  });
  return Array.from(unique);
}

function fallbackCopy(text) {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

homeTeamInput.addEventListener("input", () => {
  renderBoard();
  renderQuarterRows();
});

awayTeamInput.addEventListener("input", () => {
  renderBoard();
  renderQuarterRows();
});

randomizeBtn.addEventListener("click", () => {
  rowDigits = shuffledDigits();
  colDigits = shuffledDigits();
  if (hideDigitsEnabled) {
    digitsRevealed = false;
  }
  clearQuarterWinners();
  adminMessage.textContent = "";
  clearWinnerHighlight();
  renderBoard();
  updateSquareValueSummary();
});

clearBtn.addEventListener("click", () => {
  picks = Array.from({ length: 10 }, () => Array(10).fill(""));
  clearQuarterWinners();
  adminMessage.textContent = "";
  clearWinnerHighlight();
  renderBoard();
  updateSquareValueSummary();
});

hideDigitsToggle.addEventListener("change", () => {
  hideDigitsEnabled = hideDigitsToggle.checked;
  digitsRevealed = !hideDigitsEnabled;
  if (hideDigitsEnabled) {
    adminMessage.textContent = "Digits are hidden until you reveal them or assign registrants.";
  } else {
    adminMessage.textContent = "Digits are visible.";
  }
  clearWinnerHighlight();
  renderBoard();
});

revealDigitsBtn.addEventListener("click", () => {
  digitsRevealed = true;
  adminMessage.textContent = "Digits revealed.";
  clearWinnerHighlight();
  renderBoard();
});

randomAssignBtn.addEventListener("click", randomAssignRegistrantsToSquares);

baseSquareValueSelect.addEventListener("change", updateSquareValueSummary);
otherSquareValueInput.addEventListener("input", updateSquareValueSummary);
autoRecalcToggle.addEventListener("change", updateSquareValueSummary);
autoFormulaSelect.addEventListener("change", updateSquareValueSummary);

registrationForm.addEventListener("submit", (event) => {
  event.preventDefault();
  registrationMessage.textContent = "";

  const name = registrantNameInput.value.trim();
  const email = registrantEmailInput.value.trim().toLowerCase();
  const phone = registrantPhoneInput.value.trim();
  const paymentApp = registrantPaymentAppSelect.value;
  const paymentUsername = registrantPaymentUsernameInput.value.trim();
  const paymentUrl = generatePaymentUrl(paymentApp, paymentUsername);

  if (!name || !email || !phone || !paymentApp || !paymentUsername) {
    registrationMessage.textContent = "Name, email, phone, payment app, and payment username are required.";
    return;
  }

  if (!isValidEmail(email)) {
    registrationMessage.textContent = "Enter a valid email address.";
    return;
  }

  const duplicate = registrants.find((item) => item.email.toLowerCase() === email);
  if (duplicate) {
    registrationMessage.textContent = "That email is already registered.";
    return;
  }

  if (!paymentUrl) {
    registrationMessage.textContent = "Enter a valid payment username/handle.";
    return;
  }

  registrants.push({
    name,
    email,
    phone,
    paymentApp,
    paymentUsername,
    paymentUrl,
    registeredAt: new Date().toISOString(),
  });

  saveRegistrants();
  renderRegistrants();
  registrationForm.reset();
  registrationMessage.textContent = `${name} has been registered.`;
  updateSquareValueSummary();
});

clearRegistrantsBtn.addEventListener("click", () => {
  if (!window.confirm("Clear all pool registrants?")) {
    return;
  }
  registrants = [];
  saveRegistrants();
  renderRegistrants();
  registrationMessage.textContent = "All registrants were cleared.";
  bulkEmailMessage.textContent = "";
  updateSquareValueSummary();
});

composeBulkEmailBtn.addEventListener("click", async () => {
  bulkEmailMessage.textContent = "";
  const emails = getRegistrantEmails();
  if (!emails.length) {
    bulkEmailMessage.textContent = "No registrant emails available.";
    return;
  }

  const subject = bulkSubjectInput.value.trim() || "Football Squares Pool Update";
  const body = bulkBodyInput.value.trim() || "Hello everyone,";

  composeBulkEmailBtn.disabled = true;
  composeBulkEmailBtn.textContent = "Sending...";

  try {
    const payload = await sendBulkEmailRequest(emails, subject, body);
    bulkEmailMessage.textContent = `Email sent to ${payload.sent || emails.length} registrants.`;
  } catch (error) {
    bulkEmailMessage.textContent = error.message || "Could not reach email server. Start backend and try again.";
  } finally {
    composeBulkEmailBtn.disabled = false;
    composeBulkEmailBtn.textContent = "Send Bulk Email";
  }
});

copyEmailsBtn.addEventListener("click", async () => {
  bulkEmailMessage.textContent = "";
  const emails = getRegistrantEmails();
  if (!emails.length) {
    bulkEmailMessage.textContent = "No registrant emails available.";
    return;
  }

  const text = emails.join(", ");

  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      fallbackCopy(text);
    }
    bulkEmailMessage.textContent = "All registrant emails copied.";
  } catch {
    fallbackCopy(text);
    bulkEmailMessage.textContent = "All registrant emails copied.";
  }
});

renderBoard();
renderQuarterRows();
renderRegistrants();
updateSquareValueSummary();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {
      // Ignore registration errors for environments where service workers are unavailable.
    });
  });
}
