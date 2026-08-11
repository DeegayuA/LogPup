import { ImageResponse } from 'next/og'
import { pawSvg, BRAND_BG } from '@/lib/brand'

export const dynamic = 'force-static'

// Generates the PWA manifest icons on demand: /pwa-icon?size=192 | 512.
// Paw is centered at ~56% so it survives Android's maskable safe-zone crop.
export function GET(request: Request) {
  const requested = Number(new URL(request.url).searchParams.get('size'))
  const size = requested === 192 || requested === 512 ? requested : 512
  const pawUri = `data:image/svg+xml;utf8,${encodeURIComponent(pawSvg('#ffffff'))}`
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
