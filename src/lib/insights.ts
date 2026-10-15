import { INSIGHT_RULES, THRESHOLDS } from '../config'
import type { Insight } from '../components/ui'
import type { MonthPoint, Snapshot, Summary } from './data'
import { pct } from './format'

export interface Ctx {
  data: Summary
  cur: Snapshot
  prev: Snapshot | null
  series: MonthPoint[]
  lastMonth: number
  periodLabel: string
  prevLabel: string | null
}

const name = (d: Summary, id: number) => d.dims.customers[id]?.name ?? '-'

// 이상 탐지: 거래처 비중 전 기간 대비 +5%p 이상 (가장 크게 늘어난 1곳)
export function shareJump({ data, cur, prev, periodLabel, prevLabel }: Ctx): Insight | null {
  if (!prev) return null
  const prevMap = new Map(prev.customers.map((c) => [c.id, c.share]))
  const best = cur.customers
    .map((c) => ({ c, d: c.share - (prevMap.get(c.id) ?? 0) }))
    .sort((a, b) => b.d - a.d)[0]
  if (!best || best.d < INSIGHT_RULES.shareJumpPp) return null
  const before = prevMap.get(best.c.id) ?? 0
  return {
    type: '이상 탐지',
    text: `${name(data, best.c.id)} 비중이 ${pct(before)}에서 ${pct(best.c.share)}로 늘었습니다. 일회성 대형 납품인지, 거래 구조가 바뀐 것인지 확인해 볼 필요가 있습니다.`,
    basis: `${prevLabel} → ${periodLabel} 순매출 비중, +${best.d.toFixed(1)}%p`,
  }
}

// 추세 경고: 거래처 HHI 3개월 연속 주의 기준 이상
export function hhiStreak({ series, lastMonth }: Ctx): Insight | null {
  const n = INSIGHT_RULES.hhiStreakMonths
  if (lastMonth + 1 < n) return null
  const win = series.slice(lastMonth - n + 1, lastMonth + 1)
  if (!win.every((p) => p.hhiCustomer >= THRESHOLDS.customerHhiWarn)) return null
  return {
    type: '추세 경고',
    text: `거래처 쏠림(HHI)이 ${n}개월 연속 주의 기준(${THRESHOLDS.customerHhiWarn.toLocaleString()}) 이상입니다. 일시적 현상이 아닐 수 있습니다.`,
    basis: win.map((p) => `${p.label} ${Math.round(p.hhiCustomer).toLocaleString()}`).join(' · '),
  }
}

// 착시 경고: 1위 지역 매출의 80% 이상이 거래처 1곳
export function regionIllusion({ data, cur }: Ctx): Insight | null {
  const top = cur.regions[0]
  if (!top || top.amount <= 0) return null
  const custs = [...(cur.regionCustomer.get(top.id) ?? new Map()).entries()].sort((a, b) => b[1] - a[1])
  if (!custs.length) return null
  const [cid, amt] = custs[0]
  const inRegion = (amt / top.amount) * 100
  if (inRegion < INSIGHT_RULES.regionSingleCustomer) return null
  const region = data.dims.regions[top.id]
  return {
    type: '착시 경고',
    text: `${region} 지역 쏠림은 사실상 ${name(data, cid)} 1곳의 쏠림일 수 있습니다. 지역 전략보다 거래처 대응을 먼저 검토해 볼 수 있습니다.`,
    basis: `${region} 비중 ${pct(top.share)} 중 ${name(data, cid)} ${pct(inRegion)}`,
  }
}

// 지역 단일 비중 주의 기준
export function regionOver({ data, cur }: Ctx): Insight | null {
  const top = cur.regions[0]
  if (!top || top.share < THRESHOLDS.regionWarn) return null
  return {
    type: '참고',
    text: `${data.dims.regions[top.id]} 지역 비중이 주의 기준(${THRESHOLDS.regionWarn}%)을 넘었습니다.`,
    basis: `${data.dims.regions[top.id]} ${pct(top.share)} (지역 범위 설정 기준)`,
  }
}

export function collect(ctx: Ctx, rules: ((c: Ctx) => Insight | null)[]): Insight[] {
  return rules.map((r) => r(ctx)).filter((x): x is Insight => x !== null).slice(0, 3)
}
