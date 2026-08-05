const DB = { products: {}, interactions: {} };

async function loadData() {
  const [p, i] = await Promise.all([
    fetch('data/products.json').then(r => r.json()),
    fetch('data/interactions.json').then(r => r.json())
  ]);
  DB.products = p;
  DB.interactions = i;
}

// 성분코드로 상호작용 정보 반환 (없으면 null)
function getInteraction(ingredient) {
  return DB.interactions[ingredient] || null;
}
