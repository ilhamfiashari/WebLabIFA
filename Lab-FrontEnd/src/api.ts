export interface Identity { id: string; name: string; email: string; role: 'mahasiswa' | 'dosen' | 'admin'; allowed_roles?: Array<'mahasiswa' | 'dosen' | 'admin'>; home_route?: string; csrf_token: string; expires_at: string }
export class ApiError extends Error { constructor(public status: number) { super('Permintaan gagal') } }
export async function getIdentity(): Promise<Identity | null> {
  const response = await fetch('/api/me', { credentials: 'same-origin', cache: 'no-store' })
  if (response.status === 401) return null
  if (!response.ok) throw new ApiError(response.status)
  return response.json() as Promise<Identity>
}
export async function getPublicConfig(): Promise<{ support_email: string | null }> {
  const response = await fetch('/api/public/config', { cache: 'no-store' })
  if (!response.ok) throw new ApiError(response.status)
  return response.json() as Promise<{ support_email: string | null }>
}
