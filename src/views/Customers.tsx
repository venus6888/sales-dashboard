import { useState } from 'react'
import { Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { THRESHOLDS } from '../config'
import { Card, ChartTooltip, InsightPanel, StatusBadge, customerLevel } from '../components/ui'
import { mainKey, overStreak } from '../lib/data'
import { collect, hhiStreak, shareJump, type Ctx } from '../lib/insights'
import { mil, pct, pctAxis, pp } from '../lib/format'
import type { Tokens } from '../lib/useTokens'

export default function Customers({ ctx, t }: { ctx: Ctx; t: Tokens }) {
  const { data, cur, prev, series, lastMonth } = ctx
  const [picked, setPicked] = useState<number | null>(null)
  const prevRank = new Map(prev?.customers.map((c, i) => [c.id, i + 1]) ?? [])
  const prevShare = new Map(prev?.customers.map((c) => [c.id, c.share]) ?? [])

  const top = cur.customers.slice(0, 10).map((c, i) => {
    const info = data.dims.customers[c.id]
    const pr = prevRank.get(c.id)
    return {
      ...c,
      rank: i + 1,
      name: info.name,
      group: info.group,
      rankMove: prev ? (pr ? pr - (i + 1) : null) : undefined,
      delta: prev ? c.share - (prevShare.get(c.id) ?? 0) : null,
      channel: data.dims.channels[mainKey(cur.customerChannel.get(c.id))] ?? '-',
      division: data.dims.divisions[mainKey(cur.customerDivision.get(c.id))] ?? '-',
      streak: overStreak(series, c.id, lastMonth),
      level: customerLevel(c.share),
    }
  })
  const selId = picked ?? top[0]?.id
  const selName = selId !== undefined ? data.dims.customers[selId]?.name : '-'
  const selSeries = series.map((p) => {
    const c = p.snap.customers.find((x) => x.id === selId)
    return { label: p.label, amount: +((c?.amount ?? 0) / 1e8).toFixed(2), share: +(c?.share ?? 0).toFixed(1) }
  })

  let cum = 0
  const positive = cur.customers.filter((c) => c.share > 0)
  const pareto = positive.map((c, i) => {
    cum += c.share
    return { rank: i + 1, cum: +Math.min(cum, 100).toFixed(1) }
  })
  const reach = (p: number) => pareto.find((x) => x.cum >= p)?.rank ?? '-'
  const axis = { stroke: t.axis, tick: { fill: t.muted, fontSize: 12 }, tickLine: false }
  const rankMove = (m: number | null | undefined) =>
    m === undefined ? '' : m === null ? '신규' : m > 0 ? `▲${m}` : m < 0 ? `▼${-m}` : '–'

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-5">
        <Card title="상위 10개 거래처 비중" note={`기준선: 주의 ${THRESHOLDS.customerWarn}% · 위험 ${THRESHOLDS.customerDanger}% · 막대를 눌러 거래처 선택`} className="lg:col-span-3">
          <div className="h-[380px]">
            <ResponsiveContainer>
              <BarChart data={top.map((c) => ({ name: c.name, share: +c.share.toFixed(1) }))} layout="vertical" margin={{ top: 16, right: 24, left: 8, bottom: 0 }}>
                <CartesianGrid stroke={t.grid} horizontal={false} />
                <XAxis type="number" {...axis} unit="%" {...pctAxis(top.map((c) => c.share))} />
                <YAxis type="category" dataKey="name" {...axis} axisLine={false} width={150} tick={{ fill: t.text2, fontSize: 11.5 }} />
                <ReferenceLine x={THRESHOLDS.customerWarn} stroke={t.warning} strokeWidth={1.5} label={{ value: '주의', position: 'top', fill: t.muted, fontSize: 11 }} />
                <ReferenceLine x={THRESHOLDS.customerDanger} stroke={t.critical} strokeWidth={1.5} label={{ value: '위험', position: 'top', fill: t.muted, fontSize: 11 }} />
                <Tooltip cursor={{ fill: 'var(--wash)' }} content={<ChartTooltip fmt={(v) => pct(v)} />} />
                <Bar isAnimationActive={false} dataKey="share" name="매출 비중" fill={t.series1} radius={[0, 4, 4, 0]} cursor="pointer" onClick={(_, i) => setPicked(top[i].id)} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="누적 비중 곡선" note={`상위 ${reach(50)}곳이 매출의 50%, ${reach(80)}곳이 80%를 차지`} className="lg:col-span-2">
          <div className="h-[380px]">
            <ResponsiveContainer>
              <LineChart data={pareto} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid stroke={t.grid} vertical={false} />
                <XAxis dataKey="rank" {...axis} type="number" domain={[1, 'dataMax']} label={{ value: '거래처 순위', position: 'insideBottomRight', offset: -2, fill: t.muted, fontSize: 11 }} />
                <YAxis {...axis} axisLine={false} unit="%" width={44} domain={[0, 100]} />
                <ReferenceLine y={50} stroke={t.axis} label={{ value: '50%', position: 'insideBottomRight', fill: t.muted, fontSize: 11 }} />
                <ReferenceLine y={80} stroke={t.axis} label={{ value: '80%', position: 'insideBottomRight', fill: t.muted, fontSize: 11 }} />
                <Tooltip content={({ active, payload }) => (active && payload?.length ? (
                  <div className="rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-lg text-ink">
                    상위 {payload[0].payload.rank}곳 누적 <b className="tabular">{pct(payload[0].value as number)}</b>
                  </div>) : null)} />
                <Line isAnimationActive={false} type="linear" dataKey="cum" stroke={t.series1} strokeWidth={2} dot={false} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card title="상위 거래처 상세" note="순매출 단위: 백만 원 · 초과 지속 = 기준 기간 마지막 달부터 연속으로 비중 15% 이상인 개월 수 · 행을 눌러 선택">
        <div className="overflow-x-auto">
          <table className="tabular w-full min-w-[820px] text-[13px]">
            <thead>
              <tr className="border-b border-line text-left text-xs text-muted">
                <th className="py-2 font-medium">순위</th>
                <th className="py-2 font-medium">변동</th>
                <th className="py-2 font-medium">거래처</th>
                <th className="py-2 text-right font-medium">순매출</th>
                <th className="py-2 text-right font-medium">비중</th>
                <th className="py-2 text-right font-medium">변화</th>
                <th className="py-2 pl-6 font-medium">주 채널</th>
                <th className="py-2 font-medium">거래처 그룹</th>
                <th className="py-2 font-medium">주 사업부</th>
                <th className="py-2 text-right font-medium">초과 지속</th>
                <th className="py-2 pl-4 font-medium">상태</th>
              </tr>
            </thead>
            <tbody>
              {top.map((c) => (
                <tr key={c.id} onClick={() => setPicked(c.id)} className={`cursor-pointer border-b border-line last:border-0 hover:bg-wash ${selId === c.id ? 'bg-wash' : ''}`}>
                  <td className="py-2 text-ink">{c.rank}</td>
                  <td className="py-2 text-xs text-ink2">{rankMove(c.rankMove)}</td>
                  <td className="max-w-[220px] truncate py-2 font-medium text-ink">{c.name}</td>
                  <td className="py-2 text-right text-ink2">{mil(c.amount)}</td>
                  <td className="py-2 text-right text-ink">{pct(c.share)}</td>
                  <td className="py-2 text-right text-ink2">{pp(c.delta)}</td>
                  <td className="py-2 pl-6 text-ink2">{c.channel}</td>
                  <td className="py-2 text-ink2">{c.group}</td>
                  <td className="py-2 text-ink2">{c.division}</td>
                  <td className="py-2 text-right text-ink2">{c.streak ? `${c.streak}개월` : '–'}</td>
                  <td className="py-2 pl-4"><StatusBadge level={c.level} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title={`${selName} · 월별 순매출`} note="단위: 억 원 · 기간 선택과 무관하게 전체 월 표시">
          <div className="h-56">
            <ResponsiveContainer>
              <BarChart data={selSeries} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid stroke={t.grid} vertical={false} />
                <XAxis dataKey="label" {...axis} />
                <YAxis {...axis} axisLine={false} width={40} />
                <Tooltip cursor={{ fill: 'var(--wash)' }} content={<ChartTooltip fmt={(v) => `${v.toFixed(2)}억 원`} />} />
                <Bar isAnimationActive={false} dataKey="amount" name="순매출" fill={t.series1} radius={[4, 4, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title={`${selName} · 월별 비중`} note={`주의 ${THRESHOLDS.customerWarn}% · 위험 ${THRESHOLDS.customerDanger}% 기준선`}>
          <div className="h-56">
            <ResponsiveContainer>
              <LineChart data={selSeries} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid stroke={t.grid} vertical={false} />
                <XAxis dataKey="label" {...axis} />
                <YAxis {...axis} axisLine={false} width={40} unit="%" {...pctAxis(selSeries.map((p) => p.share))} />
                <ReferenceLine y={THRESHOLDS.customerWarn} stroke={t.warning} strokeWidth={1.5} />
                <ReferenceLine y={THRESHOLDS.customerDanger} stroke={t.critical} strokeWidth={1.5} />
                <Tooltip content={<ChartTooltip fmt={(v) => pct(v)} />} />
                <Line isAnimationActive={false} type="linear" dataKey="share" name="비중" stroke={t.series1} strokeWidth={2} dot={{ r: 4, strokeWidth: 2, fill: t.surface }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <InsightPanel items={collect(ctx, [shareJump, hhiStreak])} />
    </div>
  )
}
