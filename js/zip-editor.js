// js/zip-editor.js

(function () {
  const zipDropZone = document.getElementById("zipDropZone");
  const zipInput = document.getElementById("zipInput");
  const zipAddBtn = document.getElementById("zipAddBtn");
  const zipClearBtn = document.getElementById("zipClearBtn");
  const zipBtn = document.getElementById("zipBtn");
  const zipName = document.getElementById("zipName");
  const zipViewTextBtn = document.getElementById("zipViewTextBtn");
  const zipViewThumbBtn = document.getElementById("zipViewThumbBtn");
  const zipResultArea = document.getElementById("zipResultArea");
  const zipDownloadBtn = document.getElementById("zipDownloadBtn");

  let zipFiles = [];
  let currentViewMode = "thumb";
  let uniqueFileId = 1;
  let draggedIndex = null;
  let targetInsertIndex = null;
  let generatedZipBlob = null;

  function formatFileSize(size) {
    if (size < 1024) return size + " B";
    if (size < 1024 * 1024) return (size / 1024).toFixed(1) + " KB";
    return (size / (1024 * 1024)).toFixed(1) + " MB";
  }

  function getFileIcon(file) {
    const ext = file.name.split(".").pop().toLowerCase();
    if (["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg", "avif", "heic", "heif", "tif", "tiff"].includes(ext)) {
      return "🖼️";
    }
    if (ext === "pdf") return "📕";
    if (["zip", "rar", "7z"].includes(ext)) return "🗜️";
    return "📄";
  }

  function hideZipResult() {
    generatedZipBlob = null;
    if (zipResultArea) {
      zipResultArea.classList.add("hidden");
      zipResultArea.style.display = "none";
    }
  }

  function showZipResult() {
    if (zipResultArea) {
      zipResultArea.classList.remove("hidden");
      zipResultArea.style.display = "flex";
    }
  }

  // ★ ボタンの非活性/活性状態を更新する関数
  function updateZipBtnState() {
    if (zipBtn) {
      zipBtn.disabled = zipFiles.length === 0;
    }
  }

  if (zipViewTextBtn && zipViewThumbBtn) {
    zipViewTextBtn.addEventListener("click", () => {
      currentViewMode = "text";
      zipViewTextBtn.classList.add("active");
      zipViewThumbBtn.classList.remove("active");
      renderZipFiles();
    });

    zipViewThumbBtn.addEventListener("click", () => {
      currentViewMode = "thumb";
      zipViewThumbBtn.classList.add("active");
      zipViewTextBtn.classList.remove("active");
      renderZipFiles();
    });
  }

  if (zipDropZone && zipInput) {
    zipDropZone.addEventListener("click", (e) => {
      if (e.target.closest(".file-item") || e.target.closest(".zip-page-item-card") || e.target.closest("button") || e.target.closest("input")) return;
      zipInput.click();
    });

    if (zipAddBtn) {
      zipAddBtn.addEventListener("click", () => zipInput.click());
    }

    zipInput.addEventListener("change", (e) => {
      const files = Array.from(e.target.files);
      if (files.length > 0) {
        hideZipResult();
        addZipFiles(files);
      }
      zipInput.value = "";
    });

    ["dragenter", "dragover"].forEach(evt => {
      zipDropZone.addEventListener(evt, e => {
        e.preventDefault();
        e.stopPropagation();
        if (draggedIndex === null) {
          zipDropZone.classList.add("drag-over");
        }
      });
    });

    ["dragleave", "drop"].forEach(evt => {
      zipDropZone.addEventListener(evt, e => {
        if (draggedIndex !== null) return;
        e.preventDefault();
        e.stopPropagation();
        zipDropZone.classList.remove("drag-over");
      });
    });

    zipDropZone.addEventListener("drop", (e) => {
      if (draggedIndex !== null) return;
      e.preventDefault();
      e.stopPropagation();
      zipDropZone.classList.remove("drag-over");
      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) {
        hideZipResult();
        addZipFiles(files);
      }
    });
  }

  if (zipClearBtn) {
    zipClearBtn.addEventListener("click", () => {
      zipFiles = [];
      hideZipResult();
      renderZipFiles();
    });
  }

  function addZipFiles(files) {
    files.forEach(file => {
      zipFiles.push({
        id: uniqueFileId++,
        file: file,
        displayName: file.name
      });
    });
    renderZipFiles();
  }

  function renderZipFiles() {
    updateZipBtnState(); // ★ 表示更新に合わせてボタン状態を更新

    if (!zipDropZone) return;

    const existingInput = zipDropZone.querySelector("#zipInput");
    zipDropZone.innerHTML = "";
    if (existingInput) zipDropZone.appendChild(existingInput);

    zipDropZone.className = "file-list";
    if (currentViewMode === "thumb") {
      zipDropZone.classList.add("icon-view");
    } else {
      zipDropZone.classList.add("details-view");
    }

    if (zipFiles.length === 0) {
      zipDropZone.classList.remove("has-files");
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
      zipDropZone.appendChild(empty);
      return;
    }

    zipDropZone.classList.add("has-files");

    if (currentViewMode === "thumb") {
      zipFiles.forEach((item, index) => {
        const card = document.createElement("div");
        card.className = "pdf-page-item-card";
        card.dataset.index = index;
        card.draggable = true;

        setupDragEvents(card, index, "thumb", zipDropZone);

        const icon = document.createElement("span");
        icon.className = "file-icon";
        icon.style.fontSize = "32px";
        icon.textContent = getFileIcon(item.file);
        card.appendChild(icon);

        const nameSpan = document.createElement("span");
        nameSpan.className = "file-name";
        nameSpan.style.pointerEvents = "none";
        nameSpan.textContent = item.displayName;

        const ctrlArea = document.createElement("div");
        ctrlArea.className = "ctrl-area";

        const upBtn = document.createElement("button");
        upBtn.textContent = "◀";
        upBtn.title = "前へ";
        upBtn.disabled = index === 0;
        upBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          moveFile(index, index - 1);
        });

        const downBtn = document.createElement("button");
        downBtn.textContent = "▶";
        downBtn.title = "次へ";
        downBtn.disabled = index === zipFiles.length - 1;
        downBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          moveFile(index, index + 1);
        });

        const delBtn = document.createElement("button");
        delBtn.textContent = "✕";
        delBtn.className = "del-btn";
        delBtn.title = "削除";
        delBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          removeFile(index);
        });

        ctrlArea.append(upBtn, downBtn, delBtn);
        card.append(nameSpan, ctrlArea);
        zipDropZone.appendChild(card);
      });

    } else {
      zipFiles.forEach((item, index) => {
        const row = document.createElement("div");
        row.className = "file-item";
        row.dataset.index = index;
        row.draggable = true;
        row.style.cursor = "grab";

        setupDragEvents(row, index, "text", zipDropZone);

        const icon = document.createElement("span");
        icon.className = "file-icon";
        icon.style.pointerEvents = "none";
        icon.textContent = getFileIcon(item.file);

        const name = document.createElement("span");
        name.className = "file-name";
        name.style.pointerEvents = "none";
        name.textContent = item.displayName;

        const info = document.createElement("span");
        info.className = "file-info";
        info.innerHTML = `<span>${formatFileSize(item.file.size)}</span>`;

        const ctrlArea = document.createElement("div");
        ctrlArea.style.display = "flex";
        ctrlArea.style.gap = "4px";

        const upBtn = document.createElement("button");
        upBtn.textContent = "▲ 上へ";
        upBtn.style.padding = "3px 8px";
        upBtn.disabled = index === 0;
        upBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          moveFile(index, index - 1);
        });

        const downBtn = document.createElement("button");
        downBtn.textContent = "▼ 下へ";
        downBtn.style.padding = "3px 8px";
        downBtn.disabled = index === zipFiles.length - 1;
        downBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          moveFile(index, index + 1);
        });

        const delBtn = document.createElement("button");
        delBtn.className = "delete-file";
        delBtn.textContent = "削除";
        delBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          removeFile(index);
        });

        ctrlArea.append(upBtn, downBtn, delBtn);
        row.append(icon, name, info, ctrlArea);
        zipDropZone.appendChild(row);
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
        moveFile(fromIdx, toIdx);
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

  function moveFile(fromIndex, toIndex) {
    if (toIndex < 0 || toIndex >= zipFiles.length) return;
    const target = zipFiles.splice(fromIndex, 1)[0];
    zipFiles.splice(toIndex, 0, target);
    hideZipResult();
    renderZipFiles();
  }

  function removeFile(index) {
    zipFiles.splice(index, 1);
    hideZipResult();
    renderZipFiles();
  }

  if (zipBtn) {
    zipBtn.addEventListener("click", async () => {
      if (zipFiles.length === 0) {
        alert("ZIPにまとめるファイルを選択してください。");
        hideZipResult();
        return;
      }

      if (!window.JSZip) {
        alert("ZIPライブラリ（JSZip）が読み込まれていません。");
        return;
      }

      const zip = new JSZip();
      zipFiles.forEach(item => zip.file(item.file.name, item.file));

      try {
        generatedZipBlob = await zip.generateAsync({ type: "blob" });
        const zipFileName = zipName && zipName.value.trim() !== "" ? zipName.value.trim() : "archive.zip";

        if (typeof window.saveUserHistory === "function") {
          window.saveUserHistory("zip-compression", { fileName: zipFileName, fileCount: zipFiles.length });
        }

        showZipResult();
      } catch (err) {
        console.error("ZIP作成エラー:", err);
        alert("ZIPの作成中にエラーが発生しました。");
        hideZipResult();
      }
    });
  }

  if (zipDownloadBtn) {
    zipDownloadBtn.addEventListener("click", () => {
      if (!generatedZipBlob) return;
      const filename = zipName && zipName.value.trim() !== "" ? zipName.value.trim() : "archive.zip";
      
      const url = URL.createObjectURL(generatedZipBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);

      zipFiles = [];
      hideZipResult();
      renderZipFiles();
    });
  }

  renderZipFiles();
  hideZipResult();
})();