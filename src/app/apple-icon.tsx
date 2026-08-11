import { ImageResponse } from 'next/og'
import { pawSvg, BRAND_BG } from '@/lib/brand'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  const pawUri = `data:image/svg+xml;utf8,${encodeURIComponent(pawSvg('#ffffff'))}`
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
        <img width={104} height={104} src={pawUri} alt="" />
      </div>
    ),
    { ...size },
  )
}
