export interface RoomStatusChangedPayload {
    roomId: string;
    status: string;
    ownerAdminId?: string;
}

export interface RoomResultsResetPayload {
    roomId: string;
    ownerAdminId?: string;
}
