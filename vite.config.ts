import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// base './' — 상대 경로 빌드. GitHub Pages 프로젝트 사이트(<org>.github.io/<repo>)와 커스텀 도메인 모두 동작
// 데모 모드는 public-demo/(더미 데이터)만 복사 — 실데이터 암호화본(public/)이 빌드에 섞이지 않는다
export default defineConfig(({ mode }) => ({
  base: './',
  publicDir: mode === 'demo' ? 'public-demo' : 'public',
  plugins: [react(), tailwindcss()],
}))
