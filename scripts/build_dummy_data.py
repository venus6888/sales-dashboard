"""데모용 더미 집계 JSON 생성 — 실제 ERP 데이터와 무관한 가상 데이터.

사용법:
    python scripts/build_dummy_data.py [출력경로] [--seed N]

- 출력 형식은 build_data.py 결과(data/sales-summary.json)와 동일하다
- 거래처명·금액은 모두 무작위 생성이며 실제 거래처·매출과 관계없다
- 출력(public-demo/data/sales-summary.demo.json)은 공개 데모 배포용으로 커밋한다
- 인사이트 패널이 동작하도록 집중 패턴(대형 건설사 납품 급증, 지역 착시)을 일부러 넣는다
"""
import json
import random
import sys
from datetime import datetime
from pathlib import Path

MONTHS = [202601, 202602, 202603, 202604, 202605, 202606, 202607, 202608]
CHANNELS = ["유통", "납품"]
DIVISIONS = ["1사업부", "2사업부", "3사업부", "RIM", "B2C", "자사몰", "종합몰"]
CATEGORIES = ["도기", "수전금구", "비데", "전략제품", "부품", "사입"]
REGIONS = ["서울", "경기·인천", "강원", "대전·충청", "전북", "광주·전남",
           "대구·경북", "부산·울산·경남", "제주", "온라인", "비지역"]
GEO_WEIGHTS = {"서울": 22, "경기·인천": 20, "강원": 4, "대전·충청": 9, "전북": 4,
               "광주·전남": 8, "대구·경북": 12, "부산·울산·경남": 4, "제주": 2}
CATEGORY_WEIGHTS = [36, 30, 10, 9, 8, 7]

PREFIX = ["가람", "나래", "다온", "한빛", "새솔", "푸른", "으뜸", "온누리", "해솔", "미르",
          "도담", "라온", "바른", "소담", "아라", "보람", "하늘", "누리", "별빛", "초록",
          "늘봄", "단비", "마루", "샘물", "여울"]
SUFFIX = {
    "거점유통점": ["도기상사", "건재", "욕실센터"],
    "기타유통점": ["세라믹", "타일", "설비", "바스"],
    "AS전문점": ["욕실서비스", "AS센터"],
    "건설사": ["건설", "종합건설", "개발"],
    "B2C(매장/온라인)": ["인테리어", "홈스토어"],
}


def pick(rng, weights: dict):
    return rng.choices(list(weights), weights=list(weights.values()))[0]


def make_customers(rng, n: int):
    used, out = set(), []
    groups = {"거점유통점": 15, "기타유통점": 40, "AS전문점": 20, "건설사": 10, "B2C(매장/온라인)": 15}
    while len(out) < n:
        group = pick(rng, groups)
        name = f"{rng.choice(PREFIX)}{rng.choice(SUFFIX[group])}"
        if name in used:
            continue
        used.add(name)
        region = "비지역" if group == "건설사" and rng.random() < 0.4 else pick(rng, GEO_WEIGHTS)
        # 거래 규모: 롱테일 분포 (월 평균, 원)
        base = rng.lognormvariate(16.3, 1.25)
        out.append({"code": f"D{len(out) + 1:04d}", "name": f"(주){name}" if group == "건설사" else name,
                    "group": group, "region": region, "base": base})
    return out


def main(out: Path, seed: int) -> None:
    rng = random.Random(seed)
    customers = make_customers(rng, 100)

    # 온라인몰 2곳 (사업부 자사몰·종합몰 → 지역 '온라인')
    customers += [
        {"code": "D9001", "name": "자사몰(데모)", "group": "B2C(매장/온라인)", "region": "온라인", "base": 6.0e7, "div": "자사몰"},
        {"code": "D9002", "name": "종합몰(데모)", "group": "B2C(매장/온라인)", "region": "온라인", "base": 4.5e7, "div": "종합몰"},
    ]
    # 집중 패턴: 부산·울산·경남 대형 건설사 — 2분기부터 납품 급증
    star = {"code": "D9100", "name": "(주)동해마린건설", "group": "건설사", "region": "부산·울산·경남", "base": 2.0e8}
    customers.append(star)
    # 2위권 건설사 (비지역 특판)
    customers.append({"code": "D9101", "name": "(주)다온종합건설", "group": "건설사", "region": "비지역", "base": 2.2e8})

    star_curve = [0.7, 0.8, 1.0, 2.6, 2.9, 3.4, 3.6, 3.9]  # base 대비 월별 배수
    season = [0.82, 0.78, 1.0, 1.05, 1.08, 1.02, 0.97, 0.95]

    agg: dict[tuple, int] = {}
    lines = 0
    for mi, _ in enumerate(MONTHS):
        for ci, c in enumerate(customers):
            if c is not star and rng.random() < 0.12:  # 해당 월 거래 없음
                continue
            mult = star_curve[mi] if c is star else season[mi] * rng.uniform(0.7, 1.3)
            amount = c["base"] * mult
            is_builder = c["group"] == "건설사"
            channel = 1 if is_builder else (1 if rng.random() < 0.08 else 0)
            if "div" in c:
                division = DIVISIONS.index(c["div"])
            elif c["group"] == "B2C(매장/온라인)":
                division = DIVISIONS.index("B2C")
            elif is_builder:
                division = DIVISIONS.index(rng.choice(["2사업부", "3사업부"]))
            else:
                division = DIVISIONS.index(rng.choice(["1사업부", "1사업부", "2사업부", "RIM"]))
            region = REGIONS.index(c["region"])
            # 대분류 2~4개로 나눠 담기
            cats = rng.sample(range(len(CATEGORIES)), k=rng.randint(2, 4))
            ws = [CATEGORY_WEIGHTS[k] * rng.uniform(0.5, 1.5) for k in cats]
            for k, w in zip(cats, ws):
                v = int(round(amount * w / sum(ws), -3))
                key = (mi, ci, channel, division, k, region)
                agg[key] = agg.get(key, 0) + v
                lines += rng.randint(3, 25)
            # 반품·매출수정 (음수)
            if rng.random() < 0.06:
                key = (mi, ci, channel, division, cats[0], region)
                agg[key] = agg.get(key, 0) - int(round(amount * rng.uniform(0.05, 0.3), -3))
                lines += 1

    rows = [[*k, v] for k, v in sorted(agg.items()) if v != 0]
    net = sum(r[-1] for r in rows)
    doc = {
        "meta": {
            "generatedAt": datetime.now().isoformat(timespec="seconds"),
            "source": "더미 데이터(가상)",
            "site": 10,
            "sourceFile": f"build_dummy_data.py (seed={seed})",
            "dataFrom": "20260102",
            "dataTo": "20260831",
            "sourceRows": lines,
            "siteRows": lines,
            "netTotal": net,
            "rules": [
                "가상 데이터 — 실제 거래처·매출과 무관",
                "순매출 = 판매액 합계(반품 음수 포함)",
                "온라인 = 사업부 자사몰·종합몰",
                "비지역 = 건설사 특판",
            ],
        },
        "dims": {
            "months": MONTHS,
            "channels": CHANNELS,
            "divisions": DIVISIONS,
            "categories": CATEGORIES,
            "regions": REGIONS,
            "customers": [{k: c[k] for k in ("code", "name", "group", "region")} for c in customers],
        },
        "columns": ["month", "customer", "channel", "division", "category", "region", "amount"],
        "rows": rows,
    }
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(doc, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"거래처 {len(customers)}곳 · 집계 {len(rows):,}행 · 순매출 {net:,}원")
    print(f"저장: {out} ({out.stat().st_size / 1024:.0f} KB)")


if __name__ == "__main__":
    args = sys.argv[1:]
    seed = 42
    if "--seed" in args:
        i = args.index("--seed")
        seed = int(args[i + 1])
        del args[i:i + 2]
    here = Path(__file__).resolve().parent.parent
    main(Path(args[0]) if args else here / "public-demo" / "data" / "sales-summary.demo.json", seed)
