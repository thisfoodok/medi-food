const selectedProducts = new Set();

const input = document.getElementById('searchInput');
const suggestionsEl = document.getElementById('suggestions');
const selectedEl = document.getElementById('selected');
const resultsEl = document.getElementById('results');
const photoInput = document.getElementById('photoInput');
const ocrStatus = document.getElementById('ocrStatus');

// ── 검색 입력 ──
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

// ── 약봉투 촬영/업로드 → OCR ──
photoInput.addEventListener('change', async () => {
  const file = photoInput.files[0];
  if (!file) return;

  ocrStatus.textContent = "사진을 읽는 중… (0%)";
  try {
    const text = await runOCR(file, (p) => {
      ocrStatus.textContent = `사진을 읽는 중… (${p}%)`;
    });
    const found = extractProductsFromText(text);

    if (found.length === 0) {
      ocrStatus.textContent =
        "약 이름을 찾지 못했어요. 사진을 다시 찍거나 아래에서 직접 검색해 주세요.";
    } else {
      // ★ 안전장치: 자동 선택하지 않고 사용자에게 확인받는다
      ocrStatus.innerHTML =
        "이 약이 맞나요? 눌러서 추가하세요:<br>" +
        found.map(n =>
          `<button class="ocr-suggest" data-name="${n}">＋ ${n}</button>`
        ).join(" ");
    }
  } catch (err) {
    ocrStatus.textContent = "사진 인식에 실패했어요. 다시 시도해 주세요.";
  }
  photoInput.value = ""; // 같은 사진 다시 올릴 수 있게 초기화
});

// OCR이 제안한 약을 사용자가 눌러서 확정
ocrStatus.addEventListener('click', (e) => {
  const btn = e.target.closest('.ocr-suggest');
  if (!btn) return;
  selectedProducts.add(btn.dataset.name);
  btn.disabled = true;
  render();
});

// ── 약 제거 ──
function removeProduct(name) {
  selectedProducts.delete(name);
  render();
}

// ── 결과 렌더링 ──
function render() {
  selectedEl.innerHTML = [...selectedProducts]
    .map(n => `<span class="chip">${n}<button onclick="removeProduct('${n}')">×</button></span>`)
    .join('');

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
