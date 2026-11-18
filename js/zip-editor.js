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

  const zipResultArea = document.getElementById("zipResultArea");
  const zipDownloadBtn = document.getElementById("zipDownloadBtn");

  let zipFiles = [];
  let zipFolders = [];
  let currentFolder = null;
  let currentViewMode = "icons"; // "icons", "details"
  let uniqueId = 1;
  let draggedItem = null;
  let expandedFolderIds = new Set();
  let generatedZipBlob = null;

  function formatFileSize(size) {
    if (size < 1024) return size + " B";
    if (size < 1024 * 1024) return (size / 1024).toFixed(1) + " KB";
    return (size / (1024 * 1024)).toFixed(1) + " MB";
  }

  function formatDate(timestamp) {
    const date = new Date(timestamp);
    return (
      date.getFullYear() + "年" +
      (date.getMonth() + 1) + "月" +
      date.getDate() + "日 " +
      String(date.getHours()).padStart(2, "0") + ":" +
      String(date.getMinutes()).padStart(2, "0")
    );
  }

  function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, char => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[char]);
  }

  // ★ margin-top を 8px に変更して上部に余白を確保
  function getFileIconHtml(file) {
    const ext = file.name.split(".").pop().toLowerCase();
    
    let imgPath = "images/hatena.png";
    let label = "ファイル";

    if (["png"].includes(ext)) {
      imgPath = "images/image.png";
      label = "PNG画像";
    } else if (["jpg", "jpeg"].includes(ext)) {
      imgPath = "images/jpg.png";
      label = "JPEG画像";
    } else if (ext === "pdf") {
      imgPath = "images/pdf.png";
      label = "PDF";
    } else if (["zip", "rar", "7z"].includes(ext)) {
      imgPath = "images/zip.png";
      label = "ZIP";
    }

    return `<div style="text-align: center; margin-top: 8px; margin-bottom: 0;"><img src="${imgPath}" width="128" height="128" style="display: inline-block; object-fit: contain;" alt="${label}"></div>`;
  }

  function getFolderIconHtml() {
    return `<div style="text-align: center; margin-top: 8px; margin-bottom: 0;"><img src="images/file.png" width="128" height="128" style="display: inline-block; object-fit: contain;" alt="フォルダ"></div>`;
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

  function setViewMode(mode, activeBtn) {
    currentViewMode = mode;
    if (zipViewThumbBtn) zipViewThumbBtn.classList.toggle("active", mode === "icons");
    if (zipViewTextBtn) zipViewTextBtn.classList.toggle("active", mode === "details");
    renderZipFiles();
  }

  if (zipViewThumbBtn) zipViewThumbBtn.addEventListener("click", () => setViewMode("icons", zipViewThumbBtn));
  if (zipViewTextBtn) zipViewTextBtn.addEventListener("click", () => setViewMode("details", zipViewTextBtn));

  window.addEventListener("keydown", (e) => {
    const zipSection = document.getElementById("zip");
    if (!zipSection || zipSection.classList.contains("hidden")) return;
    if (["INPUT", "TEXTAREA"].includes(document.activeElement.tagName)) return;

    const isMacCmd = e.metaKey || e.ctrlKey;

    if ((isMacCmd && e.key === "ArrowUp") || e.key === "Escape") {
      if (currentFolder !== null) {
        e.preventDefault();
        const f = zipFolders.find(fold => fold.id === currentFolder);
        currentFolder = f ? f.parentId : null;
        renderZipFiles();
      }
    }
  });

  if (zipCreateFolderBtn) {
    zipCreateFolderBtn.addEventListener("click", () => {
      const name = prompt("新しいフォルダ名を入力してください。");
      if (!name || !name.trim()) return;
      const newFolderId = uniqueId++;
      zipFolders.push({
        id: newFolderId,
        name: name.trim(),
        parentId: currentFolder
      });
      expandedFolderIds.add(newFolderId);
      renderZipFiles();
    });
  }

  if (zipDropZone && zipInput) {
    zipDropZone.addEventListener("click", (e) => {
      const isItemClick = e.target.closest(".file-item") || e.target.closest("button") || e.target.closest("input");
      if (!isItemClick) {
        zipInput.click();
      }
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
      e.preventDefault();
      e.stopPropagation();
      zipDropZone.classList.remove("drag-over");

      if (draggedItem) {
        let parentFolderId = null;
        if (currentFolder !== null) {
          const cf = zipFolders.find(f => f.id === currentFolder);
          parentFolderId = cf ? cf.parentId : null;
        }
        moveItemToFolder(draggedItem, parentFolderId);
        return;
      }

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
      expandedFolderIds.clear();
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
    zipPath.innerHTML = "";

    const pathChain = [{ id: null, name: 'ファイル' }];
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
        sep.textContent = " › ";
        sep.style.color = "#888";
        sep.style.margin = "0 3px";
        zipPath.appendChild(sep);
      }

      const link = document.createElement("span");
      link.style.display = "inline-flex";
      link.style.alignItems = "center";
      link.style.cursor = "pointer";
      link.style.padding = "2px 6px";
      link.style.borderRadius = "4px";

      const iconImg = document.createElement("img");
      iconImg.src = "images/file.png";
      iconImg.width = 20;
      iconImg.height = 20;
      iconImg.style.verticalAlign = "middle";
      iconImg.style.marginRight = "4px";
      iconImg.style.objectFit = "contain";
      iconImg.alt = "ファイル";

      const textSpan = document.createElement("span");
      textSpan.textContent = crumb.name;

      link.append(iconImg, textSpan);

      link.addEventListener("click", (e) => {
        e.stopPropagation();
        currentFolder = crumb.id;
        renderZipFiles();
      });

      link.addEventListener("dragover", (e) => {
        e.preventDefault();
        if (draggedItem) {
          link.style.background = "#007aff";
          link.style.color = "#fff";
        }
      });
      link.addEventListener("dragleave", () => {
        link.style.background = "transparent";
        link.style.color = "";
      });
      link.addEventListener("drop", (e) => {
        e.preventDefault();
        e.stopPropagation();
        link.style.background = "transparent";
        link.style.color = "";
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
      if (itemInfo.id === targetFolderId) return;
      let checkId = targetFolderId;
      while (checkId !== null) {
        if (checkId === itemInfo.id) return;
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
    if (currentViewMode === "icons") zipDropZone.classList.add("icon-view");
    if (currentViewMode === "details") zipDropZone.classList.add("details-view");

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

    if (currentViewMode === "details") {
      const header = document.createElement("div");
      header.className = "details-header";
      header.innerHTML = `
        <span></span>
        <span>名前</span>
        <span>更新日時</span>
        <span>サイズ</span>
        <span>種類</span>
        <span style="text-align: right; margin-right: 12px;">操作</span>
      `;
      zipDropZone.appendChild(header);
    }

    currentFolders.forEach(folder => {
      zipDropZone.appendChild(createFolderRow(folder));
    });

    currentFiles.forEach(item => {
      zipDropZone.appendChild(createFileRow(item));
    });
  }

  function createFolderRow(folder) {
    const row = document.createElement("div");
    row.className = "file-item";

    if (currentViewMode === "details") {
      row.style.display = "flex";
      row.style.alignItems = "center";
      row.style.justifyContent = "space-between";
    }

    row.draggable = true;
    setupItemDragEvents(row, { type: "folder", id: folder.id });
    setupFolderDropEvents(row, folder.id);

    const icon = document.createElement("span");
    icon.className = "file-icon";
    if (currentViewMode === "icons") {
      icon.innerHTML = getFolderIconHtml();
    } else {
      icon.innerHTML = "";
    }

    const name = document.createElement("span");
    name.className = "file-name";
    name.textContent = folder.name;

    const info = document.createElement("span");
    info.className = "file-info";
    if (currentViewMode === "details") {
      info.innerHTML = `
        <span>-</span>
        <span>-</span>
        <span>フォルダ</span>
      `;
    }

    const deleteButton = document.createElement("button");
    deleteButton.className = "delete-file";
    deleteButton.textContent = "削除";
    deleteButton.title = "フォルダを削除";
    deleteButton.style.border = "none";
    deleteButton.style.background = "transparent";
    deleteButton.style.color = "#d9534f";
    deleteButton.style.fontSize = "0.85rem";
    deleteButton.style.cursor = "pointer";
    deleteButton.style.padding = "0";
    deleteButton.style.marginLeft = "auto";
    deleteButton.style.marginRight = "8px";

    deleteButton.addEventListener("mouseenter", () => {
      deleteButton.style.textDecoration = "underline";
    });
    deleteButton.addEventListener("mouseleave", () => {
      deleteButton.style.textDecoration = "none";
    });

    deleteButton.addEventListener("click", event => {
      event.stopPropagation();
      deleteFolder(folder.id);
    });

    row.addEventListener("dblclick", event => {
      event.stopPropagation();
      openFolder(folder.id);
    });

    row.append(icon, name, info, deleteButton);
    return row;
  }

  function createFileRow(item) {
    const row = document.createElement("div");
    row.className = "file-item";

    if (currentViewMode === "details") {
      row.style.display = "flex";
      row.style.alignItems = "center";
      row.style.justifyContent = "space-between";
    }

    row.draggable = true;
    setupItemDragEvents(row, { type: "file", id: item.id });

    const icon = document.createElement("span");
    icon.className = "file-icon";
    if (currentViewMode === "icons") {
      icon.innerHTML = getFileIconHtml(item.file);
    } else {
      icon.innerHTML = "";
    }

    const name = document.createElement("span");
    name.className = "file-name";
    name.textContent = item.displayName;

    const info = document.createElement("span");
    info.className = "file-info";
    if (currentViewMode === "details") {
      info.innerHTML = `
        <span>${formatDate(item.file.lastModified)}</span>
        <span>${formatFileSize(item.file.size)}</span>
        <span>${escapeHTML(item.file.type || "形式不明")}</span>
      `;
    }

    const deleteButton = document.createElement("button");
    deleteButton.className = "delete-file";
    deleteButton.textContent = "削除";
    deleteButton.title = "ファイルを削除";
    deleteButton.style.border = "none";
    deleteButton.style.background = "transparent";
    deleteButton.style.color = "#d9534f";
    deleteButton.style.fontSize = "0.85rem";
    deleteButton.style.cursor = "pointer";
    deleteButton.style.padding = "0";
    deleteButton.style.marginLeft = "auto";
    deleteButton.style.marginRight = "8px";

    deleteButton.addEventListener("mouseenter", () => {
      deleteButton.style.textDecoration = "underline";
    });
    deleteButton.addEventListener("mouseleave", () => {
      deleteButton.style.textDecoration = "none";
    });

    deleteButton.addEventListener("click", event => {
      event.stopPropagation();
      removeFileById(item.id);
    });

    row.append(icon, name, info, deleteButton);
    return row;
  }

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

  function setupFolderDropEvents(element, targetFolderId) {
    element.addEventListener("dragover", (e) => {
      e.preventDefault();
      if (draggedItem && (draggedItem.type !== "folder" || draggedItem.id !== targetFolderId)) {
        element.style.outline = "2px dashed #007aff";
        element.style.background = "#e4efff";
      }
    });

    element.addEventListener("dragleave", () => {
      element.style.outline = "";
      element.style.background = "";
    });

    element.addEventListener("drop", (e) => {
      e.preventDefault();
      e.stopPropagation();
      element.style.outline = "";
      element.style.background = "";
      if (draggedItem) {
        moveItemToFolder(draggedItem, targetFolderId);
      }
    });
  }

  function deleteFolder(id, skipConfirm = false) {
    if (!skipConfirm && !confirm("このフォルダと中のファイルを削除しますか？")) return;
    const removeIds = [id];
    for (let i = 0; i < removeIds.length; i++) {
      const pid = removeIds[i];
      zipFolders.filter(f => f.parentId === pid).forEach(f => removeIds.push(f.id));
    }
    removeIds.forEach(fid => expandedFolderIds.delete(fid));
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
      expandedFolderIds.clear();
      hideZipResult();
      renderZipFiles();
    });
  }

  renderZipFiles();
  hideZipResult();
})();