'use client'

import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts'
import { formatMoneyShort, formatMoney } from '@/lib/formatters'

type Point = { label: string; income: number; expense: number; savings?: number }

export function IncomeExpenseBars({ data, currency = 'INR' }: { data: Point[]; currency?: string }) {
  return (
    <div className="h-64">
      <ResponsiveContainer>
        <BarChart data={data} barCategoryGap="26%">
          <CartesianGrid strokeDasharray="3 3" stroke="#1E232E" vertical={false} />
          <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
          <YAxis axisLine={false} tickLine={false} tickFormatter={(v: number) => formatMoneyShort(v, currency)} tick={{ fontSize: 11 }} width={64} />
          <Tooltip formatter={(v: number) => formatMoney(v, currency)} contentStyle={{ backgroundColor: '#141822', borderColor: '#1E232E', borderRadius: 10 }} />
          <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="income" fill="#10B981" radius={[4, 4, 0, 0]} name="Income" />
          <Bar dataKey="expense" fill="#EF4444" radius={[4, 4, 0, 0]} name="Expense" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
