# votedi-next

`votedi-next` is a Firestore-backed voting platform built with Next.js.

## Current scope

- single-admin setup
- user login by `studentId`
- voter management by `fullName + studentId`
- user import from Excel only
- candidate management by manual CRUD only
- Firestore-backed vote flow
- near-realtime room status and results

## Current stack

- Next.js 16
- React 19
- TypeScript
- Firebase Firestore
- Firebase Admin SDK
- Firebase Web SDK
- JWT
- Zustand
- Tailwind CSS

## Project structure

- `src/app` - App Router pages and API routes
- `src/pages` - legacy page components still used in the migration boundary
- `src/components` - shared UI components
- `src/store` - client state stores
- `src/lib` - Firestore, auth, realtime, and lifecycle helpers
- `scripts` - utility scripts such as admin seeding
- `docs` - current handoff docs

## Read first

Before changing code, read:

1. [docs/00-READ-FIRST.md](/d:/my-projects/vote/vote-next/docs/00-READ-FIRST.md)
2. [docs/01-ARCHITECTURE.md](/d:/my-projects/vote/vote-next/docs/01-ARCHITECTURE.md)
3. [docs/02-SETUP-AND-OPS.md](/d:/my-projects/vote/vote-next/docs/02-SETUP-AND-OPS.md)

## Environment variables

Required server values:

```env
JWT_SECRET=your-secret-key

FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_CLIENT_EMAIL=your-service-account@your-project-id.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY\n-----END PRIVATE KEY-----\n"
```

Required client values:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your-firebase-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-firebase-project-id
NEXT_PUBLIC_FIREBASE_APP_ID=your-firebase-app-id
```

Optional admin seed values:

```env
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
ADMIN_FULL_NAME=Administrator
```

## Firebase setup

```bash
npx firebase-tools deploy --project votedi --only firestore:rules,firestore:indexes
```

Then seed the admin:

```bash
node scripts/create-admin.js
```

## Local development

```bash
npm install
npm run dev
```

## Verification

```bash
npx.cmd tsc --noEmit
npm.cmd run build
```

## Routes

- `/` - user entry
- `/login` - user login
- `/my-rooms` - user room list
- `/vote-room/[roomCode]` - voting room
- `/vote-room/[roomCode]/result` - room results
- `/admin` - redirects to `/admin/login`
- `/admin/login` - admin login
- `/admin/users` - voter management
- `/admin/vote-rooms` - room management
- `/admin/vote-rooms/[roomId]` - room detail

## Notes

- hot-path results summary now comes from `room_results/{roomId}`
- participation rows are intentionally kept out of the hot realtime path
- Google Drive image links are still supported
- current remaining lint warnings are `no-img-element` warnings only
