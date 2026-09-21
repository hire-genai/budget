'use client'

import { AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'
import { formatMoney, formatMoneyShort, formatDate } from '@/lib/formatters'

export function TrendLine({ data, currency = 'INR' }: { data: { date: string; amount: number }[]; currency?: string }) {
  return (
    <div className="h-56">
      <ResponsiveContainer>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6366F1" stopOpacity={0.4} />
              <stop offset="100%" stopColor="#6366F1" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1E232E" vertical={false} />
          <XAxis dataKey="date"
            tickFormatter={(v: string) => new Date(v).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
            axisLine={false} tickLine={false} tick={{ fontSize: 11 }} interval="preserveStartEnd" />
          <YAxis tickFormatter={(v: number) => formatMoneyShort(v, currency)} axisLine={false} tickLine={false} tick={{ fontSize: 11 }} width={64} />
          <Tooltip
            formatter={(v: number) => [formatMoney(v, currency), 'Spent']}
            labelFormatter={(v: string) => formatDate(v, 'long')}
            contentStyle={{ backgroundColor: '#141822', borderColor: '#1E232E', borderRadius: 10 }} />
          <Area type="monotone" dataKey="amount" stroke="#6366F1" strokeWidth={2} fill="url(#trendFill)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
