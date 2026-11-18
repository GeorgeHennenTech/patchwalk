export type TodoLine = { kind: 'head' | 'item' | 'note'; text: string; isDone: boolean; line: number }

declare module 'claude-code' {
  interface PluginState {
    'patchwalk-todo': { lines: Shaped<TodoLine[]>; isOpen: boolean; isHidingDone: boolean }
  }
}
