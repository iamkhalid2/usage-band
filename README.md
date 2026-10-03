# usage-band

A **Claude Code mod**: a slim, retro-styled line above the prompt that shows how much of your plan's usage limits you've used.

```
5H ▰▰▰▰▰▰▱▱▱▱▱▱ 62% · 2h 14m  ◆  WK ▰▰▱▱▱▱▱▱▱▱▱▱ 31% · 3d 4h
```

- **5H**: the rolling 5-hour window. **WK**: the weekly window.
- Bars run through a muted 70s sunset gradient (teal, mustard, burnt orange, brick), so a fuller bar reads warmer.
- Shows time until each window resets (on windows 70+ columns wide).
- One line, no animation, no border. It stays out of the way.
- Shown only on a subscription plan, once Claude Code has a reading from your first response. Without rate-limit data there is nothing to draw.
- Works in the terminal and the desktop app (the `AbovePrompt` slot).

## Install

```bash
claude plugin marketplace add iamkhalid2/usage-band
claude plugin install usage-band@usage-band
```

Start a new session (or reload plugins in a running one).

## Use

It shows up on its own. `/usage-band` hides or shows the line.

## Uninstall

```bash
claude plugin uninstall usage-band@usage-band
```

## How it works

A hooks module (`plugins/usage-band/hooks/register.tsx`) listens to `session.measure` for the rate-limit windows and draws them in a `ui.render` hook on the `AbovePrompt` component. It reads usage figures only; it makes no network requests of its own and stores nothing outside the session.

## License

MIT

## Contact

contact@iamkhalid.xyz
