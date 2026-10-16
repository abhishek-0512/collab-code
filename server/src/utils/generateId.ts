import crypto from 'node:crypto';

export function generateRoomId(): string {
  return crypto.randomUUID().replace(/-/g, '').substring(0, 10);
}

export function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export function generateUserColor(): string {
  const colors = [
    '#f87171', '#fb923c', '#fbbf24', '#34d399',
    '#38bdf8', '#818cf8', '#c084fc', '#f472b6',
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}
