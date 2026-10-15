# 매출 집중도 대시보드

경영진 분기 회의용 — 거래처·지역별 매출 집중도로 의존 위험 대응 여부를 판단한다.
설계서: `../dashboard-prd.md`

> ※ 거래처별 매출(사내 기밀)을 포함한다. 저장소와 GitHub Pages 사이트는 **비공개**로 운영한다.

## 화면
| 주소 | 화면 | 판단 |
|------|------|------|
| `#overview` | 집중도 개요 | 이번 기간 의존 위험이 커졌는가 |
| `#regions` | 지역 포트폴리오 | 어느 지역에 쏠렸는가 (지역 내 거래처 드릴다운) |
| `#customers` | 거래처 의존도 | 누구에게 의존하는가, 경고 기준 초과 지속 기간 |

## 데모 모드 (더미 데이터)
공개 저장소·외부 시연용. 거래처명·금액은 모두 무작위 생성한 가상 데이터이며 로그인 없이 열린다.
- 더미 데이터 생성: `npm run demo-data` (`--seed N`으로 다른 데이터) → `public-demo/data/sales-summary.demo.json`(커밋 대상)
- 실행: `npm run dev:demo` / 빌드: `npm run build:demo` — `public-demo/`만 복사되어 실데이터 암호화본은 빌드에 들어가지 않는다
- `.github/workflows/deploy.yml`은 `build:demo`로 배포한다. 실데이터로 사내 배포할 때만 `npm run build`로 바꾼다
- 실데이터 암호화본(`public/data/*.enc.json`)은 `.gitignore`로 커밋하지 않는다

## 월 1회 데이터 갱신
1. ERP에서 매출 엑셀 다운로드 (로컬 보관 — **커밋 금지**, `.gitignore`가 `*.xlsx` 차단)
2. 집계 JSON 생성 (개인정보·원가 컬럼은 읽지 않음)
   ```bash
   python scripts/build_data.py "<ERP엑셀경로>"
   ```
   → `data/sales-summary.json`(평문, 커밋 금지) 갱신. `[경고] 지역 매핑에 없는 값` 이 나오면 `REGION_MAP`에 추가
3. 암호화: `npm run encrypt` → `public/data/sales-summary.enc.json`(커밋 대상)
4. 확인: `npm run dev` → http://localhost:5173
5. 커밋·푸시하면 GitHub Actions가 GitHub Pages로 배포

## 로그인 계정
- 계정은 `.env`의 `DASHBOARD_USERS=아이디:비밀번호,아이디:비밀번호` (형식은 `.env.example`, `.env`는 커밋 금지)
- 계정 추가·삭제·비밀번호 변경 후 `npm run encrypt` → 커밋·배포. 새 데이터 키로 다시 암호화되므로 삭제된 계정은 새 파일을 열 수 없다
- 동작 방식: 집계 데이터를 AES-256-GCM으로 암호화하고, 비밀번호(PBKDF2 310,000회)로만 복호화 키를 얻는다. 서버가 없는 정적 사이트에서도 비밀번호 없이는 데이터를 읽을 수 없다
- 한계: 비밀번호가 약하면 암호화 파일을 내려받아 추측 공격을 할 수 있으므로 12자 이상 무작위 비밀번호를 쓴다. 로그인 기록·잠금 기능은 없다. Pages 비공개 게시가 가능하면 함께 적용한다

## 기준값 변경
- 경고 기준·인사이트 조건: `src/config.ts`
- 지역 매핑·온라인/비지역 정의: `scripts/build_data.py` 상단
- 색상 테마(브랜드 가이드 반영 시): `src/index.css` 상단 토큰

## 배포 (최초 1회)
1. royalnco 조직에 **비공개(Private)** 저장소 생성 후 이 폴더를 푸시
2. Settings → Pages → Source: **GitHub Actions**
3. Settings → Pages → Visibility: **Private** (GitHub Enterprise Cloud 필요 — 정보관리팀 확인)
   - 비공개 게시 불가 시 배포하지 말고 `npm run build` 결과(`dist/`)를 사내 SharePoint로 공유
4. `.github/workflows/deploy.yml`이 main 푸시마다 빌드·배포

## 스택
Vite 6 · React 18 · TypeScript · Tailwind CSS 4 · Recharts 2 · Python(pandas) — 서버 기능 없음(정적 사이트)
