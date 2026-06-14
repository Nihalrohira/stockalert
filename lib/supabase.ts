import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Normalizes project URL if `.env.local` mistakenly includes `/rest/v1/`
 * (the JS client appends API paths itself).
 */
function normalizeSupabaseUrl(raw: string): string {
  return raw.replace(/\/rest\/v1\/?$/i, '').replace(/\/$/, '')
}

// Static `process.env.NEXT_PUBLIC_*` keys so Next can inline them in the client bundle.
const supabaseUrlRaw = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKeyRaw = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const supabaseUrl = supabaseUrlRaw ? normalizeSupabaseUrl(supabaseUrlRaw) : ''
const supabaseAnonKey = supabaseAnonKeyRaw ?? ''

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. Add them to .env.local in the project root and restart `next dev` / rebuild.'
  )
}

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey)
