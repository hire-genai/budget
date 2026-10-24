// Conscious Spending Plan — 5 fixed category groups.
// Every user category slug maps to exactly one of these 5 groups.

export type GroupKey = 'INCOME' | 'FIXED' | 'INVEST' | 'SAVINGS' | 'GUILT_FREE'

export type GroupDef = {
  key: GroupKey
  label: string
  icon: string
  color: string
  colorSoft: string
  // Target percentage of income (null = no target). "better" tells which direction wins.
  target: { min: number | null; max: number | null; label: string; better: 'higher' | 'lower' | 'neutral' }
}

export const GROUPS: GroupDef[] = [
  {
    key: 'INCOME',
    label: 'Income',
    icon: 'arrow-down-to-line',
    color: '#10B981',
    colorSoft: '#064E3B',
    target: { min: null, max: null, label: '—', better: 'neutral' },
  },
  {
    key: 'FIXED',
    label: 'Fixed Costs',
    icon: 'home',
    color: '#F59E0B',
    colorSoft: '#78350F',
    target: { min: 50, max: 60, label: '50–60%', better: 'lower' },
  },
  {
    key: 'INVEST',
    label: 'Investments',
    icon: 'trending-up',
    color: '#6366F1',
    colorSoft: '#312E81',
    target: { min: 10, max: null, label: '≥10%', better: 'higher' },
  },
  {
    key: 'SAVINGS',
    label: 'Savings Goals',
    icon: 'piggy-bank',
    color: '#06B6D4',
    colorSoft: '#164E63',
    target: { min: 5, max: null, label: '≥5%', better: 'higher' },
  },
  {
    key: 'GUILT_FREE',
    label: 'Guilt-Free Spending',
    icon: 'smile',
    color: '#EC4899',
    colorSoft: '#831843',
    target: { min: null, max: 35, label: '≤35%', better: 'lower' },
  },
]

export function groupByKey(key: GroupKey): GroupDef {
  return GROUPS.find((g) => g.key === key) || GROUPS[1]
}

// Map a category slug (from the seed defaults or any user-created category) to one of the 5 groups.
// Falls back to FIXED for unknown expenses, INCOME for anything that looks like income.
const SLUG_GROUP_MAP: Record<string, GroupKey> = {
  // Income
  'income-salary': 'INCOME',
  'income-freelance': 'INCOME',
  'income-interest': 'INCOME',
  'income-refund': 'INCOME',
  'income-other': 'INCOME',

  // Fixed costs
  housing: 'FIXED',
  'housing-rent': 'FIXED',
  'housing-electricity': 'FIXED',
  'housing-water': 'FIXED',
  'housing-internet': 'FIXED',
  'housing-maintenance': 'FIXED',
  'food-groceries': 'FIXED',
  'transport-fuel': 'FIXED',
  'transport-metro': 'FIXED',
  'transport-bus': 'FIXED',
  'transport-maintenance': 'FIXED',
  'bills-mobile': 'FIXED',
  'bills-subscriptions': 'FIXED',
  'health-insurance': 'FIXED',
  'health-medicine': 'FIXED',
  'health-doctor': 'FIXED',
  'financial-emi': 'FIXED',
  'financial-bank-fees': 'FIXED',
  'financial-cc-fees': 'FIXED',
  'shopping-care': 'FIXED',
  'education-courses': 'FIXED',
  'education-books': 'FIXED',
  'education-certifications': 'FIXED',

  // Investments
  'financial-investment': 'INVEST',

  // Guilt-free
  entertainment: 'GUILT_FREE',
  'entertainment-movies': 'GUILT_FREE',
  'entertainment-ott': 'GUILT_FREE',
  'entertainment-gaming': 'GUILT_FREE',
  'entertainment-events': 'GUILT_FREE',
  'food-restaurant': 'GUILT_FREE',
  'food-swiggy': 'GUILT_FREE',
  'food-zomato': 'GUILT_FREE',
  'food-snacks': 'GUILT_FREE',
  'transport-uber': 'GUILT_FREE',
  'transport-ola': 'GUILT_FREE',
  'shopping-clothing': 'GUILT_FREE',
  'shopping-electronics': 'GUILT_FREE',
  'shopping-accessories': 'GUILT_FREE',
  'shopping-other': 'GUILT_FREE',
  'health-gym': 'GUILT_FREE',

  // Fallbacks
  food: 'FIXED',
  transport: 'FIXED',
  shopping: 'GUILT_FREE',
  bills: 'FIXED',
  health: 'FIXED',
  financial: 'FIXED',
  education: 'FIXED',
  other: 'FIXED',
}

export function categorySlugToGroup(
  slug: string | null | undefined,
  kind: 'EXPENSE' | 'INCOME' = 'EXPENSE',
): GroupKey {
  if (!slug) return kind === 'INCOME' ? 'INCOME' : 'FIXED'
  if (kind === 'INCOME') return 'INCOME'
  const direct = SLUG_GROUP_MAP[slug]
  if (direct) return direct
  // Any category whose name starts with "goal-" → savings
  if (slug.startsWith('goal-') || slug.startsWith('savings-')) return 'SAVINGS'
  if (slug.startsWith('invest') || slug.includes('stock') || slug.includes('mutual')) return 'INVEST'
  if (slug.startsWith('income') || slug.includes('salary')) return 'INCOME'
  return 'FIXED'
}

export type GroupStatus = 'good' | 'warn' | 'bad' | 'neutral'

export function evalGroupStatus(
  key: GroupKey,
  amount: number,
  income: number,
): { pct: number | null; status: GroupStatus; label: string; targetLabel: string } {
  const g = groupByKey(key)
  if (!income || income <= 0 || key === 'INCOME') {
    return { pct: null, status: 'neutral', label: '—', targetLabel: g.target.label }
  }
  const pct = (amount / income) * 100
  const t = g.target
  if (t.better === 'lower') {
    if (t.max !== null && pct <= t.max) return { pct, status: 'good', label: `${pct.toFixed(0)}%`, targetLabel: t.label }
    if (t.max !== null && pct <= t.max + 5) return { pct, status: 'warn', label: `${pct.toFixed(0)}%`, targetLabel: t.label }
    return { pct, status: 'bad', label: `${pct.toFixed(0)}%`, targetLabel: t.label }
  }
  if (t.better === 'higher') {
    if (t.min !== null && pct >= t.min) return { pct, status: 'good', label: `${pct.toFixed(0)}%`, targetLabel: t.label }
    if (t.min !== null && pct >= t.min - 2) return { pct, status: 'warn', label: `${pct.toFixed(0)}%`, targetLabel: t.label }
    return { pct, status: 'bad', label: `${pct.toFixed(0)}%`, targetLabel: t.label }
  }
  return { pct, status: 'neutral', label: `${pct.toFixed(0)}%`, targetLabel: t.label }
}

export function monthKeyFromISODate(iso: string): string {
  // "2026-09-14" → "2026-09"
  return iso.slice(0, 7)
}

export function monthLabel(key: string): string {
  // "2026-09" → "Sep 2026"
  const [y, m] = key.split('-')
  const d = new Date(Number(y), Number(m) - 1, 1)
  return d.toLocaleString('en-US', { month: 'short', year: 'numeric' })
}
