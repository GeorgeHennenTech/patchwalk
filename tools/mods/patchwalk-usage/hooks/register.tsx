import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Meter, Usage } from '../types'

const usage = atom({ plugin: 'patchwalk-usage', key: 'usage' } as const, null, { shape: 'usage-1' })
const isHidden = atom({ plugin: 'patchwalk-usage', key: 'isHidden' } as const, false)

// Patchwalk's neons.
const PINK = '#ff4fa8'
const CYAN = '#3df5ff'
const GREEN = '#7dff5c'
const YELLOW = '#ffe14a'
const ORANGE = '#ff9a3d'

const LIMIT_NAMES: Record<string, string> = { five_hour: '5-hour limit', seven_day: 'Weekly limit', spend_limit: 'Spend limit' }

/** "resets in 2h 14m", "resets in 3d 4h", or "" when the time is unknown or already past. */
function until(iso: string | undefined, now: number): string {
  if (!iso) return ''
  const ms = Date.parse(iso) - now
  if (!(ms > 0)) return ''
  const minutes = Math.round(ms / 60000)
  if (minutes < 60) return `resets in ${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 48) return `resets in ${hours}h ${minutes % 60}m`
  return `resets in ${Math.floor(hours / 24)}d ${hours % 24}h`
}

type Measured = {
  context: { tokens?: number; window: number; percent?: number }
  rateLimits: { kind: string; percentUsed: number; resetsAt?: string }[]
  cost?: { usd: number }
}

function summarise(m: Measured, now: number): Usage {
  const meters: Meter[] = []
  if (m.context.percent !== undefined) {
    const k = (n: number) => (n >= 1000 ? `${Math.round(n / 1000)}k` : String(n))
    meters.push({ label: 'Context', percent: m.context.percent, note: m.context.tokens !== undefined ? `${k(m.context.tokens)} of ${k(m.context.window)}` : '' })
  }
  for (const limit of m.rateLimits) {
    meters.push({ label: LIMIT_NAMES[limit.kind] ?? limit.kind, percent: limit.percentUsed, note: until(limit.resetsAt, now) })
  }
  return { meters, cost: m.cost ? `$${m.cost.usd.toFixed(2)}` : '' }
}

/** A bar of blocks, filled in proportion. */
function bar(percent: number, width: number): [string, string] {
  const filled = Math.max(0, Math.min(width, Math.round((percent / 100) * width)))
  return ['█'.repeat(filled), '░'.repeat(width - filled)]
}
/** Green while there is plenty left, yellow when it is getting on, orange then pink near the end. */
const tone = (percent: number) => (percent >= 90 ? PINK : percent >= 75 ? ORANGE : percent >= 50 ? YELLOW : GREEN)

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'usage-row', description: 'Show or hide the usage row above the prompt' })
    const now = await $.clock.now()
    const measured = await $.session.usage()
    await update($, usage, () => summarise(measured, now))
    return next(e)
  })

  // The engine pushes new figures after each turn and whenever a limit moves a whole point.
  on('session.measure', async ($, e, next) => {
    const now = await $.clock.now()
    await update($, usage, () => summarise(e, now))
    return next(e)
  })

  on('command.run', { command: 'usage-row' }, async $ => {
    const hidden = !(await read($, isHidden))
    await update($, isHidden, () => hidden)
    const now = await $.clock.now()
    const latest = summarise(await $.session.usage(), now)
    await update($, usage, () => latest)
    const lines = latest.meters.map(m => `${m.label}: ${Math.round(m.percent)}%${m.note ? ` (${m.note})` : ''}`)
    if (latest.cost) lines.push(`This session: ${latest.cost}`)
    return { text: `Usage row ${hidden ? 'hidden' : 'shown'}.\n${lines.length ? lines.join('\n') : 'No usage figures yet: they arrive after the first reply.'}` }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const latest = await read($, usage)
    if (e.props.hasSurvey || latest === null || (await read($, isHidden)) || (latest.meters.length === 0 && !latest.cost)) return next(e)
    const { Box, Text } = $.ui.resolve(e)

    return (
      <Box>
        <Text color={PINK} bold>Patchwalk </Text>
        {latest.meters.map(m => {
          const [full, empty] = bar(m.percent, 8)
          return (
            <Text>
              <Text color={CYAN}>{m.label} </Text>
              <Text color={tone(m.percent)}>{full}</Text>
              <Text dimColor>{empty}</Text>
              <Text bold> {Math.round(m.percent)}%</Text>
              <Text dimColor>{m.note ? ` ${m.note}` : ''}   </Text>
            </Text>
          )
        })}
        {latest.cost && (
          <Text>
            <Text color={CYAN}>Session </Text>
            <Text bold>{latest.cost}</Text>
          </Text>
        )}
      </Box>
    )
  })
}
