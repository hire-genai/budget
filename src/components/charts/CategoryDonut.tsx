'use client'

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { formatMoney } from '@/lib/formatters'

export type DonutSlice = { name: string; value: number; color: string }

export function CategoryDonut({ data, currency = 'INR' }: { data: DonutSlice[]; currency?: string }) {
  const total = data.reduce((a, b) => a + b.value, 0)
  if (total === 0) return null
  return (
    <div className="relative h-56">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius={62} outerRadius={90} paddingAngle={2} stroke="#0B0D12" strokeWidth={2}>
            {data.map((s, i) => <Cell key={i} fill={s.color} />)}
          </Pie>
          <Tooltip
            formatter={(v: number, n: string) => [formatMoney(v, currency), n]}
            contentStyle={{ backgroundColor: '#141822', borderColor: '#1E232E', borderRadius: 10 }}
            labelStyle={{ color: '#9CA3AF' }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <div className="text-[10px] text-text-muted uppercase tracking-wider">Total</div>
        <div className="text-lg font-semibold tabular-nums">{formatMoney(total, currency)}</div>
      </div>
    </div>
  )
}
