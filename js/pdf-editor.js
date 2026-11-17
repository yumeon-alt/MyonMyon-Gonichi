// js/pdf-editor.js

(function () {
  if (window.pdfjsLib) {
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
  }

  const pdfDropZone = document.getElementById("pdfDropZone");
  const pdfInput = document.getElementById("pdfInput");
  const pdfAddBtn = document.getElementById("pdfAddBtn");
  const pdfClearBtn = document.getElementById("pdfClearBtn");
  const pdfExportBtn = document.getElementById("pdfExportBtn");
  const pdfOutputName = document.getElementById("pdfOutputName");
  const pdfStatus = document.getElementById("pdfStatus");
  const pdfViewTextBtn = document.getElementById("pdfViewTextBtn");
  const pdfViewThumbBtn = document.getElementById("pdfViewThumbBtn");

  let pdfPages = [];
  let currentViewMode = "thumb";
  let uniquePageId = 1;
  let draggedIndex = null;

  function setPdfStatus(msg, isError = false) {
    if (!pdfStatus) return;
    pdfStatus.textContent = msg;
    pdfStatus.style.color = isError ? "#d94848" : "#16845b";
  }

  if (pdfViewTextBtn && pdfViewThumbBtn) {
    pdfViewTextBtn.addEventListener("click", () => {
      currentViewMode = "text";
      pdfViewTextBtn.classList.add("active");
      pdfViewThumbBtn.classList.remove("active");
      renderPdfPages();
    });

    pdfViewThumbBtn.addEventListener("click", () => {
      currentViewMode = "thumb";
      pdfViewThumbBtn.classList.add("active");
      pdfViewTextBtn.classList.remove("active");
      renderPdfPages();
    });
  }

  if (pdfDropZone && pdfInput) {
    pdfDropZone.addEventListener("click", (e) => {
      if (e.target.closest("button") || e.target.closest("input") || e.target.closest(".pdf-page-item")) return;
      pdfInput.click();
    });

    if (pdfAddBtn) {
      pdfAddBtn.addEventListener("click", () => pdfInput.click());
    }

    pdfInput.addEventListener("change", async (e) => {
      const files = Array.from(e.target.files);
      if (files.length > 0) {
        await processIncomingFiles(files);
      }
      pdfInput.value = "";
    });

    ["dragenter", "dragover"].forEach(evt => {
      pdfDropZone.addEventListener(evt, e => {
        e.preventDefault();
        e.stopPropagation();
        pdfDropZone.classList.add("drag-over");
      });
    });

    ["dragleave", "drop"].forEach(evt => {
      pdfDropZone.addEventListener(evt, e => {
        e.preventDefault();
        e.stopPropagation();
        pdfDropZone.classList.remove("drag-over");
      });
    });

    pdfDropZone.addEventListener("drop", async (e) => {
      if (draggedIndex !== null) return;
      e.preventDefault();
      e.stopPropagation();
      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) {
        await processIncomingFiles(files);
      }
    });
  }

  if (pdfClearBtn) {
    pdfClearBtn.addEventListener("click", () => {
      pdfPages = [];
      renderPdfPages();
      setPdfStatus("すべてのページをクリアしました。");
    });
  }

  async function processIncomingFiles(files) {
    setPdfStatus("ファイルを解析・読み込み中...");

    for (const file of files) {
      const ext = file.name.split(".").pop().toLowerCase();
      const baseName = file.name.replace(/\.[^.]+$/, "");

      try {
        if (ext === "pdf") {
          const arrayBuffer = await file.arrayBuffer();
          const pdfDoc = await PDFLib.PDFDocument.load(arrayBuffer);
          const pageCount = pdfDoc.getPageCount();

          for (let i = 0; i < pageCount; i++) {
            const newDoc = await PDFLib.PDFDocument.create();
            const [copiedPage] = await newDoc.copyPages(pdfDoc, [i]);
            newDoc.addPage(copiedPage);
            const singlePdfBytes = await newDoc.save();

            const thumbUrl = await generateThumbnailUrl(singlePdfBytes);

            pdfPages.push({
              id: uniquePageId++,
              displayName: `${baseName}-${i + 1}.pdf`,
              pdfBytes: singlePdfBytes,
              thumbUrl: thumbUrl
            });
          }
        } else {
          if (!window.ImageConverter) {
            throw new Error("画像変換ライブラリが利用できません。");
          }
          const pdfBlob = await window.ImageConverter.convert(file, "pdf");
          const pdfBytes = new Uint8Array(await pdfBlob.arrayBuffer());
          const thumbUrl = await generateThumbnailUrl(pdfBytes);

          pdfPages.push({
            id: uniquePageId++,
            displayName: `${baseName}-1.pdf`,
            pdfBytes: pdfBytes,
            thumbUrl: thumbUrl
          });
        }
      } catch (err) {
        console.error("読み込みエラー:", err);
        setPdfStatus(`${file.name} の読み込みに失敗しました。`, true);
      }
    }

    setPdfStatus(`全 ${pdfPages.length} ページを読み込みました。`);
    renderPdfPages();
  }

  function generateThumbnailUrl(pdfBytes) {
    return new Promise(async (resolve) => {
      if (!window.pdfjsLib) return resolve("");
      try {
        const loadingTask = pdfjsLib.getDocument({ data: pdfBytes.slice(0) });
        const pdf = await loadingTask.promise;
        const page = await pdf.getPage(1);

        const viewport = page.getViewport({ scale: 0.3 });
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        await page.render({
          canvasContext: context,
          viewport: viewport
        }).promise;

        resolve(canvas.toDataURL("image/png"));
      } catch (err) {
        console.error("サムネイル生成失敗:", err);
        resolve("");
      }
    });
  }

  function renderPdfPages() {
    if (!pdfDropZone) return;

    const existingInput = pdfDropZone.querySelector("#pdfInput");
    pdfDropZone.innerHTML = "";
    if (existingInput) pdfDropZone.appendChild(existingInput);

    if (pdfPages.length === 0) {
      const empty = document.createElement("div");
      empty.className = "drop-empty";
      empty.innerHTML = `
        <div class="drop-icon">⇩</div>
        <p>PDFや画像をここにドラッグ＆ドロップ、またはクリックして追加できます。</p>
      `;
      pdfDropZone.appendChild(empty);
      return;
    }

    if (currentViewMode === "thumb") {
      const container = document.createElement("div");
      container.style.display = "grid";
      container.style.gridTemplateColumns = "repeat(auto-fill, minmax(140px, 1fr))";
      container.style.gap = "15px";

      pdfPages.forEach((page, index) => {
        const card = document.createElement("div");
        card.className = "pdf-page-item";
        card.draggable = true;
        card.style.border = "1px solid #ccc";
        card.style.borderRadius = "8px";
        card.style.padding = "8px";
        card.style.background = "#fafafa";
        card.style.display = "flex";
        card.style.flexDirection = "column";
        card.style.alignItems = "center";
        card.style.cursor = "grab";
        card.style.userSelect = "none";
        card.style.position = "relative";
        card.style.boxSizing = "border-box";
        card.style.transition = "border 0.1s ease";

        setupDragEvents(card, index, "thumb");

        if (page.thumbUrl) {
          const img = document.createElement("img");
          img.src = page.thumbUrl;
          img.style.maxWidth = "100%";
          img.style.height = "auto";
          img.style.maxHeight = "150px";
          img.style.border = "1px solid #eee";
          img.style.borderRadius = "4px";
          img.draggable = false;
          card.appendChild(img);
        }

        const nameSpan = document.createElement("span");
        nameSpan.style.fontSize = "0.75rem";
        nameSpan.style.marginTop = "6px";
        nameSpan.style.wordBreak = "break-all";
        nameSpan.style.textAlign = "center";
        nameSpan.textContent = page.displayName;

        const ctrlArea = document.createElement("div");
        ctrlArea.style.display = "flex";
        ctrlArea.style.gap = "4px";
        ctrlArea.style.marginTop = "6px";

        const upBtn = document.createElement("button");
        upBtn.textContent = "◀";
        upBtn.title = "前へ";
        upBtn.style.padding = "2px 6px";
        upBtn.disabled = index === 0;
        upBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          movePage(index, index - 1);
        });

        const downBtn = document.createElement("button");
        downBtn.textContent = "▶";
        downBtn.title = "次へ";
        downBtn.style.padding = "2px 6px";
        downBtn.disabled = index === pdfPages.length - 1;
        downBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          movePage(index, index + 1);
        });

        const delBtn = document.createElement("button");
        delBtn.textContent = "✕";
        delBtn.title = "削除";
        delBtn.style.padding = "2px 6px";
        delBtn.style.color = "#c44";
        delBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          removePage(index);
        });

        ctrlArea.append(upBtn, downBtn, delBtn);
        card.append(nameSpan, ctrlArea);
        container.appendChild(card);
      });

      pdfDropZone.appendChild(container);

    } else {
      pdfPages.forEach((page, index) => {
        const row = document.createElement("div");
        row.className = "file-item pdf-page-item";
        row.draggable = true;
        row.style.display = "flex";
        row.style.alignItems = "center";
        row.style.gap = "10px";
        row.style.cursor = "grab";
        row.style.position = "relative";
        row.style.boxSizing = "border-box";
        row.style.transition = "border 0.1s ease";

        setupDragEvents(row, index, "text");

        const icon = document.createElement("span");
        icon.className = "file-icon";
        icon.textContent = "📕";

        const name = document.createElement("span");
        name.className = "file-name";
        name.textContent = page.displayName;

        const ctrlArea = document.createElement("div");
        ctrlArea.style.display = "flex";
        ctrlArea.style.gap = "4px";

        const upBtn = document.createElement("button");
        upBtn.textContent = "▲ 上へ";
        upBtn.style.padding = "3px 8px";
        upBtn.disabled = index === 0;
        upBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          movePage(index, index - 1);
        });

        const downBtn = document.createElement("button");
        downBtn.textContent = "▼ 下へ";
        downBtn.style.padding = "3px 8px";
        downBtn.disabled = index === pdfPages.length - 1;
        downBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          movePage(index, index + 1);
        });

        const delBtn = document.createElement("button");
        delBtn.className = "delete-file";
        delBtn.textContent = "削除";
        delBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          removePage(index);
        });

        ctrlArea.append(upBtn, downBtn, delBtn);
        row.append(icon, name, ctrlArea);
        pdfDropZone.appendChild(row);
      });
    }
  }

  // ドラッグ＆ドロップ（挿入ガイド線表示）イベント設定
  function setupDragEvents(element, index, mode) {
    element.addEventListener("dragstart", (e) => {
      draggedIndex = index;
      element.style.opacity = "0.4";
      e.dataTransfer.effectAllowed = "move";
    });

    element.addEventListener("dragend", () => {
      draggedIndex = null;
      element.style.opacity = "1";
      clearDragOverStyles();
    });

    element.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";

      if (draggedIndex !== null && draggedIndex !== index) {
        clearDragOverStyles();

        const rect = element.getBoundingClientRect();

        if (mode === "thumb") {
          // 画像表示（左右判定）：マウス位置がカードの半分より左か右かで前後の線の位置を決める
          const isLeftHalf = e.clientX - rect.left < rect.width / 2;
          if (isLeftHalf) {
            element.style.borderLeft = "4px solid #252535";
          } else {
            element.style.borderRight = "4px solid #252535";
          }
        } else {
          // リスト表示（上下判定）：マウス位置が上下の半分より上か下かで決める
          const isTopHalf = e.clientY - rect.top < rect.height / 2;
          if (isTopHalf) {
            element.style.borderTop = "4px solid #252535";
          } else {
            element.style.borderBottom = "4px solid #252535";
          }
        }
      }
    });

    element.addEventListener("dragleave", () => {
      element.style.border = "1px solid #ccc";
      element.style.borderLeft = "";
      element.style.borderRight = "";
      element.style.borderTop = "";
      element.style.borderBottom = "";
    });

    element.addEventListener("drop", (e) => {
      e.preventDefault();
      e.stopPropagation();

      if (draggedIndex !== null && draggedIndex !== index) {
        const rect = element.getBoundingClientRect();
        let targetIndex = index;

        if (mode === "thumb") {
          const isLeftHalf = e.clientX - rect.left < rect.width / 2;
          targetIndex = isLeftHalf ? index : index + 1;
        } else {
          const isTopHalf = e.clientY - rect.top < rect.height / 2;
          targetIndex = isTopHalf ? index : index + 1;
        }

        if (draggedIndex < targetIndex) {
          targetIndex--;
        }

        movePage(draggedIndex, targetIndex);
        draggedIndex = null;
      }
      clearDragOverStyles();
    });
  }

  function clearDragOverStyles() {
    document.querySelectorAll(".pdf-page-item").forEach(item => {
      item.style.border = "1px solid #ccc";
      item.style.borderLeft = "";
      item.style.borderRight = "";
      item.style.borderTop = "";
      item.style.borderBottom = "";
      item.style.opacity = "1";
    });
  }

  function movePage(fromIndex, toIndex) {
    if (toIndex < 0 || toIndex >= pdfPages.length) return;
    const target = pdfPages.splice(fromIndex, 1)[0];
    pdfPages.splice(toIndex, 0, target);
    renderPdfPages();
  }

  function removePage(index) {
    pdfPages.splice(index, 1);
    renderPdfPages();
  }

  if (pdfExportBtn) {
    pdfExportBtn.addEventListener("click", async () => {
      if (pdfPages.length === 0) {
        alert("編集するPDFページがありません。");
        return;
      }

      setPdfStatus("PDFを統合・出力しています...");

      try {
        const mergedPdf = await PDFLib.PDFDocument.create();

        for (const pageItem of pdfPages) {
          const bytes = new Uint8Array(pageItem.pdfBytes);
          const doc = await PDFLib.PDFDocument.load(bytes);
          const [copiedPage] = await mergedPdf.copyPages(doc, [0]);
          mergedPdf.addPage(copiedPage);
        }

        const pdfBytes = await mergedPdf.save();
        const blob = new Blob([pdfBytes], { type: "application/pdf" });

        const filename = pdfOutputName && pdfOutputName.value.trim() !== ""
          ? pdfOutputName.value.trim()
          : "merged.pdf";

        const outputFilename = filename.endsWith(".pdf") ? filename : `${filename}.pdf`;

        window.ImageConverter.download(blob, outputFilename);
        setPdfStatus("PDFの出力が完了しました！");
      } catch (err) {
        console.error("PDF結合エラー:", err);
        setPdfStatus("PDFの結合出力中にエラーが発生しました。", true);
      }
    });
  }

})();