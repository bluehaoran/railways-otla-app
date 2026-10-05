/** An in-memory Storage for tests. `quota` is the most characters it holds across all values. */
export function memoryStorage(quota = Infinity): Storage {
  const map = new Map<string, string>()
  return {
    get length() {
      return map.size
    },
    clear: () => map.clear(),
    getItem: (key) => map.get(key) ?? null,
    key: (i) => [...map.keys()][i] ?? null,
    removeItem: (key) => void map.delete(key),
    setItem(key, value) {
      let used = value.length
      for (const [k, v] of map) if (k !== key) used += v.length
      if (used > quota) throw new DOMException('The quota has been exceeded.', 'QuotaExceededError')
      map.set(key, value)
    },
  }
}
