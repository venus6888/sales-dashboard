export const pct = (v: number, d = 1) => `${v.toFixed(d)}%`

export const pp = (v: number | null) => {
  if (v === null || Number.isNaN(v)) return '비교 없음'
  const s = v > 0 ? '▲' : v < 0 ? '▼' : '–'
  return `${s} ${Math.abs(v).toFixed(1)}%p`
}

export const num = (v: number) => Math.round(v).toLocaleString('ko-KR')

// 억 원 (경영진 보고 단위)
export const eok = (v: number) => `${(v / 1e8).toFixed(1)}억 원`

// 백만 원 (표 단위)
export const mil = (v: number) => `${Math.round(v / 1e6).toLocaleString('ko-KR')}`

export const ymd = (s: string) => `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`

export const signed = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : '±'}${Math.abs(Math.round(v)).toLocaleString('ko-KR')}`

// 비중 축: 기준선(25%)이 항상 보이도록 최소 30%, 10%p 간격 눈금
export const pctAxis = (values: number[]) => {
  const top = Math.max(30, Math.ceil(Math.max(0, ...values) / 10) * 10)
  return { domain: [0, top] as [number, number], ticks: Array.from({ length: top / 10 + 1 }, (_, i) => i * 10) }
}
