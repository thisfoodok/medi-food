const selectedProducts = new Set();

const input = document.getElementById('searchInput');
const suggestionsEl = document.getElementById('suggestions');
const selectedEl = document.getElementById('selected');
const resultsEl = document.getElementById('results');

input.addEventListener('input', () => {
  const matches = searchProducts(input.value);
  suggestionsEl.innerHTML = matches
    .map(name => `<li data-name="${name}">${name}</li>`).join('');
});

suggestionsEl.addEventListener('click', (e) => {
  const li = e.target.closest('li');
  if (!li) return;
  selectedProducts.add(li.dataset.name);
  input.value = '';
  suggestionsEl.innerHTML = '';
  render();
});

function removeProduct(name) {
  selectedProducts.delete(name);
  render();
}

function render() {
  // 선택된 약 칩
  selectedEl.innerHTML = [...selectedProducts]
    .map(n => `<span class="chip">${n}<button onclick="removeProduct('${n}')">×</button></span>`)
    .join('');

  // 성분 집합 만들기
  const ingredients = new Set();
  selectedProducts.forEach(p =>
    productToIngredients(p).forEach(i => ingredients.add(i)));

  if (ingredients.size === 0) { resultsEl.innerHTML = ''; return; }

  resultsEl.innerHTML = [...ingredients].map(ing => {
    const info = getInteraction(ing);
    if (!info) {
      return `<div class="card"><h2>${ing}</h2>
        <p class="empty">이 약에 대한 음식 궁합 정보가 아직 없어요. (확인 불가)</p></div>`;
    }
    const avoid = info.avoid?.map(f =>
      `<div class="food-item avoid ${f.severity}">
         <div class="food">🚫 ${f.food}</div>
         <div class="reason">${f.reason}</div></div>`).join('') || '';
    const good = info.good?.map(f =>
      `<div class="food-item good">
         <div class="food">✅ ${f.food}</div>
         <div class="reason">${f.reason}</div></div>`).join('') || '';
    return `<div class="card">
      <h2>${info.displayName}</h2>
      ${avoid}${good}
      <div class="source">출처: ${info.source} (${info.lastUpdated})</div>
    </div>`;
  }).join('');
}

// 시작
loadData().then(render);
