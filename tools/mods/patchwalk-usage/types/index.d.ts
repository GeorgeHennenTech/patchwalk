export type Meter = { label: string; percent: number; note: string }
export type Usage = { meters: Meter[]; cost: string }

declare module 'claude-code' {
  interface PluginState {
    'patchwalk-usage': { usage: Shaped<Usage | null>; isHidden: boolean }
  }
}
