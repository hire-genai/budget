/**
 * Seed script — creates a demo user with 6 months of realistic transactions,
 * multiple accounts, budgets, recurring payments and financial goals.
 *
 * Run with: `npm run seed`
 * Demo credentials: demo@ledger.app / demo1234
 */

import { PrismaClient } from '@prisma/client'
import { addDays, startOfMonth, subMonths, format, setDate, addMonths } from 'date-fns'

const prisma = new PrismaClient()

const DEMO_EMAIL = 'demo@ledger.app'
const DEMO_NAME = 'Aarav Shah'

async function reset(userId: string) {
  // Delete children first thanks to cascades — but the relationships exist so a Cascade is enough
  await prisma.user.delete({ where: { id: userId } }).catch(() => {})
}

async function main() {
  const existing = await prisma.user.findUnique({ where: { email: DEMO_EMAIL } })
  if (existing) {
    console.log('Removing existing demo data…')
    await reset(existing.id)
  }

  const user = await prisma.user.create({
    data: {
      email: DEMO_EMAIL, name: DEMO_NAME,
      emailVerifiedAt: new Date(),
      currency: 'INR', timezone: 'Asia/Kolkata',
      settings: { create: {} },
    },
  })
  const userId = user.id

  // ---------- Categories (hierarchical) ----------
  type CatSpec = { name: string; slug: string; color: string; kind?: 'EXPENSE' | 'INCOME'; children?: { name: string; slug: string }[] }
  const catSpecs: CatSpec[] = [
    { name: 'Housing', slug: 'housing', color: '#6366F1', children: [
      { name: 'Rent', slug: 'housing-rent' },
      { name: 'Electricity', slug: 'housing-electricity' },
      { name: 'Water', slug: 'housing-water' },
      { name: 'Internet', slug: 'housing-internet' },
      { name: 'Maintenance', slug: 'housing-maintenance' },
    ]},
    { name: 'Food', slug: 'food', color: '#F59E0B', children: [
      { name: 'Groceries', slug: 'food-groceries' },
      { name: 'Restaurant', slug: 'food-restaurant' },
      { name: 'Swiggy', slug: 'food-swiggy' },
      { name: 'Zomato', slug: 'food-zomato' },
      { name: 'Snacks', slug: 'food-snacks' },
    ]},
    { name: 'Transportation', slug: 'transport', color: '#3B82F6', children: [
      { name: 'Fuel', slug: 'transport-fuel' },
      { name: 'Uber', slug: 'transport-uber' },
      { name: 'Ola', slug: 'transport-ola' },
      { name: 'Metro', slug: 'transport-metro' },
      { name: 'Vehicle Maintenance', slug: 'transport-maintenance' },
    ]},
    { name: 'Shopping', slug: 'shopping', color: '#EC4899', children: [
      { name: 'Clothing', slug: 'shopping-clothing' },
      { name: 'Electronics', slug: 'shopping-electronics' },
      { name: 'Personal Care', slug: 'shopping-care' },
      { name: 'Accessories', slug: 'shopping-accessories' },
    ]},
    { name: 'Entertainment', slug: 'entertainment', color: '#8B5CF6', children: [
      { name: 'Movies', slug: 'entertainment-movies' },
      { name: 'OTT', slug: 'entertainment-ott' },
      { name: 'Gaming', slug: 'entertainment-gaming' },
    ]},
    { name: 'Health', slug: 'health', color: '#10B981', children: [
      { name: 'Medicine', slug: 'health-medicine' },
      { name: 'Doctor', slug: 'health-doctor' },
      { name: 'Gym', slug: 'health-gym' },
      { name: 'Insurance', slug: 'health-insurance' },
    ]},
    { name: 'Financial', slug: 'financial', color: '#14B8A6', children: [
      { name: 'EMI', slug: 'financial-emi' },
      { name: 'Investment', slug: 'financial-investment' },
      { name: 'Bank Fees', slug: 'financial-bank-fees' },
    ]},
    { name: 'Bills', slug: 'bills', color: '#EF4444', children: [
      { name: 'Mobile', slug: 'bills-mobile' },
      { name: 'Subscriptions', slug: 'bills-subscriptions' },
    ]},
    { name: 'Other', slug: 'other', color: '#6B7280', children: [] },
    { name: 'Salary', slug: 'income-salary', color: '#10B981', kind: 'INCOME' },
    { name: 'Freelance', slug: 'income-freelance', color: '#3B82F6', kind: 'INCOME' },
    { name: 'Interest', slug: 'income-interest', color: '#14B8A6', kind: 'INCOME' },
    { name: 'Refund', slug: 'income-refund', color: '#8B5CF6', kind: 'INCOME' },
  ]

  const catBySlug = new Map<string, string>()
  for (const spec of catSpecs) {
    const parent = await prisma.category.create({
      data: { userId, name: spec.name, slug: spec.slug, color: spec.color, kind: spec.kind ?? 'EXPENSE', isSystem: true },
    })
    catBySlug.set(spec.slug, parent.id)
    for (const child of spec.children ?? []) {
      const c = await prisma.category.create({
        data: { userId, name: child.name, slug: child.slug, color: spec.color, kind: 'EXPENSE', isSystem: true, parentId: parent.id },
      })
      catBySlug.set(child.slug, c.id)
    }
  }

  // ---------- Accounts ----------
  const hdfc = await prisma.account.create({ data: { userId, name: 'HDFC Salary', type: 'BANK', openingBalance: '32000', currency: 'INR', color: '#6366F1' } })
  const sbi = await prisma.account.create({ data: { userId, name: 'SBI Savings', type: 'BANK', openingBalance: '85000', currency: 'INR', color: '#10B981' } })
  const cash = await prisma.account.create({ data: { userId, name: 'Cash', type: 'CASH', openingBalance: '1200', currency: 'INR', color: '#F59E0B' } })
  const gpay = await prisma.account.create({ data: { userId, name: 'Google Pay', type: 'WALLET', openingBalance: '450', currency: 'INR', color: '#3B82F6' } })
  const ccard = await prisma.account.create({ data: { userId, name: 'HDFC Credit Card', type: 'CREDIT_CARD', openingBalance: '0', currency: 'INR', color: '#EC4899' } })
  const invest = await prisma.account.create({ data: { userId, name: 'Zerodha', type: 'INVESTMENT', openingBalance: '120000', currency: 'INR', color: '#8B5CF6' } })

  // ---------- Merchants ----------
  const merchantNames = ['Swiggy', 'Zomato', 'Amazon', 'Uber', 'BigBasket', 'Netflix', 'Spotify', 'Airtel', 'BESCOM', 'Cult.fit', 'Blinkit', 'Domino’s', 'Apollo Pharmacy', 'BookMyShow', 'Shell Petrol', 'Café Coffee Day', 'Zepto', 'Myntra', 'Flipkart']
  const merchants = new Map<string, string>()
  for (const name of merchantNames) {
    const m = await prisma.merchant.create({ data: { userId, name } })
    merchants.set(name, m.id)
  }

  // ---------- Transactions across 6 months ----------
  type TxSpec = {
    amount: number; date: Date; type: 'EXPENSE' | 'INCOME' | 'TRANSFER'
    accountId: string; categorySlug?: string; merchant?: string; paymentMethod?: string
    needType?: 'NEED' | 'WANT'; isFixed?: boolean; description?: string
    transferAccountId?: string; isRefund?: boolean
  }
  const txs: TxSpec[] = []
  const today = new Date()

  // Reproducible PRNG so seeding is stable across runs.
  let seed = 123456
  const rand = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280 }
  const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)]
  const jitter = (base: number, spread: number) => Math.max(1, Math.round(base + (rand() * 2 - 1) * spread))

  for (let mAgo = 5; mAgo >= 0; mAgo--) {
    const monthStart = startOfMonth(subMonths(today, mAgo))

    // Salary (5th of each month) — income to HDFC
    txs.push({
      amount: jitter(85000, 500), date: setDate(monthStart, 5), type: 'INCOME',
      accountId: hdfc.id, categorySlug: 'income-salary', paymentMethod: 'BANK_TRANSFER',
      description: 'Monthly salary', isFixed: true,
    })

    // Optional freelance income some months
    if (rand() < 0.5) {
      txs.push({
        amount: jitter(18000, 4000), date: setDate(monthStart, 12 + Math.floor(rand() * 8)),
        type: 'INCOME', accountId: sbi.id, categorySlug: 'income-freelance',
        paymentMethod: 'BANK_TRANSFER', description: 'Freelance project payment',
      })
    }

    // Interest on savings
    if (mAgo % 3 === 0) {
      txs.push({
        amount: jitter(650, 100), date: setDate(monthStart, 28), type: 'INCOME',
        accountId: sbi.id, categorySlug: 'income-interest', description: 'Quarterly savings interest', paymentMethod: 'BANK_TRANSFER',
      })
    }

    // Fixed monthly expenses
    txs.push({ amount: 20000, date: setDate(monthStart, 3), type: 'EXPENSE', accountId: hdfc.id, categorySlug: 'housing-rent', description: 'Monthly rent', paymentMethod: 'BANK_TRANSFER', isFixed: true, needType: 'NEED' })
    txs.push({ amount: jitter(1800, 400), date: setDate(monthStart, 8), type: 'EXPENSE', accountId: hdfc.id, categorySlug: 'housing-electricity', merchant: 'BESCOM', description: 'Electricity bill', paymentMethod: 'UPI', isFixed: true, needType: 'NEED' })
    txs.push({ amount: 999, date: setDate(monthStart, 10), type: 'EXPENSE', accountId: hdfc.id, categorySlug: 'housing-internet', merchant: 'Airtel', description: 'Fibre internet', paymentMethod: 'UPI', isFixed: true, needType: 'NEED' })
    txs.push({ amount: 649, date: setDate(monthStart, 12), type: 'EXPENSE', accountId: hdfc.id, categorySlug: 'entertainment-ott', merchant: 'Netflix', description: 'Netflix subscription', paymentMethod: 'CREDIT_CARD', isFixed: true, needType: 'WANT' })
    txs.push({ amount: 119, date: setDate(monthStart, 12), type: 'EXPENSE', accountId: hdfc.id, categorySlug: 'entertainment-ott', merchant: 'Spotify', description: 'Spotify Premium', paymentMethod: 'UPI', isFixed: true, needType: 'WANT' })
    txs.push({ amount: 1499, date: setDate(monthStart, 15), type: 'EXPENSE', accountId: hdfc.id, categorySlug: 'health-gym', merchant: 'Cult.fit', description: 'Gym membership', paymentMethod: 'UPI', isFixed: true, needType: 'NEED' })
    txs.push({ amount: 399, date: setDate(monthStart, 18), type: 'EXPENSE', accountId: hdfc.id, categorySlug: 'bills-mobile', merchant: 'Airtel', description: 'Mobile recharge', paymentMethod: 'UPI', isFixed: true, needType: 'NEED' })

    // Variable food spending
    const foodMerchants = ['Swiggy', 'Zomato', 'Blinkit', 'Domino’s', 'BigBasket', 'Zepto', 'Café Coffee Day']
    const foodCategoryOptions = ['food-swiggy', 'food-zomato', 'food-restaurant', 'food-groceries', 'food-snacks']
    const foodOrders = 8 + Math.floor(rand() * 6)
    for (let i = 0; i < foodOrders; i++) {
      const day = 1 + Math.floor(rand() * 28)
      const amt = jitter(320, 220)
      txs.push({
        amount: amt, date: setDate(monthStart, day), type: 'EXPENSE',
        accountId: pick([hdfc.id, gpay.id, ccard.id]),
        categorySlug: pick(foodCategoryOptions),
        merchant: pick(foodMerchants),
        paymentMethod: pick(['UPI', 'CREDIT_CARD', 'UPI', 'WALLET']),
        needType: rand() < 0.6 ? 'WANT' : 'NEED',
      })
    }

    // Fuel + transport
    const fuelDays = 2 + Math.floor(rand() * 2)
    for (let i = 0; i < fuelDays; i++) {
      txs.push({
        amount: jitter(1400, 400), date: setDate(monthStart, 4 + Math.floor(rand() * 22)),
        type: 'EXPENSE', accountId: hdfc.id, categorySlug: 'transport-fuel',
        merchant: 'Shell Petrol', description: 'Fuel', paymentMethod: 'CREDIT_CARD', needType: 'NEED',
      })
    }
    const uberTrips = 4 + Math.floor(rand() * 5)
    for (let i = 0; i < uberTrips; i++) {
      txs.push({
        amount: jitter(210, 140), date: setDate(monthStart, 1 + Math.floor(rand() * 28)),
        type: 'EXPENSE', accountId: gpay.id, categorySlug: 'transport-uber',
        merchant: 'Uber', paymentMethod: 'UPI', needType: 'NEED',
      })
    }

    // Shopping (a few times)
    const shopCount = 2 + Math.floor(rand() * 3)
    for (let i = 0; i < shopCount; i++) {
      const day = 5 + Math.floor(rand() * 22)
      const amt = jitter(1800, 1400)
      txs.push({
        amount: amt, date: setDate(monthStart, day),
        type: 'EXPENSE', accountId: ccard.id,
        categorySlug: pick(['shopping-clothing', 'shopping-electronics', 'shopping-accessories', 'shopping-care']),
        merchant: pick(['Amazon', 'Flipkart', 'Myntra', 'Amazon']),
        paymentMethod: 'CREDIT_CARD', needType: 'WANT',
      })
    }

    // Health / medicine
    if (rand() < 0.6) {
      txs.push({
        amount: jitter(420, 200), date: setDate(monthStart, 10 + Math.floor(rand() * 15)),
        type: 'EXPENSE', accountId: gpay.id, categorySlug: 'health-medicine',
        merchant: 'Apollo Pharmacy', paymentMethod: 'UPI', needType: 'NEED',
      })
    }

    // Entertainment — a movie or event
    if (rand() < 0.55) {
      txs.push({
        amount: jitter(600, 300), date: setDate(monthStart, 15 + Math.floor(rand() * 12)),
        type: 'EXPENSE', accountId: ccard.id, categorySlug: 'entertainment-movies',
        merchant: 'BookMyShow', description: 'Movie tickets', paymentMethod: 'CREDIT_CARD', needType: 'WANT',
      })
    }

    // Credit card payment (a transfer from HDFC → CC on ~25th)
    const ccPayment = jitter(6500, 2500)
    txs.push({
      amount: ccPayment, date: setDate(monthStart, 25), type: 'TRANSFER',
      accountId: hdfc.id, transferAccountId: ccard.id,
      description: 'Credit card bill payment', paymentMethod: 'BANK_TRANSFER',
    })

    // Transfer to savings + investments
    txs.push({
      amount: 15000, date: setDate(monthStart, 6), type: 'TRANSFER',
      accountId: hdfc.id, transferAccountId: sbi.id,
      description: 'Monthly savings', paymentMethod: 'BANK_TRANSFER',
    })
    txs.push({
      amount: 10000, date: setDate(monthStart, 7), type: 'TRANSFER',
      accountId: sbi.id, transferAccountId: invest.id,
      description: 'SIP investment', paymentMethod: 'BANK_TRANSFER',
    })

    // Occasional refund
    if (rand() < 0.3) {
      txs.push({
        amount: jitter(300, 200), date: setDate(monthStart, 20 + Math.floor(rand() * 6)),
        type: 'EXPENSE', accountId: gpay.id, categorySlug: 'food-swiggy',
        merchant: 'Swiggy', description: 'Order refund', paymentMethod: 'UPI',
        isRefund: true, needType: 'WANT',
      })
    }
  }

  // Insert all
  for (const t of txs) {
    const merchantId = t.merchant ? merchants.get(t.merchant) ?? null : null
    const categoryId = t.categorySlug ? catBySlug.get(t.categorySlug) ?? null : null
    await prisma.transaction.create({
      data: {
        userId,
        amount: t.amount.toFixed(2),
        type: t.type,
        currency: 'INR',
        date: t.date,
        accountId: t.accountId,
        transferAccountId: t.transferAccountId ?? null,
        categoryId: t.type === 'TRANSFER' ? null : categoryId,
        merchantId: t.type === 'TRANSFER' ? null : merchantId,
        paymentMethod: t.paymentMethod ?? 'UPI',
        needType: t.needType ?? 'NEED',
        isFixed: !!t.isFixed,
        isRefund: !!t.isRefund,
        description: t.description,
      },
    })
  }

  // ---------- Budgets ----------
  const budgetStarts = startOfMonth(new Date())
  const budgetSpec: [string, number][] = [
    ['food', 12000],
    ['transport', 4500],
    ['shopping', 6000],
    ['entertainment', 2000],
    ['bills', 2500],
    ['health', 2500],
  ]
  for (const [slug, amt] of budgetSpec) {
    const catId = catBySlug.get(slug)!
    await prisma.budget.create({
      data: { userId, categoryId: catId, amount: amt.toFixed(2), period: 'MONTHLY', startsOn: budgetStarts },
    })
  }

  // ---------- Recurring ----------
  const nextMonth = addMonths(startOfMonth(today), 1)
  const recSpec: Array<{ name: string; amount: number; type: 'EXPENSE'|'INCOME'; categorySlug?: string; account: string; day: number; freq: string; pm: string }> = [
    { name: 'Rent', amount: 20000, type: 'EXPENSE', categorySlug: 'housing-rent', account: hdfc.id, day: 3, freq: 'MONTHLY', pm: 'BANK_TRANSFER' },
    { name: 'Netflix', amount: 649, type: 'EXPENSE', categorySlug: 'entertainment-ott', account: hdfc.id, day: 12, freq: 'MONTHLY', pm: 'CREDIT_CARD' },
    { name: 'Spotify', amount: 119, type: 'EXPENSE', categorySlug: 'entertainment-ott', account: hdfc.id, day: 12, freq: 'MONTHLY', pm: 'UPI' },
    { name: 'Airtel Internet', amount: 999, type: 'EXPENSE', categorySlug: 'housing-internet', account: hdfc.id, day: 10, freq: 'MONTHLY', pm: 'UPI' },
    { name: 'Airtel Mobile', amount: 399, type: 'EXPENSE', categorySlug: 'bills-mobile', account: hdfc.id, day: 18, freq: 'MONTHLY', pm: 'UPI' },
    { name: 'Cult.fit Gym', amount: 1499, type: 'EXPENSE', categorySlug: 'health-gym', account: hdfc.id, day: 15, freq: 'MONTHLY', pm: 'UPI' },
    { name: 'Salary', amount: 85000, type: 'INCOME', categorySlug: 'income-salary', account: hdfc.id, day: 5, freq: 'MONTHLY', pm: 'BANK_TRANSFER' },
  ]
  for (const r of recSpec) {
    const next = setDate(nextMonth, Math.min(r.day, 28))
    await prisma.recurringTransaction.create({
      data: {
        userId, name: r.name, amount: r.amount.toFixed(2), type: r.type,
        accountId: r.account, categoryId: r.categorySlug ? catBySlug.get(r.categorySlug)! : null,
        paymentMethod: r.pm, frequency: r.freq, intervalCount: 1,
        startDate: subMonths(next, 6), nextOccurrence: next, autoPost: false, isActive: true,
      },
    })
  }

  // Upcoming payments in the next 2 weeks (adjust nextOccurrence for a few)
  const soon = await prisma.recurringTransaction.findMany({ where: { userId }, orderBy: { name: 'asc' } })
  const daysFromNow = [2, 5, 7, 10]
  for (let i = 0; i < Math.min(daysFromNow.length, soon.length); i++) {
    await prisma.recurringTransaction.update({
      where: { id: soon[i].id },
      data: { nextOccurrence: addDays(today, daysFromNow[i]) },
    })
  }

  // ---------- Financial goals ----------
  await prisma.financialGoal.create({
    data: { userId, name: 'Buy Laptop', targetAmount: '80000', currentAmount: '35000',
      targetDate: addMonths(today, 8), color: '#6366F1', note: 'MacBook Air / Dell XPS' },
  })
  await prisma.financialGoal.create({
    data: { userId, name: 'Emergency Fund (6 months)', targetAmount: '300000', currentAmount: '145000',
      targetDate: addMonths(today, 18), color: '#10B981', note: '6× monthly expenses' },
  })
  await prisma.financialGoal.create({
    data: { userId, name: 'Trip to Japan', targetAmount: '150000', currentAmount: '22000',
      targetDate: addMonths(today, 14), color: '#EC4899' },
  })

  console.log(`✓ Seeded demo user: ${DEMO_EMAIL}`)
  console.log(`  Sign in with the OTP flow — the code will be printed to the`)
  console.log(`  server console (no SMTP configured) or emailed if SMTP is set.`)
}

main().then(() => prisma.$disconnect()).catch(async (e) => {
  console.error(e); await prisma.$disconnect(); process.exit(1)
})
