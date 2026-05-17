import { NextResponse } from 'next/server'
import { searchUpstoxInstruments } from '@/lib/upstox-instruments'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get('q')?.trim() ?? ''
  if (q.length < 2) {
    return NextResponse.json({ error: 'Query must be at least 2 characters' }, { status: 400 })
  }

  try {
    const results = await searchUpstoxInstruments(q, 20)
    return NextResponse.json({ results })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('[api/instruments/search]', message, e)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
