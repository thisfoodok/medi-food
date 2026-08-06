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
function productToIngredients(productName) {
  const entry = DB.products[productName];
  if (!entry) return [];
  return entry.ingredients || [];
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
