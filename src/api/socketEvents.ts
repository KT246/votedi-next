export interface RoomStatusChangedPayload {
    roomId: string;
    status: string;
    ownerAdminId?: string;
}

export interface VoteNewPayload {
    roomId: string;
    candidateId: string;
    voteCount: number;
}

export interface RoomProgressUpdatedPayload {
    roomId: string;
    totalVotes: number;
    totalVoters: number;
    votedUsers: number;
    pendingUsers: number;
    lastVoterId?: string;
}

export interface RoomResultsResetPayload {
    roomId: string;
}
