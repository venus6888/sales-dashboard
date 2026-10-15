import type { Summary } from './data'

// scripts/encrypt-data.mjs 가 만든 암호화 파일 형식
interface Envelope {
  v: number
  kdf: { name: 'PBKDF2'; hash: 'SHA-256'; iterations: number }
  iv: string
  data: string
  keys: { user: string; salt: string; iv: string; key: string }[]
}

const enc = new TextEncoder()
const bytes = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
const b64 = (buf: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buf)))

export class LoginError extends Error {}

async function fetchEnvelope(): Promise<Envelope> {
  const r = await fetch(`${import.meta.env.BASE_URL}data/sales-summary.enc.json`, { cache: 'no-store' })
  if (!r.ok) throw new Error(`데이터 파일을 불러오지 못했습니다 (HTTP ${r.status})`)
  return r.json()
}

async function decryptWith(env: Envelope, rawKey: Uint8Array): Promise<Summary> {
  const key = await crypto.subtle.importKey('raw', rawKey, 'AES-GCM', false, ['decrypt'])
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes(env.iv) }, key, bytes(env.data))
  return JSON.parse(new TextDecoder().decode(plain))
}

// 로그인 성공 시 데이터와, 같은 탭에서 새로고침 시 재로그인을 생략하기 위한 세션 토큰을 돌려준다
export async function login(id: string, password: string): Promise<{ data: Summary; session: string }> {
  const env = await fetchEnvelope()
  const hash = b64(await crypto.subtle.digest('SHA-256', enc.encode(`royal-dashboard:${id.trim()}`)))
  const entry = env.keys.find((k) => k.user === hash)
  if (!entry) throw new LoginError()
  const base = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey'])
  const kek = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: bytes(entry.salt), iterations: env.kdf.iterations, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt'],
  )
  let raw: ArrayBuffer
  try {
    raw = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes(entry.iv) }, kek, bytes(entry.key))
  } catch {
    throw new LoginError()
  }
  return { data: await decryptWith(env, new Uint8Array(raw)), session: b64(raw) }
}

// 데모 모드 전용 — 평문 더미 데이터 (scripts/build_dummy_data.py)
export async function loadDemo(): Promise<Summary> {
  const r = await fetch(`${import.meta.env.BASE_URL}data/sales-summary.demo.json`, { cache: 'no-store' })
  if (!r.ok) throw new Error(`데모 데이터를 불러오지 못했습니다 (HTTP ${r.status})`)
  return r.json()
}

export async function resume(session: string): Promise<Summary> {
  return decryptWith(await fetchEnvelope(), bytes(session))
}
