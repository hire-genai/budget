import { prisma } from './prisma'

type CatSpec = { name: string; slug: string; color: string; children: { name: string; slug: string }[] }

export const DEFAULT_CATEGORIES: CatSpec[] = [
  {
    name: 'Housing', slug: 'housing', color: '#6366F1',
    children: [
      { name: 'Rent', slug: 'housing-rent' },
      { name: 'Electricity', slug: 'housing-electricity' },
      { name: 'Water', slug: 'housing-water' },
      { name: 'Internet', slug: 'housing-internet' },
      { name: 'Maintenance', slug: 'housing-maintenance' },
    ],
  },
  {
    name: 'Food', slug: 'food', color: '#F59E0B',
    children: [
      { name: 'Groceries', slug: 'food-groceries' },
      { name: 'Restaurant', slug: 'food-restaurant' },
      { name: 'Swiggy', slug: 'food-swiggy' },
      { name: 'Zomato', slug: 'food-zomato' },
      { name: 'Snacks', slug: 'food-snacks' },
    ],
  },
  {
    name: 'Transportation', slug: 'transport', color: '#3B82F6',
    children: [
      { name: 'Fuel', slug: 'transport-fuel' },
      { name: 'Uber', slug: 'transport-uber' },
      { name: 'Ola', slug: 'transport-ola' },
      { name: 'Metro', slug: 'transport-metro' },
      { name: 'Bus', slug: 'transport-bus' },
      { name: 'Vehicle Maintenance', slug: 'transport-maintenance' },
    ],
  },
  {
    name: 'Shopping', slug: 'shopping', color: '#EC4899',
    children: [
      { name: 'Clothing', slug: 'shopping-clothing' },
      { name: 'Electronics', slug: 'shopping-electronics' },
      { name: 'Personal Care', slug: 'shopping-care' },
      { name: 'Accessories', slug: 'shopping-accessories' },
      { name: 'Other', slug: 'shopping-other' },
    ],
  },
  {
    name: 'Entertainment', slug: 'entertainment', color: '#8B5CF6',
    children: [
      { name: 'Movies', slug: 'entertainment-movies' },
      { name: 'OTT', slug: 'entertainment-ott' },
      { name: 'Gaming', slug: 'entertainment-gaming' },
      { name: 'Events', slug: 'entertainment-events' },
    ],
  },
  {
    name: 'Health', slug: 'health', color: '#10B981',
    children: [
      { name: 'Medicine', slug: 'health-medicine' },
      { name: 'Doctor', slug: 'health-doctor' },
      { name: 'Gym', slug: 'health-gym' },
      { name: 'Insurance', slug: 'health-insurance' },
    ],
  },
  {
    name: 'Financial', slug: 'financial', color: '#14B8A6',
    children: [
      { name: 'EMI', slug: 'financial-emi' },
      { name: 'Bank Fees', slug: 'financial-bank-fees' },
      { name: 'Credit Card Fees', slug: 'financial-cc-fees' },
      { name: 'Investment', slug: 'financial-investment' },
    ],
  },
  {
    name: 'Education', slug: 'education', color: '#F97316',
    children: [
      { name: 'Courses', slug: 'education-courses' },
      { name: 'Books', slug: 'education-books' },
      { name: 'Certifications', slug: 'education-certifications' },
    ],
  },
  {
    name: 'Bills', slug: 'bills', color: '#EF4444',
    children: [
      { name: 'Mobile', slug: 'bills-mobile' },
      { name: 'Subscriptions', slug: 'bills-subscriptions' },
    ],
  },
  { name: 'Other', slug: 'other', color: '#6B7280', children: [] },
]

export const DEFAULT_INCOME_CATEGORIES = [
  { name: 'Salary', slug: 'income-salary', color: '#10B981' },
  { name: 'Freelance', slug: 'income-freelance', color: '#3B82F6' },
  { name: 'Interest', slug: 'income-interest', color: '#14B8A6' },
  { name: 'Refund', slug: 'income-refund', color: '#8B5CF6' },
  { name: 'Other Income', slug: 'income-other', color: '#6B7280' },
]

export async function seedNewUserDefaults(userId: string) {
  // Categories
  for (const parent of DEFAULT_CATEGORIES) {
    const p = await prisma.category.create({
      data: {
        userId, name: parent.name, slug: parent.slug, color: parent.color,
        kind: 'EXPENSE', isSystem: true,
      },
    })
    for (const c of parent.children) {
      await prisma.category.create({
        data: {
          userId, name: c.name, slug: c.slug, color: parent.color,
          kind: 'EXPENSE', isSystem: true, parentId: p.id,
        },
      })
    }
  }
  for (const inc of DEFAULT_INCOME_CATEGORIES) {
    await prisma.category.create({
      data: { userId, name: inc.name, slug: inc.slug, color: inc.color, kind: 'INCOME', isSystem: true },
    })
  }

  // A starter Cash account so the app is immediately usable.
  await prisma.account.create({
    data: {
      userId, name: 'Cash', type: 'CASH',
      openingBalance: '0', currency: 'INR', color: '#10B981', icon: 'wallet',
    },
  })
}
