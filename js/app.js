// 사용자가 확정한 약: { label, ingredients }
const selectedDrugs = [];

const input = document.getElementById('searchInput');
const suggestionsEl = document.getElementById('suggestions');
const selectedEl = document.getElementById('selected');
const resultsEl = document.getElementById('results');
const photoInput = document.getElementById('photoInput');
const ocrStatus = document.getElementById('ocrStatus');

input.addEventListener('input', () => {
  const matches = searchProducts(input.value);
  suggestionsEl.innerHTML = matches
    .map(name => `<li data-name="${name}">${name}</li>`).join('');
});

suggestionsEl.addEventListener('click', (e) => {
  const li = e.target.closest('li');
  if (!li) return;
  addDrug(li.dataset.name);
  input.value = '';
  suggestionsEl.innerHTML = '';
});

photoInput.addEventListener('change', async () => {
  const file = photoInput.files[0];
  if (!file) return;

  ocrStatus.textContent = "사진을 읽는 중… (0%)";
  try {
    const text = await runOCR(file, (p) => {
      ocrStatus.textContent = `사진을 읽는 중… (${p}%)`;
    });

    const candidates = extractDrugNameCandidates(text);

    // 후보 버튼
    let html = "";
    if (candidates.length === 0) {
      html += "약 이름 후보를 자동으로 뽑지 못했어요. 아래 '읽은 내용'에서 약 이름을 보고 직접 검색해 주세요.<br><br>";
    } else {
      html += "사진에서 이런 약 이름을 읽었어요. 맞는 것을 눌러 추가하세요:<br>" +
        candidates.map(n =>
          `<button class="ocr-suggest" data-name="${encodeURIComponent(n)}">＋ ${n}</button>`
        ).join(" ") + "<br><br>";
    }

    // ★ 디버그: OCR이 실제로 읽은 원본 텍스트를 보여준다
    html += `<details style="margin-top:8px">
      <summary style="cursor:pointer;color:#888">🔍 사진에서 읽은 전체 내용 보기</summary>
      <pre style="white-space:pre-wrap;font-size:.8rem;background:#f0f0f0;padding:10px;border-radius:8px;margin-top:6px">${text.replace(/</g,"&lt;")}</pre>
    </details>`;

    ocrStatus.innerHTML = html;
  } catch (err) {
    ocrStatus.textContent = "사진 인식에 실패했어요. 다시 시도해 주세요.";
  }
  photoInput.value = "";
});

ocrStatus.addEventListener('click', (e) => {
  const btn = e.target.closest('.ocr-suggest');
  if (!btn) return;
  const name = decodeURIComponent(btn.dataset.name);
  addDrug(name);
  btn.disabled = true;
});

function addDrug(rawName) {
  if (selectedDrugs.some(d => d.label === rawName)) return;
  const ingredients = resolveIngredients(rawName);
  selectedDrugs.push({ label: rawName, ingredients });
  render();
}

function removeDrug(index) {
  selectedDrugs.splice(index, 1);
  render();
}

function render() {
  selectedEl.innerHTML = selectedDrugs
    .map((d, i) => `<span class="chip">${d.label}<button onclick="removeDrug(${i})">×</button></span>`)
    .join('');

  if (selectedDrugs.length === 0) { resultsEl.innerHTML = ''; return; }

  const cards = selectedDrugs.map((d) => {
    if (d.ingredients.length === 0) {
      return `<div class="card"><h2>${d.label}</h2>
        <p class="empty">이 약에 대한 음식 궁합 정보가 아직 없어요. (확인 불가)</p></div>`;
    }
    return d.ingredients.map((ing) => {
      const info = getInteraction(ing);
      if (!info) {
        return `<div class="card"><h2>${d.label}</h2>
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
        <h2>${d.label}</h2>
        <p class="ingredient-note">→ ${info.displayName}</p>
        ${avoid}${good}
        <div class="source">출처: ${info.source} (${info.lastUpdated})</div>
      </div>`;
    }).join('');
  }).join('');

  resultsEl.innerHTML = cards;
}

loadData().then(render);
