// ── 식약처 의약품 허가정보 API 설정 ──
const DRUG_API_BASE =
  "https://apis.data.go.kr/1471000/DrugPrdtPrmsnInfoService07/getDrugPrdtPrmsnDtlInq06";
const DRUG_API_KEY = "0Etcmuk6op0wz2DphT0c9jpRWf7vfw6OEB8jezpGHXhoyt7T7R2YY9T25%2BRjnCfaJlZBkpDsMrXZIpe8hHGAEQ%3D%3D";  // ← 본인 키로 교체

const SALT_WORDS = [
  "besylate","hydrochloride","hcl","maleate","mesylate","sulfate",
  "sulphate","sodium","potassium","calcium","acetate","citrate",
  "tartrate","fumarate","succinate","phosphate","nitrate","bromide",
  "chloride","dihydrate","monohydrate","trihydrate","anhydrous"
];

function normalizeIngredientName(raw) {
  const words = raw.toLowerCase().trim().split(/\s+/)
    .filter(w => !SALT_WORDS.includes(w));
  return words.join(" ").trim();
}

async function fetchIngredientsFromApi(productName) {
  const url = `${DRUG_API_BASE}?serviceKey=${DRUG_API_KEY}`
    + `&item_name=${encodeURIComponent(productName)}`
    + `&type=json&numOfRows=1&pageNo=1`;
  console.log("① 호출 URL:", url);
  try {
    const res = await fetch(url);
    console.log("② 응답 상태:", res.status);
    const data = await res.json();
    console.log("③ 받은 데이터:", data);
    const items = data?.body?.items;
    console.log("④ items:", items);
    if (!Array.isArray(items) || items.length === 0) return [];
    const eng = items[0]?.MAIN_INGR_ENG || "";
    console.log("⑤ 영문성분:", eng);
    const list = eng.split("/")
      .map(s => normalizeIngredientName(s))
      .filter(Boolean);
    console.log("⑥ 최종 성분배열:", list);
    return [...new Set(list)];
  } catch (e) {
    console.log("❌ 에러 발생:", e);
    return [];
  }
}


// 전역 데이터 저장소
const DB = {
  products: {},
  interactions: {}
};

// ── 데이터 로드 ──
async function loadData() {
  const [productsRes, interactionsRes] = await Promise.all([
    fetch('data/products.json'),
    fetch('data/interactions.json')
  ]);
  DB.products = await productsRes.json();
  DB.interactions = await interactionsRes.json();
}

// ── 공백 제거 + 소문자화 (검색 비교용) ──
function normalize(str) {
  return (str || '').replace(/\s+/g, '').toLowerCase();
}

// ── 상품명 → 성분코드 배열 ──
// products.json 구조: { "상품명": { ingredients: [...], aliases: [...] } }
async function productToIngredients(productName) {
  const entry = DB.products[productName];
  if (entry && entry.ingredients && entry.ingredients.length > 0) {
    return entry.ingredients;
  }
  return await fetchIngredientsFromApi(productName);
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
