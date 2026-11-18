// js/zip-editor.js

(function () {
  const zipDropZone = document.getElementById("zipDropZone");
  const zipInput = document.getElementById("zipInput");
  const zipAddBtn = document.getElementById("zipAddBtn");
  const zipCreateFolderBtn = document.getElementById("zipCreateFolderBtn");
  const zipClearBtn = document.getElementById("zipClearBtn");
  const zipBtn = document.getElementById("zipBtn");
  const zipName = document.getElementById("zipName");
  const zipPath = document.getElementById("zipPath");

  const zipViewThumbBtn = document.getElementById("zipViewThumbBtn");
  const zipViewTextBtn = document.getElementById("zipViewTextBtn");
  const zipViewTreeBtn = document.getElementById("zipViewTreeBtn");

  const zipResultArea = document.getElementById("zipResultArea");
  const zipDownloadBtn = document.getElementById("zipDownloadBtn");

  let zipFiles = [];
  let zipFolders = [];
  let currentFolder = null;
  let currentViewMode = "thumb"; // "thumb", "text", "tree"
  let uniqueId = 1;
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

  function updateZipBtnState() {
    if (zipBtn) {
      zipBtn.disabled = zipFiles.length === 0;
    }
  }

  // ビューモード切り替え
  const viewBtns = [zipViewThumbBtn, zipViewTextBtn, zipViewTreeBtn];
  function setViewMode(mode, activeBtn) {
    currentViewMode = mode;
    viewBtns.forEach(btn => btn && btn.classList.remove("active"));
    if (activeBtn) activeBtn.classList.add("active");
    renderZipFiles();
  }

  if (zipViewThumbBtn) zipViewThumbBtn.addEventListener("click", () => setViewMode("thumb", zipViewThumbBtn));
  if (zipViewTextBtn) zipViewTextBtn.addEventListener("click", () => setViewMode("text", zipViewTextBtn));
  if (zipViewTreeBtn) zipViewTreeBtn.addEventListener("click", () => setViewMode("tree", zipViewTreeBtn));

  // フォルダ作成
  if (zipCreateFolderBtn) {
    zipCreateFolderBtn.addEventListener("click", () => {
      const name = prompt("新しいフォルダ名を入力してください。");
      if (!name || !name.trim()) return;
      zipFolders.push({
        id: uniqueId++,
        name: name.trim(),
        parentId: currentFolder
      });
      renderZipFiles();
    });
  }

  if (zipDropZone && zipInput) {
    zipDropZone.addEventListener("click", (e) => {
      if (e.target.closest(".file-item") || e.target.closest(".pdf-page-item-card") || e.target.closest("button") || e.target.closest("input")) return;
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
      zipFolders = [];
      currentFolder = null;
      hideZipResult();
      renderZipFiles();
    });
  }

  function addZipFiles(files) {
    files.forEach(file => {
      zipFiles.push({
        id: uniqueId++,
        file: file,
        displayName: file.name,
        folderId: currentFolder
      });
    });
    renderZipFiles();
  }

  function updateFolderPath() {
    if (!zipPath) return;
    const names = [];
    let id = currentFolder;
    while (id !== null) {
      const folder = zipFolders.find(f => f.id === id);
      if (!folder) break;
      names.unshift(folder.name);
      id = folder.parentId;
    }
    zipPath.textContent = "📁 ZIP圧縮対象ファイル" + (names.length ? " / " + names.join(" / ") : "");
  }

  function openFolder(id) {
    currentFolder = id;
    renderZipFiles();
  }

  function renderZipFiles() {
    updateZipBtnState();
    updateFolderPath();

    if (!zipDropZone) return;

    const existingInput = zipDropZone.querySelector("#zipInput");
    zipDropZone.innerHTML = "";
    if (existingInput) zipDropZone.appendChild(existingInput);

    zipDropZone.className = "file-list";
    if (currentViewMode === "thumb") zipDropZone.classList.add("icon-view");
    if (currentViewMode === "text") zipDropZone.classList.add("details-view");
    if (currentViewMode === "tree") zipDropZone.classList.add("tree-view");

    if (currentViewMode === "tree") {
      zipDropZone.classList.add("has-files");
      renderTree(null, 0);
      return;
    }

    const currentFolders = zipFolders.filter(f => f.parentId === currentFolder);
    const currentFiles = zipFiles.filter(f => f.folderId === currentFolder);

    if (currentFolders.length === 0 && currentFiles.length === 0) {
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
      // フォルダ表示（アイコン）
      currentFolders.forEach(folder => {
        const card = document.createElement("div");
        card.className = "pdf-page-item-card";

        const icon = document.createElement("span");
        icon.style.fontSize = "32px";
        icon.textContent = "📁";

        const nameSpan = document.createElement("span");
        nameSpan.className = "file-name";
        nameSpan.textContent = folder.name;

        const delBtn = document.createElement("button");
        delBtn.textContent = "削除";
        delBtn.className = "del-btn";
        delBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          deleteFolder(folder.id);
        });

        card.addEventListener("click", () => openFolder(folder.id));
        card.append(icon, nameSpan, delBtn);
        zipDropZone.appendChild(card);
      });

      // ファイル表示（アイコン）
      currentFiles.forEach((item, index) => {
        const globalIndex = zipFiles.indexOf(item);
        const card = document.createElement("div");
        card.className = "pdf-page-item-card";
        card.dataset.index = globalIndex;
        card.draggable = true;

        setupDragEvents(card, globalIndex, "thumb", zipDropZone);

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
        upBtn.disabled = index === 0;
        upBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          moveFile(globalIndex, globalIndex - 1);
        });

        const downBtn = document.createElement("button");
        downBtn.textContent = "▶";
        downBtn.disabled = index === currentFiles.length - 1;
        downBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          moveFile(globalIndex, globalIndex + 1);
        });

        const delBtn = document.createElement("button");
        delBtn.textContent = "✕";
        delBtn.className = "del-btn";
        delBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          removeFile(globalIndex);
        });

        ctrlArea.append(upBtn, downBtn, delBtn);
        card.append(nameSpan, ctrlArea);
        zipDropZone.appendChild(card);
      });

    } else {
      // フォルダ表示（リスト）
      currentFolders.forEach(folder => {
        const row = document.createElement("div");
        row.className = "file-item folder-item";
        row.innerHTML = `
          <span class="file-icon">📁</span>
          <span class="file-name">${escapeHTML(folder.name)}</span>
          <button class="delete-file" title="フォルダを削除">削除</button>
        `;
        row.querySelector(".file-name").addEventListener("click", (e) => { e.stopPropagation(); openFolder(folder.id); });
        row.querySelector(".file-icon").addEventListener("click", (e) => { e.stopPropagation(); openFolder(folder.id); });
        row.querySelector(".delete-file").addEventListener("click", e => { e.stopPropagation(); deleteFolder(folder.id); });
        zipDropZone.appendChild(row);
      });

      // ファイル表示（リスト）
      currentFiles.forEach((item, index) => {
        const globalIndex = zipFiles.indexOf(item);
        const row = document.createElement("div");
        row.className = "file-item";
        row.dataset.index = globalIndex;
        row.draggable = true;

        setupDragEvents(row, globalIndex, "text", zipDropZone);

        const icon = document.createElement("span");
        icon.className = "file-icon";
        icon.textContent = getFileIcon(item.file);

        const name = document.createElement("span");
        name.className = "file-name";
        name.textContent = item.displayName;

        const info = document.createElement("span");
        info.className = "file-info";
        info.innerHTML = `<span>${formatFileSize(item.file.size)}</span>`;

        const ctrlArea = document.createElement("div");
        ctrlArea.style.display = "flex";
        ctrlArea.style.gap = "4px";

        const delBtn = document.createElement("button");
        delBtn.className = "delete-file";
        delBtn.textContent = "削除";
        delBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          removeFile(globalIndex);
        });

        ctrlArea.appendChild(delBtn);
        row.append(icon, name, info, ctrlArea);
        zipDropZone.appendChild(row);
      });
    }
  }

  function renderTree(parentId, depth) {
    const childFolders = zipFolders.filter(folder => folder.parentId === parentId);
    childFolders.forEach(folder => {
      const row = document.createElement("div");
      row.className = "file-item folder-item";
      row.style.paddingLeft = (10 + depth * 22) + "px";
      row.innerHTML = `
        <span class="file-icon">📁</span>
        <span class="file-name">${escapeHTML(folder.name)}</span>
        <button class="delete-file" title="フォルダを削除">削除</button>
      `;
      row.querySelector(".file-name").addEventListener("click", (e) => { e.stopPropagation(); openFolder(folder.id); });
      row.querySelector(".file-icon").addEventListener("click", (e) => { e.stopPropagation(); openFolder(folder.id); });
      row.querySelector(".delete-file").addEventListener("click", e => { e.stopPropagation(); deleteFolder(folder.id); });
      zipDropZone.appendChild(row);

      zipFiles.filter(item => item.folderId === folder.id).forEach(item => {
        const fileRow = createFileTreeRow(item, depth + 1);
        zipDropZone.appendChild(fileRow);
      });

      renderTree(folder.id, depth + 1);
    });

    if (parentId === null) {
      zipFiles.filter(item => item.folderId === null).forEach(item => {
        const fileRow = createFileTreeRow(item, 0);
        zipDropZone.appendChild(fileRow);
      });
    }
  }

  function createFileTreeRow(item, depth) {
    const row = document.createElement("div");
    row.className = "file-item";
    row.style.paddingLeft = (10 + depth * 22) + "px";

    const icon = document.createElement("span");
    icon.className = "file-icon";
    icon.textContent = getFileIcon(item.file);

    const name = document.createElement("span");
    name.className = "file-name";
    name.textContent = item.displayName;

    const info = document.createElement("span");
    info.className = "file-info";
    info.innerHTML = `<span>${formatFileSize(item.file.size)}</span>`;

    const delBtn = document.createElement("button");
    delBtn.className = "delete-file";
    delBtn.textContent = "削除";
    delBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const idx = zipFiles.indexOf(item);
      if (idx !== -1) removeFile(idx);
    });

    row.append(icon, name, info, delBtn);
    return row;
  }

  function escapeHTML(str) {
    return String(str).replace(/[&<>"']/g, char => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[char]);
  }

  function deleteFolder(id) {
    if (!confirm("このフォルダと中のファイルを削除しますか？")) return;
    const removeIds = [id];
    for (let i = 0; i < removeIds.length; i++) {
      const pid = removeIds[i];
      zipFolders.filter(f => f.parentId === pid).forEach(f => removeIds.push(f.id));
    }
    zipFolders = zipFolders.filter(f => !removeIds.includes(f.id));
    zipFiles = zipFiles.filter(item => !removeIds.includes(item.folderId));
    if (removeIds.includes(currentFolder)) currentFolder = null;
    hideZipResult();
    renderZipFiles();
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
      if (fromIdx < toIdx) toIdx--;
      if (fromIdx !== toIdx) moveFile(fromIdx, toIdx);
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

  // フルパスを生成する関数（フォルダ階層維持用）
  function getFullFilePath(item) {
    const pathParts = [item.file.name];
    let id = item.folderId;
    while (id !== null) {
      const folder = zipFolders.find(f => f.id === id);
      if (!folder) break;
      pathParts.unshift(folder.name);
      id = folder.parentId;
    }
    return pathParts.join("/");
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
      zipFiles.forEach(item => {
        const fullPath = getFullFilePath(item);
        zip.file(fullPath, item.file);
      });

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
      zipFolders = [];
      currentFolder = null;
      hideZipResult();
      renderZipFiles();
    });
  }

  renderZipFiles();
  hideZipResult();
})();