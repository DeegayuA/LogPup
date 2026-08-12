import { ImageResponse } from 'next/og'
import { pawSvg, BRAND_BG } from '@/lib/brand'

export const dynamic = 'force-static'

// Generates the PWA manifest icons on demand: /pwa-icon?size=120 | 192 | 512.
// Paw is centered at ~56% so it survives Android's maskable safe-zone crop.
// 120 is not a manifest size: it is the square LogPup logo the Google OAuth
// consent screen requires (120x120 PNG, under 1 MB). Generating it from the
// same paw as every other icon is what keeps the consent screen, the installed
// app, and the site showing one mark — which is what brand verification is
// checking for. Download it from /pwa-icon?size=120 and upload that file.
export function GET(request: Request) {
  const requested = Number(new URL(request.url).searchParams.get('size'))
  const size = requested === 120 || requested === 192 || requested === 512 ? requested : 512
  const pawUri = `data:image/svg+xml;utf8,${encodeURIComponent(pawSvg())}`
  const paw = Math.round(size * 0.56)
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: BRAND_BG,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img width={paw} height={paw} src={pawUri} alt="" />
      </div>
    ),
    { width: size, height: size },
  )
}
