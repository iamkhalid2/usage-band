import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Limit } from '../types'

const limits = atom({ plugin: 'usage-band', key: 'limits' } as const, [])
const nowMs = atom({ plugin: 'usage-band', key: 'nowMs' } as const, 0)
const isHidden = atom({ plugin: 'usage-band', key: 'isHidden' } as const, false)

// 70s sunset palette: teal -> mustard -> burnt orange -> brick
const STOPS = ['#3fa7a0', '#e5b53b', '#e0752f', '#c8453f']
const CREAM = '#f2e3c6'
const ROSE = '#b5656b'
const TRACK = '#6b5b4b'

const LABELS: Record<string, string> = {
  five_hour: '5H',
  seven_day: 'WK',
  spend_limit: '$$',
}
const ORDER = ['five_hour', 'seven_day']

const hex = (n: number) => Math.round(n).toString(16).padStart(2, '0')

// the colour at t (0..1) along the sunset gradient
const ramp = (t: number) => {
  const x = Math.max(0, Math.min(1, t)) * (STOPS.length - 1)
  const i = Math.min(STOPS.length - 2, Math.floor(x))
  const k = x - i
  const a = STOPS[i]
  const b = STOPS[i + 1]
  const ch = (s: string, o: number) => parseInt(s.slice(o, o + 2), 16)
  const mix = (o: number) => ch(a, o) + (ch(b, o) - ch(a, o)) * k

  return `#${hex(mix(1))}${hex(mix(3))}${hex(mix(5))}`
}

const countdown = (iso: string | undefined, now: number) => {
  if (!iso || !now) return ''
  const ms = Date.parse(iso) - now
  if (Number.isNaN(ms)) return ''
  if (ms <= 0) return 'now'
  const mins = Math.floor(ms / 60000)
  const days = Math.floor(mins / 1440)
  const hours = Math.floor((mins % 1440) / 60)
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${String(mins % 60).padStart(2, '0')}m`
  return `${Math.max(mins, 1)}m`
}

const sorted = (list: Limit[]) =>
  [...list].sort((a, b) => {
    const ai = ORDER.indexOf(a.kind)
    const bi = ORDER.indexOf(b.kind)
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
  })

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'usage-band',
      description: 'Show or hide the plan usage line above the prompt',
    })

    try {
      const now = await $.clock.now()
      await update($, nowMs, () => now)
      const usage = await $.session.usage()
      if (usage.rateLimits.length) await update($, limits, () => usage.rateLimits)
    } catch {
      // the band waits for the first measurement
    }

    // keeps the countdowns honest between measurements
    $.clock.every(30000, async () => {
      const now = await $.clock.now()
      await update($, nowMs, () => now)
    })

    return next(e)
  })

  on('session.measure', async ($, e, next) => {
    if (e.changed.includes('rateLimits')) {
      await update($, limits, () => e.rateLimits)
    }
    const now = await $.clock.now()
    await update($, nowMs, () => now)

    return next(e)
  })

  on('command.run', { command: 'usage-band' }, async $ => {
    const hidden = !(await read($, isHidden))
    await update($, isHidden, () => hidden)

    return { text: hidden ? 'Usage line hidden.' : 'Usage line shown.' }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const list = sorted(await read($, limits))

    if (e.props.hasSurvey || list.length === 0 || (await read($, isHidden))) {
      return next(e)
    }

    const now = (await read($, nowMs)) || (await $.clock.now())
    const { Box, Text } = $.ui.resolve(e)

    const cols = e.props.bodyColumns
    const isWide = cols >= 70
    const barWidth = Math.max(6, Math.min(14, Math.floor((cols - (isWide ? 40 : 24)) / list.length)))

    const parts: unknown[] = []

    list.forEach((limit, n) => {
      const pct = Math.max(0, Math.min(100, limit.percentUsed))
      const filled = Math.round((pct / 100) * barWidth)
      const reset = countdown(limit.resetsAt, now)

      if (n > 0) {
        parts.push(
          <Text key={`${limit.kind}-d`} color={ROSE}>
            {'  ◆  '}
          </Text>,
        )
      }

      parts.push(
        <Text key={`${limit.kind}-l`} bold color={CREAM}>
          {`${LABELS[limit.kind] ?? limit.kind} `}
        </Text>,
      )

      for (let i = 0; i < barWidth; i++) {
        parts.push(
          i < filled ? (
            <Text key={`${limit.kind}-${i}`} color={ramp(i / (barWidth - 1))}>
              ▰
            </Text>
          ) : (
            <Text key={`${limit.kind}-${i}`} color={TRACK}>
              ▱
            </Text>
          ),
        )
      }

      parts.push(
        <Text key={`${limit.kind}-p`} bold color={ramp(pct / 100)}>
          {` ${Math.round(pct)}%`}
        </Text>,
      )

      if (isWide && reset) {
        parts.push(
          <Text key={`${limit.kind}-r`} color={TRACK}>
            {` · ${reset}`}
          </Text>,
        )
      }
    })

    return (
      <Box justifyContent="center" width="100%">
        <Text wrap="truncate">{parts}</Text>
      </Box>
    )
  })
}
