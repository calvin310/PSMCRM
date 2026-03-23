import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

export async function GET() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(`${appUrl}/login`)
  }

  const { data: connection } = await supabase
    .from('drive_connections')
    .select('access_token')
    .eq('user_id', user.id)
    .single()

  if (!connection) {
    return NextResponse.redirect(`${appUrl}/dashboard`)
  }

  const folderRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
      "mimeType='application/vnd.google-apps.folder' and name='Meet Recordings'"
    )}&fields=files(id,name)`,
    { headers: { Authorization: `Bearer ${connection.access_token}` } }
  )

  if (!folderRes.ok) {
    const errText = await folderRes.text()
    console.log('[drive/reconnect] Folder search failed:', folderRes.status, errText)
    return new NextResponse(
      `<html><body style="font-family:sans-serif;padding:2rem">
        <h2>Folder search failed</h2>
        <p>Google Drive returned an error (${folderRes.status}). Your access token may have expired — try <a href="/api/drive/connect">reconnecting Drive</a>.</p>
      </body></html>`,
      { status: 500, headers: { 'Content-Type': 'text/html' } }
    )
  }

  const folderData = await folderRes.json()
  const folder = folderData.files?.[0]

  if (!folder) {
    return new NextResponse(
      `<html><body style="font-family:sans-serif;padding:2rem">
        <h2>Folder not found</h2>
        <p>Make sure a folder named <strong>Meet Recordings</strong> exists in your Google Drive, then <a href="/api/drive/reconnect">try again</a>.</p>
      </body></html>`,
      { status: 200, headers: { 'Content-Type': 'text/html' } }
    )
  }

  await supabase
    .from('drive_connections')
    .update({ gemini_folder_id: folder.id, updated_at: new Date().toISOString() })
    .eq('user_id', user.id)

  return NextResponse.redirect(`${appUrl}/dashboard?drive=reconnected`)
}
