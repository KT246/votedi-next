# Setup And Ops

## Required environment variables

Read [.env.example](/d:/my-projects/vote/vote-next/.env.example).

### Server-side Firebase Admin SDK

- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`

Source:

- Firebase Console
- Project settings
- Service accounts
- Generate new private key

Map from service-account JSON:

- `project_id` -> `FIREBASE_PROJECT_ID`
- `client_email` -> `FIREBASE_CLIENT_EMAIL`
- `private_key` -> `FIREBASE_PRIVATE_KEY`

### Client-side Firebase config

Required for current Firestore client usage:

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`

Optional for this app's current flow:

- storage/messaging values are not required unless you later add those features

## Firestore setup

If the Firebase Console still shows `Create database`, Firestore has not been created yet.

Create it first:

1. Firebase Console
2. Project `votedi`
3. Firestore Database
4. `Create database`
5. choose region

## Firestore rules and indexes

Repo files:

- [firebase.json](/d:/my-projects/vote/vote-next/firebase.json)
- [firestore.rules](/d:/my-projects/vote/vote-next/firestore.rules)
- [firestore.indexes.json](/d:/my-projects/vote/vote-next/firestore.indexes.json)

Recommended deploy command:

```bash
npx firebase-tools deploy --project votedi --only firestore:rules,firestore:indexes
```

If you want a persistent active project:

```bash
npx firebase-tools use --add
```

## Seed the admin account

```bash
node scripts/create-admin.js
```

This script:

- loads `.env`
- connects with Firebase Admin SDK
- replaces old admins
- creates exactly one admin

Default values:

- `ADMIN_USERNAME=admin`
- `ADMIN_PASSWORD=admin123`
- `ADMIN_FULL_NAME=Administrator`

## Local verification

```bash
npm install
npx.cmd tsc --noEmit
npm.cmd run build
npm run dev
```

Check Firebase Console:

- `admins` after seeding admin
- `users` after create/import
- `rooms` after room creation
- `votes` after voting
- `room_results` after results activity
- `realtime_channels` for room lifecycle events

## Current warnings

Known current warnings are limited to `@next/next/no-img-element` on a few UI files. They do not block build or typecheck.

## Troubleshooting

### Firebase CLI says no active project

Use:

```bash
npx firebase-tools deploy --project votedi --only firestore:rules,firestore:indexes
```

### `tsc` fails on `.next/types/validator.ts` with missing `routes.js`

This was seen once as generated-cache drift. If it happens again:

1. rerun `npm.cmd run build`
2. rerun `npx.cmd tsc --noEmit`
3. if still needed, remove `.next` and rebuild

### Realtime feels slow

Check these assumptions before changing architecture:

- results summary should come from `room_results`
- heavy rows should not be fetched on every vote
- vote submit should not re-check room login when the user is already checked in

## Operational reminders

- do not commit service-account JSON into the repo
- do not paste the private key into docs
- user import is Excel-only
- candidate import should not be reintroduced
