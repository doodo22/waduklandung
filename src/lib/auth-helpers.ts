import { NextRequest } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { db } from '@/lib/db';

export async function getAuthUser(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.split(' ')[1];
  const userId = verifyToken(token);
  if (!userId) return null;

  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      name: true,
      role: true,
      status: true,
      phone: true,
      address: true,
      familyId: true,
    },
  });

  if (!user || user.status !== 'ACTIVE') return null;
  return user;
}

export function isAdmin(role: string): boolean {
  return ['KETUA_RT', 'SEKRETARIS', 'BENDAHARA', 'PENGURUS'].includes(role);
}
