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
  const cleaned = text.replace(/\s+/g, ""); // 공백·줄바꿈 제거
  const found = [];

  Object.entries(DB.products).forEach(([productName, entry]) => {
    // 검사 대상: 정식 상품명 + 별칭 전부
    const candidates = [productName, ...((entry && entry.aliases) || [])];
    const matched = candidates.some((c) => {
      const key = (c || "").replace(/\s+/g, "");
      return key.length >= 2 && cleaned.includes(key);
    });
    if (matched) found.push(productName); // 담는 건 항상 상품명(키)
  });

  return [...new Set(found)];
}
