# Browser and home-screen icons

The chip-and-spade icon extends PokerChip Ledger's existing felt game-menu identity. It uses the incumbent deep felt (`background`, `#153e35`), gold (`primary`, `#f0cc75`) and warm paper (`card-face`, `#fff5db`) palette documented in [DESIGN.md](../DESIGN.md). This asset extension introduces no design tokens or new visual world; `PRODUCT.md`, `DESIGN.md` and `.impeccable/design.json` remain unchanged.

## Source and rebuild

[public/brand/poker-chip.svg](../public/brand/poker-chip.svg) is the editable source of truth, with a 512 × 512 viewBox and an opaque felt background. From the project root, rebuild all derived files with:

```sh
node scripts/generate-icons.mjs
```

[The generator](../scripts/generate-icons.mjs) uses Sharp to rasterize the source. Edit the source and rebuild instead of editing generated assets independently.

| Generated file | Size | Use |
| --- | --- | --- |
| `src/app/icon.svg` | Scalable, 512 × 512 viewBox | Browser icon; background receives 96-unit rounded corners |
| `src/app/favicon.ico` | 16 × 16, 32 × 32, 48 × 48 PNG frames | Conventional favicon, generated from the rounded SVG |
| `src/app/apple-icon.png` | 180 × 180 | Apple touch icon, opaque square source |
| `public/icons/poker-chip-192.png` | 192 × 192 | Manifest icon, `purpose: "any"` |
| `public/icons/poker-chip-512.png` | 512 × 512 | Manifest icon, declared separately for `any` and `maskable` |

## Metadata and masking

Next.js App Router's file metadata conventions emit the favicon, SVG `rel="icon"` and PNG `rel="apple-touch-icon"` declarations from `src/app`. [src/app/manifest.ts](../src/app/manifest.ts) serves `/manifest.webmanifest`, including the 192/512 PNG URLs, `name: "PokerChip Ledger"`, `short_name: "PokerChip"`, `start_url: "/online"` and `display: "standalone"`. Its theme and background use the existing felt color. The root viewport currently declares its separate existing theme color (`#143d33`); this extension does not change it.

The maskable PNG keeps its background full bleed so Android launchers can apply their own silhouette. The centered chip has a 178-unit radius, inside the maskable safe circle of radius 204.8 units (40% of the 512-unit canvas). Preserve that containment when modifying the chip or spade; do not bake rounded corners into the Apple or manifest PNGs.

## Verification and limits

Review disposition: **ship**, with no material fixes required for this extension.

The reviewed Chromium contact sheets are [desktop](../.impeccable/review/icons-desktop.png) (1280 × 800) and [mobile](../.impeccable/review/icons-mobile.png) (375 × 975). They show the icon at small browser sizes, 180 px, and simulated Apple/Android masks. The 64 px sample is a display-size preview, not an additional emitted file. Local binary inspection confirmed the three ICO frame sizes and the 180/192/512 PNG dimensions.

On 2026-10-04, production Chromium verification at `https://poker.yanyihan.top` confirmed the actual head declarations, manifest and icon URLs returned HTTP 200 with the expected MIME types, decoded PNG dimensions were 180/192/512, and the 512 px maskable declaration existed. These checks verify resource delivery and declarations; the contact sheets are simulations, not physical iOS or Android home-screen tests. Actual installation, launcher rendering and OS/browser caching behavior remain untested. The manifest and icons alone provide no service-worker or offline-availability guarantee.
