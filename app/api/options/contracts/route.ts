import { NextResponse } from 'next/server'
import { resolveUnderlyingInstrumentKey } from '@/lib/options-underlyings'
import { fetchOptionContracts } from '@/lib/upstox-options'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const underlying = url.searchParams.get('underlying')?.trim().toUpperCase() ?? ''
  const expiryDate = url.searchParams.get('expiry_date')?.trim() || undefined

  if (!underlying) {
    return NextResponse.json({ error: 'underlying is required' }, { status: 400 })
  }

  const instrumentKey = resolveUnderlyingInstrumentKey(underlying)
  if (!instrumentKey) {
    return NextResponse.json(
      { error: 'Unsupported underlying. Use NIFTY, BANKNIFTY, FINNIFTY, or MIDCPNIFTY.' },
      { status: 400 },
    )
  }

  try {
    const contracts = await fetchOptionContracts(instrumentKey, expiryDate, underlying)
    return NextResponse.json({ ok: true, contracts })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('[api/options/contracts]', message, e)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
