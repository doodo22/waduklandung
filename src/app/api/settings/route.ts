import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, isAdmin } from '@/lib/auth-helpers';

// GET /api/settings — Return all settings (any authenticated user)
export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const settings = await db.settings.findMany({
      orderBy: { key: 'asc' },
    });

    // Convert to key-value map for easy access
    const settingsMap: Record<string, { value: string; description: string | null }> = {};
    for (const setting of settings) {
      settingsMap[setting.key] = {
        value: setting.value,
        description: setting.description,
      };
    }

    return NextResponse.json({ settings: settingsMap, raw: settings });
  } catch (error) {
    console.error('Settings GET error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}

// PUT /api/settings — Update a setting (Admin only)
export async function PUT(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isAdmin(authUser.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { key, value } = await request.json();

    if (!key || value === undefined) {
      return NextResponse.json({ error: 'key dan value wajib diisi' }, { status: 400 });
    }

    const setting = await db.settings.upsert({
      where: { key },
      update: { value: String(value) },
      create: { key, value: String(value) },
    });

    return NextResponse.json({ setting });
  } catch (error) {
    console.error('Settings PUT error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
