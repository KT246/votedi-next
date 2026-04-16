# Setup And Ops

## Required environment variables

Đọc từ [.env.example](/d:/my-projects/vote/vote-next/.env.example).

### Server-side Firebase Admin SDK

- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`

Nguồn lấy:

- Firebase Console
- Project settings
- Service accounts
- Generate new private key

Map từ service account JSON:

- `project_id` -> `FIREBASE_PROJECT_ID`
- `client_email` -> `FIREBASE_CLIENT_EMAIL`
- `private_key` -> `FIREBASE_PRIVATE_KEY`

### Client-side Firebase config

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`

Nguồn lấy:

- Firebase Console
- Project settings
- General
- Your apps
- Chọn web app

Map từ `firebaseConfig`:

- `apiKey` -> `NEXT_PUBLIC_FIREBASE_API_KEY`
- `authDomain` -> `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `projectId` -> `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `appId` -> `NEXT_PUBLIC_FIREBASE_APP_ID`

## Firestore setup

Nếu trong Firebase Console chưa thấy tab `Data`, nghĩa là project chưa tạo Firestore database.

Bước tạo:

1. Firebase Console
2. Project `votedi`
3. Firestore Database
4. `Create database`
5. Chọn region

Sau khi Firestore có rồi, mới xem được data và mới seed được document.

## Firestore rules and indexes

Repo dùng:

- [firestore.rules](/d:/my-projects/vote/vote-next/firestore.rules)
- [firestore.indexes.json](/d:/my-projects/vote/vote-next/firestore.indexes.json)
- [firebase.json](/d:/my-projects/vote/vote-next/firebase.json)

Deploy bằng Firebase CLI:

```bash
firebase deploy --only firestore:rules,firestore:indexes
```

Nếu máy chưa có CLI:

```bash
npm install -g firebase-tools
firebase login
firebase deploy --only firestore:rules,firestore:indexes
```

Hoặc dùng `npx`:

```bash
npx firebase-tools login
npx firebase-tools deploy --only firestore:rules,firestore:indexes
```

## Seed admin

Script:

```bash
node scripts/create-admin.js
```

Script này:

- load `.env`
- kết nối Firestore qua Firebase Admin SDK
- xóa các admin cũ
- tạo đúng 1 admin mới

Default values:

- `ADMIN_USERNAME=admin`
- `ADMIN_PASSWORD=admin123`
- `ADMIN_FULL_NAME=Administrator`

## Local verification checklist

Sau khi setup xong:

```bash
npm install
npx.cmd tsc --noEmit
npm.cmd run build
npm run dev
```

Kiểm tra trong Firebase Console:

- `admins` có document sau khi seed admin
- `users` có document sau khi tạo/import user
- `rooms` có document sau khi tạo phòng
- `votes` có document sau khi submit vote
- `realtime_channels` có event documents khi có thay đổi realtime

## Known operational notes

- `firebase-tools` phải cài riêng, không nằm sẵn trong repo.
- Nếu `create-admin.js` báo thiếu config, kiểm tra lại `.env`.
- Nếu `create-admin.js` báo lỗi mạng/kết nối, thường là máy hiện tại không ra được Firestore endpoint.
- Không commit service account JSON vào repo.
- Không paste private key thật vào docs hoặc chat logs công khai.
