// 이미지 파일에서 텍스트를 읽어낸다 (브라우저 안에서만 처리, 서버 전송 없음)
async function runOCR(file, onProgress) {
  const result = await Tesseract.recognize(file, "kor", {
    logger: (m) => {
      if (m.status === "recognizing text" && onProgress) {
        onProgress(Math.round(m.progress * 100));
      }
    }
  });
  return result.data.text;
}

// OCR로 읽은 텍스트에서 '약 이름처럼 보이는 줄'을 후보로 뽑아낸다
function extractDrugNameCandidates(text) {
  const lines = text.split(/\n/);
  const candidates = [];

  lines.forEach((line) => {
    const t = line.trim();
    if (!t) return;

    // 약 이름에 흔히 붙는 단서: 정/캡슐/시럽/mg/서방정 등
    const looksLikeDrug =
      /(정|캡슐|시럽|산|주|서방정|장용정|mg|밀리그램)/i.test(t);

    // 너무 짧거나(1글자) 숫자·기호만 있는 줄은 제외
    const hasKorean = /[가-힣]/.test(t);

    if (looksLikeDrug && hasKorean && t.length >= 2 && t.length <= 30) {
      candidates.push(t);
    }
  });

  // 중복 제거
  return [...new Set(candidates)];
}

// 사용자가 고른 이름(약봉투에 적힌 대로)을 우리 DB의 성분으로 연결 시도
// 정확히 없으면 부분일치로 찾아보고, 그래도 없으면 빈 배열 반환
function resolveIngredients(rawName) {
  const clean = rawName.replace(/\s+/g, "");

  // 1) 정확히 일치하는 상품명
  if (DB.products[rawName]) return DB.products[rawName];

  // 2) 부분 일치: 등록된 상품명이 읽은 이름 안에 포함되는지
  for (const productName of Object.keys(DB.products)) {
    const key = productName.replace(/\s+/g, "");
    if (clean.includes(key) || key.includes(clean)) {
      return DB.products[productName];
    }
  }

  // 3) 성분 이름이 직접 들어있는지 (예: '아스피린'이 이름에 포함)
  for (const ing of Object.keys(DB.interactions)) {
    const display = DB.interactions[ing].displayName || "";
    // displayName의 앞부분(성분 한글명)만 비교
    const korName = display.split(" ")[0];
    if (korName && clean.includes(korName)) {
      return [ing];
    }
  }

  return []; // 못 찾음
}
