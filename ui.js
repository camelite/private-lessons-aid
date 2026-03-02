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
  buildSkeletonPrompt,
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
  skeletonIncludeExampleCheckbox: $("skeletonIncludeExampleCheckbox"),
  skeletonExampleResultSelect: $("skeletonExampleResultSelect"),
  skeletonCompiledPrompt: $("skeletonCompiledPrompt"),
  skeletonSystemPromptInput: $("skeletonSystemPromptInput"),
  skeletonModelSelect: $("skeletonModelSelect"),
  refreshModelsSkeletonBtn: $("refreshModelsSkeletonBtn"),
  skeletonModelCacheNote: $("skeletonModelCacheNote"),
  skeletonMaxTokensInput: $("skeletonMaxTokensInput"),
  skeletonReasoningSelect: $("skeletonReasoningSelect"),
  skeletonTimeoutConnect: $("skeletonTimeoutConnect"),
  skeletonTimeoutRead: $("skeletonTimeoutRead"),
  closeSkeletonModalBtn: $("closeSkeletonModalBtn"),
  saveSkeletonDraftBtn: $("saveSkeletonDraftBtn"),
  sendSkeletonBtn: $("sendSkeletonBtn"),
  skeletonStatus: $("skeletonStatus"),
  dataModal: $("dataModal"),
  dataNameInput: $("dataNameInput"),
  dataPromptInput: $("dataPromptInput"),
  dataSystemPromptInput: $("dataSystemPromptInput"),
  dataSelectedBinsPreview: $("dataSelectedBinsPreview"),
  dataCompiledPrompt: $("dataCompiledPrompt"),
  runDataTemplateBtn: $("runDataTemplateBtn"),
  closeDataModalBtn: $("closeDataModalBtn"),
  saveDataDraftBtn: $("saveDataDraftBtn"),
  saveDataTemplateBtn: $("saveDataTemplateBtn"),
  dataStatus: $("dataStatus"),
  dataModelSelect: $("dataModelSelect"),
  refreshModelsDataBtn: $("refreshModelsDataBtn"),
  dataModelCacheNote: $("dataModelCacheNote"),
  dataMaxTokensInput: $("dataMaxTokensInput"),
  dataReasoningSelect: $("dataReasoningSelect"),
  dataTimeoutConnect: $("dataTimeoutConnect"),
  dataTimeoutRead: $("dataTimeoutRead"),
  jsonResultModal: $("jsonResultModal"),
  jsonResultTextarea: $("jsonResultTextarea"),
  closeJsonResultBtn: $("closeJsonResultBtn"),
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

const parseJsonResponse = async (response, fallbackMessage) => {
  const raw = await response.text();
  let data = null;
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch (error) {
    const snippet = raw.slice(0, 300).replace(/\s+/g, " ").trim();
    throw new Error(
      `${fallbackMessage}. Server returned non-JSON (status ${response.status})${
        snippet ? `: ${snippet}` : ""
      }`
    );
  }
  if (!response.ok) {
    throw new Error(data.error || fallbackMessage);
  }
  return data;
};

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const getSuccessfulDataResults = () =>
  state.dataResults.filter((result) => result.status === "success");

const renderSkeletonExampleOptions = () => {
  const successResults = getSuccessfulDataResults();
  const options = ['<option value="">(None)</option>'];
  successResults.forEach((result) => {
    options.push(
      `<option value="${result.id}">${result.templateName} • ${new Date(
        result.createdAt
      ).toLocaleString()}</option>`
    );
  });
  elements.skeletonExampleResultSelect.innerHTML = options.join("");

  const draftId = state.llmDrafts.skeleton?.exampleDataResultId || "";
  const exists = successResults.some((result) => result.id === draftId);
  elements.skeletonExampleResultSelect.value = exists ? draftId : "";
  if (!exists && draftId) {
    setLlmDraft("skeleton", { exampleDataResultId: null });
  }
};

const updateSkeletonCompiledPromptView = () => {
  const basePrompt = elements.skeletonPromptInput.value || "";
  const systemPrompt = elements.skeletonSystemPromptInput.value || "";
  const includeExample = Boolean(elements.skeletonIncludeExampleCheckbox.checked);
  const selectedId = elements.skeletonExampleResultSelect.value || null;
  const exampleResult = includeExample
    ? state.dataResults.find((result) => result.id === selectedId && result.status === "success")
    : null;
  const compiledPrompt = buildSkeletonPrompt({ basePrompt, systemPrompt, exampleResult });
  elements.skeletonCompiledPrompt.value = compiledPrompt;
  return { compiledPrompt, selectedId, includeExample };
};

const buildDataCompiledPrompt = ({ personalPrompt, systemPrompt, items, binsMap }) => {
  const sections = [
    ["## SYSTEM / CONTRACT", (systemPrompt || "").trim() || "(No system instructions provided.)"],
    ["## TASK", (personalPrompt || "").trim() || "(No personal instructions provided.)"],
    ["## SELECTED ITEMS", JSON.stringify(items || [], null, 2)],
    ["## SELECTED BINS MAP", JSON.stringify(binsMap || {}, null, 2)],
  ];
  return sections.map(([title, body]) => `${title}\n${body}`).join("\n\n");
};

const updateDataCompiledPromptView = () => {
  const { binKeys, items, binsMap } = getSelectedBinsData();
  const personalPrompt = elements.dataPromptInput.value || "";
  const systemPrompt = elements.dataSystemPromptInput.value || "";
  elements.dataSelectedBinsPreview.value = JSON.stringify({ binKeys, items, binsMap }, null, 2);
  const compiledPrompt = buildDataCompiledPrompt({ personalPrompt, systemPrompt, items, binsMap });
  elements.dataCompiledPrompt.value = compiledPrompt;
  return { compiledPrompt, binKeys, items, binsMap };
};

const getComposerSettings = (type) => {
  const map = type === "data"
    ? {
        model: elements.dataModelSelect,
        max: elements.dataMaxTokensInput,
        reason: elements.dataReasoningSelect,
        connect: elements.dataTimeoutConnect,
        read: elements.dataTimeoutRead,
      }
    : {
        model: elements.skeletonModelSelect,
        max: elements.skeletonMaxTokensInput,
        reason: elements.skeletonReasoningSelect,
        connect: elements.skeletonTimeoutConnect,
        read: elements.skeletonTimeoutRead,
      };
  const maxTokens = Number(map.max.value) || 20000;
  const timeoutConnect = Number(map.connect.value) || 10;
  const timeoutRead = Number(map.read.value) || 180;
  return {
    model: map.model.value || "gpt-5.2-2025-12-11",
    maxOutputTokens: Math.max(1, Math.floor(maxTokens)),
    reasoningEffort: map.reason.value || "off",
    timeoutConnect: Math.max(1, Math.floor(timeoutConnect)),
    timeoutRead: Math.max(1, Math.floor(timeoutRead)),
  };
};

const applyComposerSettings = (type, settings) => {
  const map = type === "data"
    ? {
        model: elements.dataModelSelect,
        max: elements.dataMaxTokensInput,
        reason: elements.dataReasoningSelect,
        connect: elements.dataTimeoutConnect,
        read: elements.dataTimeoutRead,
        note: elements.dataModelCacheNote,
      }
    : {
        model: elements.skeletonModelSelect,
        max: elements.skeletonMaxTokensInput,
        reason: elements.skeletonReasoningSelect,
        connect: elements.skeletonTimeoutConnect,
        read: elements.skeletonTimeoutRead,
        note: elements.skeletonModelCacheNote,
      };

  const models = state.modelCache.models || [];
  map.model.innerHTML = "";
  if (!models.length) {
    map.model.innerHTML = `<option value="${settings.model}">${settings.model}</option>`;
  } else {
    models.forEach((m) => {
      const opt = document.createElement("option");
      opt.value = m;
      opt.textContent = m;
      map.model.appendChild(opt);
    });
  }
  map.model.value = settings.model;
  map.max.value = settings.maxOutputTokens;
  map.reason.value = settings.reasoningEffort || "off";
  map.connect.value = settings.timeoutConnect;
  map.read.value = settings.timeoutRead;
  map.note.textContent = state.modelCache.fetchedAt
    ? `Fetched: ${new Date(state.modelCache.fetchedAt).toLocaleString()}`
    : "Model list not fetched yet.";
};

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
      card.innerHTML = `<strong>${escapeHtml(template.name)}</strong><div class="meta">${new Date(
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
      card.innerHTML = `<strong>${escapeHtml(template.name)}</strong><div class="meta">${new Date(
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

const buildDataResultDebugText = (result) => {
  const sections = [
    `Status: ${result.status}`,
    result.error ? `Error: ${result.error}` : null,
    "",
    "--- Request Prompt ---",
    result.requestPrompt || "(not stored)",
    "",
    "--- Request Model ---",
    result.requestModel || "(unknown)",
    "",
    "--- Request Settings ---",
    JSON.stringify(result.requestSettings || {}, null, 2),
    "",
    "--- Response Text ---",
    result.responseText || "(empty)",
    "",
    "--- Parsed JSON ---",
    result.responseJson ? JSON.stringify(result.responseJson, null, 2) : "(none)",
  ].filter((part) => part !== null);
  return sections.join("\n");
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
    card.innerHTML = `<strong>${status} ${escapeHtml(result.templateName)}</strong>
      <div class="meta">${result.binKeys.join(", ") || "(no bins)"} • ${new Date(
        result.createdAt
      ).toLocaleString()}</div>`;
    card.addEventListener("click", () => {
      selectDataResult(result.id);
      saveToLocal();
      render();
      elements.jsonResultTextarea.value = buildDataResultDebugText(result);
      openModal(elements.jsonResultModal);
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
          <input type="text" id="detailSkeletonName" value="${escapeHtml(template.name)}" />
        </div>
        <div class="small">Created: ${new Date(template.createdAt).toLocaleString()}</div>
        <h4>Personal Prompt</h4>
        <textarea class="readonly" readonly>${escapeHtml(template.prompt)}</textarea>
        <h4>System Prompt</h4>
        <textarea class="readonly" readonly>${escapeHtml(template.systemPrompt || "")}</textarea>
        <h4>Compiled Prompt</h4>
        <textarea class="readonly" readonly>${escapeHtml(template.compiledPrompt || "(not stored)")}</textarea>
        <h4>Source JSON Result ID</h4>
        <textarea class="readonly" readonly>${escapeHtml(template.sourceDataResultId || "(none)")}</textarea>
        <h4>Request model</h4>
        <textarea class="readonly" readonly>${escapeHtml(template.requestModel || "(unknown)")}</textarea>
        <h4>Request settings</h4>
        <textarea class="readonly" readonly>${escapeHtml(JSON.stringify(template.requestSettings || {}, null, 2))}</textarea>
        <h4>Instructions</h4>
        <textarea class="readonly" readonly>${escapeHtml(template.instructions)}</textarea>
        <h4>Skeleton HTML</h4>
        <textarea class="readonly" readonly>${escapeHtml(template.htmlSkeleton)}</textarea>
      `;
    }
  }
  if (type === "data") {
    const template = state.dataTemplates.find((item) => item.id === id);
    if (template) {
      content = `
        <div class="field">
          <label class="small">Name</label>
          <input type="text" id="detailDataName" value="${escapeHtml(template.name)}" />
        </div>
        <div class="small">Created: ${new Date(template.createdAt).toLocaleString()}</div>
        <h4>Personal Prompt</h4>
        <textarea class="readonly" readonly>${escapeHtml(template.prompt)}</textarea>
        <h4>System Prompt</h4>
        <textarea class="readonly" readonly>${escapeHtml(template.systemPrompt || "")}</textarea>
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
  const systemPrompt = template.systemPrompt || state.llmDrafts.data?.systemPrompt || "";
  const prompt = buildDataCompiledPrompt({
    personalPrompt: template.prompt || "",
    systemPrompt,
    items,
    binsMap,
  });
  const requestSettings = getComposerSettings("data");
  const result = addDataResult({
    templateId: template.id,
    templateName: template.name,
    binKeys,
    items,
    binsMap,
    requestModel: requestSettings.model,
    requestSettings,
  });
  updateDataResult(result.id, { requestPrompt: prompt });
  saveToLocal();
  render();
  try {
    const response = await fetch("/api/llm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        settings: requestSettings,
      }),
    });
    const data = await parseJsonResponse(response, "Request failed");
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
      error: parsed
        ? null
        : `Invalid JSON returned. Response starts with: ${(data.text || "").slice(0, 280)}`,
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
  const systemPrompt = elements.skeletonSystemPromptInput.value.trim();
  if (!prompt && !systemPrompt) {
    elements.skeletonStatus.textContent = "Add personal or system instructions first.";
    return;
  }

  const { compiledPrompt, selectedId, includeExample } = updateSkeletonCompiledPromptView();
  const requestSettings = getComposerSettings("skeleton");
  elements.skeletonStatus.textContent = "Sending request...";
  try {
    const response = await fetch("/api/llm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: compiledPrompt,
        settings: requestSettings,
      }),
    });
    const data = await parseJsonResponse(response, "Request failed");
    const merged = mergeTemplateInstructions(data.text || "");
    addSkeletonTemplate({
      name: name || sanitizeTemplateName(prompt),
      prompt,
      compiledPrompt,
      sourceDataResultId: includeExample ? selectedId : null,
      systemPrompt: systemPrompt || "",
      requestModel: requestSettings.model,
      requestSettings,
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
    systemPrompt: elements.skeletonSystemPromptInput.value,
    includeExampleData: Boolean(elements.skeletonIncludeExampleCheckbox.checked),
    exampleDataResultId: elements.skeletonExampleResultSelect.value || null,
  });
  saveToLocal();
  elements.skeletonStatus.textContent = "Draft saved.";
};

const saveDataDraft = () => {
  setLlmDraft("data", {
    name: elements.dataNameInput.value,
    prompt: elements.dataPromptInput.value,
    systemPrompt: elements.dataSystemPromptInput.value,
  });
  saveToLocal();
  elements.dataStatus.textContent = "Draft saved.";
};

const saveDataTemplate = () => {
  const name = elements.dataNameInput.value.trim();
  const prompt = elements.dataPromptInput.value.trim();
  const systemPrompt = elements.dataSystemPromptInput.value.trim();
  if (!prompt && !systemPrompt) return;
  addDataTemplate({
    name: name || sanitizeTemplateName(prompt),
    prompt,
    systemPrompt: systemPrompt || "",
  });
  saveToLocal();
  render();
  elements.dataStatus.textContent = "JSON template saved.";
};

const openSkeletonModal = () => {
  elements.skeletonNameInput.value = state.llmDrafts.skeleton?.name || "";
  elements.skeletonPromptInput.value = state.llmDrafts.skeleton?.prompt || "";
  elements.skeletonSystemPromptInput.value = state.llmDrafts.skeleton?.systemPrompt || "";
  renderSkeletonExampleOptions();
  elements.skeletonIncludeExampleCheckbox.checked =
    Boolean(state.llmDrafts.skeleton?.includeExampleData) &&
    Boolean(elements.skeletonExampleResultSelect.value);
  elements.skeletonExampleResultSelect.disabled = !elements.skeletonIncludeExampleCheckbox.checked;
  elements.skeletonStatus.textContent = "";
  applyComposerSettings("skeleton", state.llmSettings);
  updateSkeletonCompiledPromptView();
  openModal(elements.skeletonModal);
};

const openDataModal = () => {
  elements.dataNameInput.value = state.llmDrafts.data?.name || "";
  elements.dataPromptInput.value = state.llmDrafts.data?.prompt || "";
  elements.dataSystemPromptInput.value = state.llmDrafts.data?.systemPrompt || "";
  elements.dataStatus.textContent = "";
  applyComposerSettings("data", state.llmSettings);
  updateDataCompiledPromptView();
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
    const data = await parseJsonResponse(response, "Failed to fetch models");
    updateModelCache(data.models || []);
    applyComposerSettings("skeleton", state.llmSettings);
    applyComposerSettings("data", state.llmSettings);
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
  elements.skeletonPromptInput.addEventListener("input", updateSkeletonCompiledPromptView);
  elements.skeletonSystemPromptInput.addEventListener("input", updateSkeletonCompiledPromptView);
  elements.skeletonIncludeExampleCheckbox.addEventListener("change", () => {
    elements.skeletonExampleResultSelect.disabled = !elements.skeletonIncludeExampleCheckbox.checked;
    updateSkeletonCompiledPromptView();
  });
  elements.skeletonExampleResultSelect.addEventListener("change", updateSkeletonCompiledPromptView);
  elements.saveDataDraftBtn.addEventListener("click", saveDataDraft);
  elements.dataPromptInput.addEventListener("input", updateDataCompiledPromptView);
  elements.dataSystemPromptInput.addEventListener("input", updateDataCompiledPromptView);
  elements.runDataTemplateBtn.addEventListener("click", () => {
    const name = elements.dataNameInput.value.trim();
    const prompt = elements.dataPromptInput.value.trim();
    if (!prompt && !elements.dataSystemPromptInput.value.trim()) {
      elements.dataStatus.textContent = "Add personal or system instructions first.";
      return;
    }
    const temp = { id: "draft", name: name || "Draft JSON run", prompt, systemPrompt: elements.dataSystemPromptInput.value || "" };
    runDataTemplate(temp);
  });
  elements.sendSkeletonBtn.addEventListener("click", sendSkeletonRequest);
  elements.saveDataTemplateBtn.addEventListener("click", saveDataTemplate);
  elements.closeJsonResultBtn.addEventListener("click", () =>
    closeModal(elements.jsonResultModal)
  );
  elements.refreshModelsSkeletonBtn.addEventListener("click", fetchModels);
  elements.refreshModelsDataBtn.addEventListener("click", fetchModels);
  const syncComposerSettings = (sourceType) => {
    const settings = getComposerSettings(sourceType);
    state.llmSettings = settings;
    applyComposerSettings("skeleton", settings);
    applyComposerSettings("data", settings);
    saveToLocal();
    updateSkeletonCompiledPromptView();
    updateDataCompiledPromptView();
  };

  [
    ["skeleton", elements.skeletonModelSelect],
    ["skeleton", elements.skeletonMaxTokensInput],
    ["skeleton", elements.skeletonReasoningSelect],
    ["skeleton", elements.skeletonTimeoutConnect],
    ["skeleton", elements.skeletonTimeoutRead],
    ["data", elements.dataModelSelect],
    ["data", elements.dataMaxTokensInput],
    ["data", elements.dataReasoningSelect],
    ["data", elements.dataTimeoutConnect],
    ["data", elements.dataTimeoutRead],
  ].forEach(([type, input]) => {
    input.addEventListener("change", () => syncComposerSettings(type));
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
