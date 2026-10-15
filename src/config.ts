// 경고 기준 — PRD 4장 "공통 정의"
export const THRESHOLDS = {
  customerWarn: 15, // 단일 거래처 비중 주의 (%) — 확정
  customerDanger: 25, // 단일 거래처 비중 위험 (%) — 확정
  customerHhiWarn: 1000, // 거래처 HHI 주의 — 잠정
  regionWarn: 30, // 단일 지역 비중 주의 (%) — 잠정
}

// 인사이트 탐지 조건 — PRD 4장 "AI 인사이트 제안 패널"
export const INSIGHT_RULES = {
  shareJumpPp: 5, // 거래처 비중 전 기간 대비 +5%p 이상
  hhiStreakMonths: 3, // 거래처 HHI 3개월 연속 주의 이상
  regionSingleCustomer: 80, // 1위 지역 매출 중 거래처 1곳 비중 80% 이상
}

// "지역 범위: 제외" 시 지역 지표에서 빠지는 그룹
export const NON_GEO_REGIONS = ['비지역', '온라인', '미지정']
