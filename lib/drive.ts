import { createClient } from '@/lib/supabase-server'

export async function refreshAccessToken(refreshToken: string, userId: string) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  })

  if (!res.ok) {
    throw new Error(`Token refresh failed: ${res.status}`)
  }

  const data = await res.json()
  const { access_token, expires_in } = data

  const supabase = await createClient()
  await supabase
    .from('drive_connections')
    .update({
      access_token,
      token_expires_at: new Date(Date.now() + expires_in * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)

  return { access_token, expires_in }
}

async function fetchDriveQuery(
  accessToken: string,
  query: string
): Promise<Array<{ id: string; name: string; createdTime: string }>> {
  const params = new URLSearchParams({
    q: query,
    fields: 'files(id,name,createdTime)',
    orderBy: 'createdTime desc',
    // Required to see files in shared drives and files shared with the user
    includeItemsFromAllDrives: 'true',
    supportsAllDrives: 'true',
  })

  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?${params.toString()}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )

  if (res.status === 401) throw new Error('token_expired')
  if (!res.ok) throw new Error(`Drive files fetch failed: ${res.status}`)

  const data = await res.json()
  return data.files ?? []
}

export async function getDriveFiles(
  accessToken: string,
  folderId: string,
  afterDate: string,
  refreshToken?: string,
  userId?: string
): Promise<Array<{ id: string; name: string; createdTime: string }>> {
  const baseFilter = `mimeType='application/vnd.google-apps.document' and (name contains 'Notes from' or name contains 'Notes by Gemini') and createdTime > '${afterDate}'`

  try {
    // Query 1: files inside the configured Gemini folder (owned or shared drive)
    const folderQuery = `'${folderId}' in parents and ${baseFilter}`

    // Query 2: files shared directly with the user (e.g. meeting owned by someone else)
    const sharedQuery = `sharedWithMe = true and ${baseFilter}`

    const [folderFiles, sharedFiles] = await Promise.all([
      fetchDriveQuery(accessToken, folderQuery),
      fetchDriveQuery(accessToken, sharedQuery),
    ])

    // Merge and deduplicate by file ID
    const seen = new Set<string>()
    const merged: Array<{ id: string; name: string; createdTime: string }> = []
    for (const file of [...folderFiles, ...sharedFiles]) {
      if (!seen.has(file.id)) {
        seen.add(file.id)
        merged.push(file)
      }
    }

    // Sort by createdTime descending
    return merged.sort(
      (a, b) => new Date(b.createdTime).getTime() - new Date(a.createdTime).getTime()
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : ''

    // Retry once with a fresh token on auth failure
    if (msg === 'token_expired' && refreshToken && userId) {
      const { access_token: newToken } = await refreshAccessToken(refreshToken, userId)
      return getDriveFiles(newToken, folderId, afterDate)
    }

    throw err
  }
}

export async function exportFileAsText(accessToken: string, fileId: string): Promise<string> {
  const params = new URLSearchParams({ mimeType: 'text/plain' })
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}/export?${params.toString()}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )

  if (res.status === 401) {
    throw new Error('token_expired')
  }

  if (!res.ok) {
    throw new Error(`File export failed: ${res.status}`)
  }

  return res.text()
}
