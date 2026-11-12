// js/pdf-handler.js

window.PdfHandler = {
  // 複数PDFの結合
  async merge(files) {
    if (!window.PDFLib) {
      throw new Error("PDF変換ライブラリを読み込めませんでした。");
    }

    const { PDFDocument } = PDFLib;
    const mergedPdf = await PDFDocument.create();

    for (const file of files) {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await PDFDocument.load(arrayBuffer);
      const copiedPages = await mergedPdf.copyPages(pdf, pdf.getIndices());
      copiedPages.forEach((page) => mergedPdf.addPage(page));
    }

    const pdfBytes = await mergedPdf.save();
    return new Blob([pdfBytes], { type: "application/pdf" });
  },

  // PDFの分割処理
  async split(file, mode, rangeStr = "") {
    if (!window.PDFLib) {
      throw new Error("PDF変換ライブラリを読み込めませんでした。");
    }

    const { PDFDocument } = PDFLib;
    const arrayBuffer = await file.arrayBuffer();
    const srcPdf = await PDFDocument.load(arrayBuffer);
    const pageCount = srcPdf.getPageCount();
    const resultFiles = [];
    const baseName = file.name.replace(/\.[^/.]+$/, "");

    if (mode === "each") {
      // 1ページずつすべてのページを個別のPDFとして分割
      for (let i = 0; i < pageCount; i++) {
        const newPdf = await PDFDocument.create();
        const [copiedPage] = await newPdf.copyPages(srcPdf, [i]);
        newPdf.addPage(copiedPage);
        const pdfBytes = await newPdf.save();
        
        resultFiles.push({
          name: `${baseName}_page_${i + 1}.pdf`,
          blob: new Blob([pdfBytes], { type: "application/pdf" })
        });
      }
    } else if (mode === "range") {
      // 範囲指定（例: "1-3, 5"）で抽出
      const indices = this.parseRange(rangeStr, pageCount);
      if (indices.length === 0) {
        throw new Error("有効なページ範囲を指定してください。");
      }

      const newPdf = await PDFDocument.create();
      const copiedPages = await newPdf.copyPages(srcPdf, indices);
      copiedPages.forEach(page => newPdf.addPage(page));
      
      const pdfBytes = await newPdf.save();
      resultFiles.push({
        name: `${baseName}_split.pdf`,
        blob: new Blob([pdfBytes], { type: "application/pdf" })
      });
    }

    return resultFiles;
  },

  // ページ範囲の文字列を配列のインデックスに変換するヘルパー
  parseRange(rangeStr, maxPages) {
    const indices = [];
    const parts = rangeStr.split(",");
    
    parts.forEach(part => {
      part = part.trim();
      if (part.includes("-")) {
        const [start, end] = part.split("-").map(n => parseInt(n, 10) - 1);
        for (let i = Math.max(0, start); i <= Math.min(maxPages - 1, end); i++) {
          indices.push(i);
        }
      } else {
        const pageNum = parseInt(part, 10) - 1;
        if (pageNum >= 0 && pageNum < maxPages) {
          indices.push(pageNum);
        }
      }
    });

    return [...new Set(indices)]; // 重複を除外
  },

  // 変換したファイルのダウンロード
  download(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
};