// 평문 집계 JSON → 로그인용 암호화 JSON
//
// 사용법: npm run encrypt   (.env 의 DASHBOARD_USERS 사용)
//   DASHBOARD_USERS=아이디1:비밀번호1,아이디2:비밀번호2
//
// 구조: 무작위 데이터 키(AES-256-GCM)로 집계 JSON을 암호화하고,
//       사용자별 비밀번호에서 PBKDF2로 만든 키로 데이터 키를 각각 감싼다.
//       브라우저는 로그인한 사용자의 비밀번호로만 데이터를 복호화할 수 있다.
// 사용자를 빼거나 비밀번호를 바꾸면 이 스크립트를 다시 실행해 새 데이터 키로 재암호화한다.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { webcrypto as crypto } from 'node:crypto'

const ITERATIONS = 310_000
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const src = resolve(root, 'data/sales-summary.json')
const out = resolve(root, 'public/data/sales-summary.enc.json')

try {
  process.loadEnvFile(resolve(root, '.env'))
} catch {
  // .env 가 없으면 환경변수만 사용
}
const users = (process.env.DASHBOARD_USERS ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)
  .map((s) => {
    const i = s.indexOf(':')
    return { id: s.slice(0, i).trim(), password: s.slice(i + 1) }
  })
if (!users.length || users.some((u) => !u.id || u.password.length < 8)) {
  console.error('DASHBOARD_USERS 형식: 아이디:비밀번호(8자 이상),아이디:비밀번호 — .env.example 참고')
  process.exit(1)
}

const enc = new TextEncoder()
const b64 = (buf) => Buffer.from(buf).toString('base64')
const rand = (n) => crypto.getRandomValues(new Uint8Array(n))
const sha256 = async (s) => b64(await crypto.subtle.digest('SHA-256', enc.encode(s)))

const dataKeyRaw = rand(32)
const dataKey = await crypto.subtle.importKey('raw', dataKeyRaw, 'AES-GCM', false, ['encrypt'])
const iv = rand(12)
const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, dataKey, readFileSync(src))

const keys = []
for (const u of users) {
  const salt = rand(16)
  const base = await crypto.subtle.importKey('raw', enc.encode(u.password), 'PBKDF2', false, ['deriveKey'])
  const kek = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt'],
  )
  const wiv = rand(12)
  const wrapped = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: wiv }, kek, dataKeyRaw)
  // 아이디는 원문 대신 해시로만 저장
  keys.push({ user: await sha256(`royal-dashboard:${u.id}`), salt: b64(salt), iv: b64(wiv), key: b64(wrapped) })
}

mkdirSync(dirname(out), { recursive: true })
writeFileSync(out, JSON.stringify({ v: 1, kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations: ITERATIONS }, iv: b64(iv), data: b64(ciphertext), keys }))
console.log(`암호화 완료: 사용자 ${users.length}명 → ${out}`)
