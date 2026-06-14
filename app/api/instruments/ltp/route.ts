import { NextResponse } from 'next/server'
import { fetchUpstoxLtp } from '@/lib/upstox'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: Request) {
  const key = new URL(request.url).searchParams.get('instrument_key')?.trim() ?? ''
  if (!key) {
    return NextResponse.json({ error: 'instrument_key is required' }, { status: 400 })
  }

  try {
    const map = await fetchUpstoxLtp([key])
    const ltp = map[key]
    if (ltp === undefined || Number.isNaN(ltp)) {
      return NextResponse.json({ error: 'No LTP returned for this instrument' }, { status: 404 })
    }
    return NextResponse.json({ ltp })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('[api/instruments/ltp]', message, e)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
