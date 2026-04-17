# Read First

## Current product rules

This repo is now built around these rules:

- Single admin only.
- User login uses `studentId` only.
- In Lao UI, the user-facing label is now `ລະຫັດ`.
- Admin manages voters with `fullName + studentId`.
- User import is `Excel only`.
- Candidates are `manual CRUD only`.
- Avatars/images still accept Google Drive links or external URLs.
- `/` is the user entry.
- `/admin` redirects to `/admin/login`.

## Current stack

- `Next.js 16`
- `Firestore` for documents
- `Firebase Admin SDK` for server-side data access
- `Firebase Web SDK` for client-side realtime
- app-managed JWT auth

Not used anymore:

- `MongoDB`
- `Pusher`
- `Firebase Auth`
- `Firebase Storage`
- custom WebSocket server

## Important recent changes

- Vote summary/count realtime was optimized.
- Admin results now subscribe directly to `room_results/{roomId}` for the hot path.
- Heavy participation rows are no longer fetched on every vote.
- `GET /api/rooms/:roomId/results` only returns participation rows when admin explicitly requests `?includeRows=1`.
- Vote submit no longer re-checks room login if the user is already checked in.
- `listUsersByIds()` was optimized to use Firestore `getAll(...)`.
- User room list no longer tears down and rejoins channels just because room status changed.
- Google Drive avatar normalization now supports more URL shapes and raw file ids.

## Current verification status

At the time of this handoff:

- `npx.cmd tsc --noEmit`: pass
- `npm.cmd run build`: pass

## Current known warnings

Lint still reports `@next/next/no-img-element` warnings in these files:

- [src/app/admin/vote-rooms/[roomId]/page.tsx](/d:/my-projects/vote/vote-next/src/app/admin/vote-rooms/[roomId]/page.tsx)
- [src/components/CandidateCard.tsx](/d:/my-projects/vote/vote-next/src/components/CandidateCard.tsx)
- [src/components/ResultBoard.tsx](/d:/my-projects/vote/vote-next/src/components/ResultBoard.tsx)
- [src/components/RoomHeader.tsx](/d:/my-projects/vote/vote-next/src/components/RoomHeader.tsx)
- [src/pages/MyRoomsPage.tsx](/d:/my-projects/vote/vote-next/src/pages/MyRoomsPage.tsx)

These are warnings only. Build and typecheck currently pass.

## Before you change anything

Check these files first:

- [.env](/d:/my-projects/vote/vote-next/.env)
- [firebase.json](/d:/my-projects/vote/vote-next/firebase.json)
- [firestore.rules](/d:/my-projects/vote/vote-next/firestore.rules)
- [firestore.indexes.json](/d:/my-projects/vote/vote-next/firestore.indexes.json)

Then read:

- [01-ARCHITECTURE.md](/d:/my-projects/vote/vote-next/docs/01-ARCHITECTURE.md)
- [02-SETUP-AND-OPS.md](/d:/my-projects/vote/vote-next/docs/02-SETUP-AND-OPS.md)
