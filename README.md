# Football Squares by Jonny+

A lightweight browser app for running football squares.

## Features
- 10x10 grid for square selection.
- Editable home/away team names.
- Randomized 0-9 digit headers for rows and columns.
- Click any square to assign a player name or initials.
- Enter end-of-quarter cumulative scores for Q1-Q4 and highlight each quarter winner by last digit.
- Quarter winner box auto-populates after score highlight with winner name and amount won.
- Quarter winner announcement button sends winner + payout message to all registrants.
- Quarter payout formula defaults to 25% of total registered funds per quarter.
- Admin can manually set quarter payout percentages.
- Register participants with name, email, and phone number.
- Capture each registrant's preferred payment app (Venmo, PayPal, Cash App, Zelle) and payment username.
- Generate a payment URL per registrant from selected app + username.
- Save registrants in browser local storage.
- Admin option to randomly assign all registrants into square positions.
- Admin option to hide randomized row/column digits until assignments are set, then reveal.
- Admin base square value selector: `$1`, `$5`, `$10`, `$20`, `$25`, or `Other`.
- Optional auto-recalculation of per-square value based on registrant count and selected base value.
- Auto formula option to divide by either `100 total squares` or `registered (filled) squares only`.
- Send bulk email directly from the app through SMTP backend integration.
- Copy all registrant emails.

## Run
1. Copy `.env.example` to `.env` and fill in your SMTP settings.

2. Start the backend server:

```bash
python3 server.py
```

3. Open `http://127.0.0.1:8080` in your browser.

## Install On iPhone/iPad (iOS App-Like)
1. Host the app on a reachable URL (HTTPS recommended).
2. Open the app URL in Safari on iPhone or iPad.
3. Tap the Share button.
4. Tap `Add to Home Screen`.
5. Launch from the Home Screen icon.

The app is configured as an installable web app (PWA) with standalone display and offline shell caching.

## SMTP Notes
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, and `SMTP_PASSWORD` come from your email provider.
- `EMAIL_FROM` must be an address your SMTP provider allows sending from.
- The app sends one bulk email with recipients passed to backend and delivered through SMTP.
