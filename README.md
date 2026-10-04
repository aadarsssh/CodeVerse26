# CodeVerse Hackathon 2026

Welcome to the official repository for **CodeVerse Hackathon 2026** — featuring the full-stack **Team Registration & Payment Verification Module**.

---

## 🌟 Key Features

### 1. Dynamic Team Registration (4 to 6 Members)
- **Strict Team Size**: Enforces minimum 4 and maximum 6 members per team with real-time UI counters and safeguards.
- **Team Leader Designation**: Member #1 is automatically designated as the Team Leader and primary contact.
- **Dynamic Controls**: Teams can dynamically add or remove members (clamped between 4 and 6 members).
- **Validation**:
  - Full Name, University Registration/Roll Number, College Email, and 10-digit Phone Number.
  - Cross-member uniqueness checks preventing duplicate emails, phone numbers, or registration IDs.
  - Unique team name validation.

### 2. Dual Payment Gateway Display
- **Option 1: UPI Transfer**:
  - Official UPI ID with 1-click copy button and feedback toast.
  - High-resolution scannable QR Code compatible with Google Pay, PhonePe, Paytm, and BHIM.
  - "Download QR Code" shortcut.
- **Option 2: Direct Bank Transfer**:
  - Account Holder Name, Bank Name, Account Number, and IFSC Code.
  - One-click copy buttons with animated feedback.
- **Banking Security First**:
  - Clear banner reminding participants that CodeVerse never requests UPI PINs, bank passwords, OTPs, or debit/credit card details.

### 3. Payment Verification & UTR Submission
- Collects: Payment method (`UPI` / `Bank Transfer`), Transaction ID / UTR Number, payment date, amount paid, and optional screenshot/receipt proof.
- Drag-and-drop receipt uploader with immediate image thumbnail preview (supporting PNG, JPG, WebP, PDF up to 5MB).
- Associates the payment record with the team registration and sets the status to **`Pending Verification`**.

### 4. Unique Registration ID & Confirmation Ticket
- Generates a collision-resistant alphanumeric Registration ID (e.g. `CV26-K9F2A1`).
- Displays a confirmation receipt with print/download capability, Discord onboarding links, and 24-hour verification tracking.

### 5. Organizer & Admin Dashboard (`admin.html`)
- **Real-Time Metrics**: Total registrations, pending verifications, approved teams, rejected payments, and total revenue collected.
- **Search & Filters**: Search across teams, leaders, registration IDs, and UTR numbers. Filter by status (`ALL`, `VERIFICATION_PENDING`, `CONFIRMED`, `PAYMENT_REJECTED`, `PAYMENT_PENDING`).
- **Expandable Member Rosters**: Inspect all 4–6 members and their credentials.
- **Proof Modal Viewer**: Inspect uploaded payment screenshots and receipts in full resolution.
- **One-Click Actions**: Approve / Verify payment or Reject payment with customized organizer remarks.
- **CSV Export**: One-click download of the complete participant roster for Excel or Google Sheets.

---

## 🚀 Quick Start

This project is built using vanilla HTML5, CSS3, ES6 JavaScript, and Python 3 standard library (`http.server` + `sqlite3`). **Zero external pip or npm dependencies required.**

### 1. Start the Server

```bash
python3 server.py
```

The server will initialize the SQLite database (`codeverse.db`) and start on port `8000`:
- **Student Registration Portal**: [http://localhost:8000/](http://localhost:8000/)
- **Organizer Admin Dashboard**: [http://localhost:8000/admin.html](http://localhost:8000/admin.html)

### 2. Run Automated Integration Tests

To run the automated test suite testing validation rules, registration limits, UTR uniqueness, and admin approval workflows:

```bash
python3 test_system.py
```

---

## 📁 Project Architecture

```
CodeVerse26/
├── index.html         # Student registration & multi-step payment portal
├── admin.html         # Organizer admin dashboard with verification & export
├── styles.css         # Modern dark-mode cyber design system with glassmorphism
├── app.js             # Student portal frontend logic & offline fallback
├── admin.js           # Admin dashboard controller & analytics logic
├── config.json        # Centralized event settings, fees, bank info, and UPI details
├── server.py          # Python 3 REST API & static server (SQLite3 backed)
├── test_system.py     # Automated integration test suite
├── assets/
│   └── qr-code.svg    # Vector UPI QR code
├── uploads/           # Storage directory for uploaded payment receipts
└── .gitignore         # Excludes databases and temporary test uploads
```

---

## 🔌 REST API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/config` | Returns hackathon fee rules, bank details, and UPI information |
| `POST` | `/api/registrations` | Registers team with 4–6 members and generates unique Registration ID |
| `GET` | `/api/registrations/{id}` | Fetches team registration details & payment status |
| `POST` | `/api/registrations/{id}/payment` | Submits payment UTR, date, amount, and screenshot proof |
| `GET` | `/api/admin/registrations` | Admin: Returns all registered teams, members, and payment records |
| `PATCH` | `/api/admin/registrations/{id}/status` | Admin: Marks payment as `VERIFIED` or `REJECTED` with remarks |
| `GET` | `/uploads/{filename}` | Serves uploaded payment proof documents |

---

## 🛡️ License

Built for **CodeVerse Hackathon 2026**. All rights reserved.
