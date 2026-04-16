# Read First

## Bắt buộc đọc trước khi sửa code

Repo này **không còn** đi theo flow cũ:

- Không dùng `MongoDB`
- Không dùng `Pusher`
- Không dùng `Firebase Auth`
- Không dùng `Firebase Storage`
- Không dùng upload ảnh lên Firebase

Repo này **đang dùng**:

- `Next.js 16`
- `Firestore` để lưu document
- `Firebase Admin SDK` cho server-side API routes
- `Firebase Web SDK` cho client-side realtime bằng `onSnapshot`
- JWT auth tự quản trong app
- Ảnh/avatar theo flow hiện tại lấy từ Google Drive hoặc URL ngoài

## Những thay đổi đã làm

Đã migrate từ `MongoDB + Pusher` sang `Firestore + Firestore realtime`.

Các file hạ tầng chính:

- [src/lib/firebaseAdmin.ts](/d:/my-projects/vote/vote-next/src/lib/firebaseAdmin.ts)
- [src/lib/firebaseClient.ts](/d:/my-projects/vote/vote-next/src/lib/firebaseClient.ts)
- [src/lib/firestoreData.ts](/d:/my-projects/vote/vote-next/src/lib/firestoreData.ts)
- [src/api/socketClient.ts](/d:/my-projects/vote/vote-next/src/api/socketClient.ts)
- [src/lib/realtimeEmitter.ts](/d:/my-projects/vote/vote-next/src/lib/realtimeEmitter.ts)
- [scripts/create-admin.js](/d:/my-projects/vote/vote-next/scripts/create-admin.js)

Các route handlers đã được đổi sang Firestore:

- `src/app/api/auth/**`
- `src/app/api/users/**`
- `src/app/api/rooms/**`
- `src/app/api/admin/profile/route.ts`

## Điều không được giả định sai

- `authDomain` trong Firebase config **không có nghĩa** app dùng Firebase Auth.
- `NEXT_PUBLIC_FIREBASE_*` chỉ để browser kết nối Firestore realtime.
- `FIREBASE_*` là biến server-only để API routes truy cập Firestore.
- Dữ liệu nghiệp vụ không nên được đọc/ghi trực tiếp từ client, trừ realtime channel events.

## Trạng thái kỹ thuật hiện tại

Tại thời điểm viết docs này:

- `npx.cmd tsc --noEmit`: pass
- `npm.cmd run build`: pass
- `node scripts/create-admin.js`: đã seed được admin khi Firestore/credentials hoạt động

## Trước khi tiếp tục làm gì

Phải kiểm tra các file này:

- [.env](/d:/my-projects/vote/vote-next/.env)
- [firestore.rules](/d:/my-projects/vote/vote-next/firestore.rules)
- [firestore.indexes.json](/d:/my-projects/vote/vote-next/firestore.indexes.json)
- [firebase.json](/d:/my-projects/vote/vote-next/firebase.json)

Nếu định refactor data layer hoặc realtime, phải đọc tiếp [01-ARCHITECTURE.md](/d:/my-projects/vote/vote-next/docs/01-ARCHITECTURE.md).
