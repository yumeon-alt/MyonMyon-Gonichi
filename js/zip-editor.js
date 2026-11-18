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
  let draggedItem = null; // { type: 'file' | 'folder', id: number }
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
        if (!draggedItem) {
          zipDropZone.classList.add("drag-over");
        }
      });
    });

    ["dragleave", "drop"].forEach(evt => {
      zipDropZone.addEventListener(evt, e => {
        if (draggedItem) return;
        e.preventDefault();
        e.stopPropagation();
        zipDropZone.classList.remove("drag-over");
      });
    });

    zipDropZone.addEventListener("drop", (e) => {
      if (draggedItem) return;
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

  // フォルダパス（パンくず）の描画＆ドロップ領域設定
  function updateFolderPath() {
    if (!zipPath) return;
    zipPath.innerHTML = "";

    const pathChain = [{ id: null, name: "📁 ZIP圧縮対象ファイル" }];
    let id = currentFolder;
    const tempChain = [];
    while (id !== null) {
      const folder = zipFolders.find(f => f.id === id);
      if (!folder) break;
      tempChain.unshift({ id: folder.id, name: folder.name });
      id = folder.parentId;
    }
    const fullChain = pathChain.concat(tempChain);

    fullChain.forEach((crumb, index) => {
      if (index > 0) {
        const sep = document.createElement("span");
        sep.textContent = " / ";
        sep.style.color = "#999";
        sep.style.margin = "0 4px";
        zipPath.appendChild(sep);
      }

      const link = document.createElement("span");
      link.textContent = crumb.name;
      link.style.cursor = "pointer";
      link.style.padding = "2px 4px";
      link.style.borderRadius = "4px";

      link.addEventListener("click", () => {
        currentFolder = crumb.id;
        renderZipFiles();
      });

      // フォルダパスリンクへのドラッグ＆ドロップ移動対応
      link.addEventListener("dragover", (e) => {
        e.preventDefault();
        if (draggedItem) {
          link.style.background = "#dce5f3";
        }
      });
      link.addEventListener("dragleave", () => {
        link.style.background = "transparent";
      });
      link.addEventListener("drop", (e) => {
        e.preventDefault();
        e.stopPropagation();
        link.style.background = "transparent";
        if (draggedItem) {
          moveItemToFolder(draggedItem, crumb.id);
        }
      });

      zipPath.appendChild(link);
    });
  }

  function openFolder(id) {
    currentFolder = id;
    renderZipFiles();
  }

  function moveItemToFolder(itemInfo, targetFolderId) {
    if (itemInfo.type === "file") {
      const file = zipFiles.find(f => f.id === itemInfo.id);
      if (file) file.folderId = targetFolderId;
    } else if (itemInfo.type === "folder") {
      if (itemInfo.id === targetFolderId) return; // 自分自身には移動不可
      // 移動先が自分の子孫フォルダかチェック
      let checkId = targetFolderId;
      while (checkId !== null) {
        if (checkId === itemInfo.id) return; // ループ防止
        const f = zipFolders.find(fold => fold.id === checkId);
        checkId = f ? f.parentId : null;
      }
      const folder = zipFolders.find(f => f.id === itemInfo.id);
      if (folder) folder.parentId = targetFolderId;
    }
    hideZipResult();
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
      // フォルダ表示（アイコン表示）
      currentFolders.forEach(folder => {
        const card = document.createElement("div");
        card.className = "pdf-page-item-card";
        card.draggable = true;

        setupItemDragEvents(card, { type: "folder", id: folder.id });
        setupFolderDropEvents(card, folder.id);

        const icon = document.createElement("span");
        icon.style.fontSize = "32px";
        icon.textContent = "📁";
        icon.style.pointerEvents = "none";

        const nameSpan = document.createElement("span");
        nameSpan.className = "file-name";
        nameSpan.textContent = folder.name;
        nameSpan.style.pointerEvents = "none";

        const delBtn = document.createElement("button");
        delBtn.textContent = "削除";
        delBtn.className = "del-btn";
        delBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          deleteFolder(folder.id);
        });

        card.addEventListener("dblclick", () => openFolder(folder.id));
        card.append(icon, nameSpan, delBtn);
        zipDropZone.appendChild(card);
      });

      // ファイル表示（アイコン表示）
      currentFiles.forEach(item => {
        const card = document.createElement("div");
        card.className = "pdf-page-item-card";
        card.draggable = true;

        setupItemDragEvents(card, { type: "file", id: item.id });

        const icon = document.createElement("span");
        icon.className = "file-icon";
        icon.style.fontSize = "32px";
        icon.textContent = getFileIcon(item.file);
        icon.style.pointerEvents = "none";

        const nameSpan = document.createElement("span");
        nameSpan.className = "file-name";
        nameSpan.style.pointerEvents = "none";
        nameSpan.textContent = item.displayName;

        const ctrlArea = document.createElement("div");
        ctrlArea.className = "ctrl-area";

        const delBtn = document.createElement("button");
        delBtn.textContent = "✕";
        delBtn.className = "del-btn";
        delBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          removeFileById(item.id);
        });

        ctrlArea.appendChild(delBtn);
        card.append(icon, nameSpan, ctrlArea);
        zipDropZone.appendChild(card);
      });

    } else {
      // フォルダ表示（リスト表示）
      currentFolders.forEach(folder => {
        const row = document.createElement("div");
        row.className = "file-item folder-item";
        row.draggable = true;

        setupItemDragEvents(row, { type: "folder", id: folder.id });
        setupFolderDropEvents(row, folder.id);

        row.innerHTML = `
          <span class="file-icon" style="pointer-events:none;">📁</span>
          <span class="file-name" style="pointer-events:none;">${escapeHTML(folder.name)}</span>
          <button class="delete-file" title="フォルダを削除">削除</button>
        `;

        row.addEventListener("dblclick", () => openFolder(folder.id));
        row.querySelector(".delete-file").addEventListener("click", e => {
          e.stopPropagation();
          deleteFolder(folder.id);
        });
        zipDropZone.appendChild(row);
      });

      // ファイル表示（リスト表示）
      currentFiles.forEach(item => {
        const row = document.createElement("div");
        row.className = "file-item";
        row.draggable = true;

        setupItemDragEvents(row, { type: "file", id: item.id });

        const icon = document.createElement("span");
        icon.className = "file-icon";
        icon.textContent = getFileIcon(item.file);
        icon.style.pointerEvents = "none";

        const name = document.createElement("span");
        name.className = "file-name";
        name.textContent = item.displayName;
        name.style.pointerEvents = "none";

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
          removeFileById(item.id);
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
      row.draggable = true;

      setupItemDragEvents(row, { type: "folder", id: folder.id });
      setupFolderDropEvents(row, folder.id);

      row.innerHTML = `
        <span class="file-icon" style="pointer-events:none;">📁</span>
        <span class="file-name" style="pointer-events:none;">${escapeHTML(folder.name)}</span>
        <button class="delete-file" title="フォルダを削除">削除</button>
      `;
      row.addEventListener("dblclick", () => openFolder(folder.id));
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
    row.draggable = true;

    setupItemDragEvents(row, { type: "file", id: item.id });

    const icon = document.createElement("span");
    icon.className = "file-icon";
    icon.textContent = getFileIcon(item.file);
    icon.style.pointerEvents = "none";

    const name = document.createElement("span");
    name.className = "file-name";
    name.textContent = item.displayName;
    name.style.pointerEvents = "none";

    const info = document.createElement("span");
    info.className = "file-info";
    info.innerHTML = `<span>${formatFileSize(item.file.size)}</span>`;

    const delBtn = document.createElement("button");
    delBtn.className = "delete-file";
    delBtn.textContent = "削除";
    delBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      removeFileById(item.id);
    });

    row.append(icon, name, info, delBtn);
    return row;
  }

  // ドラッグ開始・終了の登録
  function setupItemDragEvents(element, itemInfo) {
    element.addEventListener("dragstart", (e) => {
      draggedItem = itemInfo;
      element.style.opacity = "0.4";
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", JSON.stringify(itemInfo));
    });

    element.addEventListener("dragend", () => {
      element.style.opacity = "1";
      draggedItem = null;
    });
  }

  // フォルダに対してドロップされた時の登録
  function setupFolderDropEvents(element, targetFolderId) {
    element.addEventListener("dragover", (e) => {
      e.preventDefault();
      if (draggedItem && (draggedItem.type !== "folder" || draggedItem.id !== targetFolderId)) {
        element.style.border = "2px dashed #6559bb";
        element.style.background = "#f6f4ff";
      }
    });

    element.addEventListener("dragleave", () => {
      element.style.border = "";
      element.style.background = "";
    });

    element.addEventListener("drop", (e) => {
      e.preventDefault();
      e.stopPropagation();
      element.style.border = "";
      element.style.background = "";
      if (draggedItem) {
        moveItemToFolder(draggedItem, targetFolderId);
      }
    });
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

  function removeFileById(id) {
    zipFiles = zipFiles.filter(f => f.id !== id);
    hideZipResult();
    renderZipFiles();
  }

  // フルパスを生成する関数（ZIP出力時のフォルダ構造維持用）
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