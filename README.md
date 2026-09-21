# Ledger — Personal Finance Tracker

Production-grade personal expense & finance tracker built with Next.js 14, TypeScript, Tailwind CSS, Prisma + **PostgreSQL (Neon-ready)**, Recharts, and **passwordless OTP login**.

## Quick start

```bash
# 1) Install deps
npm install

# 2) Paste your Neon Postgres URL into .env
#    DATABASE_URL="postgresql://user:pass@ep-xxx.neon.tech/dbname?sslmode=require"

# 3) Create the schema on your database
npx prisma migrate dev --name init

# 4) Seed a demo user (optional but recommended)
npm run seed

# 5) Start the app
npm run dev              # http://localhost:3000
```

## Signing in (OTP flow)

There are **no passwords**. On the login page:

1. Enter your email.
2. If you're new, we ask for your name and create the account.
3. We email you a 6-digit code. Enter it — you're in.

### Where does the OTP come from?

- **SMTP configured** — the OTP is emailed to the user.
  Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` in `.env`.
  Works with Resend SMTP, Gmail App Passwords, Mailgun, SendGrid, Postmark, or any SMTP relay.
- **SMTP not configured** — the OTP is **printed to the server console** running `npm run dev`.
  Look for a banner like:

  ```
  ┌────────────────────────────────────────────────────┐
  │  Ledger OTP for demo@ledger.app
  │  Code: 483920   (purpose: LOGIN, 10 min)
  └────────────────────────────────────────────────────┘
  ```

  The web UI also shows a "SMTP not configured — check server console" hint after requesting a code.

### Security

- Codes are 6 digits, cryptographically random (`crypto.getRandomValues`).
- Codes are **bcrypt-hashed** at rest — never stored in plaintext.
- Codes expire after **10 minutes**.
- **6 wrong attempts** invalidate the code.
- **30-second throttle** between OTP requests per email.
- Previous unconsumed OTPs for an email are auto-invalidated on new requests.
- Sessions are JWTs signed with `AUTH_SECRET`, stored in an httpOnly SameSite=Lax cookie for 30 days.

## Environment variables

Copy `.env.example` → `.env` and fill in:

| Variable | Purpose | Required |
| --- | --- | --- |
| `DATABASE_URL` | Neon Postgres URL, e.g. `postgresql://...neon.tech/db?sslmode=require` | ✅ |
| `AUTH_SECRET` | 32+ character random string used to sign session JWTs | ✅ |
| `SMTP_HOST` | SMTP server hostname (leave empty in dev to log OTPs to console) | Optional |
| `SMTP_PORT` | SMTP port (default 587) | Optional |
| `SMTP_SECURE` | `true` for port 465, `false` otherwise | Optional |
| `SMTP_USER` | SMTP username | Optional |
| `SMTP_PASS` | SMTP password / app password / API key | Optional |
| `SMTP_FROM` | From address, e.g. `"Ledger <no-reply@yourapp.com>"` | Optional |

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Start Next.js dev server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run typecheck` | Run TypeScript checks |
| `npm run seed` | Seed the demo user + 6-month transaction history |
| `npm run prisma:migrate` | Create / apply a new migration |
| `npm run prisma:reset` | Drop DB and re-run migrations (destructive) |

## Architecture

```
src/
├── app/
│   ├── (app)/                  Authenticated shell (sidebar + pages)
│   ├── api/                    REST endpoints
│   │   └── auth/               request-otp, verify-otp, logout
│   ├── login/                  OTP login flow (email → optional name → code)
│   └── middleware.ts           Route protection
├── components/                 UI (Card, Modal, Sidebar, Toast, charts, forms)
└── lib/
    ├── auth.ts                 Sessions + OTP helpers (generate, hash, compare)
    ├── mailer.ts               Nodemailer wrapper with dev console fallback
    ├── finance.ts              All balance / budget / analytics calculations
    ├── money.ts                Decimal-safe arithmetic (decimal.js)
    ├── validators.ts           Zod schemas
    ├── prisma.ts               Prisma client singleton
    └── seedDefaults.ts         Default categories + starter account for new users
```

## Financial correctness

- **Transfers** move money between accounts and never contribute to income or expense totals.
- **Credit-card payments** are transfers, not expenses (Bank → Credit Card).
- **Refunds** on expenses reduce the expense total rather than counting as income.
- **All arithmetic** uses `decimal.js` — no native JS floats for money.
- **Budgets** roll up child categories (a "Food" budget covers Groceries, Restaurant, Swiggy, …).

## User isolation

Every API route calls `requireUser()` and every DB query is scoped by `userId`. Middleware redirects unauthenticated browser hits to `/login` and returns `401` for API hits. Cascade deletes on `User` remove all user-owned data atomically.
