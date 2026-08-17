# Durga Pollution Testing Center Eluru — PUC Manager

A full-stack internal PUC (Pollution Under Control) certificate management system.

## Tech Stack
- **Next.js 14+** (App Router, TypeScript)
- **MongoDB Atlas** (via Mongoose)
- **NextAuth.js** (Credentials provider, JWT)
- **Tailwind CSS v4**
- **SheetJS (xlsx)** for Excel import/export
- **date-fns + date-fns-tz** (IST timezone handling)

## Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment variables
Copy `.env.local.example` to `.env.local` and fill in:

```bash
cp .env.local.example .env.local
```

Required variables:
- `MONGODB_URI` — Your MongoDB Atlas connection string
- `NEXTAUTH_SECRET` — Random secret (min 32 chars)
- `NEXTAUTH_URL` — Your app URL (e.g. `https://your-app.vercel.app`)
- `ADMIN_USERNAME` — Login username
- `ADMIN_PASSWORD_HASH` — bcrypt hash of the password

### 3. Generate password hash
```bash
node -e "const b=require('bcryptjs'); b.hash('YourPassword',10).then(console.log)"
```

### 4. Run development server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Default Login (Development)
- Username: `admin`
- Password: `admin123`

> ⚠️ **Change the password before deploying to production!**

## Features

### Dashboard
- Today's issued PUC certificates
- Today's expired PUC certificates
- Vehicle number search across all records
- Live IST date/time in header
- **F7** key reveals Import button

### Create PUC
- Vehicle number validation (Indian format: `AP03AB1234`)
- Auto-computed validity: BS1–BS4 = 6 months, BS6 = 12 months
- Server-side date computation (never trusts client clock)

### Old PUC Data (`/old-data`)
- Cascading filter: Year → Month → Week
- Export filtered data to Excel

### Expired PUC (`/expired`)
- All expired certificates
- Same cascading filter + export

### Excel Import (F7 → Import)
- Upload `.xlsx` file
- Expected columns: `Vehicle No`, `BS Stage`, `Fuel`, `Customer Name`, `Customer Phone`, `Agent`, `Issued Date` (dd-mm-yyyy)
- Import summary: rows imported vs skipped with reasons

## Deployment (Vercel)

1. Push to GitHub
2. Connect to Vercel
3. Add environment variables in Vercel dashboard
4. Deploy

## Data Model

```
pucRecords collection:
  vehicleNo: string (validated Indian format)
  bsStage: BS1|BS2|BS3|BS4|BS6
  fuelType: Diesel|Petrol|Gas
  customerName: string
  customerPhone: string (10-digit)
  agent: string|null
  issuedAt: Date (IST)
  validTill: Date (computed)
  status: active|expired
  source: manual|excel_import
```

Indexes on: `vehicleNo`, `validTill`, `issuedAt`, compound `{issuedAt, validTill}`
