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
  const pdfResultArea = document.getElementById("pdfResultArea");
  const pdfDownloadBtn = document.getElementById("pdfDownloadBtn");
  const pdfPath = document.getElementById("pdfPath");

  let pdfPages = [];
  let currentViewMode = "thumb";
  let uniquePageId = 1;
  let draggedIndex = null;
  let targetInsertIndex = null;
  let generatedPdfBlob = null;

  function setPdfStatus(msg, isError = false) {
    if (!pdfStatus) return;
    pdfStatus.textContent = msg;
    pdfStatus.style.color = isError ? "#d94848" : "#16845b";
  }

  function updatePdfPath() {
    if (!pdfPath) return;
    pdfPath.innerHTML = `<img src="images/file.png" width="16" height="16" style="vertical-align: middle; margin-right: 4px; object-fit: contain;" alt="フォルダ">PDF構成ページ`;
  }

  function hidePdfResult() {
    generatedPdfBlob = null;
    if (pdfResultArea) {
      pdfResultArea.classList.add("hidden");
      pdfResultArea.style.display = "none";
    }
  }

  function showPdfResult() {
    if (pdfResultArea) {
      pdfResultArea.classList.remove("hidden");
      pdfResultArea.style.display = "flex";
    }
  }

  function updatePdfExportBtnState() {
    if (pdfExportBtn) {
      pdfExportBtn.disabled = pdfPages.length === 0;
    }
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
      if (e.target.closest(".file-item") || e.target.closest(".pdf-page-item-card") || e.target.closest("button") || e.target.closest("input")) return;
      pdfInput.click();
    });

    if (pdfAddBtn) {
      pdfAddBtn.addEventListener("click", () => pdfInput.click());
    }

    pdfInput.addEventListener("change", async (e) => {
      const files = Array.from(e.target.files);
      if (files.length > 0) {
        hidePdfResult();
        await processIncomingFiles(files);
      }
      pdfInput.value = "";
    });

    ["dragenter", "dragover"].forEach(evt => {
      pdfDropZone.addEventListener(evt, e => {
        e.preventDefault();
        e.stopPropagation();
        if (draggedIndex === null) {
          pdfDropZone.classList.add("drag-over");
        }
      });
    });

    ["dragleave", "drop"].forEach(evt => {
      pdfDropZone.addEventListener(evt, e => {
        if (draggedIndex !== null) return;
        e.preventDefault();
        e.stopPropagation();
        pdfDropZone.classList.remove("drag-over");
      });
    });

    pdfDropZone.addEventListener("drop", async (e) => {
      if (draggedIndex !== null) return;
      e.preventDefault();
      e.stopPropagation();
      pdfDropZone.classList.remove("drag-over");
      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) {
        hidePdfResult();
        await processIncomingFiles(files);
      }
    });
  }

  if (pdfClearBtn) {
    pdfClearBtn.addEventListener("click", () => {
      pdfPages = [];
      hidePdfResult();
      renderPdfPages();
      setPdfStatus("すべてのページをクリアしました。");
    });
  }

  async function processIncomingFiles(files) {
    setPdfStatus("ファイルを解析・読み込み中...");

    let successCount = 0;
    let failCount = 0;

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
            successCount++;
          }
        } else {
          if (!window.ImageConverter) {
            throw new Error("画像変換ライブラリが利用できません。");
          }

          setPdfStatus(`${file.name} をPDFに変換中...`);
          const pdfBlob = await window.ImageConverter.convert(file, "pdf");
          const pdfBytes = new Uint8Array(await pdfBlob.arrayBuffer());

          let thumbUrl = "";
          try {
            thumbUrl = await generateThumbnailUrl(pdfBytes);
          } catch (tErr) {
            thumbUrl = "";
          }

          pdfPages.push({
            id: uniquePageId++,
            displayName: `${baseName}-1.pdf`,
            pdfBytes: pdfBytes,
            thumbUrl: thumbUrl
          });
          successCount++;
        }
      } catch (err) {
        console.error("読み込みエラー:", err);
        failCount++;
        setPdfStatus(`${file.name} の読み込みに失敗しました: ${err.message}`, true);
      }
    }

    if (failCount === 0) {
      setPdfStatus(`全 ${pdfPages.length} ページを読み込みました。`);
    } else if (successCount > 0) {
      setPdfStatus(`${successCount} ページを読み込みました（${failCount} 個のファイルが失敗）。`, true);
    }

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
    updatePdfExportBtnState();
    updatePdfPath();

    if (!pdfDropZone) return;

    const existingInput = pdfDropZone.querySelector("#pdfInput");
    pdfDropZone.innerHTML = "";
    if (existingInput) pdfDropZone.appendChild(existingInput);

    pdfDropZone.className = "file-list";
    if (currentViewMode === "thumb") {
      pdfDropZone.classList.add("icon-view");
    } else {
      pdfDropZone.classList.add("details-view");
    }

    if (pdfPages.length === 0) {
      pdfDropZone.classList.remove("has-files");
      const empty = document.createElement("div");
      empty.className = "drop-empty";
      empty.innerHTML = `
        <div class="drop-icon">
          <svg viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="9.5" fill="none" stroke="#8f959e" stroke-width="2.3" />
            <path d="M12 7.5v8.5 M8.5 12.5L12 16l3.5-3.5" fill="none" stroke="#8f959e" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </div>
        <p>あなたはファイルをここにドラッグ＆ドロップして追加できます。</p>
      `;
      pdfDropZone.appendChild(empty);
      return;
    }

    pdfDropZone.classList.add("has-files");

    if (currentViewMode === "thumb") {
      pdfPages.forEach((page, index) => {
        const card = document.createElement("div");
        card.className = "pdf-page-item-card";
        card.dataset.index = index;
        card.draggable = true;

        setupDragEvents(card, index, "thumb", pdfDropZone);

        const thumbWrapper = document.createElement("div");
        thumbWrapper.className = "thumb-wrapper";

        if (page.thumbUrl) {
          const img = document.createElement("img");
          img.src = page.thumbUrl;
          thumbWrapper.appendChild(img);
        } else {
          thumbWrapper.innerHTML = `<img src="images/pdf.png" style="width: 48px; height: 48px; object-fit: contain;" alt="PDF">`;
        }

        const nameSpan = document.createElement("span");
        nameSpan.className = "file-name";
        nameSpan.style.pointerEvents = "none";
        nameSpan.textContent = page.displayName;

        const ctrlArea = document.createElement("div");
        ctrlArea.className = "ctrl-area";

        const moveBtns = document.createElement("div");
        moveBtns.className = "move-btns";

        const upBtn = document.createElement("button");
        upBtn.textContent = "◀";
        upBtn.title = "前へ";
        upBtn.disabled = index === 0;
        upBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          movePage(index, index - 1);
        });

        const downBtn = document.createElement("button");
        downBtn.textContent = "▶";
        downBtn.title = "次へ";
        downBtn.disabled = index === pdfPages.length - 1;
        downBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          movePage(index, index + 1);
        });

        moveBtns.append(upBtn, downBtn);

        const delBtn = document.createElement("button");
        delBtn.textContent = "削除";
        delBtn.className = "delete-file";
        delBtn.title = "削除";
        delBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          removePage(index);
        });

        ctrlArea.append(moveBtns, delBtn);
        card.append(thumbWrapper, nameSpan, ctrlArea);
        pdfDropZone.appendChild(card);
      });

    } else {
      pdfPages.forEach((page, index) => {
        const row = document.createElement("div");
        row.className = "file-item";
        row.dataset.index = index;
        row.draggable = true;
        row.style.display = "flex";
        row.style.alignItems = "center";
        row.style.justifyContent = "space-between";
        row.style.cursor = "grab";

        setupDragEvents(row, index, "text", pdfDropZone);

        const icon = document.createElement("span");
        icon.className = "file-icon";
        icon.style.display = "none";

        const name = document.createElement("span");
        name.className = "file-name";
        name.style.flexGrow = "1";
        name.style.overflow = "hidden";
        name.style.textOverflow = "ellipsis";
        name.style.whiteSpace = "nowrap";
        name.style.marginRight = "10px";
        name.style.pointerEvents = "none";
        name.textContent = page.displayName;

        const ctrlArea = document.createElement("div");
        ctrlArea.style.display = "flex";
        ctrlArea.style.gap = "6px";
        ctrlArea.style.alignItems = "center";
        ctrlArea.style.flexShrink = "0";

        const upBtn = document.createElement("button");
        upBtn.textContent = "▲ 上へ";
        upBtn.style.padding = "4px 10px";
        upBtn.disabled = index === 0;
        upBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          movePage(index, index - 1);
        });

        const downBtn = document.createElement("button");
        downBtn.textContent = "▼ 下へ";
        downBtn.style.padding = "4px 10px";
        downBtn.disabled = index === pdfPages.length - 1;
        downBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          movePage(index, index + 1);
        });

        const delBtn = document.createElement("button");
        delBtn.className = "delete-file";
        delBtn.textContent = "削除";
        delBtn.style.border = "none";
        delBtn.style.background = "transparent";
        delBtn.style.color = "#d9534f";
        delBtn.style.fontSize = "0.85rem";
        delBtn.style.cursor = "pointer";
        delBtn.style.padding = "4px 6px";
        delBtn.style.marginLeft = "8px";
        delBtn.style.marginRight = "4px";

        delBtn.addEventListener("mouseenter", () => {
          delBtn.style.textDecoration = "underline";
        });
        delBtn.addEventListener("mouseleave", () => {
          delBtn.style.textDecoration = "none";
        });

        delBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          removePage(index);
        });

        ctrlArea.append(upBtn, downBtn);
        row.append(icon, name, ctrlArea, delBtn);
        pdfDropZone.appendChild(row);
      });
    }
  }

  function setupDragEvents(element, index, mode, container) {
    element.addEventListener("dragstart", (e) => {
      draggedIndex = index;
      targetInsertIndex = null;
      element.style.opacity = "0.3";
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", index);
    });

    element.addEventListener("dragend", (e) => {
      e.preventDefault();
      element.style.opacity = "1";
      commitMove();
    });

    element.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";

      if (draggedIndex === null) return;

      const rect = element.getBoundingClientRect();

      if (mode === "thumb") {
        const isLeft = e.clientX - rect.left < rect.width / 2;
        targetInsertIndex = isLeft ? index : index + 1;
        showGuideLine(element, isLeft ? "before" : "after", mode, container);
      } else {
        const isTop = e.clientY - rect.top < rect.height / 2;
        targetInsertIndex = isTop ? index : index + 1;
        showGuideLine(element, isTop ? "before" : "after", mode, container);
      }
    });

    element.addEventListener("drop", (e) => {
      e.preventDefault();
      e.stopPropagation();
      commitMove();
    });
  }

  function commitMove() {
    if (draggedIndex !== null && targetInsertIndex !== null) {
      let fromIdx = draggedIndex;
      let toIdx = targetInsertIndex;

      if (fromIdx < toIdx) {
        toIdx--;
      }

      if (fromIdx !== toIdx) {
        movePage(fromIdx, toIdx);
      }
    }

    draggedIndex = null;
    targetInsertIndex = null;
    removeGuideLine();
  }

  function showGuideLine(targetEl, position, mode, container) {
    removeGuideLine();

    const guide = document.createElement("div");
    guide.className = "pdf-drag-guide";
    guide.style.background = "#6559bb";
    guide.style.borderRadius = "2px";
    guide.style.pointerEvents = "none";
    guide.style.boxShadow = "0 0 6px rgba(101, 89, 187, 0.6)";

    if (mode === "thumb") {
      guide.style.width = "4px";
      guide.style.height = "140px";
      guide.style.margin = "0 -6px";
    } else {
      guide.style.width = "100%";
      guide.style.height = "4px";
      guide.style.margin = "-4px 0";
    }

    if (position === "before") {
      container.insertBefore(guide, targetEl);
    } else {
      container.insertBefore(guide, targetEl.nextSibling);
    }
  }

  function removeGuideLine() {
    document.querySelectorAll(".pdf-drag-guide").forEach(el => el.remove());
  }

  function movePage(fromIndex, toIndex) {
    if (toIndex < 0 || toIndex >= pdfPages.length) return;
    const target = pdfPages.splice(fromIndex, 1)[0];
    pdfPages.splice(toIndex, 0, target);
    hidePdfResult();
    renderPdfPages();
  }

  function removePage(index) {
    pdfPages.splice(index, 1);
    hidePdfResult();
    renderPdfPages();
  }

  if (pdfExportBtn) {
    pdfExportBtn.addEventListener("click", async () => {
      if (pdfPages.length === 0) {
        alert("編集するPDFページがありません。ファイルを追加してください。");
        hidePdfResult();
        return;
      }

      setPdfStatus("PDFを作成しています...");

      try {
        const mergedPdf = await PDFLib.PDFDocument.create();

        for (const pageItem of pdfPages) {
          const bytes = new Uint8Array(pageItem.pdfBytes);
          const doc = await PDFLib.PDFDocument.load(bytes);
          const [copiedPage] = await mergedPdf.copyPages(doc, [0]);
          mergedPdf.addPage(copiedPage);
        }

        const pdfBytes = await mergedPdf.save();
        generatedPdfBlob = new Blob([pdfBytes], { type: "application/pdf" });

        showPdfResult();
        setPdfStatus("");
      } catch (err) {
        console.error("PDF作成エラー:", err);
        setPdfStatus("PDFの作成中にエラーが発生しました。", true);
        hidePdfResult();
      }
    });
  }

  if (pdfDownloadBtn) {
    pdfDownloadBtn.addEventListener("click", () => {
      if (!generatedPdfBlob) return;

      const filename = pdfOutputName && pdfOutputName.value.trim() !== ""
        ? pdfOutputName.value.trim()
        : "merged.pdf";

      const outputFilename = filename.endsWith(".pdf") ? filename : `${filename}.pdf`;

      window.ImageConverter.download(generatedPdfBlob, outputFilename);

      pdfPages = [];
      hidePdfResult();
      renderPdfPages();
      setPdfStatus("PDFをダウンロードしました！");
    });
  }

  renderPdfPages();
  hidePdfResult();
})();