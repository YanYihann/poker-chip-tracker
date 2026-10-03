---
name: "PokerChip Ledger"
description: "A Balatro-inspired game menu and felt table for clear poker entry, play and chip accounting."
colors:
  primary: "#f0cc75"
  primary-container: "#ffdc8e"
  on-primary: "#2a261b"
  on-primary-container: "#373020"
  game-red: "#b83f3b"
  game-blue: "#2c618c"
  menu-ink: "#fff5e8"
  mint: "#a7d8b0"
  mint-dim: "#86b995"
  tertiary: "#ffaaa0"
  background: "#153e35"
  surface-container: "#273431"
  surface-container-high: "#35443e"
  surface-container-highest: "#44544b"
  surface-container-lowest: "#172620"
  surface-bright: "#536360"
  outline-variant: "#84998d"
  on-surface: "#f6f0dd"
  on-surface-variant: "#c1cbbd"
  table-felt: "#1d5143"
  table-edge: "#102e27"
  table-inset: "#43735b"
  card-face: "#fff5db"
  card-ink: "#22302b"
  card-red: "#b73532"
  card-back: "#ad3d38"
  card-pattern: "#f0c3a0"
  button-depth: "#0d241f"
typography:
  display:
    fontFamily: 'Bungee, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif'
    fontSize: "clamp(54px, 6.3vw, 88px)"
    fontWeight: 400
    lineHeight: 1.06
    letterSpacing: "-0.035em"
  headline:
    fontFamily: 'Bungee, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif'
    fontSize: "30px"
    fontWeight: 900
  title:
    fontFamily: 'Bungee, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif'
    fontSize: "24px"
    fontWeight: 800
  body:
    fontFamily: 'Manrope, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif'
    fontSize: "14px"
    lineHeight: 1.5
  control:
    fontFamily: 'Manrope, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif'
    fontSize: "15px"
    fontWeight: 800
  badge:
    fontFamily: 'Bungee, sans-serif'
    fontSize: "11px"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "0.02em"
rounded:
  flag: "3px"
  tab: "4px"
  seat: "5px"
  control: "6px"
  menu: "8px"
  auth: "10px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  felt-inset: "18px"
  felt: "24px"
spacing:
  "1": "4px"
  "2": "8px"
  "3": "12px"
  "4": "16px"
  "6": "24px"
  "8": "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.control}"
    rounded: "{rounded.control}"
    padding: "13px 22px"
  button-primary-hover:
    backgroundColor: "{colors.primary-container}"
  button-secondary:
    backgroundColor: "{colors.surface-container-high}"
    textColor: "{colors.on-surface}"
    typography: "{typography.control}"
    rounded: "{rounded.control}"
    padding: "13px 22px"
  button-secondary-hover:
    backgroundColor: "{colors.surface-container-highest}"
  menu-host:
    backgroundColor: "{colors.game-red}"
    textColor: "{colors.menu-ink}"
    rounded: "{rounded.menu}"
    padding: "24px"
  menu-join:
    backgroundColor: "{colors.game-blue}"
    textColor: "{colors.menu-ink}"
    rounded: "{rounded.menu}"
    padding: "24px"
  menu-local:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.menu}"
    padding: "24px"
  input:
    backgroundColor: "{colors.surface-container-lowest}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.control}"
    padding: "12px 16px"
  navigation-item:
    textColor: "{colors.on-surface-variant}"
    rounded: "{rounded.control}"
    padding: "8px 14px"
  navigation-item-active:
    backgroundColor: "{colors.surface-container-lowest}"
    textColor: "{colors.primary}"
  badge-neutral:
    backgroundColor: "{colors.surface-container-high}"
    textColor: "{colors.on-surface-variant}"
    typography: "{typography.badge}"
    rounded: "{rounded.control}"
    padding: "2px 8px"
  playing-card:
    backgroundColor: "{colors.card-face}"
    textColor: "{colors.card-ink}"
    rounded: "{rounded.control}"
    width: "32px"
    height: "48px"
  action-panel:
    backgroundColor: "{colors.surface-container}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.menu}"
    padding: "16px 16px max(16px, env(safe-area-inset-bottom))"
---

# Design System: PokerChip Ledger

## Overview

**Creative North Star: "The Felt Game Menu"**

PokerChip Ledger uses a Balatro-inspired game interface: deep green felt, charcoal control surfaces, warm paper cards and chunky colored controls. Clear actions and readable poker state set the hierarchy. This user-authorized world replaces the rejected tournament broadcast and celadon system.

Bungee gives Latin headings and numerical readouts their game character; Manrope and Chinese system fallbacks keep functional copy legible. Card fans, printed card backs and short physical press responses supply the personality. Copy stays concise: action verbs, functional nouns and rules needed to make a decision.

This is a source-derived record, not a claim of browser validation. Normative token values above come from [theme](src/styles/stitch-theme.css), [globals](src/app/globals.css), [spacing tokens](src/styles/tokens.css), [font setup](src/app/layout.tsx) and sampled components. [PRODUCT.md](PRODUCT.md) retains product truth; [the surface brief](docs/surfaces/entry-redesign.md) owns page strategy. Local scoring needs no account; synced rooms require an account and a four-digit code. Hosts choose scoring-only or server-dealt play.

**Key Characteristics:**

- Deep felt, warm card stock and charcoal control surfaces.
- Red create-room, blue join-room and gold local-scoring controls.
- Compact task forms and direct game-menu copy.
- Event-driven card and chip motion with reduced-motion paths.

## Colors

Warm gold, distinct room colors and printed card tones sit on a deep green ground.

### Primary

- **Golden action** (`primary`): primary actions, focus and active-seat labels. `primary-container` is hover fill; `on-primary` is the dark foreground.
- `on-primary-container` remains the shared theme's darker container foreground.

### Secondary

- **Create red** (`game-red`) and **join blue** (`game-blue`): the two online entry choices. The same colors mark fold and call/check on the table; explicit labels establish meaning.
- **Warm menu ink** (`menu-ink`): text on the red and blue controls.
- **Mint status** (`mint`, `mint-dim`): supporting status and positive information, separate from gold primary actions.

### Tertiary

- **Coral feedback** (`tertiary`): errors, loss and destructive feedback.
- **Printed suit red** (`card-red`): red suits on warm paper.

### Neutral

- **Deep felt ground** (`background`): page canvas; `surface` aliases this value.
- **Charcoal surfaces** (`surface-container`, `surface-container-high`, `surface-container-highest`, `surface-container-lowest`): panels, raised controls and inset fields. `surface-variant` aliases the highest level.
- **Structural stroke** (`surface-bright`) and **muted stroke** (`outline-variant`): boundaries with different emphasis.
- **Warm information** (`on-surface`) and **muted information** (`on-surface-variant`): content and support.
- `table-felt`, `table-edge` and `table-inset` belong to the playing surface.
- `card-face`, `card-ink`, `card-back` and `card-pattern` belong to authored cards.
- `button-depth` supplies the dark physical edge under controls.

**The Labeled Color Rule.** Pair every action or status color with a readable label, sign or game symbol.

## Typography

**Display / numeric font:** Bungee, loaded at weight 400. **Body font:** Manrope. Headings fall back to PingFang SC, Hiragino Sans GB, Microsoft YaHei and sans-serif for Chinese. Bungee has a single loaded weight; heavier heading declarations are recorded as authored CSS rather than additional font files.

- **Display:** the game-menu title uses the fluid frontmatter size, a slightly rotated baseline and a dark depth shadow. Below 768px it becomes 48px with 1.04 line height.
- **Headline:** compact auth headings use 30px, reduced to 26px on phones.
- **Title:** workspace titles use 24px, reduced to 21px on phones.
- **Body:** task labels and concise supporting copy use 14px; some support copy uses 12–13px. Inputs retain 16px text.
- **Control:** shared actions use 15px bold labels. Large menu controls use 25px, then 22px below 1024px and 21px below 768px.
- **Badge / table detail:** badges use 10–11px; seat names use 12px. Seat amounts use 16px, 20px on desktop, 14px on phones and 13px at 360px or narrower. These dense sizes are not general body-text defaults.
- Room-code inputs use 32px Bungee digits with 0.4em tracking. The waiting-table code uses 40px with 0.08em tracking, reduced to 32px below 768px. The desktop pot uses 42px. Amounts retain tabular numerals.

**The Readable Ledger Rule.** Keep names, balances and actions distinct; reserve dense type for the table's compact metadata.

## Layout

The workspace is capped at 1280px with 40px side gutters. Gutters become 24px below 1024px, 16px below 768px and 12px at 360px or narrower. Navigation has an 80px minimum row height; phone navigation wraps to a second row inside a 68px minimum base row.

The frontmatter spacing scale is the shared rhythm. Component-specific gaps and optical adjustments remain valid where shown by the implementation.

- The desktop game menu is a 1080px maximum composition with 1.2fr / 1fr columns and a 72px gap. Title and five-card fan accompany three vertically stacked choices. Below 768px it becomes one column; action width is capped at 420px. This composition belongs to the lobby, not every page.
- Authentication is a single centered panel capped at 440px, with 32px inner padding or 24px on phones. It has no split story panel. Room forms are capped at 540px; game-mode choices stack on phones.
- At 1024px and wider, table play uses a flexible table column plus a 320px action column, separated by 28px. Actions stick 24px below the viewport top.
- Below 1024px, the action panel stays in normal document flow after the table, capped at 520px. Bottom padding respects the safe area.
- Felt uses a 4:5 aspect ratio and a 440px wrapper on compact layouts, switching to 1.8:1 and an 820px wrapper on desktop.
- Dense seats override the aspect ratio through minimum heights: compact seats require 440px; the eighth player-seat child triggers 580px, or 540px below 768px; compact seats with hole cards require 840px, or 800px below 768px. The last applicable rule wins. These are intentional information-preserving source constraints, not a promise that a whole dense table fits in one viewport.
- Compact seats hide avatars, preserving hole cards, names, balances, positions and action state. Phone pot content narrows to 190px in compact tables.
- Profile uses two independent vertical columns in a 0.9fr / 1.1fr grid with 24px gaps; they stack below 768px with 16px gaps. Article padding is 24px, reduced to 20px on phones. Each column follows its own content height.
- Waiting rooms pair a flexible table with a 300px settings column and a 32px gap. Settings move below the table below 1024px. The table centers the room code and copy control, with available seats around its perimeter. Its felt retains a 440px minimum height, increasing for compact seat layouts.
- History content is capped at 960px. Settlement dialogs scroll internally at a maximum height of viewport height minus 48px.

## Elevation & Depth

Physical lower edges are native to this user-pinned game world. Shared buttons carry a 5px dark edge, lift to 7px on primary hover and compress to 1px on activation. Menu buttons have a 7px lower edge with a faint inset highlight, rising to 10px on hover. Panels, seats, cards and the felt use related 3–7px edges. Exact shadow strings live in the sidecar.

The page has a very faint repeating horizontal texture. Card backs use their own diagonal printed pattern. These treatments belong to felt and card material, not arbitrary decorative panels.

**The Physical Feedback Rule.** Use the dark lower edge to show a control's rest, hover and pressed state; keep the motion brief and tied to interaction.

Surface entry translates 6px over 220ms. Menu cards enter with a damped spring (stiffness 260, damping 22) and 55ms stagger. Pot changes spring once (stiffness 420, damping 22). Newly revealed community cards flip over 280ms with 60ms stagger; existing cards do not re-flip. Real wager events move chips seat-to-pot, and settlement moves them pot-to-seat over 480ms. Animation completion consumes visual events; it does not gate poker state.

Reduced-motion CSS collapses animation and transition timing. Card entrances and pot changes omit their initial movement; community cards skip the flip; chips appear at their destination and fade over 100ms. A loading skeleton's 1.2s pulse is functional loading feedback, not ornamental ambient motion.

## Shapes

Use firm rounded rectangles: 6px controls, inputs and navigation; 8px menu buttons and action panels; 10px auth shells; 5px seat ledgers; 3px seat flags. Shared spacing/radius variables remain available, but do not assume their 12px and 16px values override the specific game-control geometry.

The felt is a rounded rectangle with 24px corners and an 18px inset. Its border is 4px, or 5px on desktop. It is not the retired oval table. Circles belong to chips and avatar content where implemented. Playing cards use 6px corners, with 7px on enlarged lobby cards.

## Components

### Buttons

Chunky and direct. Shared primary/secondary controls have a 52px minimum height, gold or raised-charcoal fill, and 13px 22px padding. Primary hover changes fill and lifts; press compresses the edge. Disabled primary actions lower opacity and remove depth. Shared keyboard focus uses a 3px gold outline offset by 4px.

The three menu actions retain explicit names: Create room, Join room, Local scoring. Menu buttons are at least 100px tall on desktop and 78px on phones. They lift and tilt slightly on hover, then depress on activation. Wager buttons retain their game verbs; fold is red, call/check blue and bet/raise gold.

### Chips

Status badges use small Bungee labels, 6px corners and tinted or charcoal backgrounds with thin borders. They are metadata rather than navigation. Animated wagering chips are 20px circles with dashed warm-paper rims; red travels to the pot and blue returns on settlement.

### Cards / Containers

Auth, room forms and action panels are compact charcoal surfaces with dark lower edges. Use padding to organize tasks, without adding promotional feature cards. The auth surface has a 4px gold top border in the current source. Its existence does not establish a general rule to stripe all panels.

Playing cards are authored HTML/CSS with rank, suit and patterned backs; shared sizes are 28×40px, 32×48px and 40×56px. Accessible names describe visible, hidden and blank states. The lobby fan is decorative and hidden from assistive technology.

### Inputs / Fields

Inset charcoal fields have 2px structural borders, 6px corners, 48px minimum height and 16px text. Keep explicit labels outside inputs. Focus changes the border to gold. Password visibility uses a 44px target. The room-code field is 72px tall with centered, widely spaced digits. Error containers use coral text, a thin enclosing border and a faint tint.

### Navigation

Muted route links gain a charcoal hover background. Active routes have gold text, an inset-dark fill and a 3px lower edge, with `aria-current="page"`. Targets are at least 44px high. Product identity, language and account access remain in the top row while phone route links wrap.

### Seats and action panel

Seat ledgers separate name, stack, wager and result; acting seats use a gold border and labeled flag. Compact seats preserve the dealt cards and reduce decorative content. The panel orders utility controls, wager input, betting actions and settlement. Desktop action grids use two columns; phone actions follow the table in document order.

Waiting rooms reuse the felt and seat ledgers. Empty seats are explicit controls for moving to an available position; occupied seats retain the player identity. The centered code and copy control identify the room, while the adjacent settings panel summarizes uniform starting chips and blinds and exposes the host's start action. Seat assignment remains visible when play begins. Defaults and readiness behavior belong to the surface brief and application rules.

## Do's and Don'ts

### Do:

- **Do** use the deep felt, charcoal, paper and colored-action tokens through the shared theme.
- **Do** keep concise action labels, explicit field labels and visible keyboard focus.
- **Do** preserve local scoring without an account and distinguish scoring-only rooms from server-dealt play.
- **Do** allow dense tables to grow vertically while keeping cards and game state readable.
- **Do** keep phone actions in normal document flow and desktop actions in the right sidebar.
- **Do** tie card, pot and chip movement to entry or actual state changes and respect reduced motion.

### Don't:

- **Don't** restore the rejected broadcast/celadon identity, promotional hero or split auth story.
- **Don't** add invitation slogans, invented claims or decorative feature cards.
- **Don't** copy Balatro artwork, branding or rules; the reference governs visual and motion character.
- **Don't** use color alone to communicate a turn, outcome or action.
- **Don't** hide dealt cards to preserve an arbitrary table height.
- **Don't** add looping ornamental motion or delay a game-state update for an animation.

Source-only caveats, not canonized rules: reduced-motion CSS still permits the secondary button's active translation; reduced-motion chip fades retain their event delay. These are implementation details for review, not patterns to propagate. No browser or end-to-end validation was performed by this documentation pass.
