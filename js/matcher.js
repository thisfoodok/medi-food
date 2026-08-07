// 입력 문자열과 부분 일치하는 상품명 목록 반환
function searchProducts(query) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return Object.keys(DB.products)
    .filter(name => name.toLowerCase().includes(q))
    .slice(0, 8);
}

