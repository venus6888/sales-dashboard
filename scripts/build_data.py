"""ERP 출고 매출 엑셀 → 대시보드용 집계 JSON.

사용법:
    python scripts/build_data.py <ERP엑셀경로> [출력경로]

- 사업장 10만 집계, 취소=Y 포함, 판매액(음수 포함) 합계 = 순매출
- 필요한 컬럼만 읽고 나머지(개인정보·원가 등)는 메모리에도 올리지 않는다
- 출력에는 집계값만 담기며 행 단위 원본은 포함하지 않는다
- 출력(data/sales-summary.json)은 평문이므로 커밋하지 않고, npm run encrypt 로 암호화해 public/ 에 둔다
"""
import json
import sys
import unicodedata
from datetime import datetime
from pathlib import Path

import pandas as pd

SITE = 10
USECOLS = ["사업장", "출고일", "출고월", "거래처", "거래처명", "거래처그룹명",
           "지역", "구분", "사업부", "대분류명", "판매액"]

# 잠정 지역 매핑 — 영업관리 확인 후 확정 (PRD 2장)
REGION_MAP = {
    "서울": "서울", "서울－강북": "서울", "서울－강남": "서울",
    "경기": "경기·인천", "경기－강남": "경기·인천", "경기－강북": "경기·인천", "인천": "경기·인천",
    "강원": "강원",
    "대전": "대전·충청", "충북": "대전·충청", "충남": "대전·충청",
    "전북": "전북",
    "광주": "광주·전남", "전남": "광주·전남",
    "대구": "대구·경북", "경북": "대구·경북",
    "부산": "부산·울산·경남", "울산": "부산·울산·경남", "경남": "부산·울산·경남",
    "제주": "제주",
    "특판": "비지역", "로얄RIM": "비지역", "해외": "비지역", "수출": "비지역", "신시장개척": "비지역",
}
ONLINE_DIVISIONS = {"자사몰", "종합몰"}
REGION_ORDER = ["서울", "경기·인천", "강원", "대전·충청", "전북", "광주·전남",
                "대구·경북", "부산·울산·경남", "제주", "온라인", "비지역", "미지정"]


def main(src: Path, out: Path) -> None:
    d = pd.read_excel(src, usecols=USECOLS, dtype=object)
    total_rows = len(d)
    d = d[pd.to_numeric(d["사업장"], errors="coerce") == SITE].copy()

    d["판매액"] = pd.to_numeric(d["판매액"], errors="coerce").fillna(0)
    d["출고월"] = pd.to_numeric(d["출고월"], errors="coerce").astype(int)
    d["거래처"] = d["거래처"].astype(str)
    # 전각 괄호·공백 등을 반각으로 통일 (예: （주） → (주))
    d["거래처명"] = d["거래처명"].astype(str).map(lambda s: unicodedata.normalize("NFKC", s).strip())
    d["사업부"] = d["사업부"].where(d["사업부"].notna() & (d["사업부"].astype(str) != "0"), "미지정").astype(str)
    d["대분류명"] = d["대분류명"].fillna("미지정").astype(str)
    d["구분"] = d["구분"].fillna("미지정").astype(str)
    d["region"] = d["지역"].map(REGION_MAP).fillna("미지정")
    d.loc[d["사업부"].isin(ONLINE_DIVISIONS), "region"] = "온라인"

    unmapped = sorted(set(d.loc[d["region"] == "미지정", "지역"].dropna().astype(str)))
    if unmapped:
        print(f"[경고] 지역 매핑에 없는 값: {unmapped} → '미지정'으로 처리")

    keys = ["출고월", "거래처", "구분", "사업부", "대분류명", "region"]
    g = d.groupby(keys, dropna=False)["판매액"].sum().reset_index()
    g = g[g["판매액"] != 0]

    cust = (d.groupby("거래처")
              .agg(name=("거래처명", "first"),
                   group=("거래처그룹명", lambda s: s.dropna().iloc[0] if s.notna().any() else "미지정"),
                   region=("지역", "first"))
              .reset_index())
    cust_idx = {c: i for i, c in enumerate(cust["거래처"])}

    def ordered(values, order=None):
        vals = sorted(set(values))
        if order:
            vals = [v for v in order if v in vals] + [v for v in vals if v not in order]
        return vals

    months = ordered(g["출고월"])
    channels = ordered(g["구분"], ["유통", "납품"])
    divisions = ordered(g["사업부"], ["1사업부", "2사업부", "3사업부", "RIM", "로얄RIM", "B2C"])
    categories = ordered(g["대분류명"], ["도기", "수전금구", "비데", "전략제품", "부품", "사입"])
    regions = ordered(g["region"], REGION_ORDER)
    idx = lambda vals: {v: i for i, v in enumerate(vals)}
    mi, chi, di, cai, ri = map(idx, (months, channels, divisions, categories, regions))

    rows = [[mi[r.출고월], cust_idx[r.거래처], chi[r.구분], di[r.사업부], cai[r.대분류명], ri[r.region], int(round(r.판매액))]
            for r in g.itertuples(index=False)]

    out_doc = {
        "meta": {
            "generatedAt": datetime.now().isoformat(timespec="seconds"),
            "source": "ERP 출고 매출",
            "site": SITE,
            "sourceFile": src.name,
            "dataFrom": str(int(pd.to_numeric(d["출고일"]).min())),
            "dataTo": str(int(pd.to_numeric(d["출고일"]).max())),
            "sourceRows": total_rows,
            "siteRows": len(d),
            "netTotal": int(round(d["판매액"].sum())),
            "rules": [
                "사업장 10만 집계",
                "취소=Y 행 포함",
                "순매출 = 판매액 합계(취소·반품·매출수정 음수 포함, 부가세 제외)",
                "온라인 = 사업부 자사몰·종합몰",
                "비지역 = 특판·로얄RIM·해외·수출·신시장개척",
                "지역 매핑은 잠정",
            ],
        },
        "dims": {
            "months": months,
            "channels": channels,
            "divisions": divisions,
            "categories": categories,
            "regions": regions,
            "customers": [{"code": r.거래처, "name": r.name, "group": r.group,
                           "region": REGION_MAP.get(r.region, "미지정")} for r in cust.itertuples(index=False)],
        },
        "columns": ["month", "customer", "channel", "division", "category", "region", "amount"],
        "rows": rows,
    }
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(out_doc, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"원본 {total_rows:,}행 → 사업장 {SITE} {len(d):,}행 → 집계 {len(rows):,}행")
    print(f"순매출 {out_doc['meta']['netTotal']:,}원, 기간 {out_doc['meta']['dataFrom']}~{out_doc['meta']['dataTo']}")
    print(f"저장: {out} ({out.stat().st_size / 1024:.0f} KB)")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    here = Path(__file__).resolve().parent.parent
    main(Path(sys.argv[1]), Path(sys.argv[2]) if len(sys.argv) > 2 else here / "data" / "sales-summary.json")
