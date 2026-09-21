import Decimal from 'decimal.js'

Decimal.set({ precision: 30, rounding: Decimal.ROUND_HALF_EVEN })

export type Money = Decimal
export type MoneyInput = Decimal | string | number

export function m(value: MoneyInput | null | undefined): Money {
  if (value === null || value === undefined || value === '') return new Decimal(0)
  return new Decimal(value)
}

export function add(...values: MoneyInput[]): Money {
  return values.reduce<Money>((acc, v) => acc.plus(m(v)), new Decimal(0))
}

export function sub(a: MoneyInput, b: MoneyInput): Money {
  return m(a).minus(m(b))
}

export function toStr(value: MoneyInput): string {
  return m(value).toFixed(2)
}

export function toNumber(value: MoneyInput): number {
  // ONLY for chart/UI display. Never for storage or calculations.
  return m(value).toNumber()
}

export function isNegative(value: MoneyInput): boolean {
  return m(value).isNegative()
}

export function isZero(value: MoneyInput): boolean {
  return m(value).isZero()
}

export function pct(part: MoneyInput, total: MoneyInput): number {
  const t = m(total)
  if (t.isZero()) return 0
  return m(part).div(t).mul(100).toDecimalPlaces(1).toNumber()
}
