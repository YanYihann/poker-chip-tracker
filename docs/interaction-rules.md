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
- Local final reports can be reopened from Previous settlement and /history/local without signing in. Online reports are available to every participant after the host ends the session and from the existing session history detail page.

## Profile and mode-specific history

- Profile shows total net P/L and separate online/local session and hand counts plus net P/L. It has no asset balance or personal history list.
- History tabs switch between /history/local and /history/online. Local history combines offline device reports and authenticated physical-card rooms; online history lists server-dealt rooms. Anonymous users can still read device history.
- /local offers Single device and Multiple devices. Multiple devices links to /rooms/create?mode=local or room-code join. Active local rooms route all participants to /local?room=CODE. The synced route never mounts the offline controller.
- Signed-in single-device operators select My seat before starting. Only that account-bound seat contributes to personal local P/L; anonymous and legacy records cannot be attributed by player name. These device results stay on that device.
- Reset all sessions opens a native application dialog focused on Cancel. Escape/cancel leaves data intact. Confirm clears this account's completed room history and totals, plus this device's local archives; browser clearing runs only after API success. Other players' shared reports and active games are preserved. The reset marker suppresses older account-bound device totals on other devices after the next profile load.
- Final device reports are retained independently of the 200-entry cap on intermediate hand records so personal totals do not drop when new hands are archived.

- Active phone tables hide navigation and device tabs, retaining only Back. Table, private cards and actions fit the visible viewport in portrait and landscape without page scrolling; setup and menus still scroll normally. Long settlement reports scroll inside their dialogs.
- Fullscreen is opportunistic during an entry gesture or first table interaction. Unsupported/denied requests do not block play; manual exit is respected and Back restores navigation, scrolling and table-owned fullscreen.
