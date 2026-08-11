// ── 식약처 의약품 허가정보 API 설정 ──
const DRUG_API_BASE =
  "https://apis.data.go.kr/1471000/DrugPrdtPrmsnInfoService07/getDrugPrdtPrmsnDtlInq06";
const DRUG_API_KEY = "0Etcmuk6op0wz2DphT0c9jpRWf7vfw6OEB8jezpGHXhoyt7T7R2YY9T25%2BRjnCfaJlZBkpDsMrXZIpe8hHGAEQ%3D%3D";

// 한글 성분명에서 염·수화물 표기를 떼어 기본 성분명만 남긴다
// (interactions.json 키가 한글 기본명이므로 영문 변환표가 필요 없다)
function cleanIngredientName(kor) {
  let name = (kor || "").trim();
  const saltPatterns = [
    /염산염$/, /황산염$/, /질산염$/, /인산염$/, /탄산염$/, /초산염$/, /구연산염$/,
    /시트르산염$/, /타르타르산염$/, /주석산염$/, /말레산염$/, /푸마르산염$/,
    /베실산염$/, /캄실산염$/, /메실산염$/, /토실산염$/,
    /나트륨$/, /칼륨$/, /칼슘$/, /마그네슘$/,
    /삼수화물$/, /이수화물$/, /일수화물$/, /반수화물$/, /수화물$/
  ];
  let changed = true;
  while (changed) {
    changed = false;
    for (const p of saltPatterns) {
      if (p.test(name)) { name = name.replace(p, "").trim(); changed = true; }
    }
  }
  return name;
}

// API의 MATERIAL_NAME 문자열에서 "성분명 : XXX" 들을 모두 뽑아 한글 성분명 배열로 반환
function parseIngredientsFromMaterial(materialName) {
  const raw = materialName || "";
  const matches = raw.match(/성분명\s*:\s*([^|;]+)/g) || [];
  const result = [];
  for (const m of matches) {
    const kor = m.replace(/성분명\s*:\s*/, "").trim();
    const cleaned = cleanIngredientName(kor);
    if (cleaned && !result.includes(cleaned)) result.push(cleaned);
  }
  return result;
}


// item_name으로 API를 부르고 items 배열을 반환 (없으면 빈 배열)
async function callDrugApi(itemName) {
  const url = `${DRUG_API_BASE}?serviceKey=${DRUG_API_KEY}`
    + `&item_name=${encodeURIComponent(itemName)}`
    + `&type=json&numOfRows=5&pageNo=1`;
  console.log("① 호출 URL:", url);
  const res = await fetch(url);
  console.log("② 응답 상태:", res.status);
  const data = await res.json();
  let items = data?.body?.items;
  if (items && !Array.isArray(items)) items = [items];
  return Array.isArray(items) ? items : [];
}

// 상품명(정확 or 오인식)으로 성분배열 + 정식상품명을 함께 반환
// 반환: { ingredients: [...], resolvedName: "정식이름" | null }
// 약 이름 끝의 용량·수량 표기를 제거 (API는 "리피토정10mg"를 못 찾고 "리피토정"만 찾음)
function stripDosage(name) {
  return (name || "")
    .replace(/\s*\d+(\.\d+)?\s*(mg|밀리그램|mcg|마이크로그램|g|그램|ml|밀리리터|iu|정|캡슐)\b/gi, "")
    .replace(/\s*\d+(\.\d+)?\s*\/\s*\d+(\.\d+)?/g, "")  // "0.5/10" 같은 복합 용량
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchDrugInfo(productName) {
  const name = (productName || "").trim();
  try {
    // 1차: 이름 그대로 검색
    let items = await callDrugApi(name);

    // 1.5차: 용량 표기를 떼고 재검색 (예: "리피토정10mg" → "리피토정")
    if (items.length === 0) {
      const stripped = stripDosage(name);
      if (stripped && stripped !== name) {
        console.log("💊 용량 제거 후 재검색:", stripped);
        items = await callDrugApi(stripped);
      }
    }


    // 2차: 못 찾으면 뒷부분을 조금씩 잘라 앞부분으로 부분검색 (OCR 오인식 보정)
    if (items.length === 0 && name.length >= 3) {
      for (let cut = 1; cut <= 2 && name.length - cut >= 2; cut++) {
        const partial = name.slice(0, name.length - cut);
        items = await callDrugApi(partial);
        if (items.length > 0) break;
      }
    }

    if (items.length === 0) {
      console.log("❌ 검색 결과 없음:", name);
      return { ingredients: [], resolvedName: null };
    }

    const resolvedName = items[0]?.ITEM_NAME || name;
    const material = items[0]?.MATERIAL_NAME || "";
    console.log("⑤ 정식상품명:", resolvedName, "| 성분원문:", material);
    const list = parseIngredientsFromMaterial(material);
    console.log("⑥ 최종 성분배열:", list);
    return { ingredients: list, resolvedName };
  } catch (e) {
    console.log("❌ 에러 발생:", e);
    return { ingredients: [], resolvedName: null };
  }
}




// 전역 데이터 저장소
const DB = {
  products: {},
  interactions: {}
};

// ── 데이터 로드 ──
async function loadData() {
  const interactionsRes = await fetch('data/interactions.json');
  DB.interactions = await interactionsRes.json();
}


// ── 공백 제거 + 소문자화 (검색 비교용) ──
function normalize(str) {
  return (str || '').replace(/\s+/g, '').toLowerCase();
}

// ── 상품명 → 성분코드 배열 ──
// products.json 구조: { "상품명": { ingredients: [...], aliases: [...] } }
async function productToIngredients(productName) {
  const info = await fetchDrugInfo(productName);
  return info.ingredients;
}



// ── 성분코드 → 음식 정보 ──
function getInteraction(ingredientCode) {
  return DB.interactions[ingredientCode] || null;
}

// ── 검색: 입력어가 상품명(키) 또는 aliases에 부분일치하면 그 상품명(키) 반환 ──
// 반환값은 항상 "화면에 보여줄 상품명(키)" 목록. 별칭은 노출되지 않음.
function searchProducts(query, limit = 8) {
  const q = normalize(query);
  if (!q) return [];

  const results = [];
  for (const [productName, entry] of Object.entries(DB.products)) {
    const keys = [productName, ...(entry.aliases || [])];
    const matched = keys.some(k => normalize(k).includes(q));
    if (matched) results.push(productName);
    if (results.length >= limit) break;
  }
  return results;
}

// ── 임의 문자열(상품명 또는 별칭)을 정식 상품명(키)으로 변환 ──
// OCR 결과 등에서 별칭이 잡혔을 때 화면 표시용 상품명으로 되돌리는 데 사용.
// 일치하는 상품이 없으면 null 반환.
function resolveToProduct(name) {
  const target = normalize(name);
  if (!target) return null;

  // 1) 정식 상품명(키) 정확/부분 일치 우선
  if (DB.products[name]) return name;

  // 2) 키 또는 별칭에 대한 일치 탐색
  for (const [productName, entry] of Object.entries(DB.products)) {
    const keys = [productName, ...(entry.aliases || [])];
    if (keys.some(k => normalize(k) === target)) return productName;
  }
  // 3) 부분 일치 (별칭 포함)
  for (const [productName, entry] of Object.entries(DB.products)) {
    const keys = [productName, ...(entry.aliases || [])];
    if (keys.some(k => normalize(k).includes(target) || target.includes(normalize(k)))) {
      return productName;
    }
  }
  return null;
}
