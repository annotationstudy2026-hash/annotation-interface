const state = {
  annotatorId: "",
  manifest: null,
  pages: [],
  pageIndex: 0,
  responses: new Map(),
  comments: new Map(),
  active: null,
};

const answerLabels = {
  no: "아니오",
  ambiguous: "애매함",
  yes: "예",
};

const questionTypes = {
  question_1_answer: "target",
  question_2_answer: "non_matching",
};

const els = {
  annotatorSelect: document.querySelector("#annotatorSelect"),
  statusText: document.querySelector("#statusText"),
  prevPage: document.querySelector("#prevPage"),
  nextPage: document.querySelector("#nextPage"),
  downloadCsv: document.querySelector("#downloadCsv"),
  pageLabel: document.querySelector("#pageLabel"),
  themeLabel: document.querySelector("#themeLabel"),
  progressLabel: document.querySelector("#progressLabel"),
  taskGrid: document.querySelector("#taskGrid"),
};

function storagePrefix() {
  return `annotation:${window.APP_CONFIG.studyId}:${state.annotatorId}`;
}

function responseKey(itemId, answerField) {
  return `${itemId}:${answerField}`;
}

function storageKey(itemId, answerField) {
  return `${storagePrefix()}:${itemId}:${answerField}`;
}

function commentStorageKey(itemId) {
  return `${storagePrefix()}:${itemId}:comment`;
}

function getAnswer(itemId, answerField) {
  return state.responses.get(responseKey(itemId, answerField)) || "";
}

function setAnswer(itemId, answerField, value) {
  state.responses.set(responseKey(itemId, answerField), value);
}

async function fetchJson(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${url}`);
  }
  return await res.json();
}

async function init() {
  state.manifest = await fetchJson("./data/manifest.json");
  els.annotatorSelect.innerHTML = "";
  for (const annotator of state.manifest.annotators) {
    const option = document.createElement("option");
    option.value = annotator;
    option.textContent = annotator;
    els.annotatorSelect.append(option);
  }

  const params = new URLSearchParams(window.location.search);
  const requested = params.get("annotator");
  if (requested && state.manifest.annotators.includes(requested)) {
    els.annotatorSelect.value = requested;
  }
  await loadAnnotator(els.annotatorSelect.value);
}

async function loadAnnotator(annotatorId) {
  state.annotatorId = annotatorId;
  state.pageIndex = 0;
  state.responses.clear();
  state.comments.clear();
  state.active = null;

  const data = await fetchJson(`./data/${annotatorId}.json`);
  state.pages = data.pages;
  loadLocalResponses();
  render();
}

function loadLocalResponses() {
  const prefix = `${storagePrefix()}:`;
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith(prefix)) continue;
    const raw = localStorage.getItem(key);
    if (!raw) continue;
    try {
      const payload = JSON.parse(raw);
      if (payload.question_type === "comment") {
        state.comments.set(payload.item_id, payload.answer || "");
      } else if (payload.item_id && payload.answer_field && payload.answer) {
        setAnswer(payload.item_id, payload.answer_field, payload.answer);
      }
    } catch {
      // Ignore malformed old localStorage entries.
    }
  }
}

function currentPage() {
  return state.pages[state.pageIndex] || { tasks: [], theme: "" };
}

function render() {
  const page = currentPage();
  const pageCount = state.pages.length;
  const remote = window.APP_CONFIG.webAppUrl
    ? "선택 즉시 localStorage 저장, 페이지 이동 때 Google Sheet 저장"
    : "localStorage만 저장";
  els.statusText.textContent = `${state.annotatorId}: ${remote}`;
  els.pageLabel.textContent = `Page ${state.pageIndex + 1} / ${pageCount}`;
  els.themeLabel.textContent = page.theme ? `Theme: ${page.theme}` : "";
  els.prevPage.disabled = state.pageIndex <= 0;
  els.nextPage.disabled = state.pageIndex >= pageCount - 1;
  renderProgress();

  els.taskGrid.innerHTML = "";
  for (const task of page.tasks) {
    els.taskGrid.append(renderTaskCard(task));
  }
  if (!state.active) {
    focusFirstUnanswered();
  } else {
    markActive();
  }
}

function renderProgress() {
  let total = 0;
  let done = 0;
  for (const page of state.pages) {
    for (const task of page.tasks) {
      total += 2;
      if (getAnswer(task.item_id, "question_1_answer")) done += 1;
      if (getAnswer(task.item_id, "question_2_answer")) done += 1;
    }
  }
  els.progressLabel.textContent = `${done} / ${total} answered`;
}

function renderTaskCard(task) {
  const card = document.createElement("article");
  card.className = "task-card";

  const imageWrap = document.createElement("div");
  imageWrap.className = "image-wrap";
  const image = document.createElement("img");
  image.src = task.image_url;
  image.alt = task.item_id;
  image.loading = "lazy";
  imageWrap.append(image);
  card.append(imageWrap);

  const body = document.createElement("div");
  body.className = "card-body";
  const meta = document.createElement("div");
  meta.className = "meta";
  meta.innerHTML = `<span>${task.item_id}</span><span>${task.task_order}</span>`;
  body.append(meta);

  body.append(
    renderQuestionBlock(task, "question_1_answer", task.question_1_target),
    renderQuestionBlock(task, "question_2_answer", task.question_2_non_matching),
    renderComment(task),
  );
  card.append(body);
  return card;
}

function renderQuestionBlock(task, answerField, questionText) {
  const block = document.createElement("div");
  block.className = "question-block";
  block.dataset.itemId = task.item_id;
  block.dataset.answerField = answerField;
  block.addEventListener("click", () => {
    state.active = { itemId: task.item_id, answerField };
    markActive();
  });

  const q = document.createElement("div");
  q.className = "question";
  q.textContent = questionText;
  block.append(q);

  const row = document.createElement("div");
  row.className = "answer-row";
  for (const value of ["no", "ambiguous", "yes"]) {
    const button = document.createElement("button");
    button.className = "answer";
    button.type = "button";
    button.dataset.value = value;
    button.textContent = answerLabels[value];
    if (getAnswer(task.item_id, answerField) === value) {
      button.classList.add("selected");
    }
    button.addEventListener("click", async (event) => {
      event.stopPropagation();
      state.active = { itemId: task.item_id, answerField };
      await saveAnswer(task, answerField, value);
      advanceActive();
    });
    row.append(button);
  }
  block.append(row);
  return block;
}

function renderComment(task) {
  const textarea = document.createElement("textarea");
  textarea.placeholder = "comment";
  textarea.value = state.comments.get(task.item_id) || "";
  textarea.addEventListener("change", () => {
    state.comments.set(task.item_id, textarea.value);
    saveLocalPayload({
      item_id: task.item_id,
      question_type: "comment",
      answer: textarea.value,
      answer_field: "comment",
      page_index: state.pageIndex + 1,
      task_order: task.task_order,
    });
  });
  return textarea;
}

async function saveAnswer(task, answerField, value) {
  setAnswer(task.item_id, answerField, value);
  saveLocalPayload({
    item_id: task.item_id,
    question_type: questionTypes[answerField],
    answer_field: answerField,
    answer: value,
    page_index: state.pageIndex + 1,
    task_order: task.task_order,
  });
  render();
}

function buildPayload(payload) {
  return {
    study_id: window.APP_CONFIG.studyId,
    annotator_id: state.annotatorId,
    client_timestamp: new Date().toISOString(),
    page_url: window.location.href,
    user_agent: navigator.userAgent,
    ...payload,
  };
}

function saveLocalPayload(payload) {
  const fullPayload = buildPayload(payload);

  const key =
    fullPayload.question_type === "comment"
      ? commentStorageKey(fullPayload.item_id)
      : storageKey(fullPayload.item_id, fullPayload.answer_field);
  localStorage.setItem(key, JSON.stringify(fullPayload));
}

function buildPageRecords(page) {
  const records = [];
  for (const task of page.tasks) {
    for (const answerField of ["question_1_answer", "question_2_answer"]) {
      records.push(
        buildPayload({
          item_id: task.item_id,
          question_type: questionTypes[answerField],
          answer_field: answerField,
          answer: getAnswer(task.item_id, answerField),
          page_index: state.pageIndex + 1,
          task_order: task.task_order,
        }),
      );
    }
    const comment = state.comments.get(task.item_id);
    if (comment) {
      records.push(
        buildPayload({
          item_id: task.item_id,
          question_type: "comment",
          answer_field: "comment",
          answer: comment,
          page_index: state.pageIndex + 1,
          task_order: task.task_order,
        }),
      );
    }
  }
  return records;
}

async function postRecords(records) {
  if (!window.APP_CONFIG.webAppUrl) return;
  const batchId = `${window.APP_CONFIG.studyId}:${state.annotatorId}:page_${state.pageIndex + 1}:${Date.now()}`;
  try {
    await fetch(window.APP_CONFIG.webAppUrl, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        batch_id: batchId,
        records: records.map((record) => ({
          ...record,
          batch_id: batchId,
          record_key: `${record.study_id}:${record.annotator_id}:${record.item_id}:${record.question_type}`,
        })),
      }),
    });
  } catch (error) {
    console.warn("Google Sheet sync failed; localStorage backup remains.", error);
  }
}

function firstUnansweredOnPage(page) {
  for (const task of page.tasks) {
    for (const answerField of ["question_1_answer", "question_2_answer"]) {
      if (!getAnswer(task.item_id, answerField)) {
        return { itemId: task.item_id, answerField };
      }
    }
  }
  return null;
}

async function syncCurrentPageBeforeNavigation(targetPageIndex) {
  const page = currentPage();
  const missing = firstUnansweredOnPage(page);
  if (missing) {
    state.active = missing;
    markActive();
    const block = document.querySelector(
      `.question-block[data-item-id="${missing.itemId}"][data-answer-field="${missing.answerField}"]`,
    );
    block?.scrollIntoView({ behavior: "smooth", block: "center" });
    els.statusText.textContent = `${state.annotatorId}: 이 페이지에 답변하지 않은 문항이 있습니다.`;
    return;
  }

  els.prevPage.disabled = true;
  els.nextPage.disabled = true;
  els.statusText.textContent = `${state.annotatorId}: 현재 페이지 답변 10개를 저장하는 중입니다.`;
  await postRecords(buildPageRecords(page));
  state.pageIndex = targetPageIndex;
  state.active = null;
  render();
}

function questionBlocks() {
  return [...document.querySelectorAll(".question-block")];
}

function markActive() {
  for (const block of questionBlocks()) {
    const isActive =
      state.active &&
      block.dataset.itemId === state.active.itemId &&
      block.dataset.answerField === state.active.answerField;
    block.classList.toggle("active", Boolean(isActive));
  }
}

function focusFirstUnanswered() {
  for (const block of questionBlocks()) {
    if (!getAnswer(block.dataset.itemId, block.dataset.answerField)) {
      state.active = {
        itemId: block.dataset.itemId,
        answerField: block.dataset.answerField,
      };
      markActive();
      return;
    }
  }
  const first = questionBlocks()[0];
  if (first) {
    state.active = {
      itemId: first.dataset.itemId,
      answerField: first.dataset.answerField,
    };
    markActive();
  }
}

function advanceActive() {
  const blocks = questionBlocks();
  if (!blocks.length || !state.active) return;
  const idx = blocks.findIndex(
    (block) =>
      block.dataset.itemId === state.active.itemId &&
      block.dataset.answerField === state.active.answerField,
  );
  const next = blocks
    .slice(idx + 1)
    .find((block) => !getAnswer(block.dataset.itemId, block.dataset.answerField));
  if (next) {
    state.active = {
      itemId: next.dataset.itemId,
      answerField: next.dataset.answerField,
    };
    markActive();
  }
}

function downloadLocalCSV() {
  const rows = [
    [
      "study_id",
      "annotator_id",
      "item_id",
      "question_type",
      "answer",
      "page_index",
      "task_order",
      "client_timestamp",
      "page_url",
    ],
  ];
  const prefix = `${storagePrefix()}:`;
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith(prefix)) continue;
    try {
      const payload = JSON.parse(localStorage.getItem(key));
      rows.push([
        payload.study_id || "",
        payload.annotator_id || "",
        payload.item_id || "",
        payload.question_type || "",
        payload.answer || "",
        payload.page_index || "",
        payload.task_order || "",
        payload.client_timestamp || "",
        payload.page_url || "",
      ]);
    } catch {
      // Ignore malformed entries.
    }
  }

  const csv = rows
    .map((row) => row.map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${state.annotatorId}_responses_backup.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

els.annotatorSelect.addEventListener("change", async () => {
  const annotator = els.annotatorSelect.value;
  const url = new URL(window.location.href);
  url.searchParams.set("annotator", annotator);
  window.history.replaceState({}, "", url);
  await loadAnnotator(annotator);
});

els.prevPage.addEventListener("click", async () => {
  const targetPageIndex = Math.max(0, state.pageIndex - 1);
  if (targetPageIndex === state.pageIndex) return;
  await syncCurrentPageBeforeNavigation(targetPageIndex);
});

els.nextPage.addEventListener("click", async () => {
  const targetPageIndex = Math.min(state.pages.length - 1, state.pageIndex + 1);
  if (targetPageIndex === state.pageIndex) return;
  await syncCurrentPageBeforeNavigation(targetPageIndex);
});

els.downloadCsv.addEventListener("click", downloadLocalCSV);

document.addEventListener("keydown", async (event) => {
  const mapping = {
    ArrowLeft: "no",
    ArrowDown: "ambiguous",
    ArrowRight: "yes",
  };
  const value = mapping[event.key];
  if (!value || !state.active) return;
  event.preventDefault();
  const task = currentPage().tasks.find((row) => row.item_id === state.active.itemId);
  if (!task) return;
  await saveAnswer(task, state.active.answerField, value);
  advanceActive();
});

init().catch((error) => {
  els.statusText.textContent = `Error: ${error.message}`;
  console.error(error);
});
