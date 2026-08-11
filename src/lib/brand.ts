// Shared brand marks. The paw matches the lucide `PawPrint` used in the header.
export const BRAND_BG = '#0a0a0a'
export const BRAND_FG = '#ffffff'

// White paw on a transparent background (for compositing on the brand tile).
export function pawSvg(color = BRAND_FG): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
<g fill="${color}">
<ellipse cx="11" cy="11.5" rx="2.4" ry="3.1"/>
<ellipse cx="21" cy="11.5" rx="2.4" ry="3.1"/>
<ellipse cx="6.8" cy="17.2" rx="2.1" ry="2.7"/>
<ellipse cx="25.2" cy="17.2" rx="2.1" ry="2.7"/>
<path d="M16 15.2c-3.4 0-6.2 2.5-6.2 5.4 0 2.2 1.8 3.5 3.8 3.5 1.1 0 1.8-.45 2.4-.45s1.3.45 2.4.45c2 0 3.8-1.3 3.8-3.5 0-2.9-2.8-5.4-6.2-5.4z"/>
</g>
</svg>`
}

// A rounded brand tile with a centered paw — used for the app icons.
export function brandTileSvg(size: number): string {
  const pad = Math.round(size * 0.22)
  const inner = size - pad * 2
  const radius = Math.round(size * 0.22)
  const pawDataUri = `data:image/svg+xml;utf8,${encodeURIComponent(pawSvg(BRAND_FG))}`
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
<rect width="${size}" height="${size}" rx="${radius}" fill="${BRAND_BG}"/>
<image href="${pawDataUri}" x="${pad}" y="${pad}" width="${inner}" height="${inner}"/>
</svg>`
}
