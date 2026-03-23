import { createClient } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!

  if (!code || !state) {
    return NextResponse.redirect(`${appUrl}/dashboard?drive=error`)
  }

  const userId = Buffer.from(state, 'base64').toString()

  // Exchange code for tokens
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: appUrl + '/api/drive/callback',
      grant_type: 'authorization_code',
    }),
  })

  if (!tokenRes.ok) {
    return NextResponse.redirect(`${appUrl}/dashboard?drive=error`)
  }

  const { access_token, refresh_token, expires_in } = await tokenRes.json()

  // Find Gemini folder (Meet Recordings or Meeting Notes)
  let gemini_folder_id: string | null = null
  try {
    const folderQuery = "mimeType='application/vnd.google-apps.folder' and (name='Meet Recordings' or name='Meeting Notes')"
    const folderUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(folderQuery)}&fields=files(id,name)`
    console.log('[drive/callback] Searching for folder with query:', folderQuery)

    const folderRes = await fetch(folderUrl, {
      headers: { Authorization: `Bearer ${access_token}` },
    })

    console.log('[drive/callback] Folder search status:', folderRes.status)

    if (folderRes.ok) {
      const folderData = await folderRes.json()
      console.log('[drive/callback] Folder search result:', JSON.stringify(folderData))
      gemini_folder_id = folderData.files?.[0]?.id ?? null
      console.log('[drive/callback] gemini_folder_id set to:', gemini_folder_id)
    } else {
      const errText = await folderRes.text()
      console.log('[drive/callback] Folder search error body:', errText)
    }
  } catch (err) {
    console.log('[drive/callback] Folder search threw:', err)
    // Non-fatal — user can set folder later
  }

  const supabase = await createClient()
  await supabase.from('drive_connections').upsert(
    {
      user_id: userId,
      access_token,
      refresh_token,
      token_expires_at: new Date(Date.now() + expires_in * 1000).toISOString(),
      gemini_folder_id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  )

  return NextResponse.redirect(`${appUrl}/dashboard?drive=connected`)
}
