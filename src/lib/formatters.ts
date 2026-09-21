import { toNumber, type MoneyInput } from './money'

const RUPEE = '₹'

export const CURRENCY_SYMBOLS: Record<string, string> = {
  INR: RUPEE,
  USD: '$',
  EUR: '€',
  GBP: '£',
  JPY: '¥',
  AUD: 'A$',
  CAD: 'C$',
}

export function currencySymbol(code = 'INR'): string {
  return CURRENCY_SYMBOLS[code] ?? code + ' '
}

export function formatMoney(value: MoneyInput, currency = 'INR', opts: { compact?: boolean; signed?: boolean } = {}): string {
  const symbol = currencySymbol(currency)
  const num = toNumber(value)
  const abs = Math.abs(num)
  const sign = num < 0 ? '-' : opts.signed && num > 0 ? '+' : ''
  if (opts.compact) {
    return `${sign}${symbol}${formatCompact(abs)}`
  }
  return `${sign}${symbol}${abs.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function formatCompact(n: number): string {
  if (n >= 1_00_00_000) return (n / 1_00_00_000).toFixed(2).replace(/\.00$/, '') + ' Cr'
  if (n >= 1_00_000) return (n / 1_00_000).toFixed(2).replace(/\.00$/, '') + ' L'
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k'
  return n.toFixed(0)
}

export function formatMoneyShort(value: MoneyInput, currency = 'INR'): string {
  return formatMoney(value, currency, { compact: true })
}

export function formatPercent(value: number, digits = 1): string {
  return `${value.toFixed(digits)}%`
}

export function formatDate(date: Date | string, style: 'short' | 'long' | 'time' | 'monthYear' = 'short'): string {
  const d = typeof date === 'string' ? new Date(date) : date
  if (style === 'time') {
    return d.toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    })
  }
  if (style === 'long') {
    return d.toLocaleString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })
  }
  if (style === 'monthYear') {
    return d.toLocaleString('en-IN', { month: 'long', year: 'numeric' })
  }
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function relativeDate(target: Date | string): string {
  const t = typeof target === 'string' ? new Date(target) : target
  const now = new Date()
  const diffMs = t.getTime() - now.getTime()
  const days = Math.round(diffMs / (1000 * 60 * 60 * 24))
  if (days === 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  if (days === -1) return 'Yesterday'
  if (days > 0 && days < 30) return `in ${days} days`
  if (days < 0 && days > -30) return `${Math.abs(days)} days ago`
  if (days >= 30 && days < 365) return `in ${Math.round(days / 30)} months`
  if (days <= -30 && days > -365) return `${Math.round(Math.abs(days) / 30)} months ago`
  return formatDate(t)
}
