# Interaction Rules

## Data Entry

- Primary flows must be reachable within 1-2 taps/clicks.
- Numeric input should open numeric keyboard on mobile.
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
