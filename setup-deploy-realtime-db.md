# Archived Setup Note

This file is no longer the source of truth for deployment or realtime architecture.

Use the current docs instead:

- [docs/00-READ-FIRST.md](/d:/my-projects/vote/vote-next/docs/00-READ-FIRST.md)
- [docs/01-ARCHITECTURE.md](/d:/my-projects/vote/vote-next/docs/01-ARCHITECTURE.md)
- [docs/02-SETUP-AND-OPS.md](/d:/my-projects/vote/vote-next/docs/02-SETUP-AND-OPS.md)

Reason:

- the current app uses `Next.js API routes + Firebase Admin SDK + Firestore`
- realtime is split between `room_results` direct snapshots and Firestore event channels
- the older simplified note here is incomplete and can mislead future changes
