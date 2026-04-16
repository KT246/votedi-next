# votedi-next

`votedi-next` is a voting platform built with Next.js. It provides admin and user workflows for managing rooms, importing voters from Excel, collecting votes, and reviewing results.

## Features

- Admin authentication with JWT
- Single-admin setup
- User CRUD with Excel import
- Vote room CRUD
- Candidate management by manual entry only
- Multi-select voting
- Vote countdown and room closing logic
- Result visibility after a room closes
- Firestore-backed realtime updates

## Tech Stack

- Next.js 16
- React 19
- TypeScript
- Firebase Firestore
- Firebase Admin SDK
- Firebase Web SDK
- JWT
- Zustand
- Tailwind CSS

## Project Structure

- `src/app` - App Router pages and API routes
- `src/pages` - Legacy user-facing pages kept during migration
- `src/components` - Shared UI components
- `src/store` - Client state stores
- `src/lib` - Firestore, auth, and lifecycle helpers
- `scripts` - Utility scripts such as admin seeding
- `firestore.rules` - Firestore security rules
- `firestore.indexes.json` - Firestore composite indexes

## Prerequisites

- Node.js 20 or newer
- A Firebase project with Firestore enabled
- A Firebase service account for server access

## Environment Variables

Create a `.env` file in the project root:

```env
JWT_SECRET=your-secret-key

FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_CLIENT_EMAIL=your-service-account@your-project-id.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY\n-----END PRIVATE KEY-----\n"
FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com

NEXT_PUBLIC_FIREBASE_API_KEY=your-firebase-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-firebase-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-messaging-sender-id
NEXT_PUBLIC_FIREBASE_APP_ID=your-firebase-app-id
```

Optional values used by the admin seed script:

```env
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
ADMIN_FULL_NAME=Administrator
```

## Firebase Setup

1. Create or choose a Firebase project.
2. Enable Firestore in Native mode.
3. Create a service account and copy:
   `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`
4. From Project Settings, copy the web app config values into the `NEXT_PUBLIC_FIREBASE_*` variables.
5. Deploy Firestore rules and indexes:

```bash
firebase deploy --only firestore:rules,firestore:indexes
```

Important:
- This app uses Firestore client SDK only for realtime channel reads under `realtime_channels/*/events/*`.
- All rooms, users, votes, and admin data are accessed through Next.js API routes using Firebase Admin SDK.
- Current rules allow public read access only to realtime channel events. They deny direct client access to the rest of Firestore.

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

This script replaces the `admins` collection with exactly one admin record using Firestore.

## Excel Import Format

### Users

User import expects the first worksheet to contain:

```text
fullName | studentId
```

- `studentId` is used as the initial password.
- Users should change their password after first login.
- Candidate data is created and edited manually in the admin room detail page.

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

- Realtime updates are implemented through Firestore snapshot listeners on `realtime_channels`.
- Consider enabling TTL cleanup for realtime event documents using the `createdAt` field.
- The project currently contains both App Router and legacy Pages Router code during migration.
- Room lifecycle logic is handled server-side so open, draft, and closed states stay consistent.

## License

Private project.
