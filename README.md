# 건축물대장 바로보기

주소 검색 → 건축물대장(표제부·총괄표제부·층별개요·전유부·지역지구) 열람.
빌드 과정 없는 정적 페이지 + Vercel 서버리스 함수 1개로 구성됩니다.

```
public/index.html   화면 (카카오 우편번호 주소 검색, 탭별 대장 표시)
api/building.js     건축HUB 건축물대장정보 API 프록시 (서비스키 숨김, CDN 캐시)
```

## 필요한 키 1개

| 환경변수 | 발급처 |
|---|---|
| `DATA_GO_KR_KEY` | 공공데이터포털 – 국토교통부_건축HUB_건축물대장정보 서비스 |

주소 검색은 키가 필요 없는 카카오(다음) 우편번호 서비스를 씁니다.
선택한 주소의 법정동코드(`bcode`, 10자리)와 지번주소의 번·지를 건축물대장 조회 키로 변환합니다.

## 배포 (Vercel)

1. 이 폴더를 GitHub 저장소로 올리기
2. vercel.com → Add New Project → 저장소 선택 (Framework: **Other**, 빌드 설정 그대로)
3. Settings → Environment Variables 에 `DATA_GO_KR_KEY` 등록
4. Deploy

로컬 테스트: `npm i -g vercel` → `.env.example`을 `.env`로 복사해 키 입력 → `vercel dev`

## 참고

- 공공데이터포털 키는 승인 직후 1~2시간 동안 `SERVICE_KEY_IS_NOT_REGISTERED_ERROR`가 날 수 있습니다.
- 개발계정 일일 트래픽 제한이 있어 응답을 CDN에 하루 캐시합니다. 서비스 규모가 커지면 포털에서 운영계정 전환을 신청하세요.
- 이 데이터는 참고용이며 법적 효력 있는 열람·발급은 정부24/세움터에서 해야 합니다.

## Netlify로 하려면

`api/*.js`를 `netlify/functions/`로 옮기고 핸들러를 `export default async (req) => new Response(...)` 형식으로 바꾼 뒤,
`netlify.toml`에 `/api/*` → `/.netlify/functions/:splat` 리다이렉트를 추가하면 됩니다. Vercel이 설정이 더 적습니다.
