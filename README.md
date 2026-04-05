# votedi-next

`votedi-next` is a voting platform built with Next.js. It provides admin and user workflows for managing rooms, importing candidates, collecting votes, and reviewing results.

## Features

- Admin authentication with JWT
- Single-admin setup
- User CRUD with CSV import
- Vote room CRUD
- Candidate import from CSV
- Multi-select voting
- Vote countdown and room closing logic
- Result visibility after a room closes
- Optional Pusher real-time updates

## Tech Stack

- Next.js 16
- React 19
- TypeScript
- MongoDB
- JWT
- Zustand
- Tailwind CSS
- Pusher Channels (optional)

## Project Structure

- `src/app` - App Router pages and API routes
- `src/pages` - Legacy user-facing pages kept during migration
- `src/components` - Shared UI components
- `src/store` - Client state stores
- `src/lib` - Database and lifecycle helpers
- `scripts` - Utility scripts such as admin seeding and migration helpers

## Prerequisites

- Node.js 20 or newer
- MongoDB running locally or a remote MongoDB connection

## Environment Variables

Create a `.env` file in the project root:

```env
MONGODB_URI=mongodb://localhost:27017/votedi
JWT_SECRET=your-secret-key
PUSHER_APP_ID=
PUSHER_SECRET=
NEXT_PUBLIC_PUSHER_KEY=
NEXT_PUBLIC_PUSHER_CLUSTER=
```

Optional values used by the admin seed script:

```env
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
ADMIN_FULL_NAME=Administrator
```

## Getting Started

```bash
npm install
npm run dev
```

Open the app at:

- `http://localhost:3000/admin/login`
- `http://localhost:3000/login`
- `http://localhost:3000/my-rooms`

## Available Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
```

## Seed the Admin Account

If you need to create or reset the single admin account, run:

```bash
node scripts/create-admin.js
```

## CSV Formats

### Users

User import expects:

```csv
username,fullName,studentId
```

- `studentId` is used as the initial password.
- Users should change their password after first login.

### Candidates

Candidate import expects:

```csv
name,title,date,bio,avatar
```

- `bio` must be separated by semicolons in the CSV.
- `avatar` should be a direct image URL and is stored as-is.

Example:

```csv
name,title,date,bio,avatar
Jane Doe,Project Manager,2026-03-31,"Achievement 1; Achievement 2",https://example.com/avatar.png
```

## Main Routes

- `/admin` - Admin dashboard
- `/admin/login` - Admin login
- `/admin/users` - User management
- `/admin/vote-rooms` - Vote room management
- `/admin/vote-rooms/[roomId]` - Vote room details
- `/login` - User login
- `/my-rooms` - User rooms
- `/vote-room/[roomCode]` - Voting room
- `/vote-room/[roomCode]/result` - Room results

## Notes

- Pusher realtime is optional. If the Pusher environment variables are not set, the app still runs without live updates.
- The project currently contains both App Router and legacy Pages Router code during migration.
- Room lifecycle logic is handled server-side so open, draft, and closed states stay consistent.

## License

Private project.
