// js/file-manager.js

(function () {
  const fileInput = document.getElementById("fileInput");
  const fileList = document.getElementById("fileList");
  const addFilesBtn = document.getElementById("addFilesBtn");
  const createFolderBtn = document.getElementById("createFolderBtn");
  const downloadFilesBtn = document.getElementById("downloadFilesBtn");
  const filePath = document.getElementById("filePath");

  let managedFiles = [];
  let folders = [];
  let currentFolder = null;
  let currentView = "icons";
  let nextId = 1;

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

  function getFileIcon(file) {
    const ext = file.name.split(".").pop().toLowerCase();
    if (["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg", "avif", "heic", "heif", "tif", "tiff"].includes(ext)) {
      return "🖼️";
    }
    if (ext === "pdf") return "📕";
    if (["zip", "rar", "7z"].includes(ext)) return "🗜️";
    return "📄";
  }

  if (addFilesBtn && fileInput) {
    addFilesBtn.addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", () => {
      addManagedFiles(Array.from(fileInput.files));
      fileInput.value = "";
    });
  }

  if (fileList && fileInput) {
    fileList.addEventListener("click", (e) => {
      if (e.target.closest(".file-item") || e.target.closest("button") || e.target.closest("input")) return;
      fileInput.click();
    });

    ["dragenter", "dragover"].forEach(eventName => {
      fileList.addEventListener(eventName, event => {
        event.preventDefault();
        event.stopPropagation();
        fileList.classList.add("drag-over");
      });
    });

    ["dragleave", "drop"].forEach(eventName => {
      fileList.addEventListener(eventName, event => {
        event.preventDefault();
        event.stopPropagation();
        fileList.classList.remove("drag-over");
      });
    });

    fileList.addEventListener("drop", event => {
      event.preventDefault();
      event.stopPropagation();
      fileList.classList.remove("drag-over");
      addManagedFiles(Array.from(event.dataTransfer.files));
    });
  }

  function addManagedFiles(files) {
    files.forEach(file => {
      const alreadyExists = managedFiles.some(item =>
        item.file.name === file.name &&
        item.file.size === file.size &&
        item.file.lastModified === file.lastModified
      );

      if (!alreadyExists) {
        managedFiles.push({
          id: nextId++,
          file,
          folderId: currentFolder,
          selected: false
        });
      }
    });

    renderFileList();
    notifyApp();
  }

  function notifyApp() {
    window.dispatchEvent(
      new CustomEvent("file-studio-files-changed", {
        detail: { files: managedFiles.map(item => item.file) }
      })
    );
  }

  if (createFolderBtn) {
    createFolderBtn.addEventListener("click", () => {
      const name = prompt("新しいフォルダ名を入力してください。");
      if (!name || !name.trim()) return;
      folders.push({ id: nextId++, name: name.trim(), parentId: currentFolder });
      renderFileList();
    });
  }

  function openFolder(id) {
    currentFolder = id;
    renderFileList();
  }

  function updateFolderPath() {
    if (!filePath) return;
    const names = [];
    let id = currentFolder;
    while (id !== null) {
      const folder = folders.find(item => item.id === id);
      if (!folder) break;
      names.unshift(folder.name);
      id = folder.parentId;
    }
    filePath.textContent = "📁 ファイル" + (names.length ? " / " + names.join(" / ") : "");
  }

  function renderFileList() {
    if (!fileList) return;
    updateFolderPath();

    fileList.innerHTML = "";
    fileList.className = "file-list";

    if (currentView === "icons") fileList.classList.add("icon-view");
    if (currentView === "details") fileList.classList.add("details-view");
    if (currentView === "tree") fileList.classList.add("tree-view");

    if (currentView === "tree") {
      fileList.classList.add("has-files");
      renderTree(null, 0);
      return;
    }

    const currentFolders = folders.filter(f => f.parentId === currentFolder);
    const currentFiles = managedFiles.filter(item => item.folderId === currentFolder);

    if (currentFolders.length === 0 && currentFiles.length === 0) {
      fileList.classList.remove("has-files");
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
      fileList.appendChild(empty);
      return;
    }

    fileList.classList.add("has-files");

    if (currentView === "details") {
      const header = document.createElement("div");
      header.className = "details-header";
      header.innerHTML = `
        <span></span>
        <span>名前</span>
        <span>更新日時</span>
        <span>サイズ</span>
        <span>種類</span>
        <span>操作</span>
      `;
      fileList.appendChild(header);
    }

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
      row.querySelector(".delete-file").addEventListener("click", event => { event.stopPropagation(); deleteFolder(folder.id); });
      fileList.appendChild(row);
    });

    currentFiles.forEach(item => {
      fileList.appendChild(createFileRow(item));
    });
  }

  function renderTree(parentId, depth) {
    const childFolders = folders.filter(folder => folder.parentId === parentId);
    childFolders.forEach(folder => {
      const row = document.createElement("div");
      row.className = "file-item folder-item";
      row.style.paddingLeft = (10 + depth * 22) + "px";
      row.innerHTML = `
        <span class="file-icon">📁</span>
        <span class="file-name">${escapeHTML(folder.name)}</span>
      `;
      row.querySelector(".file-name").addEventListener("click", (e) => { e.stopPropagation(); openFolder(folder.id); });
      row.querySelector(".file-icon").addEventListener("click", (e) => { e.stopPropagation(); openFolder(folder.id); });
      fileList.appendChild(row);

      managedFiles.filter(item => item.folderId === folder.id).forEach(item => {
        const fileRow = createFileRow(item);
        fileRow.style.paddingLeft = (32 + depth * 22) + "px";
        fileList.appendChild(fileRow);
      });

      renderTree(folder.id, depth + 1);
    });

    if (parentId === null) {
      managedFiles.filter(item => item.folderId === null).forEach(item => {
        fileList.appendChild(createFileRow(item));
      });
    }
  }

  function createFileRow(item) {
    const row = document.createElement("div");
    row.className = "file-item";
    if (item.selected) row.classList.add("selected");

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = item.selected;
    checkbox.addEventListener("change", () => {
      item.selected = checkbox.checked;
      renderFileList();
    });

    const icon = document.createElement("span");
    icon.className = "file-icon";
    icon.textContent = getFileIcon(item.file);

    const name = document.createElement("span");
    name.className = "file-name";
    name.textContent = item.file.name;

    const info = document.createElement("span");
    info.className = "file-info";
    if (currentView === "details") {
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
    deleteButton.addEventListener("click", event => {
      event.stopPropagation();
      deleteFile(item.id);
    });

    row.addEventListener("click", event => {
      if (event.target === checkbox || event.target === deleteButton) return;
      item.selected = !item.selected;
      renderFileList();
    });

    row.append(checkbox, icon, name, info, deleteButton);
    return row;
  }

  function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, char => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[char]);
  }

  function deleteFile(id) {
    managedFiles = managedFiles.filter(item => item.id !== id);
    renderFileList();
    notifyApp();
  }

  function deleteFolder(id) {
    if (!confirm("このフォルダと中のファイルを削除しますか？")) return;
    const removeFolderIds = [id];
    for (let i = 0; i < removeFolderIds.length; i++) {
      const parentId = removeFolderIds[i];
      folders.filter(folder => folder.parentId === parentId).forEach(folder => removeFolderIds.push(folder.id));
    }
    folders = folders.filter(folder => !removeFolderIds.includes(folder.id));
    managedFiles = managedFiles.filter(item => !removeFolderIds.includes(item.folderId));
    if (removeFolderIds.includes(currentFolder)) currentFolder = null;
    renderFileList();
    notifyApp();
  }

  if (downloadFilesBtn) {
    downloadFilesBtn.addEventListener("click", async () => {
      const selected = managedFiles.filter(item => item.selected);
      if (selected.length === 0) {
        alert("ダウンロードするファイルを選択してください。");
        return;
      }
      if (selected.length === 1) {
        downloadBlob(selected[0].file, selected[0].file.name);
        return;
      }
      if (!window.JSZip) {
        alert("ZIPライブラリを読み込めません。");
        return;
      }
      const zip = new JSZip();
      selected.forEach((item, index) => {
        let filename = item.file.name;
        if (zip.file(filename)) {
          const dot = filename.lastIndexOf(".");
          const base = dot > 0 ? filename.slice(0, dot) : filename;
          const ext = dot > 0 ? filename.slice(dot) : "";
          filename = `${base}_${index + 1}${ext}`;
        }
        zip.file(filename, item.file);
      });
      const blob = await zip.generateAsync({ type: "blob" });
      downloadBlob(blob, "files.zip");
    });
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  document.querySelectorAll(".view-btn").forEach(button => {
    button.addEventListener("click", () => {
      if (!button.dataset.view) return;
      currentView = button.dataset.view;
      document.querySelectorAll(".view-btn").forEach(btn => {
        btn.classList.toggle("active", btn === button);
      });
      renderFileList();
    });
  });

  // ファイル変換成功時に選択されていたファイルを自動クリアするイベントリスナー
  window.addEventListener("file-studio-clear-converted-files", event => {
    if (event.detail && event.detail.convertedFiles) {
      const convertedFiles = event.detail.convertedFiles;
      managedFiles = managedFiles.filter(item => !convertedFiles.includes(item.file));
      renderFileList();
      notifyApp();
    }
  });

  renderFileList();
})();