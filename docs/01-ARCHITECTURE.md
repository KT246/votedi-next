# Architecture

## Current stack

```txt
Browser
  -> Next.js client code
  -> Firebase Web SDK (Firestore onSnapshot)

Next.js API routes
  -> Firebase Admin SDK
  -> Firestore

JWT auth
  -> managed by app code
  -> stored/validated by Next.js routes
```

## Auth model

App này không dùng Firebase Auth.

Auth hiện tại:

- Admin login qua [src/app/api/auth/login/route.ts](/d:/my-projects/vote/vote-next/src/app/api/auth/login/route.ts)
- User login qua [src/app/api/auth/user/login/route.ts](/d:/my-projects/vote/vote-next/src/app/api/auth/user/login/route.ts)
- JWT được ký bằng `JWT_SECRET`
- User/admin session vẫn đi qua logic hiện có trong app

Các helper chính:

- [src/lib/serverAuth.ts](/d:/my-projects/vote/vote-next/src/lib/serverAuth.ts)
- [src/lib/userAuth.ts](/d:/my-projects/vote/vote-next/src/lib/userAuth.ts)
- [src/lib/userSession.ts](/d:/my-projects/vote/vote-next/src/lib/userSession.ts)

## Realtime model

App không dùng WebSocket server riêng và không dùng Pusher nữa.

Realtime hiện tại hoạt động như sau:

1. Server-side event được ghi vào Firestore bởi [src/lib/realtimeEmitter.ts](/d:/my-projects/vote/vote-next/src/lib/realtimeEmitter.ts)
2. Event được ghi dưới collection:

```txt
realtime_channels/{channelId}/events/{eventId}
```

3. Client subscribe bằng Firestore `onSnapshot` trong [src/api/socketClient.ts](/d:/my-projects/vote/vote-next/src/api/socketClient.ts)
4. UI pages/hooks hiện tại vẫn giữ interface gần giống “socket” cũ để giảm thay đổi ở layer màn hình

Channel naming:

- room scope qua [src/lib/realtimeChannels.ts](/d:/my-projects/vote/vote-next/src/lib/realtimeChannels.ts)
- admin rooms channel
- owner channel
- room channel

## Data model

Collection chính:

- `admins`
- `users`
- `rooms`
- `votes`
- `realtime_channels`

### `admins`

Một admin record chính được tạo qua:

- [scripts/create-admin.js](/d:/my-projects/vote/vote-next/scripts/create-admin.js)

Fields điển hình:

- `username`
- `password`
- `fullName`
- `role`
- `createdAt`
- `updatedAt`

### `users`

Fields điển hình:

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

Fields điển hình:

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

### `votes`

Mỗi vote hiện được lưu theo cặp `roomId + userId`.

Fields điển hình:

- `roomId`
- `roomCode`
- `userId`
- `selectedIds`
- `votedAt`

## Important constraints

- Dữ liệu nghiệp vụ đi qua API routes, không ghi trực tiếp từ browser.
- Firestore rules hiện chỉ mở read cho realtime events.
- Nếu muốn đổi flow sang client-write trực tiếp, phải viết lại rules và data-access strategy.
- Nếu muốn dùng Firebase Auth sau này, đó là thay đổi kiến trúc, không phải thay đổi nhỏ.
