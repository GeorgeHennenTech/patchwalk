import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { TodoLine } from '../types'

// The list lives in the repository (docs/TODO.md) so it survives this container; the pane only shows it.
const FILE = '/home/user/patchwalk/docs/TODO.md'
const PANE = 'patchwalk-todo'
const TITLE = 'Patchwalk to-do'
const lines = atom({ plugin: 'patchwalk-todo', key: 'lines' } as const, [], { shape: 'lines-1' })
const isOpen = atom({ plugin: 'patchwalk-todo', key: 'isOpen' } as const, false)
const isHidingDone = atom({ plugin: 'patchwalk-todo', key: 'isHidingDone' } as const, false)

// Patchwalk's neons: one per section, in turn.
const PINK = '#ff4fa8'
const NEONS = [PINK, '#3df5ff', '#7dff5c', '#ffe14a', '#ff9a3d']
const GREEN = '#7dff5c'

function parse(text: string): TodoLine[] {
  const out: TodoLine[] = []
  text.split('\n').forEach((raw, line) => {
    const item = /^\s*- \[( |x|X)\] (.*)$/.exec(raw)
    const head = /^##+ (.*)$/.exec(raw)
    if (item) out.push({ kind: 'item', text: item[2] ?? '', isDone: item[1] !== ' ', line })
    else if (head) out.push({ kind: 'head', text: head[1] ?? '', isDone: false, line })
  })
  return out
}

/** A bar of blocks, filled in proportion: readable on every surface. */
function bar(done: number, total: number, width: number): [string, string] {
  const filled = total === 0 ? 0 : Math.round((done / total) * width)
  return ['█'.repeat(filled), '░'.repeat(Math.max(0, width - filled))]
}

type Section = { title: string; items: TodoLine[] }
function sections(list: TodoLine[]): Section[] {
  const out: Section[] = []
  for (const one of list) {
    if (one.kind === 'head') out.push({ title: one.text, items: [] })
    else if (one.kind === 'item') (out[out.length - 1] ?? (out[out.length] = { title: 'To do', items: [] })).items.push(one)
  }
  return out.filter(section => section.items.length > 0)
}

async function load($: any): Promise<void> {
  const text = (await $.fs.exists(FILE)) ? await $.fs.read(FILE) : ''
  await update($, lines, () => parse(text))
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'todo', description: "Show Patchwalk's to-do list in a pane" })
    await load($)
    void $.ui.open({ id: PANE, title: TITLE }).then(opened => update($, isOpen, () => opened.isPlaced))
    return next(e)
  })

  on('command.run', { command: 'todo' }, async $ => {
    await load($)
    const opened = await $.ui.open({ id: PANE, title: TITLE })
    await update($, isOpen, () => opened.isPlaced)
    if (opened.isPlaced) return { text: 'To-do pane opened.' }
    // This app has nowhere to seat a pane: print the list here instead, so the command is never empty-handed.
    const list = await read($, lines)
    const items = list.filter(one => one.kind === 'item')
    const done = items.filter(one => one.isDone).length
    const [full, empty] = bar(done, items.length, 24)
    const body = sections(list)
      .map(group => {
        const finished = group.items.filter(one => one.isDone).length
        const open = group.items.filter(one => !one.isDone)
        return [`${group.title.toUpperCase()}  ${finished}/${group.items.length}`, ...open.map(one => `  ○ ${one.text}`), ...(open.length === 0 ? ['  ✓ all done'] : [])].join('\n')
      })
      .join('\n\n')
    return {
      text: `Patchwalk to-do  ${full}${empty}  ${done} of ${items.length} done\n(This app is not showing side panes${opened.reason ? `: ${opened.reason}` : ''}, so here is the list. Finished items are counted but not listed.)\n\n${body}`,
    }
  })

  // Closing the pane leaves a one-line tab above the prompt, so the list is one press away.
  on('ui.close', { id: PANE }, async ($, e, next) => {
    await update($, isOpen, () => false)
    return next(e)
  })

  // Whenever a tool has run, the file may have changed: read it again.
  on('tool.call', async ($, e, next) => {
    const ran = await next(e)
    await load($)
    return ran
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey || (await read($, isOpen))) return next(e)
    const list = await read($, lines)
    const items = list.filter(one => one.kind === 'item')
    if (items.length === 0) return next(e)
    const done = items.filter(one => one.isDone).length
    const upNext = items.find(one => !one.isDone)
    const [full, empty] = bar(done, items.length, 10)
    const { Box, Button, Text } = $.ui.resolve(e)
    const reopen = async () => {
      await update($, isOpen, () => true)
      await $.ui.open({ id: PANE, title: TITLE })
    }

    return (
      <Box>
        <Text color={PINK} bold>To-do </Text>
        <Text color={GREEN}>{full}</Text>
        <Text dimColor>{empty} {done}/{items.length}</Text>
        {upNext && <Text dimColor>  next: {upNext.text.length > 48 ? upNext.text.slice(0, 47) + '…' : upNext.text}  </Text>}
        <Button key="open" label="Open list" onPress={() => void reopen()} />
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const list = await read($, lines)
    const hiding = await read($, isHidingDone)
    const items = list.filter(one => one.kind === 'item')
    const done = items.filter(one => one.isDone).length
    const groups = sections(list)

    // Minimised on the desktop app: just the score and what is next.
    if (e.props.placement === 'widget') {
      const [full, empty] = bar(done, items.length, 12)
      return (
        <Box flexDirection="column">
          <Text><Text color={GREEN}>{full}</Text><Text dimColor>{empty}</Text> <Text bold>{done}/{items.length}</Text></Text>
          {items.filter(one => !one.isDone).slice(0, 3).map(one => <Text dimColor>○ {one.text}</Text>)}
        </Box>
      )
    }

    const toggle = async (target: TodoLine) => {
      const rows = (await $.fs.read(FILE)).split('\n')
      const row = rows[target.line]
      if (row === undefined || !row.includes(target.text)) return load($)
      rows[target.line] = target.isDone ? row.replace(/- \[(x|X)\]/, '- [ ]') : row.replace('- [ ]', '- [x]')
      await $.fs.write(FILE, rows.join('\n'))
      await load($)
    }
    const width = Math.max(10, Math.min(30, (e.props.bodyColumns ?? 40) - 12))
    const [full, empty] = bar(done, items.length, width)

    return (
      <Box flexDirection="column">
        {items.length === 0 && <Text dimColor>No to-do list yet (docs/TODO.md).</Text>}
        {items.length > 0 && (
          <Box flexDirection="column">
            <Text><Text color={GREEN}>{full}</Text><Text dimColor>{empty}</Text> <Text bold>{done}</Text><Text dimColor> of {items.length} done</Text></Text>
            <Button key="hide-done" label={hiding ? 'Show finished items' : 'Hide finished items'} onPress={() => void update($, isHidingDone, now => !now)} />
          </Box>
        )}
        {groups.map((group, index) => {
          const finished = group.items.filter(one => one.isDone).length
          const color = NEONS[index % NEONS.length]
          const shown = hiding ? group.items.filter(one => !one.isDone) : group.items
          return (
            <Box flexDirection="column">
              <Text> </Text>
              <Text>
                <Text color={color} bold>▍{group.title.toUpperCase()}</Text>
                <Text dimColor>  {finished}/{group.items.length}{finished === group.items.length ? '  all done' : ''}</Text>
              </Text>
              {shown.map(one => (
                <Button key={`row-${one.line}`} onPress={() => void toggle(one)}>
                  {one.isDone
                    ? <Text dimColor><Text color={GREEN}>✓</Text> {one.text}</Text>
                    : <Text><Text color={color}>○</Text> {one.text}</Text>}
                </Button>
              ))}
            </Box>
          )
        })}
      </Box>
    )
  })
}
