import {
  state,
  initState,
  saveToLocal,
  toggleSortBySize,
  getBinOrder,
  dequeueToBin,
  moveItem,
  renameItem,
  replaceQueueWithLines,
  serializeState,
  restoreState,
  parseState,
  toggleBinSelection,
  clearBinSelection,
  getSelectedBinsData,
  addSkeletonTemplate,
  selectSkeletonTemplate,
  getSelectedSkeletonTemplate,
  addDataTemplate,
  addDataResult,
  updateDataResult,
  selectDataResult,
  getSelectedDataResult,
  setPreviewCombo,
  getPreviewCombo,
  buildPreviewHtml,
  buildFilename,
  updateTab,
  createCheckpoint,
  loadCheckpoint,
  updateCheckpointLabel,
  updateModelCache,
  setLlmDraft,
  mergeTemplateInstructions,
  sanitizeTemplateName,
  updateTemplateName,
  updateDataTemplateName,
} from "./logic.js";

const $ = (id) => document.getElementById(id);

const elements = {
  currentEntry: $("currentEntry"),
  queueStats: $("queueStats"),
  binsGrid: $("binsGrid"),
  sortBinsBtn: $("sortBinsBtn"),
  importNotesBtn: $("importNotesBtn"),
  saveCheckpointBtn: $("saveCheckpointBtn"),
  prevCheckpointBtn: $("prevCheckpointBtn"),
  nextCheckpointBtn: $("nextCheckpointBtn"),
  clearSelectionBtn: $("clearSelectionBtn"),
  checkpointLabel: $("checkpointLabel"),
  skeletonListSorter: $("skeletonListSorter"),
  skeletonListLlm: $("skeletonListLlm"),
  dataTemplateList: $("dataTemplateList"),
  dataTemplateListLlm: $("dataTemplateListLlm"),
  dataResultList: $("dataResultList"),
  combineBtn: $("combineBtn"),
  combineHint: $("combineHint"),
  previewFrame: $("previewFrame"),
  previewNote: $("previewNote"),
  downloadHtmlBtn: $("downloadHtmlBtn"),
  fullscreenPreviewBtn: $("fullscreenPreviewBtn"),
  popoutPreviewBtn: $("popoutPreviewBtn"),
  fullscreenOverlay: $("fullscreenOverlay"),
  fullscreenFrame: $("fullscreenFrame"),
  closeFullscreenBtn: $("closeFullscreenBtn"),
  templateDetails: $("templateDetails"),
  openSkeletonModalBtn: $("openSkeletonModalBtn"),
  openDataModalBtn: $("openDataModalBtn"),
  skeletonModal: $("skeletonModal"),
  skeletonNameInput: $("skeletonNameInput"),
  skeletonPromptInput: $("skeletonPromptInput"),
  closeSkeletonModalBtn: $("closeSkeletonModalBtn"),
  saveSkeletonDraftBtn: $("saveSkeletonDraftBtn"),
  sendSkeletonBtn: $("sendSkeletonBtn"),
  skeletonStatus: $("skeletonStatus"),
  dataModal: $("dataModal"),
  dataNameInput: $("dataNameInput"),
  dataPromptInput: $("dataPromptInput"),
  closeDataModalBtn: $("closeDataModalBtn"),
  saveDataDraftBtn: $("saveDataDraftBtn"),
  saveDataTemplateBtn: $("saveDataTemplateBtn"),
  dataStatus: $("dataStatus"),
  jsonResultModal: $("jsonResultModal"),
  jsonResultTextarea: $("jsonResultTextarea"),
  closeJsonResultBtn: $("closeJsonResultBtn"),
  llmModelSelect: $("llmModelSelect"),
  refreshModelsBtn: $("refreshModelsBtn"),
  modelCacheNote: $("modelCacheNote"),
  llmMaxTokensInput: $("llmMaxTokensInput"),
  llmReasoningSelect: $("llmReasoningSelect"),
  llmTimeoutConnect: $("llmTimeoutConnect"),
  llmTimeoutRead: $("llmTimeoutRead"),
  exportStateBtn: $("exportStateBtn"),
  copyStateBtn: $("copyStateBtn"),
  downloadStateBtn: $("downloadStateBtn"),
  loadStateBtn: $("loadStateBtn"),
  openImportModalBtn: $("openImportModalBtn"),
  stateTextarea: $("stateTextarea"),
  importModal: $("importModal"),
  importTextarea: $("importTextarea"),
  cancelImportBtn: $("cancelImportBtn"),
  confirmImportBtn: $("confirmImportBtn"),
};

const openModal = (modal) => modal.classList.remove("hidden");
const closeModal = (modal) => modal.classList.add("hidden");

const renderCurrentEntry = () => {
  const current = state.queue[0]?.text || "(done)";
  elements.currentEntry.textContent = `Current entry: ${current}`;
  elements.queueStats.textContent = `Queue: ${state.queue.length} items • Bins: ${
    state.binOrder.length
  } • Selected: ${state.selectedBinKeys.length}`;
};

const renderBins = () => {
  elements.binsGrid.innerHTML = "";
  const order = getBinOrder();
  if (!order.length) {
    elements.binsGrid.innerHTML = `<div class="small">No bins yet. Press a key to create one.</div>`;
    return;
  }

  order.forEach((binKey) => {
    const binItems = state.bins[binKey] || [];
    const binCard = document.createElement("div");
    binCard.className = "bin-card";
    if (state.selectedBinKeys.includes(binKey)) binCard.classList.add("selected");

    const header = document.createElement("div");
    header.className = "bin-header";
    header.innerHTML = `<span>${binKey}</span><small>${binItems.length}</small>`;
    header.addEventListener("click", () => {
      toggleBinSelection(binKey);
      saveToLocal();
      render();
    });

    const itemsWrap = document.createElement("div");
    itemsWrap.className = "bin-items";
    itemsWrap.dataset.bin = binKey;

    itemsWrap.addEventListener("dragover", (event) => event.preventDefault());
    itemsWrap.addEventListener("drop", (event) => {
      event.preventDefault();
      const payload = event.dataTransfer.getData("text/plain");
      if (!payload) return;
      const { fromKey, itemId } = JSON.parse(payload);
      if (!fromKey || !itemId) return;
      moveItem(fromKey, binKey, itemId);
      saveToLocal();
      render();
    });

    binItems.forEach((item) => {
      const itemDiv = document.createElement("div");
      itemDiv.className = "bin-item";
      itemDiv.textContent = item.text;
      itemDiv.draggable = true;
      itemDiv.dataset.itemId = item.id;
      itemDiv.addEventListener("dragstart", (event) => {
        event.dataTransfer.setData(
          "text/plain",
          JSON.stringify({ fromKey: binKey, itemId: item.id })
        );
      });
      itemDiv.addEventListener("click", () => startInlineEdit(itemDiv, binKey, item));
      itemsWrap.appendChild(itemDiv);
    });

    binCard.appendChild(header);
    binCard.appendChild(itemsWrap);
    elements.binsGrid.appendChild(binCard);
  });
};

const startInlineEdit = (itemDiv, binKey, item) => {
  if (itemDiv.classList.contains("editing")) return;
  const original = item.text;
  itemDiv.classList.add("editing");
  itemDiv.contentEditable = "true";
  itemDiv.focus();
  const range = document.createRange();
  range.selectNodeContents(itemDiv);
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);

  const finish = (commit) => {
    itemDiv.removeEventListener("keydown", onKey);
    itemDiv.contentEditable = "false";
    itemDiv.classList.remove("editing");
    const nextText = itemDiv.textContent.trim();
    if (commit && nextText) {
      renameItem(binKey, item.id, nextText);
    } else {
      itemDiv.textContent = original;
    }
    saveToLocal();
    render();
  };

  const onKey = (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      finish(true);
    }
    if (event.key === "Escape") {
      event.preventDefault();
      finish(false);
    }
  };

  itemDiv.addEventListener("keydown", onKey);
  itemDiv.addEventListener("blur", () => finish(true), { once: true });
};

const renderSkeletonLists = () => {
  const renderList = (container) => {
    container.innerHTML = "";
    if (!state.skeletonTemplates.length) {
      container.innerHTML = `<div class="small">No skeletons yet.</div>`;
      return;
    }
    state.skeletonTemplates.forEach((template) => {
      const card = document.createElement("div");
      card.className = "select-card";
      if (state.selectedSkeletonId === template.id) card.classList.add("active");
      card.innerHTML = `<strong>${template.name}</strong><div class="meta">${new Date(
        template.createdAt
      ).toLocaleString()}</div>`;
      card.addEventListener("click", () => {
        selectSkeletonTemplate(template.id);
        state.ui.templateDetails = { type: "skeleton", id: template.id };
        saveToLocal();
        render();
      });
      container.appendChild(card);
    });
  };
  renderList(elements.skeletonListSorter);
  renderList(elements.skeletonListLlm);
};

const renderDataTemplates = () => {
  const renderList = (container, allowRun) => {
    container.innerHTML = "";
    if (!state.dataTemplates.length) {
      container.innerHTML = `<div class="small">No JSON templates yet.</div>`;
      return;
    }
    state.dataTemplates.forEach((template) => {
      const card = document.createElement("div");
      card.className = "select-card";
      card.innerHTML = `<strong>${template.name}</strong><div class="meta">${new Date(
        template.createdAt
      ).toLocaleString()}</div>`;
      if (allowRun) {
        card.addEventListener("click", () => runDataTemplate(template));
      } else {
        card.addEventListener("click", () => {
          state.ui.templateDetails = { type: "data", id: template.id };
          saveToLocal();
          render();
        });
      }
      container.appendChild(card);
    });
  };

  renderList(elements.dataTemplateList, true);
  renderList(elements.dataTemplateListLlm, false);
};

const renderDataResults = () => {
  elements.dataResultList.innerHTML = "";
  if (!state.dataResults.length) {
    elements.dataResultList.innerHTML = `<div class="small">No JSON results yet.</div>`;
    return;
  }
  state.dataResults.forEach((result) => {
    const card = document.createElement("div");
    card.className = "select-card";
    if (state.selectedDataResultId === result.id) card.classList.add("active");
    const status = result.status === "pending" ? "⏳" : result.status === "error" ? "⚠️" : "✅";
    card.innerHTML = `<strong>${status} ${result.templateName}</strong>
      <div class="meta">${result.binKeys.join(", ") || "(no bins)"} • ${new Date(
        result.createdAt
      ).toLocaleString()}</div>`;
    card.addEventListener("click", () => {
      selectDataResult(result.id);
      saveToLocal();
      render();
      if (result.status === "success") {
        elements.jsonResultTextarea.value = JSON.stringify(result.responseJson, null, 2);
        openModal(elements.jsonResultModal);
      }
    });
    elements.dataResultList.appendChild(card);
  });
};

const renderCombineHint = () => {
  const skeleton = getSelectedSkeletonTemplate();
  const dataResult = getSelectedDataResult();
  elements.combineHint.textContent =
    skeleton && dataResult
      ? `Ready to combine “${skeleton.name}” with “${dataResult.templateName}”.`
      : "Select a skeleton and a JSON result.";
};

const renderPreview = () => {
  const html = buildPreviewHtml();
  elements.previewFrame.srcdoc = html || "";
  elements.fullscreenFrame.srcdoc = html || "";
  elements.previewNote.textContent = html
    ? "Preview ready."
    : "Select a skeleton + JSON result, then combine.";
};

const renderTemplateDetails = () => {
  const { type, id } = state.ui.templateDetails || {};
  let content = "<div class='small'>Select a template to see details.</div>";
  if (type === "skeleton") {
    const template = state.skeletonTemplates.find((item) => item.id === id);
    if (template) {
      content = `
        <div class="field">
          <label class="small">Name</label>
          <input type="text" id="detailSkeletonName" value="${template.name}" />
        </div>
        <div class="small">Created: ${new Date(template.createdAt).toLocaleString()}</div>
        <h4>Prompt</h4>
        <textarea class="readonly" readonly>${template.prompt}</textarea>
        <h4>Instructions</h4>
        <textarea class="readonly" readonly>${template.instructions}</textarea>
        <h4>Skeleton HTML</h4>
        <textarea class="readonly" readonly>${template.htmlSkeleton}</textarea>
      `;
    }
  }
  if (type === "data") {
    const template = state.dataTemplates.find((item) => item.id === id);
    if (template) {
      content = `
        <div class="field">
          <label class="small">Name</label>
          <input type="text" id="detailDataName" value="${template.name}" />
        </div>
        <div class="small">Created: ${new Date(template.createdAt).toLocaleString()}</div>
        <h4>Prompt</h4>
        <textarea class="readonly" readonly>${template.prompt}</textarea>
      `;
    }
  }
  elements.templateDetails.innerHTML = content;
  const skeletonNameInput = $("detailSkeletonName");
  if (skeletonNameInput) {
    skeletonNameInput.addEventListener("change", () => {
      updateTemplateName(state.ui.templateDetails.id, skeletonNameInput.value.trim());
      saveToLocal();
      render();
    });
  }
  const dataNameInput = $("detailDataName");
  if (dataNameInput) {
    dataNameInput.addEventListener("change", () => {
      updateDataTemplateName(state.ui.templateDetails.id, dataNameInput.value.trim());
      saveToLocal();
      render();
    });
  }
};

const renderModelCache = () => {
  const models = state.modelCache.models || [];
  elements.llmModelSelect.innerHTML = "";
  if (!models.length) {
    elements.llmModelSelect.innerHTML = `<option value="${state.llmSettings.model}">${
      state.llmSettings.model
    }</option>`;
  } else {
    models.forEach((model) => {
      const option = document.createElement("option");
      option.value = model;
      option.textContent = model;
      elements.llmModelSelect.appendChild(option);
    });
  }
  elements.llmModelSelect.value = state.llmSettings.model;
  elements.modelCacheNote.textContent = state.modelCache.fetchedAt
    ? `Fetched: ${new Date(state.modelCache.fetchedAt).toLocaleString()}`
    : "Model list not fetched yet.";
  const supportsReasoning = /o1|o3|gpt-4o|gpt-4\.1/i.test(state.llmSettings.model);
  elements.llmReasoningSelect.disabled = !supportsReasoning;
  if (!supportsReasoning && state.llmSettings.reasoningEffort !== "off") {
    state.llmSettings.reasoningEffort = "off";
    elements.llmReasoningSelect.value = "off";
    saveToLocal();
  }
};

const renderLlmSettings = () => {
  elements.llmMaxTokensInput.value = state.llmSettings.maxOutputTokens;
  elements.llmReasoningSelect.value = state.llmSettings.reasoningEffort || "off";
  elements.llmTimeoutConnect.value = state.llmSettings.timeoutConnect;
  elements.llmTimeoutRead.value = state.llmSettings.timeoutRead;
};

const render = () => {
  renderCurrentEntry();
  renderBins();
  renderCheckpointInfo();
  renderSkeletonLists();
  renderDataTemplates();
  renderDataResults();
  renderCombineHint();
  renderPreview();
  renderTemplateDetails();
  renderModelCache();
  renderLlmSettings();
};

const setTabActive = (tabId) => {
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === tabId);
  });
  document.querySelectorAll(".tab-panel").forEach((panel) => {
    panel.classList.toggle("active", panel.id === `tab-${tabId}`);
  });
  updateTab(tabId);
  saveToLocal();
  render();
};

const readLlmSettings = () => {
  const maxTokens = Number(elements.llmMaxTokensInput.value) || 20000;
  const timeoutConnect = Number(elements.llmTimeoutConnect.value) || 10;
  const timeoutRead = Number(elements.llmTimeoutRead.value) || 180;
  state.llmSettings = {
    model: elements.llmModelSelect.value || "gpt-4.1-mini",
    maxOutputTokens: Math.max(1, Math.floor(maxTokens)),
    reasoningEffort: elements.llmReasoningSelect.value || "off",
    timeoutConnect: Math.max(1, Math.floor(timeoutConnect)),
    timeoutRead: Math.max(1, Math.floor(timeoutRead)),
  };
  saveToLocal();
};

const composeDataPrompt = (templatePrompt, items, binsMap) =>
  templatePrompt
    .replace("{{itemsJson}}", JSON.stringify(items, null, 2))
    .replace("{{binsMap}}", JSON.stringify(binsMap, null, 2));

const runDataTemplate = async (template) => {
  const { binKeys, items, binsMap } = getSelectedBinsData();
  if (!binKeys.length) {
    alert("Select at least one bin.");
    return;
  }
  const result = addDataResult({
    templateId: template.id,
    templateName: template.name,
    binKeys,
    items,
    binsMap,
  });
  saveToLocal();
  render();

  const prompt = composeDataPrompt(template.prompt, items, binsMap);
  try {
    const response = await fetch("/api/llm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        settings: state.llmSettings,
      }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Request failed");
    let parsed = null;
    try {
      parsed = JSON.parse(data.text || "");
    } catch (error) {
      parsed = null;
    }
    updateDataResult(result.id, {
      status: parsed ? "success" : "error",
      responseText: data.text || "",
      responseJson: parsed,
      error: parsed ? null : "Invalid JSON returned",
    });
  } catch (error) {
    updateDataResult(result.id, {
      status: "error",
      responseText: "",
      responseJson: null,
      error: error.message,
    });
  }
  saveToLocal();
  render();
};

const sendSkeletonRequest = async () => {
  const name = elements.skeletonNameInput.value.trim();
  const prompt = elements.skeletonPromptInput.value.trim();
  if (!prompt) return;
  elements.skeletonStatus.textContent = "Sending request...";
  try {
    const response = await fetch("/api/llm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        settings: state.llmSettings,
      }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Request failed");
    const merged = mergeTemplateInstructions(data.text || "");
    addSkeletonTemplate({
      name: name || sanitizeTemplateName(prompt),
      prompt,
      htmlSkeleton: merged.skeleton,
      instructions: merged.instructions,
    });
    elements.skeletonStatus.textContent = "Skeleton saved.";
    saveToLocal();
    render();
  } catch (error) {
    elements.skeletonStatus.textContent = `Error: ${error.message}`;
  }
};

const saveSkeletonDraft = () => {
  setLlmDraft("skeleton", {
    name: elements.skeletonNameInput.value,
    prompt: elements.skeletonPromptInput.value,
  });
  saveToLocal();
  elements.skeletonStatus.textContent = "Draft saved.";
};

const saveDataDraft = () => {
  setLlmDraft("data", {
    name: elements.dataNameInput.value,
    prompt: elements.dataPromptInput.value,
  });
  saveToLocal();
  elements.dataStatus.textContent = "Draft saved.";
};

const saveDataTemplate = () => {
  const name = elements.dataNameInput.value.trim();
  const prompt = elements.dataPromptInput.value.trim();
  if (!prompt) return;
  addDataTemplate({
    name: name || sanitizeTemplateName(prompt),
    prompt,
  });
  saveToLocal();
  render();
  elements.dataStatus.textContent = "JSON template saved.";
};

const openSkeletonModal = () => {
  elements.skeletonNameInput.value = state.llmDrafts.skeleton?.name || "";
  elements.skeletonPromptInput.value = state.llmDrafts.skeleton?.prompt || "";
  elements.skeletonStatus.textContent = "";
  openModal(elements.skeletonModal);
};

const openDataModal = () => {
  elements.dataNameInput.value = state.llmDrafts.data?.name || "";
  elements.dataPromptInput.value = state.llmDrafts.data?.prompt || "";
  elements.dataStatus.textContent = "";
  openModal(elements.dataModal);
};

const combineSelection = () => {
  const skeleton = getSelectedSkeletonTemplate();
  const dataResult = getSelectedDataResult();
  if (!skeleton || !dataResult) {
    alert("Select both a skeleton and a JSON result.");
    return;
  }
  if (dataResult.status !== "success") {
    alert("Pick a JSON result that finished successfully.");
    return;
  }
  setPreviewCombo({ skeletonId: skeleton.id, dataResultId: dataResult.id });
  saveToLocal();
  render();
};

const downloadPreviewHtml = () => {
  const combo = getPreviewCombo();
  const skeleton = state.skeletonTemplates.find((item) => item.id === combo.skeletonId);
  const dataResult = state.dataResults.find((item) => item.id === combo.dataResultId);
  const html = buildPreviewHtml();
  if (!html || !skeleton || !dataResult) return;
  const blob = new Blob([html], { type: "text/html" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = buildFilename(skeleton.name, dataResult.templateName);
  link.click();
  URL.revokeObjectURL(link.href);
};

const openFullscreenPreview = () => {
  if (!elements.previewFrame.srcdoc) return;
  elements.fullscreenFrame.srcdoc = elements.previewFrame.srcdoc;
  elements.fullscreenOverlay.classList.remove("hidden");
};

const popoutPreview = () => {
  const html = elements.previewFrame.srcdoc;
  if (!html) return;
  const pop = window.open();
  if (!pop) return;
  pop.document.write(html);
  pop.document.close();
};

const renderCheckpointInfo = () => {
  const active = state.checkpoints[state.activeCheckpointIndex] || null;
  if (!active) {
    elements.checkpointLabel.textContent = "No checkpoints yet.";
    return;
  }
  elements.checkpointLabel.textContent = `Checkpoint ${
    state.activeCheckpointIndex + 1
  } / ${state.checkpoints.length}: ${active.label}`;
};

const handleKeyAssign = (event) => {
  if (event.target.matches("textarea, input, [contenteditable='true']")) return;
  const key = event.key.toLowerCase();
  if (!/^[0-9a-z]$/.test(key)) return;
  const item = dequeueToBin(key);
  if (!item) return;
  saveToLocal();
  render();
};

const setStateTextarea = () => {
  elements.stateTextarea.value = serializeState();
};

const handleExportState = () => setStateTextarea();

const handleCopyState = async () => {
  setStateTextarea();
  await navigator.clipboard.writeText(elements.stateTextarea.value);
};

const handleDownloadState = () => {
  setStateTextarea();
  const blob = new Blob([elements.stateTextarea.value], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `designer-state-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
};

const handleLoadState = () => {
  try {
    const parsed = parseState(elements.stateTextarea.value);
    restoreState(parsed);
    saveToLocal();
    render();
  } catch (error) {
    alert("Invalid JSON state.");
  }
};

const openImportModal = () => {
  elements.importTextarea.value = "";
  openModal(elements.importModal);
};

const confirmImport = () => {
  const mode = document.querySelector("input[name='importMode']:checked").value;
  const raw = elements.importTextarea.value.trim();
  if (!raw) return;
  if (mode === "lines") {
    replaceQueueWithLines(raw.split(/\r?\n/));
  } else {
    try {
      restoreState(parseState(raw));
    } catch (error) {
      alert("Invalid JSON state.");
      return;
    }
  }
  saveToLocal();
  render();
  closeModal(elements.importModal);
};

const fetchModels = async () => {
  try {
    const response = await fetch("/api/models", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ settings: state.llmSettings }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Failed to fetch models");
    updateModelCache(data.models || []);
    saveToLocal();
    render();
  } catch (error) {
    alert(error.message);
  }
};

const initTabs = () => {
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => setTabActive(btn.dataset.tab));
  });
  if (state.ui.activeTab) setTabActive(state.ui.activeTab);
};

const initEvents = () => {
  document.addEventListener("keydown", handleKeyAssign);
  elements.sortBinsBtn.addEventListener("click", () => {
    toggleSortBySize();
    saveToLocal();
    render();
  });
  elements.importNotesBtn.addEventListener("click", openImportModal);
  elements.saveCheckpointBtn.addEventListener("click", () => {
    createCheckpoint();
    saveToLocal();
    render();
    const label = prompt("Checkpoint label (optional):");
    if (label && label.trim()) updateCheckpointLabel(state.checkpoints.at(-1).id, label);
    saveToLocal();
    render();
  });
  elements.prevCheckpointBtn.addEventListener("click", () => {
    if (state.activeCheckpointIndex === null) return;
    loadCheckpoint(Math.max(0, state.activeCheckpointIndex - 1));
    saveToLocal();
    render();
  });
  elements.nextCheckpointBtn.addEventListener("click", () => {
    if (state.activeCheckpointIndex === null) return;
    loadCheckpoint(
      Math.min(state.checkpoints.length - 1, state.activeCheckpointIndex + 1)
    );
    saveToLocal();
    render();
  });
  elements.clearSelectionBtn.addEventListener("click", () => {
    clearBinSelection();
    saveToLocal();
    render();
  });
  elements.combineBtn.addEventListener("click", combineSelection);
  elements.downloadHtmlBtn.addEventListener("click", downloadPreviewHtml);
  elements.fullscreenPreviewBtn.addEventListener("click", openFullscreenPreview);
  elements.closeFullscreenBtn.addEventListener("click", () =>
    elements.fullscreenOverlay.classList.add("hidden")
  );
  elements.popoutPreviewBtn.addEventListener("click", popoutPreview);
  elements.openSkeletonModalBtn.addEventListener("click", openSkeletonModal);
  elements.openDataModalBtn.addEventListener("click", openDataModal);
  elements.closeSkeletonModalBtn.addEventListener("click", () =>
    closeModal(elements.skeletonModal)
  );
  elements.closeDataModalBtn.addEventListener("click", () =>
    closeModal(elements.dataModal)
  );
  elements.saveSkeletonDraftBtn.addEventListener("click", saveSkeletonDraft);
  elements.saveDataDraftBtn.addEventListener("click", saveDataDraft);
  elements.sendSkeletonBtn.addEventListener("click", sendSkeletonRequest);
  elements.saveDataTemplateBtn.addEventListener("click", saveDataTemplate);
  elements.closeJsonResultBtn.addEventListener("click", () =>
    closeModal(elements.jsonResultModal)
  );
  elements.refreshModelsBtn.addEventListener("click", fetchModels);
  [
    elements.llmModelSelect,
    elements.llmMaxTokensInput,
    elements.llmReasoningSelect,
    elements.llmTimeoutConnect,
    elements.llmTimeoutRead,
  ].forEach((input) => {
    input.addEventListener("change", () => {
      readLlmSettings();
      render();
    });
  });
  elements.exportStateBtn.addEventListener("click", handleExportState);
  elements.copyStateBtn.addEventListener("click", handleCopyState);
  elements.downloadStateBtn.addEventListener("click", handleDownloadState);
  elements.loadStateBtn.addEventListener("click", handleLoadState);
  elements.openImportModalBtn.addEventListener("click", openImportModal);
  elements.cancelImportBtn.addEventListener("click", () => closeModal(elements.importModal));
  elements.confirmImportBtn.addEventListener("click", confirmImport);
};

const initApp = () => {
  initState();
  render();
  initTabs();
  initEvents();
  if (!state.modelCache.models?.length) {
    fetchModels();
  }
};

initApp();
