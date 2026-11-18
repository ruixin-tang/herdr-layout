import { atom, read, update } from 'claude-code'
import type { EngineInterface, McpToolResult, Register } from 'claude-code'

import type { Board, Pr, PrKind, Role, Tab, Ticket } from '../types'

const PANE = 'my-tickets'
const TITLE = 'My work'
const NOTION = 'notion'
const TICKETS = 'collection://2858fda3-5abb-81ff-b59a-000b08c4a7e0'
const OPEN_STATUSES = ['Doing', 'Review', 'Todo', 'Inbox']
const REFRESH_MS = 10 * 60 * 1000
// The Herdr panel (~/.config/herdr-app/mods/my-work) reads the tickets from here.
const CACHE = '/Users/ruixintang/.cache/my-work/tickets.json'
// The forest sprite reads the next day's meetings from here.
const MEETINGS = '/Users/ruixintang/.cache/my-work/meetings.json'
const MEETINGS_ERROR = '/Users/ruixintang/.cache/my-work/meetings.error.json'

const EMPTY: Board = {
  tickets: [],
  prs: [],
  loadedAt: null,
  isLoading: false,
  ticketsError: null,
  prsError: null,
}
const board = atom({ plugin: 'my-tickets', key: 'board' } as const, EMPTY, {
  shape: 'board-2',
})
const FIRST_TAB: Tab = 'tickets'
const tab = atom({ plugin: 'my-tickets', key: 'tab' } as const, FIRST_TAB)

const ROLES: { role: Role; heading: string }[] = [
  { role: 'owner', heading: 'Owner' },
  { role: 'reviewer', heading: 'Reviewer' },
  { role: 'pairbuddy', heading: 'Pairbuddy' },
]

const PR_KINDS: { kind: PrKind; heading: string; flag: string }[] = [
  { kind: 'mine', heading: 'My PRs', flag: '--author=@me' },
  { kind: 'review', heading: 'Review requested', flag: '--review-requested=@me' },
]

type Row = {
  url: string
  id: number
  title: string | null
  status: string
  is_owner: number | null
  is_reviewer: number | null
  is_pairbuddy: number | null
}

type GhPr = {
  number: number
  title: string
  url: string
  isDraft: boolean
  repository: { name: string }
}

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

const parse = (result: McpToolResult): unknown => {
  const text = result.content.find(block => block.type === 'text')?.text ?? ''
  if (result.isError) {
    throw new Error(text.slice(0, 200) || 'Notion refused the call')
  }

  return result.structuredContent ?? JSON.parse(text)
}

const roleOf = (row: Row): Role =>
  row.is_owner ? 'owner' : row.is_reviewer ? 'reviewer' : 'pairbuddy'

const loadTickets = async ($: EngineInterface): Promise<Ticket[]> => {
  const self = parse(await $.mcp.call(NOTION, 'notion-get-self', {})) as {
    user: { id: string }
  }
  const me = `%${self.user.id}%`
  const statuses = OPEN_STATUSES.map(() => '?').join(', ')
  const query = `SELECT url, "userDefined:ID" AS id, "Task summary" AS title, "Status" AS status,
      "Owner" LIKE ? AS is_owner, "Reviewer" LIKE ? AS is_reviewer, "Pairbuddy" LIKE ? AS is_pairbuddy
    FROM "${TICKETS}"
    WHERE "Status" IN (${statuses})
      AND ("Owner" LIKE ? OR "Reviewer" LIKE ? OR "Pairbuddy" LIKE ?)
    ORDER BY "userDefined:ID" DESC LIMIT 100`
  const answer = parse(
    await $.mcp.call(NOTION, 'notion-query-data-sources', {
      data: {
        mode: 'sql',
        data_source_urls: [TICKETS],
        query,
        params: [me, me, me, ...OPEN_STATUSES, me, me, me],
      },
    }),
  ) as { results: Row[] }

  return answer.results.map(row => ({
    id: row.id,
    url: row.url,
    title: row.title ?? '(untitled)',
    status: row.status,
    role: roleOf(row),
  }))
}

const loadPrs = async ($: EngineInterface): Promise<Pr[]> => {
  const lists = await Promise.all(
    PR_KINDS.map(async ({ kind, flag }) => {
      const ran = await $.process.run([
        'gh',
        'search',
        'prs',
        flag,
        '--state=open',
        '--json=number,title,url,isDraft,repository',
        '--limit=50',
      ])
      if (ran.exitCode !== 0) {
        throw new Error(ran.stderr.trim().slice(0, 200) || `gh exited ${ran.exitCode}`)
      }

      return (JSON.parse(ran.stdout) as GhPr[]).map(pr => ({
        number: pr.number,
        repo: pr.repository.name,
        url: pr.url,
        title: pr.title,
        isDraft: pr.isDraft,
        kind,
      }))
    }),
  )

  return lists.flat()
}

type CalendarEvent = {
  summary?: string
  description?: string
  conferencingUrl?: string
  responseStatus?: string
  location?: string
  resources?: { displayName?: string }[]
  period: { type: string; start: { dateTime?: string; date?: string }; end: { dateTime?: string } }
}

// Today's timed events on my own calendar, with a join link and a room when given.
// One day only: the answer carries my colleagues' calendars too, and a longer
// window made it too big to come back.
const loadMeetings = async ($: EngineInterface, now: number) => {
  const answer = parse(
    await $.mcp.call(NOTION, 'notion-calendar-list-events', {
      timeMin: new Date(new Date(now).setHours(0, 0, 0, 0)).toISOString(),
      timeMax: new Date(new Date(now).setHours(23, 59, 59, 0)).toISOString(),
      timeZone: 'Europe/Amsterdam',
    }),
  ) as {
    accounts: {
      email: string
      calendars: { name: string; isPrimary: boolean; events: CalendarEvent[] }[]
    }[]
  }

  const calendars = answer.accounts.flatMap(account => account.calendars)
  const events = calendars.filter(calendar => calendar.isPrimary).flatMap(calendar => calendar.events)
  // The "Dev-support" calendar has one all-day event per day, "support: <first names>":
  // my name on today's puts the panel on duty.
  const me = answer.accounts[0]?.email.split('@')[0] ?? ''
  const day = new Date(now)
  const today = [day.getFullYear(), day.getMonth() + 1, day.getDate()]
    .map(part => String(part).padStart(2, '0'))
    .join('-')
  const duty = calendars
    .filter(calendar => calendar.name === 'Dev-support')
    .flatMap(calendar => calendar.events)
    .some(
      event =>
        event.period.start.date === today &&
        me !== '' &&
        (event.summary ?? '').toLowerCase().includes(me),
    )
  const meetings = events
    .filter(event => event.period.type === 'DATE_TIME' && event.responseStatus !== 'declined')
    .map(event => ({
      title: event.summary ?? '(no title)',
      start: Date.parse(event.period.start.dateTime ?? ''),
      end: Date.parse(event.period.end.dateTime ?? ''),
      url:
        event.conferencingUrl ??
        /https:\/\/[^\s\]]*(slack\.com\/huddle|meet\.google|zoom\.us|teams\.microsoft)[^\s\]]*/.exec(
          event.description ?? '',
        )?.[0] ??
        null,
      // The booked rooms ("Kantoor-1-Frans Hals (8)" reads "Frans Hals"), else the typed location.
      location:
        (event.resources ?? [])
          .map(room => (room.displayName ?? '').replace(/^Kantoor-\d+-/, '').replace(/ \(\d+\)$/, ''))
          .filter(name => name !== '')
          .join(', ') ||
        event.location ||
        null,
      // Where I have to be, for the trains: the location as typed into the event, or
      // the town of a "travel to <town>" block, which I want to have reached by its end.
      place: event.location ?? /^travel(?:ling)? to (.+)$/i.exec((event.summary ?? '').trim())?.[1] ?? null,
      travel: /^travel(?:ling)? to /i.test((event.summary ?? '').trim()),
    }))
    .sort((a, b) => a.start - b.start)

  return { meetings, duty }
}

type Done = { id: number; title: string; at: number }
const DAY_MS = 24 * 60 * 60 * 1000

// A ticket that left my open list and now has status Done, kept for a day:
// the Herdr panel has a Korok cheer for each.
const writeCache = async ($: EngineInterface, tickets: Ticket[], loadedAt: number) => {
  let before: { tickets: Ticket[]; done?: Done[] } = { tickets: [] }
  try {
    before = JSON.parse(await $.fs.read(CACHE))
  } catch {
    // no cache yet
  }
  const gone = before.tickets.filter(old => !tickets.some(now => now.id === old.id))
  let done = (before.done ?? []).filter(d => loadedAt - d.at < DAY_MS)
  if (gone.length > 0) {
    try {
      const answer = parse(
        await $.mcp.call(NOTION, 'notion-query-data-sources', {
          data: {
            mode: 'sql',
            data_source_urls: [TICKETS],
            query: `SELECT "userDefined:ID" AS id FROM "${TICKETS}"
              WHERE "Status" = 'Done' AND "userDefined:ID" IN (${gone.map(() => '?').join(', ')})`,
            params: gone.map(ticket => ticket.id),
          },
        }),
      ) as { results: { id: number }[] }
      done = [
        ...done,
        ...gone
          .filter(ticket => answer.results.some(row => row.id === ticket.id))
          .map(ticket => ({ id: ticket.id, title: ticket.title, at: loadedAt })),
      ]
    } catch {
      // asked again when the next ticket leaves the list
    }
  }
  await $.fs.write(CACHE, JSON.stringify({ loadedAt, tickets, done }))
}

// Keeps the cache fresh for the Herdr panel; sessions that find it fresh skip.
const sync = async ($: EngineInterface): Promise<void> => {
  const now = await $.clock.now()
  try {
    const cached = JSON.parse(await $.fs.read(CACHE)) as { loadedAt: number }
    if (now - cached.loadedAt < REFRESH_MS - 60_000) {
      return
    }
  } catch {
    // no cache yet
  }
  try {
    await writeCache($, await loadTickets($), now)
  } catch {
    // the panel keeps showing the last cache
  }
  try {
    await $.fs.write(MEETINGS, JSON.stringify({ loadedAt: now, ...(await loadMeetings($, now)) }))
    await $.fs.write(MEETINGS_ERROR, JSON.stringify({ at: 0, error: null }))
  } catch (error) {
    // the sprite and the agenda keep the last list; the agenda says why it is old
    await $.fs.write(MEETINGS_ERROR, JSON.stringify({ at: now, error: messageOf(error).slice(0, 200) }))
  }
}

const refresh = async ($: EngineInterface): Promise<void> => {
  await update($, board, now => ({ ...now, isLoading: true }))
  const [tickets, prs] = await Promise.allSettled([loadTickets($), loadPrs($)])
  const loadedAt = await $.clock.now()
  if (tickets.status === 'fulfilled') {
    await writeCache($, tickets.value, loadedAt)
  }
  await update($, board, now => ({
    tickets: tickets.status === 'fulfilled' ? tickets.value : now.tickets,
    prs: prs.status === 'fulfilled' ? prs.value : now.prs,
    loadedAt,
    isLoading: false,
    ticketsError: tickets.status === 'rejected' ? messageOf(tickets.reason) : null,
    prsError: prs.status === 'rejected' ? messageOf(prs.reason) : null,
  }))
}

const clock = (at: number): string => {
  const date = new Date(at)
  const two = (n: number) => String(n).padStart(2, '0')

  return `${two(date.getHours())}:${two(date.getMinutes())}`
}

let isPolling = false

// Opens the pane and keeps it fresh; nothing is fetched before the first open.
const show = async ($: EngineInterface): Promise<void> => {
  await $.ui.open({ id: PANE, title: TITLE })
  void refresh($)
  if (!isPolling) {
    isPolling = true
    $.clock.every(REFRESH_MS, () => void refresh($))
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'my-tickets',
      description: 'Show my open tickets and pull requests in a pane',
    })
    void sync($)
    $.clock.every(REFRESH_MS, () => void sync($))

    return next(e)
  })

  on('command.run', { command: 'my-tickets' }, async $ => {
    await show($)

    return { text: 'My work pane opened and refreshing.' }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Button, Link, Text } = $.ui.resolve(e)
    const { tickets, prs, loadedAt, isLoading, ticketsError, prsError } = await read(
      $,
      board,
    )
    const shown = await read($, tab)
    const error = shown === 'tickets' ? ticketsError : prsError

    return (
      <Box flexDirection="column">
        <Box marginBottom={1}>
          <Button
            key="tab-tickets"
            label={`Tickets (${tickets.length})`}
            hotkey="t"
            variant={shown === 'tickets' ? 'primary' : 'secondary'}
            onPress={() => update($, tab, () => 'tickets' as Tab)}
          />
          <Text> </Text>
          <Button
            key="tab-prs"
            label={`PRs (${prs.length})`}
            hotkey="p"
            variant={shown === 'prs' ? 'primary' : 'secondary'}
            onPress={() => update($, tab, () => 'prs' as Tab)}
          />
        </Box>
        {shown === 'tickets' &&
          ROLES.map(({ role, heading }) => {
            const mine = tickets.filter(ticket => ticket.role === role)

            return (
              <Box flexDirection="column" marginBottom={1}>
                <Text bold>
                  {heading} <Text dimColor>({mine.length})</Text>
                </Text>
                {mine.map(ticket => (
                  <Text wrap="truncate-end">
                    <Link href={ticket.url} label={`DIL-${ticket.id}`} />{' '}
                    <Text dimColor>{ticket.status}</Text> {ticket.title}
                  </Text>
                ))}
              </Box>
            )
          })}
        {shown === 'prs' &&
          PR_KINDS.map(({ kind, heading }) => {
            const mine = prs.filter(pr => pr.kind === kind)

            return (
              <Box flexDirection="column" marginBottom={1}>
                <Text bold>
                  {heading} <Text dimColor>({mine.length})</Text>
                </Text>
                {mine.map(pr => (
                  <Text wrap="truncate-end">
                    <Link href={pr.url} label={`${pr.repo}#${pr.number}`} />{' '}
                    {pr.isDraft && <Text dimColor>draft </Text>}
                    {pr.title}
                  </Text>
                ))}
              </Box>
            )
          })}
        {error !== null && <Text color="red">{error}</Text>}
        <Box>
          <Button key="refresh" label="Refresh" hotkey="r" onPress={() => refresh($)} />
          <Text dimColor>
            {' '}
            {isLoading
              ? 'loading…'
              : loadedAt === null
                ? 'not loaded yet'
                : `updated ${clock(loadedAt)}`}
          </Text>
        </Box>
      </Box>
    )
  })
}
