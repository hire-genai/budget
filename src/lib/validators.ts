import { z } from 'zod'
import { ACCOUNT_TYPES, PAYMENT_METHODS, TRANSACTION_TYPES, NEED_TYPES, FREQUENCIES, BUDGET_PERIODS, CATEGORY_KINDS } from './constants'

const decimalString = z
  .union([z.string(), z.number()])
  .transform((v) => String(v).trim())
  .refine((v) => /^-?\d+(\.\d{1,4})?$/.test(v), 'Must be a valid number')

const positiveDecimal = decimalString.refine((v) => Number(v) > 0, 'Must be greater than zero')

const transactionBase = z.object({
  type: z.enum(TRANSACTION_TYPES),
  amount: positiveDecimal,
  date: z.string().datetime().or(z.string().min(1)),
  accountId: z.string().min(1),
  transferAccountId: z.string().optional().nullable(),
  categoryId: z.string().optional().nullable(),
  merchantId: z.string().optional().nullable(),
  merchantName: z.string().optional().nullable(),
  paymentMethod: z.enum(PAYMENT_METHODS).default('UPI'),
  needType: z.enum(NEED_TYPES).default('NEED'),
  isFixed: z.boolean().default(false),
  isRefund: z.boolean().default(false),
  description: z.string().max(500).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  tags: z.array(z.string()).optional(),
})

export const transactionCreateSchema = transactionBase
  .refine((v) => v.type !== 'TRANSFER' || !!v.transferAccountId, {
    path: ['transferAccountId'],
    message: 'Transfers require a destination account',
  })
  .refine((v) => v.type !== 'TRANSFER' || v.transferAccountId !== v.accountId, {
    path: ['transferAccountId'],
    message: 'Source and destination accounts must differ',
  })

export type TransactionCreateInput = z.infer<typeof transactionCreateSchema>

export const transactionPartialSchema = transactionBase.partial()

export const transactionUpdateSchema = transactionBase.partial().extend({
  id: z.string().min(1),
})

export const accountCreateSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(ACCOUNT_TYPES),
  openingBalance: decimalString.default('0'),
  currency: z.string().length(3).default('INR'),
  color: z.string().default('#6366F1'),
  icon: z.string().default('wallet'),
  note: z.string().max(500).optional().nullable(),
})

export const accountUpdateSchema = accountCreateSchema.partial().extend({
  archived: z.boolean().optional(),
})

export const categoryCreateSchema = z.object({
  name: z.string().min(1).max(80),
  parentId: z.string().optional().nullable(),
  kind: z.enum(CATEGORY_KINDS).default('EXPENSE'),
  color: z.string().default('#6366F1'),
  icon: z.string().default('tag'),
})

export const categoryUpdateSchema = categoryCreateSchema.partial()

export const budgetCreateSchema = z.object({
  categoryId: z.string().min(1),
  amount: positiveDecimal,
  period: z.enum(BUDGET_PERIODS).default('MONTHLY'),
  startsOn: z.string().optional(),
  rollover: z.boolean().default(false),
})

export const budgetUpdateSchema = budgetCreateSchema.partial()

export const recurringCreateSchema = z.object({
  name: z.string().min(1),
  amount: positiveDecimal,
  type: z.enum(['EXPENSE', 'INCOME']),
  accountId: z.string().min(1),
  categoryId: z.string().optional().nullable(),
  paymentMethod: z.enum(PAYMENT_METHODS).default('UPI'),
  frequency: z.enum(FREQUENCIES),
  intervalCount: z.number().int().min(1).max(365).default(1),
  startDate: z.string().min(1),
  endDate: z.string().optional().nullable(),
  autoPost: z.boolean().default(false),
  notes: z.string().max(2000).optional().nullable(),
})

export const recurringUpdateSchema = recurringCreateSchema.partial().extend({
  isActive: z.boolean().optional(),
})

export const goalCreateSchema = z.object({
  name: z.string().min(1).max(100),
  targetAmount: positiveDecimal,
  currentAmount: decimalString.default('0'),
  targetDate: z.string().optional().nullable(),
  color: z.string().default('#10B981'),
  icon: z.string().default('target'),
  note: z.string().max(500).optional().nullable(),
})

export const goalUpdateSchema = goalCreateSchema.partial()

export const goalContributionSchema = z.object({
  amount: positiveDecimal,
  note: z.string().max(200).optional().nullable(),
})

export const requestOtpSchema = z.object({
  email: z.string().email().transform((v) => v.toLowerCase()),
  name: z.string().min(2).max(80).optional(),
})

export const verifyOtpSchema = z.object({
  email: z.string().email().transform((v) => v.toLowerCase()),
  code: z.string().regex(/^\d{4,8}$/),
  name: z.string().min(2).max(80).optional(),
})
