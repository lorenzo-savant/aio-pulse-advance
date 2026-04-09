import { getCurrentUserId, AuthError } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

export async function requireAuth(
  req: NextRequest,
): Promise<{ userId: string; error: null } | { userId: null; error: NextResponse }> {
  try {
    const userId = await getCurrentUserId(
      req.headers.get('authorization'),
      req.headers.get('cookie'),
    )
    return { userId, error: null }
  } catch (e) {
    if (e instanceof AuthError) {
      return {
        userId: null,
        error: NextResponse.json({ success: false, message: e.message }, { status: 401 }),
      }
    }
    return {
      userId: null,
      error: NextResponse.json(
        { success: false, message: 'Authentication failed' },
        { status: 401 },
      ),
    }
  }
}
