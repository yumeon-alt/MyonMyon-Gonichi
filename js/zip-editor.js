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
  let currentViewMode = "thumb"; // "thumb", "text"
  let uniqueId = 1;
  let draggedItem = null; // { type: 'file' | 'folder', id: number }
  let selectedItem = null; // { type: 'file' | 'folder', id: number }
  let expandedFolderIds = new Set(); // リスト表示で展開中のフォルダID
  let generatedZipBlob = null;

  function formatFileSize(size) {
    if (size < 1024) return size + " B";
    if (size < 1024 * 1024) return (size / 1024).toFixed(1) + " KB";
    return (size / (1024 * 1024)).toFixed(1) + " MB";
  }

  // ファイルの種類に応じた画像アイコンのHTMLを返す関数（128x128サイズ・上部余白詰め）
  function getFileIconHtml(file) {
    const ext = file.name.split(".").pop().toLowerCase();
    
    let imgPath = "images/?.png"; // デフォルト（HEICやその他）
    let label = "ファイル";

    if (["png"].includes(ext)) {
      imgPath = "images/image.png";
      label = "PNG画像";
    } else if (["jpg", "jpeg"].includes(ext)) {
      imgPath = "images/jpg.png";
      label = "JPEG画像";
    } else if (["gif", "webp", "bmp", "svg", "avif", "tif", "tiff"].includes(ext)) {
      imgPath = "images/image.png";
      label = "画像";
    } else if (ext === "pdf") {
      imgPath = "images/pdf.png";
      label = "PDF";
    } else if (["zip", "rar", "7z"].includes(ext)) {
      imgPath = "images/zip.png";
      label = "ZIP";
    }

    return `<div style="text-align: center; margin-top: -12px; margin-bottom: 0;"><img src="${imgPath}" width="128" height="128" style="display: inline-block; object-fit: contain;" alt="${label}"></div>`;
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
  function setViewMode(mode, activeBtn) {
    currentViewMode = mode;
    if (zipViewThumbBtn) zipViewThumbBtn.classList.toggle("active", mode === "thumb");
    if (zipViewTextBtn) zipViewTextBtn.classList.toggle("active", mode === "text");
    renderZipFiles();
  }

  if (zipViewThumbBtn) zipViewThumbBtn.addEventListener("click", () => setViewMode("thumb", zipViewThumbBtn));
  if (zipViewTextBtn) zipViewTextBtn.addEventListener("click", () => setViewMode("text", zipViewTextBtn));

  // Mac風キーボード操作
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
        selectedItem = null;
        renderZipFiles();
      }
    } else if ((isMacCmd && e.key === "ArrowDown") || e.key === "Enter") {
      if (selectedItem && selectedItem.type === "folder") {
        e.preventDefault();
        openFolder(selectedItem.id);
      }
    } else if (e.key === "Delete" || e.key === "Backspace" || (isMacCmd && e.key === "Backspace")) {
      if (selectedItem) {
        e.preventDefault();
        if (selectedItem.type === "file") {
          removeFileById(selectedItem.id);
        } else if (selectedItem.type === "folder") {
          deleteFolder(selectedItem.id);
        }
        selectedItem = null;
      }
    }
  });

  // フォルダ作成
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
      const isItemClick = e.target.closest(".file-item") || e.target.closest(".pdf-page-item-card") || e.target.closest("button") || e.target.closest("input");
      if (!isItemClick) {
        selectedItem = null;
        renderZipFiles();
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

    // 枠外（ドロップゾーンの空白エリア）にドロップされた場合、直近の親フォルダへ移動（外出し）
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
      selectedItem = null;
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
        sep.textContent = " › ";
        sep.style.color = "#888";
        sep.style.margin = "0 3px";
        zipPath.appendChild(sep);
      }

      const link = document.createElement("span");
      link.textContent = crumb.name;
      link.style.cursor = "pointer";
      link.style.padding = "2px 6px";
      link.style.borderRadius = "4px";

      link.addEventListener("click", (e) => {
        e.stopPropagation();
        currentFolder = crumb.id;
        selectedItem = null;
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
    selectedItem = null;
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
    if (currentViewMode === "thumb") zipDropZone.classList.add("icon-view");
    if (currentViewMode === "text") zipDropZone.classList.add("details-view");

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
      // フォルダ（アイコン表示）
      currentFolders.forEach(folder => {
        const card = document.createElement("div");
        card.className = "pdf-page-item-card";
        if (selectedItem && selectedItem.type === "folder" && selectedItem.id === folder.id) {
          card.style.background = "#e4efff";
          card.style.borderColor = "#007aff";
          card.style.boxShadow = "0 0 0 2px rgba(0,122,255,0.2)";
        }

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

        card.addEventListener("click", (e) => {
          e.stopPropagation();
          selectedItem = { type: "folder", id: folder.id };
          renderZipFiles();
        });

        card.addEventListener("dblclick", (e) => {
          e.stopPropagation();
          openFolder(folder.id);
        });

        card.append(icon, nameSpan, delBtn);
        zipDropZone.appendChild(card);
      });

      // ファイル（アイコン表示）
      currentFiles.forEach(item => {
        const card = document.createElement("div");
        card.className = "pdf-page-item-card";
        if (selectedItem && selectedItem.type === "file" && selectedItem.id === item.id) {
          card.style.background = "#e4efff";
          card.style.borderColor = "#007aff";
          card.style.boxShadow = "0 0 0 2px rgba(0,122,255,0.2)";
        }

        card.draggable = true;
        setupItemDragEvents(card, { type: "file", id: item.id });

        const icon = document.createElement("div");
        icon.className = "file-icon";
        icon.innerHTML = getFileIconHtml(item.file);
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

        card.addEventListener("click", (e) => {
          e.stopPropagation();
          selectedItem = { type: "file", id: item.id };
          renderZipFiles();
        });

        ctrlArea.appendChild(delBtn);
        card.append(icon, nameSpan, ctrlArea);
        zipDropZone.appendChild(card);
      });

    } else {
      // 🍎 リスト表示（Mac風 階層展開対応）
      renderListViewNodes(currentFolder, 0);
    }
  }

  // リスト表示時の階層展開描画ロジック
  function renderListViewNodes(parentId, depth) {
    const childFolders = zipFolders.filter(folder => folder.parentId === parentId);
    const childFiles = zipFiles.filter(item => item.folderId === parentId);

    childFolders.forEach(folder => {
      const isExpanded = expandedFolderIds.has(folder.id);

      const row = document.createElement("div");
      row.className = "file-item folder-item";
      row.style.paddingLeft = (10 + depth * 20) + "px";
      if (selectedItem && selectedItem.type === "folder" && selectedItem.id === folder.id) {
        row.style.background = "#e4efff";
      }

      row.draggable = true;
      setupItemDragEvents(row, { type: "folder", id: folder.id });
      setupFolderDropEvents(row, folder.id);

      // Mac風 ▶ トグル矢印
      const toggleBtn = document.createElement("span");
      toggleBtn.style.display = "inline-block";
      toggleBtn.style.width = "18px";
      toggleBtn.style.textAlign = "center";
      toggleBtn.style.cursor = "pointer";
      toggleBtn.style.userSelect = "none";
      toggleBtn.style.fontSize = "12px";
      toggleBtn.style.color = "#666";
      toggleBtn.textContent = isExpanded ? "▼" : "▶";

      toggleBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (isExpanded) {
          expandedFolderIds.delete(folder.id);
        } else {
          expandedFolderIds.add(folder.id);
        }
        renderZipFiles();
      });

      const icon = document.createElement("span");
      icon.className = "file-icon";
      icon.style.pointerEvents = "none";
      icon.textContent = "📁";

      const name = document.createElement("span");
      name.className = "file-name";
      name.style.pointerEvents = "none";
      name.textContent = folder.name;

      const delBtn = document.createElement("button");
      delBtn.className = "delete-file";
      delBtn.textContent = "削除";
      delBtn.addEventListener("click", e => {
        e.stopPropagation();
        deleteFolder(folder.id);
      });

      row.addEventListener("click", (e) => {
        e.stopPropagation();
        selectedItem = { type: "folder", id: folder.id };
        renderZipFiles();
      });

      row.addEventListener("dblclick", (e) => {
        e.stopPropagation();
        openFolder(folder.id);
      });

      row.append(toggleBtn, icon, name, delBtn);
      zipDropZone.appendChild(row);

      // フォルダが展開されている場合、子要素を再帰描画
      if (isExpanded) {
        renderListViewNodes(folder.id, depth + 1);
      }
    });

    childFiles.forEach(item => {
      const row = document.createElement("div");
      row.className = "file-item";
      row.style.paddingLeft = (28 + depth * 20) + "px"; // 矢印分のオフセット調整
      if (selectedItem && selectedItem.type === "file" && selectedItem.id === item.id) {
        row.style.background = "#e4efff";
      }

      row.draggable = true;
      setupItemDragEvents(row, { type: "file", id: item.id });

      const icon = document.createElement("span");
      icon.className = "file-icon";
      icon.innerHTML = getFileIconHtml(item.file);
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

      row.addEventListener("click", (e) => {
        e.stopPropagation();
        selectedItem = { type: "file", id: item.id };
        renderZipFiles();
      });

      row.append(icon, name, info, delBtn);
      zipDropZone.appendChild(row);
    });
  }

  // ドラッグ開始・終了
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

  // フォルダ上へのドロップ
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

  function deleteFolder(id) {
    if (!confirm("このフォルダと中のファイルを削除しますか？")) return;
    const removeIds = [id];
    for (let i = 0; i < removeIds.length; i++) {
      const pid = removeIds[i];
      zipFolders.filter(f => f.parentId === pid).forEach(f => removeIds.push(f.id));
    }
    removeIds.forEach(fid => expandedFolderIds.delete(fid));
    zipFolders = zipFolders.filter(f => !removeIds.includes(f.id));
    zipFiles = zipFiles.filter(item => !removeIds.includes(item.folderId));
    if (removeIds.includes(currentFolder)) currentFolder = null;
    if (selectedItem && selectedItem.type === "folder" && removeIds.includes(selectedItem.id)) {
      selectedItem = null;
    }
    hideZipResult();
    renderZipFiles();
  }

  function removeFileById(id) {
    zipFiles = zipFiles.filter(f => f.id !== id);
    if (selectedItem && selectedItem.type === "file" && selectedItem.id === id) {
      selectedItem = null;
    }
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
      selectedItem = null;
      expandedFolderIds.clear();
      hideZipResult();
      renderZipFiles();
    });
  }

  renderZipFiles();
  hideZipResult();
})();