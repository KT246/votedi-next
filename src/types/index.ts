export interface User {
    id: string;
    fullName: string;
    studentId: string;
    avatar?: string;
    mustChangePassword?: boolean;
    createdByAdminId?: string;
}

export interface AdminUser {
    id: string;
    username: string;
    fullName: string;
    role: string;              // single admin account
    password?: string;
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
    candidates: string[] | unknown[];
    allowedUsers: string[] | unknown[];
    ownerAdminId?: string;  // which admin owns this room
    createdAt?: string;
    updatedAt?: string;
}

export interface VoteResult {
    candidateId: string;
    voteCount: number;
}

export interface VoteParticipationRow {
    userId: string;
    studentId: string;
    fullName: string;
    hasVoted: boolean;
    selectedIds: string[];
    submittedAt: string | null;
}

export interface VoteResultsResponse {
    results: VoteResult[];
    participation: {
        eligibleCount: number;
        votedCount: number;
        notVotedCount: number;
        rows: VoteParticipationRow[];
    };
}

export interface VoteRecord {
    userId: string;
    roomId: string;
    selectedIds: string[];
    submittedAt: string;
}
