# Architecture

## Active stack

```txt
Browser
  -> Next.js client code
  -> Firebase Web SDK
     -> direct onSnapshot for room_results hot-path realtime
     -> Firestore event-log subscription for room status/reset/list sync

Next.js API routes
  -> Firebase Admin SDK
  -> Firestore

JWT auth
  -> managed by app code
  -> validated by Next.js routes
```

## Auth model

The app does not use Firebase Auth.

Current auth flow:

- admin login: [src/app/api/auth/login/route.ts](/d:/my-projects/vote/vote-next/src/app/api/auth/login/route.ts)
- user login: [src/app/api/auth/user/login/route.ts](/d:/my-projects/vote/vote-next/src/app/api/auth/user/login/route.ts)
- JWT signing: `JWT_SECRET`

Helpers:

- [src/lib/serverAuth.ts](/d:/my-projects/vote/vote-next/src/lib/serverAuth.ts)
- [src/lib/userAuth.ts](/d:/my-projects/vote/vote-next/src/lib/userAuth.ts)
- [src/lib/userSession.ts](/d:/my-projects/vote/vote-next/src/lib/userSession.ts)

## Realtime model

There are now two realtime paths:

### 1. Direct room result summary

Used for the hot path where low latency matters:

- admin room detail results summary
- vote counts
- result counts

Source:

- `room_results/{roomId}`
- client helper: [src/lib/roomResultsRealtime.ts](/d:/my-projects/vote/vote-next/src/lib/roomResultsRealtime.ts)

This path exists to avoid:

- refetching heavy results rows on every vote
- append-only event overhead for every vote
- extra API round-trips after each vote

### 2. Firestore event-log channels

Still used for lighter room lifecycle events:

- room status changed
- room results reset
- list/status sync across pages

Files:

- [src/lib/realtimeEmitter.ts](/d:/my-projects/vote/vote-next/src/lib/realtimeEmitter.ts)
- [src/api/socketClient.ts](/d:/my-projects/vote/vote-next/src/api/socketClient.ts)
- [src/hooks/useRoomSocket.ts](/d:/my-projects/vote/vote-next/src/hooks/useRoomSocket.ts)

Stored under:

```txt
realtime_channels/{channelId}/events/{eventId}
```

## Data model

Main collections:

- `admins`
- `users`
- `rooms`
- `room_results`
- `votes`
- `realtime_channels`

### `admins`

Single-admin setup.

Typical fields:

- `username`
- `password`
- `fullName`
- `role`
- `createdAt`
- `updatedAt`

Seeded by:

- [scripts/create-admin.js](/d:/my-projects/vote/vote-next/scripts/create-admin.js)

### `users`

Typical fields:

- `fullName`
- `studentId`
- `avatar`
- `password`
- `mustChangePassword`
- `activeDeviceId`
- `activeDeviceBoundAt`
- `createdByAdminId`
- `createdAt`
- `updatedAt`

### `rooms`

Typical fields:

- `roomCode`
- `roomName`
- `description`
- `startTime`
- `endTime`
- `timeMode`
- `durationMinutes`
- `voteType`
- `maxSelection`
- `status`
- `allowResultView`
- `candidates`
- `allowedUsers`
- `ownerAdminId`
- `createdAt`
- `updatedAt`

Important rules:

- candidate editing is blocked while a room is open
- opening a room validates `candidate count > maxSelection`

### `room_results`

Summary read model for fast results/realtime.

Typical fields:

- `roomId`
- `status`
- `eligibleCount`
- `votedCount`
- `notVotedCount`
- `totalVotes`
- `resultCounts`
- `updatedAt`

### `votes`

One vote per `roomId + userId`.

Document identity is effectively:

```txt
{roomId}__{userId}
```

Typical fields:

- `roomId`
- `roomCode`
- `userId`
- `selectedIds`
- `votedAt`

## Results API behavior

Route:

- [src/app/api/rooms/[roomId]/results/route.ts](/d:/my-projects/vote/vote-next/src/app/api/rooms/[roomId]/results/route.ts)

Current behavior:

- summary data should come from `room_results`
- participation rows are only returned when:
  - caller is admin
  - query string explicitly sends `?includeRows=1`

This is intentional. Do not revert it casually.

## Performance notes

Known good decisions in current code:

- do not refetch full results rows on every vote
- use direct `room_results` snapshot for summary counts
- keep heavy participation/audit reads out of the hot path
- avoid unnecessary room-login round-trips on vote submit
- avoid rejoining room channels when only room status changes

## Things not to break

- do not let the client write business data directly to Firestore
- do not reopen candidate editing while a room is open
- do not reintroduce vote-progress event spam if `room_results` already covers the need
- do not let non-admin callers fetch participation rows
