import { supabase } from './supabase'

export interface DailyRating {
  date: string // 'YYYY-MM-DD'
  stars: number
  comment: string
  updated_at?: string
}

export type RatingsMap = Record<string, DailyRating>

const LS_KEY = 'earth_ratings'

/* ───────── Local helpers ───────── */
export function todayStr(): string {
  const d = new Date()
  return (
    d.getFullYear() +
    '-' +
    String(d.getMonth() + 1).padStart(2, '0') +
    '-' +
    String(d.getDate()).padStart(2, '0')
  )
}

export function dateStr(y: number, m: number, d: number): string {
  return y + '-' + String(m + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0')
}

export function isToday(d: string): boolean {
  return d === todayStr()
}

export function isPast(d: string): boolean {
  return d < todayStr()
}

export function isFuture(d: string): boolean {
  return d > todayStr()
}

/* ───────── LocalStorage fallback ───────── */
function loadLocal(): RatingsMap {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(LS_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function saveLocal(ratings: RatingsMap): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(ratings))
  } catch {
    /* ignore quota errors */
  }
}

/* ───────── Supabase operations ───────── */
/**
 * Fetch all ratings for a given month.
 * Logged in → Supabase. Otherwise → localStorage.
 */
export async function fetchMonthRatings(
  userId: string | null,
  year: number,
  month: number
): Promise<RatingsMap> {
  if (!userId) return loadLocal()

  const mm = String(month + 1).padStart(2, '0')
  const firstDay = `${year}-${mm}-01`
  const lastDay = `${year}-${mm}-${new Date(year, month + 1, 0).getDate()}`

  const { data, error } = await supabase
    .from('daily_ratings')
    .select('date, stars, comment, updated_at')
    .eq('user_id', userId)
    .gte('date', firstDay)
    .lte('date', lastDay)

  if (error || !data) return {}

  const result: RatingsMap = {}
  for (const row of data) {
    result[row.date] = {
      date: row.date,
      stars: row.stars,
      comment: row.comment || '',
      updated_at: row.updated_at,
    }
  }
  return result
}

/**
 * Insert or update a rating. Returns true on success.
 * Logged in → Supabase upsert. Otherwise → localStorage.
 */
export async function upsertRating(
  userId: string | null,
  date: string,
  stars: number,
  comment: string
): Promise<boolean> {
  if (!userId) {
    const all = loadLocal()
    all[date] = { date, stars, comment: comment || '', updated_at: new Date().toISOString() }
    saveLocal(all)
    return true
  }

  const { error } = await supabase
    .from('daily_ratings')
    .upsert(
      {
        user_id: userId,
        date,
        stars,
        comment: comment || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,date' }
    )

  return !error
}
