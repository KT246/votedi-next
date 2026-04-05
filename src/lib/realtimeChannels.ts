function normalizeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : String(value || "").trim();
}

export function roomChannel(roomId: unknown): string {
  const normalizedRoomId = normalizeString(roomId);
  return normalizedRoomId ? `room-${normalizedRoomId}` : "";
}

export function ownerChannel(ownerAdminId: unknown): string {
  const normalizedOwnerId = normalizeString(ownerAdminId);
  return normalizedOwnerId ? `owner-${normalizedOwnerId}` : "";
}

export function adminRoomsChannel(): string {
  return "admin-rooms";
}

export function toRealtimeChannelName(scope: unknown): string {
  const normalizedScope = normalizeString(scope);
  if (!normalizedScope) return "";

  if (normalizedScope === "admin:rooms") {
    return adminRoomsChannel();
  }

  if (normalizedScope.startsWith("owner:")) {
    return ownerChannel(normalizedScope.slice("owner:".length));
  }

  if (normalizedScope.startsWith("room:")) {
    return roomChannel(normalizedScope.slice("room:".length));
  }

  return roomChannel(normalizedScope);
}
