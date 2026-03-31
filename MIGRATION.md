# Migration Guide: React + NestJS to Next.js

## Current Status
- **Backend**: NestJS (unchanged) - keep running on port 3333
- **Frontend**: Next.js 16.2.1 with App Router, TypeScript, Tailwind CSS 4.x
- **Database**: MongoDB (unchanged)
- **Auth**: JWT with access/refresh tokens (unchanged backend)

## What's Been Migrated

### ✅ Core Infrastructure
1. **Project Setup**: Next.js with TypeScript, Tailwind CSS
2. **State Management**: Zustand stores (authStore, adminAuthStore) adapted for SSR
3. **API Client**: Axios instance with interceptors (adapted for Next.js environment)
4. **Internationalization**: i18next with Lao translations
5. **Type Definitions**: All TypeScript interfaces migrated
6. **Hooks**: useAdminRole, useRoomSocket (needs socket events)

### ✅ Pages (Partial)
1. Landing Page (`/`)
2. Voter Login (`/login`)
3. Admin Login (`/admin/login`)
4. Admin Dashboard (`/admin/dashboard`) - basic stats
5. Admin Layout with navigation

### ✅ Components
1. `AdminRoute` - protected route for admin pages
2. `ProtectedUserRoute` - protected route for voter pages
3. `ForceChangePasswordModal` - password change modal
4. `ModalShell` - reusable modal component

## Remaining Migration Tasks

### Pages to Migrate (from `votedi/src/pages/` and `votedi/src/admin/pages/`)

#### Voter Pages:
1. `MyRoomsPage` → `/my-rooms/page.tsx`
2. `VoteRoomPage` → `/vote-room/[roomCode]/page.tsx`
3. `ResultPage` → `/vote-room/[roomCode]/result/page.tsx`

#### Admin Pages:
1. `VoteRoomListPage` → `/admin/vote-rooms/page.tsx`
2. `VoteRoomCreatePage` → `/admin/vote-rooms/create/page.tsx`
3. `VoteRoomDetailPage` → `/admin/vote-rooms/[roomId]/page.tsx`
4. `AdminManagementPage` → `/admin/admins/page.tsx`
5. `UserManagementPage` → `/admin/users/page.tsx`
6. `ChangePasswordPage` → `/admin/change-password/page.tsx`

### Components to Migrate (from `votedi/src/components/` and `votedi/src/admin/components/`)
- `CandidateCard`, `ResultBoard`, `RoomHeader`, `VoteConfirmModal`, `VoteStatusCard`
- `ImagePreviewModal`, `DialogHost`
- UI components: `EmptyState`, `ErrorState`, `LoadingState`, `PageHeader`, `StatusBadge`, `ToastMessage`
- Admin components: `AdminRoute` (already done), various room detail tabs

### API Integration
- Update API endpoints if needed (current backend API is unchanged)
- Ensure socket.io integration works with Next.js (may need custom server)
- Handle file uploads (Excel/CSV import) using Next.js API routes or keep backend

### Real-time Features
- Socket.io client is already set up
- Need to test WebSocket connections in Next.js environment
- Consider using Server-Sent Events as alternative for simpler deployment

### Database Considerations
- Keep MongoDB with Mongoose (no changes needed)
- Consider Prisma for better type safety (optional)

## How to Continue Migration

### Step 1: Copy and Adapt Components
For each component in `votedi/src/components/`:
1. Copy to `vote-next/src/components/`
2. Replace `react-router-dom` imports with `next/navigation`
3. Replace `import.meta.env` with `process.env.NEXT_PUBLIC_`
4. Ensure `"use client"` directive for client components

### Step 2: Create Pages
For each page in `votedi/src/pages/` and `votedi/src/admin/pages/`:
1. Create corresponding file in `vote-next/src/app/` directory
2. Wrap with appropriate route protection (`AdminRoute`, `ProtectedUserRoute`)
3. Update navigation using Next.js router

### Step 3: Test API Integration
1. Ensure backend is running on `http://localhost:3333`
2. Set `NEXT_PUBLIC_API_URL=http://localhost:3333/api` in `.env`
3. Test authentication flow (admin login, voter login)

### Step 4: Deploy
1. Build production: `npm run build`
2. Set environment variables for production
3. Deploy to Vercel or your preferred platform

## Environment Variables
Create `.env.local` in `vote-next/`:
```
NEXT_PUBLIC_API_URL=http://localhost:3333/api
```

For production:
```
NEXT_PUBLIC_API_URL=https://your-api-domain.com/api
```

## Running the Project
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
npm run start
```

## Notes
- The NestJS backend remains unchanged - continue running separately
- WebSocket connections may need CORS configuration in backend
- For SSR/SSG, consider which pages need server-side data fetching
- Use Next.js API routes for any new backend functionality

## Next Steps
1. Migrate remaining pages following the pattern of existing pages
2. Add real-time updates using socket.io
3. Implement file import/export features
4. Add comprehensive error handling and loading states
5. Set up CI/CD pipeline
6. Consider adding NextAuth.js for more robust authentication (optional)