// js/file-manager.js

(function () {
  const fileInput = document.getElementById("fileInput");
  const fileList = document.getElementById("fileList");
  const addFilesBtn = document.getElementById("addFilesBtn");
  const clearFilesBtn = document.getElementById("clearFilesBtn");
  const filePath = document.getElementById("filePath");

  let managedFiles = [];
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

  // ファイルの種類に応じた画像アイコンのHTMLを返す関数（デフォルト・その他は file.png）
  function getFileIconHtml(file) {
    const ext = file.name.split(".").pop().toLowerCase();
    
    let imgPath = "images/file.png"; // デフォルト
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

  if (addFilesBtn && fileInput) {
    addFilesBtn.addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", () => {
      addManagedFiles(Array.from(fileInput.files));
      fileInput.value = "";
    });
  }

  if (clearFilesBtn) {
    clearFilesBtn.addEventListener("click", () => {
      managedFiles = [];
      renderFileList();
      notifyApp();
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

  function renderFileList() {
    if (!fileList) return;
    if (filePath) {
      filePath.innerHTML = `<img src="images/file.png" width="20" height="20" style="vertical-align: middle; margin-right: 4px; object-fit: contain;" alt="ファイル"> ファイル`;
    }

    fileList.innerHTML = "";
    fileList.className = "file-list";

    if (currentView === "icons") fileList.classList.add("icon-view");
    if (currentView === "details") fileList.classList.add("details-view");

    if (managedFiles.length === 0) {
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
        <span style="text-align: right; margin-right: 12px;">操作</span>
      `;
      fileList.appendChild(header);
    }

    managedFiles.forEach(item => {
      fileList.appendChild(createFileRow(item));
    });
  }

  function createFileRow(item) {
    const row = document.createElement("div");
    row.className = "file-item";
    if (item.selected) row.classList.add("selected");

    if (currentView === "details") {
      row.style.display = "flex";
      row.style.alignItems = "center";
      row.style.justifyContent = "space-between";
    }

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = item.selected;
    checkbox.addEventListener("change", () => {
      item.selected = checkbox.checked;
      renderFileList();
    });

    const icon = document.createElement("span");
    icon.className = "file-icon";
    if (currentView === "icons") {
      icon.innerHTML = getFileIconHtml(item.file);
    } else {
      icon.innerHTML = "";
    }

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

  document.querySelectorAll("#convert .view-btn").forEach(button => {
    button.addEventListener("click", () => {
      if (!button.dataset.view) return;
      currentView = button.dataset.view;
      document.querySelectorAll("#convert .view-btn").forEach(btn => {
        btn.classList.toggle("active", btn === button);
      });
      renderFileList();
    });
  });

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