import { NON_GEO_REGIONS, THRESHOLDS } from '../config'

export interface Customer {
  code: string
  name: string
  group: string
  region: string
}

export interface Summary {
  meta: {
    generatedAt: string
    source: string
    site: number
    sourceFile: string
    dataFrom: string
    dataTo: string
    sourceRows: number
    siteRows: number
    netTotal: number
    rules: string[]
  }
  dims: {
    months: number[]
    channels: string[]
    divisions: string[]
    categories: string[]
    regions: string[]
    customers: Customer[]
  }
  // [month, customer, channel, division, category, region, amount]
  rows: number[][]
}

export interface Filters {
  channel: number // -1 = 전체
  division: number
  category: number
  includeNonGeo: boolean
}

export interface Period {
  key: string
  label: string
  months: number[] // month 인덱스
  partial: boolean
}

export type PeriodMode = 'Q' | 'M' | 'A'

export function buildPeriods(months: number[], mode: PeriodMode): Period[] {
  if (mode === 'A') {
    // 전체 기간 — 비교 대상 기간이 없으므로 증감·변동은 표시되지 않는다
    const first = months[0]
    const last = months[months.length - 1]
    const y = (m: number) => Math.floor(m / 100)
    const label = y(first) === y(last)
      ? `${y(first)}년 ${first % 100}~${last % 100}월 전체`
      : `${y(first)}년 ${first % 100}월 ~ ${y(last)}년 ${last % 100}월 전체`
    return [{ key: 'ALL', label, months: months.map((_, i) => i), partial: false }]
  }
  if (mode === 'M') {
    return months.map((m, i) => ({ key: String(m), label: `${Math.floor(m / 100)}년 ${m % 100}월`, months: [i], partial: false }))
  }
  const byQ = new Map<string, number[]>()
  months.forEach((m, i) => {
    const key = `${Math.floor(m / 100)}-Q${Math.floor((m % 100 - 1) / 3) + 1}`
    byQ.set(key, [...(byQ.get(key) ?? []), i])
  })
  return [...byQ.entries()].map(([key, idx]) => {
    const [y, q] = key.split('-')
    const partial = idx.length < 3
    const range = partial ? ` (${idx.map((i) => months[i] % 100).join('·')}월, 진행 중)` : ''
    return { key, label: `${y}년 ${q}${range}`, months: idx, partial }
  })
}

const C = { month: 0, customer: 1, channel: 2, division: 3, category: 4, region: 5, amount: 6 }

function passes(r: number[], f: Filters) {
  return (f.channel < 0 || r[C.channel] === f.channel) &&
    (f.division < 0 || r[C.division] === f.division) &&
    (f.category < 0 || r[C.category] === f.category)
}

export interface Share {
  id: number
  amount: number
  share: number // %
}

export interface Snapshot {
  total: number
  geoTotal: number // 지역 지표 분모 (범위 설정 반영)
  excludedShare: number // 지역 범위에서 빠진 매출 비중 (%)
  customers: Share[] // 내림차순
  regions: Share[] // 내림차순, 범위 반영
  regionChannel: Map<number, Map<number, number>> // region → channel → amount
  regionCustomer: Map<number, Map<number, number>> // region → customer → amount
  customerChannel: Map<number, Map<number, number>>
  customerDivision: Map<number, Map<number, number>>
  hhiCustomer: number
  hhiRegion: number
  top5: number
  overWarn: number // 주의 기준 이상 거래처 수
}

function add<K>(m: Map<K, number>, k: K, v: number) {
  m.set(k, (m.get(k) ?? 0) + v)
}
function add2(m: Map<number, Map<number, number>>, a: number, b: number, v: number) {
  if (!m.has(a)) m.set(a, new Map())
  add(m.get(a)!, b, v)
}
function shares(m: Map<number, number>, total: number): Share[] {
  return [...m.entries()]
    .map(([id, amount]) => ({ id, amount, share: total ? (amount / total) * 100 : 0 }))
    .sort((a, b) => b.amount - a.amount)
}
// HHI = Σ(비중%)² — 순매출이 음수인 항목은 의존 위험이 아니므로 제외
const hhi = (s: Share[]) => s.reduce((acc, x) => acc + (x.share > 0 ? x.share * x.share : 0), 0)

export function snapshot(data: Summary, f: Filters, monthIdx: number[]): Snapshot {
  const months = new Set(monthIdx)
  const nonGeo = new Set(data.dims.regions.map((r, i) => (NON_GEO_REGIONS.includes(r) ? i : -1)).filter((i) => i >= 0))
  const byCust = new Map<number, number>()
  const byRegion = new Map<number, number>()
  const regionChannel = new Map<number, Map<number, number>>()
  const regionCustomer = new Map<number, Map<number, number>>()
  const customerChannel = new Map<number, Map<number, number>>()
  const customerDivision = new Map<number, Map<number, number>>()
  let total = 0
  let geoTotal = 0
  for (const r of data.rows) {
    if (!months.has(r[C.month]) || !passes(r, f)) continue
    const amt = r[C.amount]
    total += amt
    add(byCust, r[C.customer], amt)
    add2(customerChannel, r[C.customer], r[C.channel], amt)
    add2(customerDivision, r[C.customer], r[C.division], amt)
    if (!f.includeNonGeo && nonGeo.has(r[C.region])) continue
    geoTotal += amt
    add(byRegion, r[C.region], amt)
    add2(regionChannel, r[C.region], r[C.channel], amt)
    add2(regionCustomer, r[C.region], r[C.customer], amt)
  }
  const customers = shares(byCust, total)
  const regions = shares(byRegion, geoTotal)
  return {
    total,
    geoTotal,
    excludedShare: total ? ((total - geoTotal) / total) * 100 : 0,
    customers,
    regions,
    regionChannel,
    regionCustomer,
    customerChannel,
    customerDivision,
    hhiCustomer: hhi(customers),
    hhiRegion: hhi(regions),
    top5: customers.slice(0, 5).reduce((a, x) => a + x.share, 0),
    overWarn: customers.filter((x) => x.share >= THRESHOLDS.customerWarn).length,
  }
}

export interface MonthPoint {
  month: number
  label: string
  hhiCustomer: number
  hhiRegion: number
  topCustomerShare: number
  topCustomer: number
  topRegionShare: number
  topRegion: number
  snap: Snapshot
}

export function monthly(data: Summary, f: Filters): MonthPoint[] {
  return data.dims.months.map((m, i) => {
    const s = snapshot(data, f, [i])
    return {
      month: i,
      label: `${m % 100}월`,
      hhiCustomer: s.hhiCustomer,
      hhiRegion: s.hhiRegion,
      topCustomerShare: s.customers[0]?.share ?? 0,
      topCustomer: s.customers[0]?.id ?? -1,
      topRegionShare: s.regions[0]?.share ?? 0,
      topRegion: s.regions[0]?.id ?? -1,
      snap: s,
    }
  })
}

// 기준 기간 마지막 달부터 거슬러 올라가며 거래처 비중이 주의 기준 이상인 연속 개월 수
export function overStreak(series: MonthPoint[], customer: number, lastMonth: number) {
  let n = 0
  for (let i = lastMonth; i >= 0; i--) {
    const share = series[i].snap.customers.find((c) => c.id === customer)?.share ?? 0
    if (share >= THRESHOLDS.customerWarn) n++
    else break
  }
  return n
}

export function mainKey(m: Map<number, number> | undefined): number {
  if (!m) return -1
  let best = -1
  let bestV = -Infinity
  m.forEach((v, k) => {
    if (v > bestV) {
      bestV = v
      best = k
    }
  })
  return best
}
