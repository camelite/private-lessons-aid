const STORAGE_KEY = "esl-designer-state";

const DEFAULT_SKELETON_PROMPT = "";

const DEFAULT_DATA_PROMPT = "";

const createId = () =>
  `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const nowIso = () => new Date().toISOString();

const defaultState = () => ({
  queue: [],
  bins: {},
  binOrder: [],
  selectedBinKeys: [],
  sortBySize: false,
  skeletonTemplates: [],
  selectedSkeletonId: null,
  dataTemplates: [],
  dataResults: [],
  selectedDataResultId: null,
  previewCombo: {
    skeletonId: null,
    dataResultId: null,
  },
  llmSettings: {
    model: "gpt-5.2-2025-12-11",
    maxOutputTokens: 20000,
    reasoningEffort: "off",
    timeoutConnect: 10,
    timeoutRead: 180,
  },
  llmDrafts: {
    skeleton: {
      name: "Skeleton template",
      prompt: DEFAULT_SKELETON_PROMPT,
      includeExampleData: false,
      exampleDataResultId: null,
    },
    data: {
      name: "Vocab definitions",
      prompt: DEFAULT_DATA_PROMPT,
    },
  },
  modelCache: {
    models: [],
    fetchedAt: null,
  },
  checkpoints: [],
  activeCheckpointIndex: null,
  ui: {
    activeTab: "sorter",
    templateDetails: {
      type: null,
      id: null,
    },
  },
});

export const state = defaultState();

export const clone = (obj) => JSON.parse(JSON.stringify(obj));

export const setState = (next) => {
  const snapshot = clone(next);
  Object.keys(state).forEach((key) => delete state[key]);
  Object.assign(state, snapshot);
};

const normalizeSelection = (keys) => {
  const orderIndex = new Map(state.binOrder.map((key, idx) => [key, idx]));
  return [...new Set(keys)]
    .filter((key) => state.bins[key])
    .sort((a, b) => (orderIndex.get(a) ?? 0) - (orderIndex.get(b) ?? 0));
};

export const ensureBin = (binKey) => {
  if (!state.bins[binKey]) {
    state.bins[binKey] = [];
    state.binOrder.push(binKey);
  }
};

export const addToBin = (binKey, item) => {
  ensureBin(binKey);
  state.bins[binKey].push(item);
};

export const moveItem = (fromKey, toKey, itemId) => {
  if (!state.bins[fromKey]) return;
  const idx = state.bins[fromKey].findIndex((item) => item.id === itemId);
  if (idx === -1) return;
  const [item] = state.bins[fromKey].splice(idx, 1);
  addToBin(toKey, item);
};

export const renameItem = (binKey, itemId, text) => {
  const bin = state.bins[binKey] || [];
  const target = bin.find((item) => item.id === itemId);
  if (target) target.text = text;
};

export const addQueueItems = (lines) => {
  lines
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((text) => state.queue.push({ id: createId(), text }));
};

export const replaceQueueWithLines = (lines) => {
  state.queue = [];
  state.bins = {};
  state.binOrder = [];
  state.selectedBinKeys = [];
  addQueueItems(lines);
};

export const dequeueToBin = (binKey) => {
  if (!state.queue.length) return null;
  const item = state.queue.shift();
  addToBin(binKey, item);
  return item;
};

export const toggleSortBySize = () => {
  state.sortBySize = !state.sortBySize;
};

export const getBinOrder = () => {
  if (!state.sortBySize) return [...state.binOrder];
  const orderIndex = new Map(state.binOrder.map((key, idx) => [key, idx]));
  return [...state.binOrder].sort((a, b) => {
    const diff = (state.bins[b] || []).length - (state.bins[a] || []).length;
    if (diff !== 0) return diff;
    return orderIndex.get(a) - orderIndex.get(b);
  });
};

export const toggleBinSelection = (binKey) => {
  if (state.selectedBinKeys.includes(binKey)) {
    state.selectedBinKeys = state.selectedBinKeys.filter((key) => key !== binKey);
  } else {
    state.selectedBinKeys = normalizeSelection([...state.selectedBinKeys, binKey]);
  }
};

export const clearBinSelection = () => {
  state.selectedBinKeys = [];
};

export const setSelectedBinKeys = (keys) => {
  state.selectedBinKeys = normalizeSelection(keys);
};

export const getSelectedBinsData = () => {
  const binKeys = normalizeSelection(state.selectedBinKeys);
  const binsMap = {};
  const items = [];
  binKeys.forEach((key) => {
    const texts = (state.bins[key] || []).map((item) => item.text);
    binsMap[key] = texts;
    items.push(...texts);
  });
  return { binKeys, items, binsMap };
};

export const addSkeletonTemplate = ({
  name,
  prompt,
  compiledPrompt = "",
  sourceDataResultId = null,
  htmlSkeleton,
  instructions,
}) => {
  const template = {
    id: createId(),
    name,
    prompt,
    compiledPrompt,
    sourceDataResultId,
    htmlSkeleton,
    instructions,
    createdAt: nowIso(),
  };
  state.skeletonTemplates.unshift(template);
  state.selectedSkeletonId = template.id;
  return template;
};

export const selectSkeletonTemplate = (templateId) => {
  state.selectedSkeletonId = templateId;
};

export const getSelectedSkeletonTemplate = () =>
  state.skeletonTemplates.find((template) => template.id === state.selectedSkeletonId) || null;

export const addDataTemplate = ({ name, prompt }) => {
  const template = {
    id: createId(),
    name,
    prompt,
    createdAt: nowIso(),
  };
  state.dataTemplates.unshift(template);
  state.ui.templateDetails = { type: "data", id: template.id };
  return template;
};

export const getDataTemplateById = (templateId) =>
  state.dataTemplates.find((template) => template.id === templateId) || null;

export const addDataResult = ({ templateId, templateName, binKeys, items, binsMap }) => {
  const result = {
    id: createId(),
    templateId,
    templateName,
    binKeys,
    items,
    binsMap,
    requestPrompt: "",
    status: "pending",
    responseText: "",
    responseJson: null,
    error: null,
    createdAt: nowIso(),
  };
  state.dataResults.unshift(result);
  state.selectedDataResultId = result.id;
  return result;
};

export const updateDataResult = (resultId, updates) => {
  const result = state.dataResults.find((item) => item.id === resultId);
  if (result) Object.assign(result, updates);
};

export const selectDataResult = (resultId) => {
  state.selectedDataResultId = resultId;
};

export const getSelectedDataResult = () =>
  state.dataResults.find((result) => result.id === state.selectedDataResultId) || null;

export const getDataResultsForTemplate = (templateId) =>
  state.dataResults.filter((result) => result.templateId === templateId);

export const setPreviewCombo = ({ skeletonId, dataResultId }) => {
  state.previewCombo = {
    skeletonId,
    dataResultId,
  };
};

export const getPreviewCombo = () => state.previewCombo;

export const buildPreviewHtml = () => {
  const skeleton = state.skeletonTemplates.find(
    (template) => template.id === state.previewCombo.skeletonId
  );
  const dataResult = state.dataResults.find(
    (result) => result.id === state.previewCombo.dataResultId
  );
  if (!skeleton || !dataResult) return "";

  const payload = {
    binKeys: dataResult.binKeys,
    items: dataResult.items,
    binsMap: dataResult.binsMap,
    data: dataResult.responseJson,
    rawText: dataResult.responseText,
    dataTemplateName: dataResult.templateName,
    createdAt: nowIso(),
  };

  const dataScript = `\n<script>\nwindow.STUDENT_DATA = ${JSON.stringify(
    payload,
    null,
    2
  )};\n</script>\n`;

  if (skeleton.htmlSkeleton.includes("<!--DATA-->")) {
    return skeleton.htmlSkeleton.replace("<!--DATA-->", dataScript);
  }
  return skeleton.htmlSkeleton + dataScript;
};

export const createCheckpoint = (label = null) => {
  const snapshot = clone(state);
  snapshot.checkpoints = [];
  snapshot.activeCheckpointIndex = null;
  const checkpoint = {
    id: createId(),
    label: label || new Date().toLocaleString(),
    savedAt: nowIso(),
    snapshot,
  };
  state.checkpoints.push(checkpoint);
  state.activeCheckpointIndex = state.checkpoints.length - 1;
  return checkpoint;
};

export const loadCheckpoint = (index) => {
  if (index < 0 || index >= state.checkpoints.length) return null;
  const checkpoints = state.checkpoints;
  const snapshot = clone(checkpoints[index].snapshot);
  setState(snapshot);
  state.checkpoints = checkpoints;
  state.activeCheckpointIndex = index;
  return state.checkpoints[index];
};

export const serializeState = () => JSON.stringify(state, null, 2);

export const parseState = (raw) => JSON.parse(raw);

export const restoreState = (parsed) => {
  const fallback = defaultState();
  const next = { ...fallback, ...parsed };
  next.queue = parsed.queue || [];
  next.bins = parsed.bins || {};
  next.binOrder = parsed.binOrder || [];
  if (Array.isArray(parsed.selectedBinKeys)) {
    next.selectedBinKeys = parsed.selectedBinKeys;
  } else if (parsed.selectedBinKey) {
    next.selectedBinKeys = [parsed.selectedBinKey];
  } else {
    next.selectedBinKeys = [];
  }
  next.skeletonTemplates = parsed.skeletonTemplates || parsed.templates || [];
  next.selectedSkeletonId =
    parsed.selectedSkeletonId || parsed.selectedTemplateId || null;
  next.dataTemplates = parsed.dataTemplates || [];
  next.dataResults = parsed.dataResults || [];
  next.selectedDataResultId = parsed.selectedDataResultId || null;
  next.previewCombo = parsed.previewCombo || fallback.previewCombo;
  next.llmSettings = {
    ...fallback.llmSettings,
    ...(parsed.llmSettings || {}),
  };
  next.llmDrafts = {
    ...fallback.llmDrafts,
    ...(parsed.llmDrafts || {}),
  };
  next.modelCache = {
    ...fallback.modelCache,
    ...(parsed.modelCache || {}),
  };
  next.checkpoints = parsed.checkpoints || [];
  next.ui = { ...fallback.ui, ...(parsed.ui || {}) };
  next.activeCheckpointIndex =
    typeof parsed.activeCheckpointIndex === "number" ? parsed.activeCheckpointIndex : null;
  setState(next);
};

export const saveToLocal = () => {
  localStorage.setItem(STORAGE_KEY, serializeState());
};

export const loadFromLocal = () => {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return false;
  try {
    restoreState(parseState(raw));
    return true;
  } catch (error) {
    console.warn("Failed to load state from storage", error);
    return false;
  }
};

export const buildFilename = (skeletonName, dataLabel) => {
  const safe = (value) =>
    value
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-_]/g, "")
      .slice(0, 40);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const base = safe(skeletonName || "exercise") || "exercise";
  const dataPart = dataLabel ? `-${safe(dataLabel)}` : "";
  return `${base}${dataPart}-${stamp}.html`;
};

export const updateTab = (tab) => {
  state.ui.activeTab = tab;
};

export const sanitizeTemplateName = (prompt) => {
  if (!prompt) return "Untitled template";
  return prompt.trim().split("\n")[0].slice(0, 40);
};

export const mergeTemplateInstructions = (htmlText) => {
  const marker = "<!--INSTRUCTIONS-->";
  if (!htmlText.includes(marker)) {
    return {
      skeleton: htmlText,
      instructions: "",
    };
  }
  const [skeleton, instructions] = htmlText.split(marker);
  return {
    skeleton: skeleton.trim(),
    instructions: instructions.trim() || "",
  };
};

export const buildSkeletonPrompt = ({ basePrompt, exampleResult = null }) => {
  const trimmedBase = (basePrompt || "").trim();
  const sections = [
    [
      "## SYSTEM / CONTRACT",
      [
        "Return only one complete, self-contained HTML document.",
        "Use only vanilla HTML/CSS/JS (no external dependencies).",
        "Include exactly one <!--DATA--> placeholder for injected window.STUDENT_DATA.",
        "After the HTML, include a <!--INSTRUCTIONS--> section describing how data is consumed.",
      ].join("\n"),
    ],
    ["## TASK", trimmedBase || "(No task prompt provided.)"],
  ];

  if (exampleResult) {
    const dataPayload = exampleResult.responseJson || {
      rawText: exampleResult.responseText || "",
    };
    sections.push([
      "## DATA EXAMPLE",
      [
        `Template: ${exampleResult.templateName}`,
        `Bins: ${(exampleResult.binKeys || []).join(", ") || "(none)"}`,
        "Example JSON:",
        JSON.stringify(dataPayload, null, 2),
      ].join("\n"),
    ]);
  }

  sections.push([
    "## OUTPUT RULES",
    [
      "Output HTML first, then <!--INSTRUCTIONS--> text.",
      "Do not wrap output in markdown code fences.",
      "Ensure the final HTML can run directly in an iframe.",
    ].join("\n"),
  ]);

  return sections.map(([title, body]) => `${title}\n${body}`).join("\n\n");
};

export const updateTemplateName = (templateId, name) => {
  const template = state.skeletonTemplates.find((item) => item.id === templateId);
  if (template) template.name = name;
};

export const updateDataTemplateName = (templateId, name) => {
  const template = state.dataTemplates.find((item) => item.id === templateId);
  if (template) template.name = name;
};

export const updateCheckpointLabel = (checkpointId, label) => {
  const checkpoint = state.checkpoints.find((item) => item.id === checkpointId);
  if (checkpoint && label) checkpoint.label = label;
};

export const updateModelCache = (models) => {
  state.modelCache = { models, fetchedAt: nowIso() };
};

export const setLlmDraft = (type, updates) => {
  state.llmDrafts[type] = {
    ...(state.llmDrafts[type] || {}),
    ...updates,
  };
};

export const initState = () => {
  if (!loadFromLocal()) {
    setState(defaultState());
  }
};
