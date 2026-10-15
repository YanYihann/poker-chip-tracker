# Interaction Rules

## Data Entry

- Primary flows must be reachable within 1-2 taps/clicks.
- Numeric inputs use the numeric keyboard on mobile setup forms. Active phone tables use a numeric dialog with Cancel/Apply to preserve the fixed betting controls.
- Use clear labels for buy-in, rebuy, and cash-out.

## Feedback

- Show immediate success feedback after each event.
- Show explicit confirmation before irreversible actions (session close/reset).
- Highlight validation errors inline and in plain language.

## Accessibility

- Meet WCAG AA contrast for text and interactive controls.
- Ensure minimum touch target size around 44x44 px.
- Do not rely on color alone to communicate win/loss.

## Responsive

- Prioritize one-handed mobile usage.
- Keep critical totals visible without deep scrolling.


## Final session report
- End session opens an application confirmation with Keep playing and End & save. The default focus is Keep playing; Escape cancels.
- Final reports list chip transfers, player totals, and hand history. Hand details use native disclosures and are collapsed on every report opening.
- Report dialogs trap focus via the native modal dialog, close with Close/Escape, and restore focus to the trigger. Long reports scroll within the panel with a persistent close control.
- Local final reports can be reopened from Previous settlement and /history/local without signing in. Online reports are available to every participant after the session ends and from the existing session history detail page.

## Profile and mode-specific history

- Profile shows total net P/L and separate online/local session and hand counts plus net P/L. It has no asset balance or personal history list.
- History tabs switch between /history/local and /history/online. Local history combines offline device reports and authenticated physical-card rooms; online history lists server-dealt rooms. Anonymous users can still read device history.
- /local offers Single device and Multiple devices. Multiple devices links to /rooms/create?mode=local or room-code join. Active local rooms route all participants to /local?room=CODE. The synced route never mounts the offline controller.
- Signed-in single-device operators select My seat before starting. Only that account-bound seat contributes to personal local P/L; anonymous and legacy records cannot be attributed by player name. These device results stay on that device.
- Reset all sessions opens a native application dialog focused on Cancel. Escape/cancel leaves data intact. Confirm clears this account's completed room history and totals, plus this device's local archives; browser clearing runs only after API success. Other players' shared reports and active games are preserved. The reset marker suppresses older account-bound device totals on other devices after the next profile load.
- Final device reports are retained independently of the 200-entry cap on intermediate hand records so personal totals do not drop when new hands are archived.

- Active phone tables hide navigation and device tabs, retaining only Back. Table, private cards and actions fit the visible viewport in portrait and landscape without page scrolling; setup and menus still scroll normally. Long settlement reports scroll inside their dialogs.
- Fullscreen is opportunistic during an entry gesture or first table interaction. Unsupported/denied requests do not block play; manual exit is respected and Back restores navigation, scrolling and table-owned fullscreen.

- Active wager controls omit the visible round-total label and routine range/minimum hints, retain an accessible label, and show validation errors when needed.
- Phone Back has a 32px face and centered arrow inside its 44px touch target. Blind badge text is centered. Heads-up seats move inward only when the pot/board remains clear.
- Every synced-room participant sees chip-to-pot feedback for server-confirmed debits, including calls that advance a street and all-ins settled in the same response. Loading, repeated polling and standalone payouts do not replay wagers.

## Online matchmaking

- Lobby Quick match opens /online/match behind the existing sign-in gate. Labeled native Players and Stakes selects offer 2–8 players and Beginner/Advanced/Expert, with starting chips and blinds shown before joining. Find opponent explicitly reserves a seat; visiting alone does not start a match.
- Entrants open /rooms/CODE immediately while the remaining players join the same tier and size. The preparation table uses the existing felt, seat cards and settings panel. Desktop keeps settings beside the table; mobile setup scrolls with settings below. Existing typography and felt-green/charcoal/gold tokens remain in use.
- My seat is a labeled native select. Empty seats are also clickable; occupied options permit swaps only with unready players. Seat changes reset readiness. Ready/Unready and joined/ready counts explain that the full table starts automatically when everyone is ready. Leave match vacates the seat and returns to /online/match.
- Preparation renews its 30-second lease every 8 seconds. Connection errors show retry feedback; abandoned seats can be reclaimed, and expired entrants return to Quick match. Leave and start serialize: leave first vacates the seat; start first preserves the active room. A stale ticket cannot cancel a newer match; repeated joins and tabs reserve one membership.
- Revisiting Quick match resumes a live preparation or active room. Finished/deleted rooms permit a new explicit match; history removal never silently requeues a player. Private rooms retain their existing automatic readiness and host start.

## Online hand decisions and synchronization

- After settlement, every eligible seated player with chips can choose Start next hand; at least two eligible players are needed. Choosing it replaces the settlement view with Waiting for players and a consent count, disables duplicate continuation, and keeps End session available. The server continues when all eligible players consent. Any online participant may end through the existing Keep playing / End & save confirmation. Offline and synced-local tables keep operator/host decisions.
- Active and settled phone tables retain their fixed viewport and bottom actions; the consent waiting view keeps the same Back and action placement. Setup screens continue to scroll normally.
- Persistent Socket.IO deployments push each participant's private cards and legal actions with the committed turn. Serverless polling refreshes visible subscribed rooms at a target 250 ms during a hand, 750 ms in preparation or settlement, and 5 seconds after closure or on errors. Each room has at most one polling request in flight; request time is included in the cadence. API action responses update the acting client immediately.
