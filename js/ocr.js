// 이미지에서 텍스트를 읽는다 (브라우저 안에서만 처리, 서버 전송 없음)
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

// 전체 텍스트에서 우리 DB에 있는 약 이름/성분을 찾아낸다 (줄 배열 무시)
function extractDrugNameCandidates(text) {
  const cleaned = text.replace(/\s+/g, ""); // 공백·줄바꿈 모두 제거
  const found = [];

  // 1) products.json의 상품명이 텍스트 안에 통째로 들어있는지
  Object.keys(DB.products).forEach((name) => {
    const key = name.replace(/\s+/g, "");
    if (key.length >= 2 && cleaned.includes(key)) {
      found.push(name);
    }
  });

  // 2) interactions.json의 성분 한글명이 들어있는지 (예: '아토르바스타틴')
  Object.keys(DB.interactions).forEach((ing) => {
    const display = DB.interactions[ing].displayName || "";
    const korName = display.split(" ")[0]; // 괄호 앞 한글 성분명
    if (korName && korName.length >= 2 && cleaned.includes(korName.replace(/\s+/g, ""))) {
      // 상품명으로 이미 잡힌 것과 중복 방지 위해 성분명 자체를 후보로
      found.push(korName);
    }
  });

  return [...new Set(found)];
}

// 사용자가 고른 이름을 성분으로 연결
function resolveIngredients(rawName) {
  const clean = rawName.replace(/\s+/g, "");

  if (DB.products[rawName]) return DB.products[rawName];

  for (const productName of Object.keys(DB.products)) {
    const key = productName.replace(/\s+/g, "");
    if (clean.includes(key) || key.includes(clean)) {
      return DB.products[productName];
    }
  }

  for (const ing of Object.keys(DB.interactions)) {
    const korName = (DB.interactions[ing].displayName || "").split(" ")[0];
    if (korName && clean.includes(korName.replace(/\s+/g, ""))) {
      return [ing];
    }
  }

  return [];
}
