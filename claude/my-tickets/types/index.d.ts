export type Role = 'owner' | 'reviewer' | 'pairbuddy'

export type Ticket = {
  id: number
  url: string
  title: string
  status: string
  role: Role
}

export type PrKind = 'mine' | 'review'

export type Pr = {
  number: number
  repo: string
  url: string
  title: string
  isDraft: boolean
  kind: PrKind
}

export type Board = {
  tickets: Ticket[]
  prs: Pr[]
  loadedAt: number | null
  isLoading: boolean
  ticketsError: string | null
  prsError: string | null
}

export type Tab = 'tickets' | 'prs'

declare module 'claude-code' {
  interface PluginState {
    'my-tickets': { board: Shaped<Board>; tab: Tab }
  }
}
