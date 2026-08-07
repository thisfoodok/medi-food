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

// 사진에서 읽은 전체 텍스트에서 products.json에 있는 약을 찾아낸다.
// 상품명(키)뿐 아니라 aliases(성분명 등)도 함께 검사하되, 결과엔 항상 상품명만 담는다.
function extractDrugNames(text) {
  const found = [];
  // 사진에서 읽은 글자를 줄 단위로 나눈다
  const lines = (text || "").split(/[\n\r]+/);

  for (const line of lines) {
    // 한글/영문/숫자만 남기고 나머지(기호·공백)는 제거
    const words = line.split(/[^가-힣A-Za-z0-9]+/);
    for (const w of words) {
      const word = (w || "").trim();
      // 한글이 2글자 이상 포함된 단어만 약 이름 후보로 본다
      const korCount = (word.match(/[가-힣]/g) || []).length;
      if (korCount >= 2 && !found.includes(word)) {
        found.push(word);
      }
    }
  }

  return found;
}

