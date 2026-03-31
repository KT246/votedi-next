export interface User {
    id: string;
    username: string;
    fullName: string;
    studentId?: string;
    mustChangePassword?: boolean;
    createdByAdminId?: string;
}

export interface OfficerPermissions {
    canChangeStatus: boolean;      // open/close/pending/draft
    canManageCandidates: boolean;  // add/edit/delete candidates
    canManageUsers: boolean;       // import / manage voters
    canViewResults: boolean;       // see Results tab
    canExportCsv: boolean;         // download CSV
    canCreateRooms: boolean;       // create new rooms
}

export const DEFAULT_OFFICER_PERMISSIONS: OfficerPermissions = {
    canChangeStatus: false,
    canManageCandidates: false,
    canManageUsers: false,
    canViewResults: true,
    canExportCsv: true,
    canCreateRooms: false,
};

export interface AdminUser {
    id: string;
    username: string;
    fullName: string;
    role: string;              // single admin account
    password?: string;
    createdByAdminId?: string;
    permissions?: OfficerPermissions;
}

export interface Candidate {
    id: string;
    name: string;
    title: string;
    date?: string;
    bio?: string[];
    shortBio: string;
    fullProfile: string;
    avatar: string;
    achievements?: string[];
    voteCount?: number;
}

export type VoteStatus = 'draft' | 'pending' | 'open' | 'closed';

export interface VoteRoom {
    id: string;
    roomCode: string;
    roomName: string;
    description: string;
    startTime: string | null;
    endTime: string | null;
    timeMode?: 'range' | 'duration';
    durationMinutes?: number;
    voteType: 'single' | 'multi' | 'option';
    maxSelection: number;
    status: VoteStatus;
    allowResultView: boolean;
    candidates: string[] | any[];
    allowedUsers: string[] | any[];
    ownerAdminId?: string;  // which admin owns this room
    createdAt?: string;
    updatedAt?: string;
}

export interface VoteResult {
    candidateId: string;
    voteCount: number;
}

export interface VoteRecord {
    userId: string;
    roomId: string;
    selectedIds: string[];
    submittedAt: string;
}
