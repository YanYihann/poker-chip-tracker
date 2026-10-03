# Entry and table redesign

Mode: Operate. Local and online Texas Hold’em remain equally accessible. Code-first implementation, as previously selected by the user.

## Direction contract

THESIS: A playable game interface with direct controls and concise labels. Replace the rejected promotional hero, split authentication story, repeated feature cards and vague invitation copy.

OWN-WORLD: The user explicitly pinned Balatro as the reference for visual and motion logic. Deep green felt (#153e35), dark control surfaces (#273431), warm paper cards (#fff5db), red and blue room buttons, golden primary action. Bungee display lettering and numeric readouts; Manrope body with legible CJK system fallback. Chunky 5–7px button depth is intentional game UI feedback under this pinned reference, not a generic dashboard decoration. No copied Balatro artwork, branding or game rules.

STORY: Choose Create room, Join room or Local scoring. Authentication returns to the requested route. Create chooses online dealing or synced scoring; Join accepts a four-digit code. Local setup chooses seats and stacks, then preserves the existing betting and settlement rules. Profile and history stay secondary.

FIRST VIEWPORT: Desktop lobby has a large game title and five-card fan beside three functional menu actions. Mobile uses one column with all three actions. Auth uses a compact centered form; no marketing headline. Table uses a flat rounded rectangular felt surface with player seats around the perimeter; desktop actions at the right, mobile actions in normal document flow below the table.

FORM: User-pinned Balatro direction supersedes earlier broadcast seed 8ca99aed and its split hero. No new random direction tournament or comp approval applies: the user explicitly requested the reference and code-first preference persists. Public reference inspected: https://www.playstack.com/games/balatro and its official game screenshot. This is an interpretation of its chunky type, green field and direct game controls, not a screenshot replica.

MOTION: Five-card entrance with a short stagger and damped spring; buttons lift on hover and depress on activation; actual wager events move outlined chips from seat to pot and settlement sends them back; pot amounts spring once when their value changes; new community cards flip with 60ms stagger. No looping ornamental motion. Reduced-motion preference removes movement or uses immediate state changes. State updates never wait for animation.

COPY: Functional nouns, action verbs and necessary rules only. No slogans, invitations, fake social proof or phrases such as ‘下一场，怎么开’, ‘好牌局，从这里开始’, ‘为你留一个座位’. Rules and limits that help a decision are retained.

## Validation boundary

Rule logic, backend transport and saved sessions remain intact. UI smoke testing uses an isolated local API fixture, explicitly synthetic; local gameplay uses real client rules. Production health and unauthenticated route checks are read-only. Review and final design documentation are required before this iteration is complete.

## Room entry and profile refinement — 2026-10-03

User requirements: remove the profile grid's large holes; host sets identical starting chips and small/big blinds before generating a room code; the waiting room is a seat-selectable table; all members automatically ready; host start opens the game for every member. Follow-up: default player count is four. Existing saved room capacity is retained.

The profile uses two independent columns on desktop and one stacked column on mobile. Waiting uses the shared PokerTable presentation with room code at center and settings alongside (below at tablet/mobile widths). Empty-seat controls move the requesting player; occupied seats cannot be stolen. Chosen seat indices persist in the active table. One host action starts; no individual ready or buy-in controls remain on the waiting route. Direct links to an online table still waiting redirect to this route. Creation defaults: four seats, 10,000 chips each, blinds 100/200.

The server serializes join, seat, buy-in, blind and start mutations using the same room row lock. It rejects mismatched individual buy-ins, validates positive integer settings and small blind ≤ big blind ≤ stack, and normalizes legacy waiting buy-ins on start. Offline local scoring remains independent; new local sessions also default to four.

Verification uses an isolated PostgreSQL instance at localhost, with actual schema migrations and real services (not the earlier mock API). Eighteen unit/regression tests pass; four database integration tests pass, covering both modes, auto-ready, uniform chips, occupied/out-of-range seats, concurrent seat claims, host-only start, duplicate start, fixed seat positions, reconnection and last-seat capacity races. Browser users on localhost and 127.0.0.1 created/joined a room, changed seats, automatically reached the same active table, played and archived one hand. No production QA users were created.

Responsive evidence: profile at desktop/375px; create form at desktop/375px; waiting at desktop/375px, four-seat default and ten-seat full table at 320px. Ten occupied seat-content bounds have no intersections and document scrollWidth equals 320px. Copy feedback works. Existing local recovery snapshot was left untouched; new setup shows four player inputs. Frontend/backend lint and type checks, production build, and whitespace checks pass.

Production deployment `dpl_6QhFs4DeNze1F1dE9ZgAWigfxkyR` is READY at https://poker.yanyihan.top. Live read-only checks return health 200/database up, expected anonymous auth/me 401, and create redirects to login preserving its next route. The production browser error log is empty. Authenticated room-flow verification was performed on the isolated local database, not production. Online automatic entry follows the visible-page polling interval (1.5 seconds); hidden tabs refresh when visible again.

Independent finish review returned `ship` for the profile/create/waiting refinement after inspecting all eight captures and the user's original screenshot, with no material fixes requested. Static captures do not certify motion feel. Full local verdict is in the ignored `.impeccable/review/flow-verdict.md`.

## Default-language follow-up — 2026-10-03

New visits and the server-rendered document default to English (`en-US`), regardless of browser language. Explicitly saved Chinese/English selections remain supported. Persistence waits until the stored selection is loaded, preventing the initial default from overwriting it during mount. Browser verification on a fresh local origin confirmed English first load, Chinese selection surviving reload, English selection surviving reload, and no hydration errors. English lobby captures at 1280px and 375px are in the ignored review directory.

The independent follow-up reviewer returned `ship` with no material fixes in this narrow language scope. Lint, type checking and the production build pass after the language change.

English-default deployment `dpl_DTxnXEySBamAJm5LemfEoanQtfCa` is READY at https://poker.yanyihan.top. Live checks confirm page 200 with `lang="en-US"` and health 200/database up.

The documenter wrote current DESIGN.md and schema-v2 sidecar before its turn failed on usage limits. The parent completed the document verification inline: 28 color metadata keys match normative frontmatter; ten self-contained component previews exist; retired celadon metadata is absent; profile columns and the waiting 1024px breakpoint match source. Reduced-motion caveats are recorded rather than canonized. This substituted documentation check does not claim extra browser coverage.

## Lobby footer removal — 2026-10-03

At the user's request, the lobby's bottom History and Profile links are removed along with their unused footer styles. The header navigation and account entry remain the existing routes to those functions.

## Sound controls — 2026-10-04

The header exposes independent Button sounds and Background music switches in a compact sound popover. Both start off and persist locally. Audio unlocks only after a user gesture, stays continuous across routes, pauses while the page is hidden, and respects either mute immediately. Original synthesized chip clicks and a quiet 96 BPM instrumental loop use Web Audio without external assets or dependencies. The controls remain available in local mode without an account or API.

## Completion checks — 2026-10-02

The independent reviewer returned `fix` for one authentication error stripe. Its verdict pass returned `ship`, scoring that fix resolved from the updated error screenshot; this scope does not certify motion feel from still images. All seven review captures were valid. No generated or copied Balatro assets ship.

Automated rules: 16 tests pass. Frontend and backend lint/type checks pass. Production build passes. Browser checks covered desktop lobby/table, mobile login/create/table, and 320px ten-seat geometry with no intersecting seat bounds. Real local flow: call updates pot 300 to 500, undo restores it; ten-player folds reach settlement, award chips, and next hand rotates positions. Synthetic local API fixture: login return route, create, invalid room-code error, and successful join. No production users or rooms were created for this redesign. Mobile actions remain below the board in document flow and require scrolling on short screens.

Production deployment `dpl_2qDUGAQkZ58pX8QxLodDgjbeE1Rs` is READY at https://poker.yanyihan.top. Read-only live verification: new game menu and compact authentication page, create-to-auth redirect with preserved next route, empty browser error log, health 200 with database up, and expected unauthenticated auth/me 401.
