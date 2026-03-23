// IMPORTANT: Before this works, add Google Calendar API scope in
// Google Cloud Console → APIs & Services → OAuth consent screen →
// Data Access → Add scope: https://www.googleapis.com/auth/calendar.readonly
// Also enable Calendar API in APIs & Services → Library

import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(new URL('/login', process.env.NEXT_PUBLIC_APP_URL))
  }

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: process.env.NEXT_PUBLIC_APP_URL + '/api/calendar/callback',
    response_type: 'code',
    access_type: 'offline',
    prompt: 'consent',
    scope: 'openid email https://www.googleapis.com/auth/calendar.readonly',
    state: Buffer.from(user.id).toString('base64'),
  })

  return NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
  )
}
