import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { THRESHOLDS } from '../config'
import { Card, ChartTooltip, InsightPanel, StatTile, customerLevel } from '../components/ui'
import { collect, hhiStreak, regionIllusion, shareJump, type Ctx } from '../lib/insights'
import { pct, pctAxis, pp, signed } from '../lib/format'
import type { Tokens } from '../lib/useTokens'

export default function Overview({ ctx, t }: { ctx: Ctx; t: Tokens }) {
  const { data, cur, prev, series } = ctx
  const custName = (id: number | undefined) => (id === undefined ? '-' : data.dims.customers[id]?.name ?? '-')
  const regName = (id: number | undefined) => (id === undefined ? '-' : data.dims.regions[id] ?? '-')
  const d = (a: number, b: number | undefined) => (prev && b !== undefined ? pp(a - b) : '비교 없음')

  const topR = cur.regions[0]
  const topC = cur.customers[0]
  const prevTopR = prev?.regions.find((r) => r.id === topR?.id)?.share ?? (prev ? 0 : undefined)
  const prevTopC = prev?.customers.find((c) => c.id === topC?.id)?.share ?? (prev ? 0 : undefined)

  const trend = series.map((p) => ({
    label: p.label,
    hhiRegion: Math.round(p.hhiRegion),
    hhiCustomer: Math.round(p.hhiCustomer),
    top: +p.topCustomerShare.toFixed(1),
    topName: custName(p.topCustomer),
  }))
  const axis = { stroke: t.axis, tick: { fill: t.muted, fontSize: 12 }, tickLine: false }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatTile
          label="1위 지역 비중"
          value={topR ? pct(topR.share) : '-'}
          subject={regName(topR?.id)}
          delta={topR ? d(topR.share, prevTopR) : undefined}
          level={topR && topR.share >= THRESHOLDS.regionWarn ? 'warn' : 'ok'}
          footnote={`주의 ${THRESHOLDS.regionWarn}% (잠정)`}
        />
        <StatTile
          label="1위 거래처 비중"
          value={topC ? pct(topC.share) : '-'}
          subject={custName(topC?.id)}
          delta={topC ? d(topC.share, prevTopC) : undefined}
          level={topC ? customerLevel(topC.share) : 'ok'}
          footnote={`주의 ${THRESHOLDS.customerWarn}% · 위험 ${THRESHOLDS.customerDanger}%`}
        />
        <StatTile label="상위 5개 거래처 누적 비중" value={pct(cur.top5)} delta={d(cur.top5, prev?.top5)} footnote="거래처 순매출 상위 5곳 합 ÷ 전체" />
        <StatTile
          label="거래처 HHI · 지역 HHI"
          value={`${Math.round(cur.hhiCustomer).toLocaleString()} · ${Math.round(cur.hhiRegion).toLocaleString()}`}
          delta={prev ? `${signed(cur.hhiCustomer - prev.hhiCustomer)} · ${signed(cur.hhiRegion - prev.hhiRegion)}` : '비교 없음'}
          level={cur.hhiCustomer >= THRESHOLDS.customerHhiWarn ? 'warn' : 'ok'}
          levelLabel="거래처 주의"
          footnote={`Σ(비중%)² · 거래처 주의 ${THRESHOLDS.customerHhiWarn.toLocaleString()} (잠정)`}
        />
        <StatTile
          label="경고 기준 초과 거래처"
          value={`${cur.overWarn}곳`}
          delta={prev ? `${cur.overWarn - prev.overWarn >= 0 ? '+' : ''}${cur.overWarn - prev.overWarn}곳` : '비교 없음'}
          level={cur.overWarn > 0 ? 'warn' : 'ok'}
          footnote={`비중 ${THRESHOLDS.customerWarn}% 이상`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="월별 쏠림 지수(HHI) 추이" note={`높을수록 소수에 집중 · 기준선: 거래처 주의 ${THRESHOLDS.customerHhiWarn.toLocaleString()} (잠정)`}>
          <div className="h-64">
            <ResponsiveContainer>
              <LineChart data={trend} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid stroke={t.grid} vertical={false} />
                <XAxis dataKey="label" {...axis} />
                <YAxis {...axis} axisLine={false} width={48} tickFormatter={(v) => v.toLocaleString()} />
                <ReferenceLine y={THRESHOLDS.customerHhiWarn} stroke={t.warning} strokeWidth={1.5} label={{ value: '주의', position: 'insideTopRight', fill: t.muted, fontSize: 11 }} />
                <Tooltip content={<ChartTooltip fmt={(v) => Math.round(v).toLocaleString()} />} />
                <Legend iconType="plainline" wrapperStyle={{ fontSize: 12, color: t.text2 }} />
                <Line isAnimationActive={false} type="linear" dataKey="hhiCustomer" name="거래처 HHI" stroke={t.series1} strokeWidth={2} dot={{ r: 4, strokeWidth: 2, fill: t.surface }} activeDot={{ r: 5 }} />
                <Line isAnimationActive={false} type="linear" dataKey="hhiRegion" name="지역 HHI" stroke={t.series2} strokeWidth={2} dot={{ r: 4, strokeWidth: 2, fill: t.surface }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="월별 1위 거래처 비중" note={`주의 ${THRESHOLDS.customerWarn}% · 위험 ${THRESHOLDS.customerDanger}% 기준선`}>
          <div className="h-64">
            <ResponsiveContainer>
              <LineChart data={trend} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid stroke={t.grid} vertical={false} />
                <XAxis dataKey="label" {...axis} />
                <YAxis {...axis} axisLine={false} width={40} unit="%" {...pctAxis(trend.map((p) => p.top))} />
                <ReferenceLine y={THRESHOLDS.customerWarn} stroke={t.warning} strokeWidth={1.5} label={{ value: '주의', position: 'insideTopRight', fill: t.muted, fontSize: 11 }} />
                <ReferenceLine y={THRESHOLDS.customerDanger} stroke={t.critical} strokeWidth={1.5} label={{ value: '위험', position: 'insideTopRight', fill: t.muted, fontSize: 11 }} />
                <Tooltip
                  content={({ active, payload, label }) =>
                    active && payload?.length ? (
                      <div className="rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-lg">
                        <div className="font-semibold text-ink">{label}</div>
                        <div className="text-ink2">{payload[0].payload.topName}</div>
                        <div className="tabular font-medium text-ink">{pct(payload[0].value as number)}</div>
                      </div>
                    ) : null
                  }
                />
                <Line isAnimationActive={false} type="linear" dataKey="top" name="1위 거래처 비중" stroke={t.series1} strokeWidth={2} dot={{ r: 4, strokeWidth: 2, fill: t.surface }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <InsightPanel items={collect(ctx, [shareJump, hhiStreak, regionIllusion])} />
    </div>
  )
}
