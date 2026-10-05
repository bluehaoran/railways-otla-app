/** Splits by code point, so an emoji is one character. */
const chars = (s: string) => Array.from(s)

/** First character uppercase, the rest lowercase. */
function capitalise(s: string): string {
  const c = chars(s)
  return c.length === 0 ? '' : c[0].toUpperCase() + c.slice(1).join('').toLowerCase()
}

/**
 * One short code per player name.
 * - No clash: the first letter, uppercase.
 * - Names that share a first letter: every one of them is extended to the shortest
 *   prefix length that makes them all different (John, James -> Jo, Ja; Jo, John -> Jo, Joh).
 * - Identical names: the full name plus a digit (John1, John2).
 * - Empty name: P plus the seat number.
 */
export function playerCodes(names: string[]): string[] {
  const clean = names.map((n) => n.trim())
  const keys = clean.map((n) => n.toLowerCase())
  const codes = clean.map((n, i) => (n === '' ? `P${i + 1}` : ''))

  const occurrences = new Map<string, number>()
  for (const k of keys) occurrences.set(k, (occurrences.get(k) ?? 0) + 1)
  const seen = new Map<string, number>()
  clean.forEach((name, i) => {
    if (name === '' || occurrences.get(keys[i]) === 1) return
    const n = (seen.get(keys[i]) ?? 0) + 1
    seen.set(keys[i], n)
    codes[i] = capitalise(name) + n
  })

  const groups = new Map<string, number[]>()
  clean.forEach((_, i) => {
    if (codes[i] !== '') return
    const first = chars(keys[i])[0]
    groups.set(first, [...(groups.get(first) ?? []), i])
  })
  for (const members of groups.values()) {
    let length = 1
    const prefix = (i: number) => capitalise(chars(clean[i]).slice(0, length).join(''))
    const longest = Math.max(...members.map((i) => chars(clean[i]).length))
    while (length < longest && new Set(members.map(prefix)).size < members.length) length++
    for (const i of members) codes[i] = prefix(i)
  }

  // Last pass: a generated code can still collide with another one (a player named "John1").
  const used = new Set<string>()
  return codes.map((code) => {
    let out = code
    for (let n = 2; used.has(out.toLowerCase()); n++) out = `${code}${n}`
    used.add(out.toLowerCase())
    return out
  })
}

/** A message for each code that is empty or used twice (ignoring case), else null. */
export function codeProblems(codes: string[]): (string | null)[] {
  const keys = codes.map((c) => c.trim().toLowerCase())
  return keys.map((key, i) => {
    if (key === '') return 'Enter a code'
    return keys.some((other, j) => j !== i && other === key) ? 'This code is already used' : null
  })
}
