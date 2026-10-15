import { useEffect, useState } from 'react'

// Recharts는 SVG 속성에 색을 넣으므로 CSS 변수를 실제 값으로 읽어 전달한다
const NAMES = ['text', 'text2', 'muted', 'grid', 'axis', 'surface', 'series1', 'series2', 'compare', 'warning', 'critical'] as const
export type Tokens = Record<(typeof NAMES)[number], string>

function read(): Tokens {
  const cs = getComputedStyle(document.documentElement)
  return Object.fromEntries(NAMES.map((n) => [n, cs.getPropertyValue(`--${n}`).trim()])) as Tokens
}

export function useTokens() {
  const [t, setT] = useState<Tokens>(read)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const on = () => setT(read())
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return t
}
