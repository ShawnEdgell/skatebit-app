import { writable, derived, type Readable, type Writable } from 'svelte/store'

export interface SearchStore<Item, SortKey = unknown> {
  query: Writable<string>
  sortKey?: Writable<SortKey>
  results: Readable<Item[]>
}

export function createSearchStore<
  Item extends Record<string, any>,
  SortKey = unknown,
  Hit = Item,
>(
  baseData: Readable<Item[]>,
  index: { search: (q: string) => Promise<Hit[]> },
  opts?: {
    queryStore?: Writable<string>
    sortStore?: Writable<SortKey>
    sortFn?: (a: Item, b: Item, sortKey: SortKey) => number
    idField?: keyof Item
    hitToId?: (hit: Hit) => string
  },
): SearchStore<Item, SortKey> {
  const query = opts?.queryStore ?? writable('')
  const sortKey = opts?.sortStore
  const idField = (opts?.idField ?? 'id') as keyof Item
  const hitToId = opts?.hitToId

  const inputs = [query, baseData] as any[]
  if (sortKey) inputs.push(sortKey)

  const results = derived(
    inputs,
    (values: any[], set: (v: Item[]) => void) => {
      const q = (values[0] as string).trim().toLowerCase()
      const data = values[1] as Item[]
      const sKey = sortKey ? (values[2] as SortKey) : undefined

      if (!data.length) {
        set([])
        return
      }

      ;(async () => {
        let out: Item[]

        if (!q) {
          out = [...data]
        } else {
          const hits = await index.search(q) // Hit[]

          if (hitToId) {
            // Map hits to items by ID
            const map = new Map<string, Item>(
              data.map((item) => [String(item[idField]), item]),
            )
            out = hits
              .map((hit) => map.get(hitToId(hit)))
              .filter((x): x is Item => !!x)
          } else {
            // Assume Hit is actually the full Item
            out = hits as unknown as Item[]
          }
        }

        if (sortKey && opts?.sortFn && sKey !== undefined) {
          out.sort((a, b) => opts.sortFn!(a, b, sKey))
        }

        set(out)
      })()
    },
    [] as Item[],
  )

  return { query, sortKey, results }
}
