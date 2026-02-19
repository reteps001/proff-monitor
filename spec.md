# Proff Financial Statement Monitor Specification

> **Branch:** `main` (Personal project)

---

## Agent Task Checklist

> **Instructions for Agents:**
> 1. Find the first task marked with `[ ]`
> 2. Change it to `[x]` when you START the task
> 3. Complete the task
> 4. Mark complete

### Phase 1: Foundation & Setup
- [ ] **1.1** Initialize Next.js Project (App Router, Tailwind, TypeScript)
    - Setup `shadcn/ui` for base components
    - Setup Supabase client & environment variables
- [ ] **1.2** Setup Supabase Database Schema
    - Tables: `profiles`, `companies`, `subscriptions`, `notifications`
    - RLS Policies

### Phase 2: Core Feature - Company Search & Subscription
- [ ] **2.1** Implement Proff.dk Search Scraper (API Route)
    - Endpoint `/api/search?q=...`
    - Scrapes `proff.dk` search results
    - Returns list of `{ name, url, cvr }`
- [ ] **2.2** Create Search UI Component
    - "Remotion"-style input with dropdown results
    - Add to "My Watchlist" functionality
- [ ] **2.3** Manual URL Fallback
    - Input field to paste direct Proff URL if search fails

### Phase 3: Core Feature - Monitoring & Scraping
- [ ] **3.1** Implement Check-Logic Scraper
    - Function to fetch a specific company page
    - Parse "Årsregnskab" table for latest year/date
- [ ] **3.2** Create Cron/Batch Job Structure
    - API route `/api/cron/check-updates`
    - Iterates through subscribed companies
    - Compares latest parsed year vs stored year
    - Triggers notification if new
- [ ] **3.3** Set up Vercel Cron (config)

### Phase 4: Notifications & UI
- [ ] **4.1** In-App Notification System
    - Database table `notifications`
    - UI: Bell icon with badge
    - Dropdown showing recent alerts
- [ ] **4.2** Email Notification (Resend/SendGrid or Mock)
    - Trigger email when new statement found
- [ ] **4.3** Dashboard View
    - List of subscribed companies
    - Status (Last checked, Latest Statement Year)
    - Action to "Unsubscribe"

### Phase 5: Polish & Deployment
- [ ] **5.1** Apply "Remotion" Aesthetic
    - Dark mode refinement
    - Framer Motion animations for list items
- [ ] **5.2** Verify Vercel Deployment

---

## Overview
A personal web application to monitor Danish companies on `proff.dk` for the release of their annual financial statements. Users subscribe to companies, and the system periodically checks for updates, notifying the user via in-app alerts and email when a new statement (e.g., 2025 report in 2026) is published.

## Goals
- **Automated Monitoring**: Daily checks for new financial statements.
- **Easy Subscription**: Search and add companies easily.
- **Notifications**: Instant awareness via UI and Email.
- **Premium UX**: High-quality, dark-mode-first aesthetic (Remotion style).

## Non-Goals
- **Historical Analysis**: We only care about *notification of new release*, not analyzing the numbers.
- **Multi-tenancy isolation**: While typical SaaS, this is primarily for a single user/admin.
- **Real-time instant scraping**: Daily checks are sufficient.

## Technical Design

### Architecture
- **Framework**: Next.js 14+ (App Router).
- **Styling**: Tailwind CSS + generic UI components (shadcn/ui equivalent) customized for "Remotion" look + Framer Motion.
- **Backend**: Next.js Server Actions / API Routes.
- **Database**: Supabase (PostgreSQL).
- **Scraping**: `cheerio` (lightweight HTML parsing) called from Server Actions/API routes.
    - *Fallback*: If `cheerio` fails due to JS blocking, investigate `puppeteer-core` (but start lightweight).
- **Hosting**: Vercel.

### Data Model (Supabase)

**`companies`**
- `id` (uuid)
- `name` (text)
- `proff_url` (text, unique) - The usage source of truth.
- `last_known_statement_year` (int) - e.g., 2024.
- `last_checked_at` (timestamp)

**`subscriptions`**
- `id` (uuid)
- `user_id` (uuid) -> references `auth.users`
- `company_id` (uuid) -> references `companies`

**`notifications`**
- `id` (uuid)
- `user_id` (uuid)
- `company_id` (uuid)
- `message` (text) - "New statement for Lego A/S (2025)"
- `read` (boolean)
- `created_at` (timestamp)

### Scraping Strategy
1.  **Search**: `GET https://proff.dk/soeg?q={query}` -> Parse HTML for list of results.
2.  **Monitor**: `GET {company_url}` -> Parse the "Regnskab" table. Look for the most recent year column.

### API Design
- `GET /api/search?q=lego`: Proxy for frontend search component.
- `POST /api/subscribe`: Link user to company (create company if not exists).
- `GET /api/cron/check`: Protected route (Cron secret) to trigger update checks.

## User Experience
1.  **Dashboard**: Main view. Two sections: "Recent Notifications" and "Monitored Companies".
2.  **Add Company**:
    - User clicks "Add Subscription".
    - Types "Lego" into search bar.
    - Dropdown shows "Lego A/S", "Lego System A/S".
    - User selects one.
    - System scrapes initial data (latest year) and adds to DB.
    - User falls back to "Paste URL" if search fails.
3.  **Notification**:
    - Bell icon in header has red dot.
    - Clicking shows list.

## Security
- **Cron Security**: Verify `CRON_SECRET` header to prevent public triggering of scraping jobs.
- **Auth**: Supabase Auth (Email/Password or Magic Link) to protect the dashboard.

## Testing Strategy
- **Unit**: Test the `parser` logic (feed it sample HTML from proff.dk and assert it extracts years correctly).
- **Manual**: Verify Vercel Cron triggers correctly in logs.
