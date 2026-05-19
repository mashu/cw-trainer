# App icons

- **`icon.svg`** — source icon (512×512 viewBox). Regenerate PNGs after editing (see below).
- **`icon-192.png`**, **`icon-512.png`** — raster icons for PWA / GNOME / Android launchers (required for desktop shortcuts).
- **`favicon.svg`** — small variant. The app also uses **`app/icon.svg`** for the browser tab (Next.js picks it up automatically).

## Regenerate PNGs from SVG

```bash
inkscape public/icon.svg -w 192 -h 192 -o public/icon-192.png
inkscape public/icon.svg -w 512 -h 512 -o public/icon-512.png
```
