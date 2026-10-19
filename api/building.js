// 건축물대장 조회 프록시 (국토교통부 건축HUB 건축물대장정보 서비스)
// 서비스키를 브라우저에 노출하지 않고, CORS 문제도 피하기 위해 서버에서 호출합니다.
const BASE = "https://apis.data.go.kr/1613000/BldRgstHubService";

// 허용 오퍼레이션 (임의 호출 방지)
const OPS = {
  title: "getBrTitleInfo",               // 표제부
  recap: "getBrRecapTitleInfo",          // 총괄표제부
  floor: "getBrFlrOulnInfo",             // 층별개요
  expos: "getBrExposInfo",               // 전유부 (집합건물 호 목록)
  exposArea: "getBrExposPubuseAreaInfo", // 전유공용면적
  jijigu: "getBrJijiguInfo",             // 지역지구구역
  price: "getBrHsprcInfo",               // 주택가격
};

const isDigits = (v, n) => typeof v === "string" && new RegExp(`^\\d{${n}}$`).test(v);

export default async function handler(req, res) {
  const { op, sigunguCd, bjdongCd, platGbCd = "0", bun, ji, dongNm, hoNm } = req.query;
  const pageNo = String(parseInt(req.query.pageNo || "1", 10) || 1);
  const numOfRows = String(Math.min(parseInt(req.query.numOfRows || "100", 10) || 100, 1000));

  const operation = OPS[op];
  if (!operation) return res.status(400).json({ error: "지원하지 않는 조회 종류입니다." });
  if (!isDigits(sigunguCd, 5) || !isDigits(bjdongCd, 5) || !isDigits(bun, 4) || !isDigits(ji, 4)) {
    return res.status(400).json({ error: "지번 코드 형식이 올바르지 않습니다." });
  }

  const rawKey = (process.env.DATA_GO_KR_KEY || "").replace(/\s+/g, ""); // 복사 시 섞인 공백·줄바꿈 제거
  if (!rawKey) return res.status(500).json({ error: "서버에 DATA_GO_KR_KEY가 설정되지 않았습니다." });
  // 공공데이터포털 '인코딩 키'를 넣었든 '디코딩 키'를 넣었든 동작하도록 처리
  const serviceKey = rawKey.includes("%") ? rawKey : encodeURIComponent(rawKey);

  const params = new URLSearchParams({
    sigunguCd, bjdongCd, platGbCd, bun, ji, pageNo, numOfRows, _type: "json",
  });
  if (dongNm) params.set("dongNm", dongNm);
  if (hoNm) params.set("hoNm", hoNm);

  try {
    const r = await fetch(`${BASE}/${operation}?serviceKey=${serviceKey}&${params}`, {
      signal: AbortSignal.timeout(9000), // 응답이 없으면 9초 후 중단
    });
    const text = await r.text();

    // 진단 모드: ...&debug=1 을 붙이면 공공데이터포털 원본 응답을 그대로 보여줌 (키 값은 노출 안 함)
    if (req.query.debug === "1") {
      const envKey = process.env.DATA_GO_KR_KEY || "";
      return res.status(200).json({
        region: process.env.VERCEL_REGION || "unknown",
        keyLength: rawKey.length,
        keyHadWhitespace: envKey !== envKey.replace(/\s+/g, ""),
        keyHead: rawKey.slice(0, 4),
        upstreamStatus: r.status,
        upstreamRaw: text.slice(0, 1500),
      });
    }

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      // 키 오류 등은 XML로 내려오는 경우가 있음
      const msg = text.match(/<returnAuthMsg>(.*?)<\/returnAuthMsg>/)?.[1]
        || text.match(/<resultMsg>(.*?)<\/resultMsg>/)?.[1]
        || "API 응답을 해석할 수 없습니다.";
      return res.status(502).json({ error: `공공데이터 API 오류: ${msg}` });
    }

    const header = data?.response?.header;
    if (header && header.resultCode !== "00") {
      return res.status(502).json({ error: `공공데이터 API 오류: ${header.resultMsg}` });
    }

    const body = data?.response?.body || {};
    let items = body.items?.item ?? [];
    if (!Array.isArray(items)) items = [items];

    // 건축물대장은 자주 바뀌지 않으므로 CDN 캐시로 호출 횟수(일일 트래픽) 절약
    res.setHeader("Cache-Control", items.length
      ? "s-maxage=86400, stale-while-revalidate=604800"
      : "no-store"); // 빈 결과는 캐시하지 않음
    return res.status(200).json({
      totalCount: Number(body.totalCount || 0),
      pageNo: Number(pageNo),
      items,
    });
  } catch (e) {
    const timeout = e?.name === "TimeoutError" || e?.name === "AbortError";
    return res.status(502).json({
      error: timeout
        ? "공공데이터포털이 응답하지 않습니다(시간 초과). 서버 리전이 서울(icn1)인지 확인하세요."
        : `건축물대장 API 호출 오류: ${e?.cause?.code || e?.message || "알 수 없음"}`,
      region: process.env.VERCEL_REGION || "unknown",
    });
  }
}
