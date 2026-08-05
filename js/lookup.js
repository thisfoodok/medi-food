// 데이터 저장소
const DB = { products: {}, interactions: {} };

// 두 개의 JSON 파일을 불러온다 (브라우저 안에서만 처리)
async function loadData() {
  const [products, interactions] = await Promise.all([
    fetch('data/products.json').then(r => r.json()),
    fetch('data/interactions.json').then(r => r.json())
  ]);
  DB.products = products;
  DB.interactions = interactions;
}

// 약 이름(상품명) → 성분 목록
function productToIngredients(productName) {
  return DB.products[productName] || [];
}

// 성분 → 음식 상호작용 정보
function getInteraction(ingredient) {
  return DB.interactions[ingredient] || null;
}
