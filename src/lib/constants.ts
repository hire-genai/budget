export const TRANSACTION_TYPES = ['EXPENSE', 'INCOME', 'TRANSFER'] as const
export type TransactionType = (typeof TRANSACTION_TYPES)[number]

export const ACCOUNT_TYPES = ['BANK', 'CASH', 'CREDIT_CARD', 'WALLET', 'INVESTMENT', 'OTHER'] as const
export type AccountType = (typeof ACCOUNT_TYPES)[number]

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  BANK: 'Bank',
  CASH: 'Cash',
  CREDIT_CARD: 'Credit Card',
  WALLET: 'Wallet',
  INVESTMENT: 'Investment',
  OTHER: 'Other',
}

export const PAYMENT_METHODS = ['UPI', 'CASH', 'DEBIT_CARD', 'CREDIT_CARD', 'BANK_TRANSFER', 'WALLET', 'OTHER'] as const
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  UPI: 'UPI',
  CASH: 'Cash',
  DEBIT_CARD: 'Debit Card',
  CREDIT_CARD: 'Credit Card',
  BANK_TRANSFER: 'Bank Transfer',
  WALLET: 'Wallet',
  OTHER: 'Other',
}

export const NEED_TYPES = ['NEED', 'WANT'] as const
export type NeedType = (typeof NEED_TYPES)[number]

export const CATEGORY_KINDS = ['EXPENSE', 'INCOME'] as const
export type CategoryKind = (typeof CATEGORY_KINDS)[number]

export const FREQUENCIES = ['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY'] as const
export type Frequency = (typeof FREQUENCIES)[number]

export const FREQUENCY_LABELS: Record<Frequency, string> = {
  DAILY: 'Daily',
  WEEKLY: 'Weekly',
  MONTHLY: 'Monthly',
  QUARTERLY: 'Quarterly',
  YEARLY: 'Yearly',
}

export const BUDGET_PERIODS = ['WEEKLY', 'MONTHLY', 'YEARLY'] as const
export type BudgetPeriod = (typeof BUDGET_PERIODS)[number]

// Categorical palette (dataviz-friendly, brand-neutral)
export const CHART_COLORS = [
  '#6366F1', // indigo
  '#10B981', // green
  '#F59E0B', // amber
  '#EF4444', // red
  '#3B82F6', // blue
  '#8B5CF6', // purple
  '#14B8A6', // teal
  '#EC4899', // pink
  '#F97316', // orange
  '#84CC16', // lime
  '#06B6D4', // cyan
  '#A855F7', // violet
]

export function colorForIndex(i: number): string {
  return CHART_COLORS[i % CHART_COLORS.length]
}
