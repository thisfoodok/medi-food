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

// 사진에서 읽은 전체 텍스트에서 products.json에 있는 약 이름을 찾아낸다
function extractDrugNames(text) {
  const cleaned = text.replace(/\s+/g, ""); // 공백·줄바꿈 제거
  const found = [];

  Object.keys(DB.products).forEach((name) => {
    const key = name.replace(/\s+/g, "");
    if (key.length >= 2 && cleaned.includes(key)) {
      found.push(name);
    }
  });

  return [...new Set(found)];
}
