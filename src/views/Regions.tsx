import { useState } from 'react'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Card, ChartTooltip, InsightPanel } from '../components/ui'
import { collect, regionIllusion, regionOver, type Ctx } from '../lib/insights'
import { mil, pct, pp } from '../lib/format'
import type { Tokens } from '../lib/useTokens'

export default function Regions({ ctx, t, includeNonGeo }: { ctx: Ctx; t: Tokens; includeNonGeo: boolean }) {
  const { data, cur, prev, prevLabel } = ctx
  const [picked, setPicked] = useState<number | null>(null)
  const prevMap = new Map(prev?.regions.map((r) => [r.id, r.share]) ?? [])
  const chIdx = (name: string) => data.dims.channels.indexOf(name)
  // 비지역 정의는 데이터 산출 기준(meta.rules)을 따른다 — 실데이터·데모 데이터마다 다름
  const nonGeoDef = data.meta.rules.find((r) => r.startsWith('비지역 = '))?.slice('비지역 = '.length) ?? '특판 등'

  const rows = cur.regions.map((r) => {
    const custs = [...(cur.regionCustomer.get(r.id) ?? new Map()).entries()].sort((a, b) => b[1] - a[1])
    const ch = cur.regionChannel.get(r.id)
    const dist = ch?.get(chIdx('유통')) ?? 0
    const deliv = ch?.get(chIdx('납품')) ?? 0
    return {
      ...r,
      name: data.dims.regions[r.id],
      prev: prev ? prevMap.get(r.id) ?? 0 : null,
      delta: prev ? r.share - (prevMap.get(r.id) ?? 0) : null,
      topCust: custs[0] ? data.dims.customers[custs[0][0]].name : '-',
      topCustShare: custs[0] && r.amount > 0 ? (custs[0][1] / r.amount) * 100 : 0,
      delivShare: dist + deliv > 0 ? (deliv / (dist + deliv)) * 100 : 0,
      custs,
    }
  })
  const chart = rows.map((r) => ({ name: r.name, 현재: +r.share.toFixed(1), '전 기간': r.prev === null ? null : +r.prev.toFixed(1) }))
  const sel = rows.find((r) => r.id === picked) ?? rows[0]
  const drill = (sel?.custs ?? []).slice(0, 8).map(([cid, amt]) => ({
    name: data.dims.customers[cid].name,
    share: sel.amount > 0 ? +((amt / sel.amount) * 100).toFixed(1) : 0,
  }))
  const movers = rows.filter((r) => r.delta !== null).sort((a, b) => Math.abs(b.delta!) - Math.abs(a.delta!)).slice(0, 3)
  const axis = { stroke: t.axis, tick: { fill: t.muted, fontSize: 12 }, tickLine: false }

  return (
    <div className="space-y-4">
      {!includeNonGeo && (
        <p className="rounded-lg border border-line bg-wash px-3 py-2 text-[13px] text-ink2">
          비지역({nonGeoDef})·온라인 <b>제외 중</b>: 전체 순매출의 <b className="tabular">{pct(cur.excludedShare)}</b>가 지역 지표에서 빠졌습니다. 해당 거래처는 ‘거래처 의존도’ 화면에는 그대로 포함됩니다.
        </p>
      )}
      <div className="grid gap-4 lg:grid-cols-5">
        <Card title="지역별 매출 비중" note={prevLabel ? `현재 기간 vs ${prevLabel}` : '전 기간 데이터 없음'} className="lg:col-span-3">
          <div style={{ height: Math.max(220, chart.length * 38) }}>
            <ResponsiveContainer>
              <BarChart data={chart} layout="vertical" margin={{ top: 0, right: 24, left: 8, bottom: 0 }} barGap={2} barCategoryGap="28%">
                <CartesianGrid stroke={t.grid} horizontal={false} />
                <XAxis type="number" {...axis} unit="%" />
                <YAxis type="category" dataKey="name" {...axis} axisLine={false} width={96} />
                <Tooltip cursor={{ fill: 'var(--wash)' }} content={<ChartTooltip fmt={(v) => pct(v)} />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar isAnimationActive={false} dataKey="현재" fill={t.series1} radius={[0, 4, 4, 0]} onClick={(_, i) => setPicked(rows[i].id)} cursor="pointer" />
                {prev && <Bar isAnimationActive={false} dataKey="전 기간" fill={t.compare} radius={[0, 4, 4, 0]} />}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title={`${sel?.name ?? '-'} 지역 내 거래처 구성`} note="지역 쏠림이 거래처 1곳 때문인지 확인 · 막대나 표 행을 눌러 지역 변경" className="lg:col-span-2">
          <div style={{ height: Math.max(220, drill.length * 34) }}>
            <ResponsiveContainer>
              <BarChart data={drill} layout="vertical" margin={{ top: 0, right: 24, left: 8, bottom: 0 }}>
                <CartesianGrid stroke={t.grid} horizontal={false} />
                <XAxis type="number" {...axis} unit="%" domain={[0, 100]} />
                <YAxis type="category" dataKey="name" {...axis} axisLine={false} width={150} tick={{ fill: t.text2, fontSize: 11.5 }} />
                <Tooltip cursor={{ fill: 'var(--wash)' }} content={<ChartTooltip fmt={(v) => `지역 내 ${pct(v)}`} />} />
                <Bar isAnimationActive={false} dataKey="share" name="지역 내 비중" fill={t.series1} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card title="지역별 상세" note="순매출 단위: 백만 원 · 변화는 전 기간 대비 비중 차이">
        <div className="overflow-x-auto">
          <table className="tabular w-full min-w-[640px] text-[13px]">
            <thead>
              <tr className="border-b border-line text-left text-xs text-muted">
                <th className="py-2 font-medium">지역</th>
                <th className="py-2 text-right font-medium">순매출</th>
                <th className="py-2 text-right font-medium">비중</th>
                <th className="py-2 text-right font-medium">변화</th>
                <th className="py-2 pl-6 font-medium">지역 내 1위 거래처</th>
                <th className="py-2 text-right font-medium">지역 내 비중</th>
                <th className="py-2 text-right font-medium">납품 비율</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  onClick={() => setPicked(r.id)}
                  className={`cursor-pointer border-b border-line last:border-0 hover:bg-wash ${sel?.id === r.id ? 'bg-wash' : ''}`}
                >
                  <td className="py-2 font-medium text-ink">{r.name}</td>
                  <td className="py-2 text-right text-ink2">{mil(r.amount)}</td>
                  <td className="py-2 text-right text-ink">{pct(r.share)}</td>
                  <td className="py-2 text-right text-ink2">{pp(r.delta)}</td>
                  <td className="max-w-[220px] truncate py-2 pl-6 text-ink2">{r.topCust}</td>
                  <td className="py-2 text-right text-ink2">{pct(r.topCustShare)}</td>
                  <td className="py-2 text-right text-ink2">{pct(r.delivShare)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {movers.length > 0 && (
          <p className="mt-3 text-xs text-muted">
            변화 폭 상위: {movers.map((m) => `${m.name} ${pp(m.delta)}`).join(' · ')}
          </p>
        )}
      </Card>

      <InsightPanel items={collect(ctx, [regionIllusion, regionOver])} />
    </div>
  )
}
