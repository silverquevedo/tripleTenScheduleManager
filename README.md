# Schedule Manager

A weekly shift management tool for teams, with Google OAuth login and multi-user session support.

## Tech Stack

- **Next.js 14** (App Router)
- **NextAuth.js v4** — Google OAuth, database sessions
- **Prisma ORM** — SQLite (local dev) / PostgreSQL (production)
- **Tailwind CSS**

---

## Prerequisites

- Node.js 18+
- A Google Cloud Console project with OAuth 2.0 credentials

---

## 1 — Create Google OAuth Credentials

1. Go to [console.cloud.google.com](https://console.cloud.google.com).
2. Create a new project (or select an existing one).
3. Navigate to **APIs & Services → OAuth consent screen**.
   - Choose **External**, fill in the app name, support email, and save.
4. Navigate to **APIs & Services → Credentials → Create Credentials → OAuth client ID**.
   - Application type: **Web application**.
   - Authorised JavaScript origins: `http://localhost:3000`
   - Authorised redirect URIs: `http://localhost:3000/api/auth/callback/google`
5. Copy the **Client ID** and **Client Secret**.

---

## 2 — Environment Setup

```bash
cp .env.example .env
```

Edit `.env`:

```env
GOOGLE_CLIENT_ID=<paste Client ID>
GOOGLE_CLIENT_SECRET=<paste Client Secret>
NEXTAUTH_SECRET=<run: openssl rand -base64 32>
NEXTAUTH_URL=http://localhost:3000
DATABASE_URL="file:./dev.db"
```

---

## 3 — Install Dependencies

```bash
npm install
```

---

## 4 — Database Setup

```bash
# Run migrations (creates prisma/dev.db)
npx prisma migrate dev --name init

# Seed programs, shift types, and UX/UI team members
npx prisma db seed
```

To inspect data visually:

```bash
npx prisma studio
```

---

## 5 — Start the Dev Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and sign in with Google.

---

## Production — PostgreSQL

1. Provision a PostgreSQL database.
2. In `prisma/schema.prisma`, change the provider:
   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```
3. Set `DATABASE_URL` to your PostgreSQL connection string.
4. Run `npx prisma migrate deploy`.

---

## Seeded Data

| Programs | Shift Types         | UX/UI Members   |
|----------|---------------------|-----------------|
| UX/UI    | 1:1 → 1:1 Session   | Isaac Tovar     |
| QA       | MTI → MTI           | Jose D. Ortiz   |
| AI       | REV → Review        | Daniel Otero    |
| BIA      | GOH → GOH           | Andres Quevedo  |

---

## Multi-Session Behaviour

Sessions are stored server-side in the database (NextAuth database strategy). Each browser tab or user has an independent session token — switching programs in one tab has no effect on another. Multiple Google accounts can be logged in simultaneously in different windows.

---

## Available Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run db:migrate` | Run Prisma migrations |
| `npm run db:seed` | Seed the database |
| `npm run db:studio` | Open Prisma Studio |
