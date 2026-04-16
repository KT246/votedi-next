export interface RoomStatusChangedPayload {
    roomId: string;
    status: string;
    ownerAdminId?: string;
}

export interface RoomProgressUpdatedPayload {
    roomId: string;
    totalVotes: number;
    totalVoters: number;
    votedUsers: number;
    pendingUsers: number;
    lastVoterId?: string;
    ownerAdminId?: string;
}

export interface RoomResultsResetPayload {
    roomId: string;
    ownerAdminId?: string;
}
