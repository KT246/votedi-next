import type { SyntheticEvent } from 'react';

function extractDriveFileId(input: string): string | null {
    try {
        const url = new URL(input);
        const host = url.hostname.toLowerCase();
        if (!host.includes('drive.google.com')) {
            return null;
        }

        const directId = url.searchParams.get('id');
        if (directId) {
            return directId;
        }

        const parts = url.pathname.split('/').filter(Boolean);
        const dIndex = parts.indexOf('d');
        if (dIndex >= 0 && parts[dIndex + 1]) {
            return parts[dIndex + 1];
        }
    } catch {
        // Keep fallback regex below for non-standard URLs.
    }

    const match = input.match(/\/d\/([a-zA-Z0-9_-]+)/) || input.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    return match?.[1] || null;
}

function getDriveViewUrl(id: string): string {
    return `https://drive.google.com/uc?export=view&id=${id}`;
}

function getDriveCdnUrl(id: string): string {
    return `https://lh3.googleusercontent.com/d/${id}=w1200`;
}

function getDriveThumbUrl(id: string): string {
    return `https://drive.google.com/thumbnail?id=${id}&sz=w1200`;
}

function getDriveCandidates(id: string): string[] {
    return [getDriveThumbUrl(id), getDriveViewUrl(id), getDriveCdnUrl(id)];
}

export function getAvatarFallback(seed = 'candidate'): string {
    const text = String(seed || 'C').trim().slice(0, 2).toUpperCase();
    const bg = '#E0E7FF';
    const fg = '#3730A3';
    const svg =
        `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">` +
        `<rect width="128" height="128" rx="24" fill="${bg}"/>` +
        `<text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="${fg}" font-family="Arial, sans-serif" font-size="44" font-weight="700">${text}</text>` +
        `</svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function toDisplayAvatarUrl(avatar?: string, seed = 'candidate'): string {
    const value = String(avatar || '').trim();
    if (!value) {
        return getAvatarFallback(seed);
    }

    const driveId = extractDriveFileId(value);
    if (driveId) {
        return getDriveThumbUrl(driveId);
    }

    return value;
}

export function onAvatarError(event: SyntheticEvent<HTMLImageElement>, seed = 'candidate') {
    const img = event.currentTarget;
    const driveId = extractDriveFileId(img.src);
    if (driveId) {
        const attempts = getDriveCandidates(driveId);
        const currentIndex = attempts.findIndex((url) => url === img.src);
        const startIndex = currentIndex >= 0 ? currentIndex + 1 : Number(img.dataset.avatarAttempt || '0');
        if (startIndex < attempts.length) {
            img.dataset.avatarAttempt = String(startIndex + 1);
            img.src = attempts[startIndex];
            return;
        }
    }
    img.src = getAvatarFallback(seed);
}
