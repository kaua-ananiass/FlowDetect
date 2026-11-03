// Execution pages are persisted independently from automation run snapshots.
// Colors use the same page palette as FlowDetect Studio: cyan, violet, green and amber.
export const PAGES_KEY = "flowdetectChromeExecutionPages";
export const PAGE_RUN_PREFIX = "flowdetectChromePageRun:";
export const PAGE_COLORS = Object.freeze(["#12b5cb", "#8b5cf6", "#4ade80", "#f59e0b"]);
const MAX_PAGES = 12;
let pageQueue = Promise.resolve();

const resolveColor = (page, index) => PAGE_COLORS.includes(page.color)
  ? page.color : PAGE_COLORS[(Number(page.slot || index + 1) - 1) % PAGE_COLORS.length];

const normalizePages = (pages) => pages.map((page, index) => ({
  ...page, color: resolveColor(page, index),
  slot: Number.isInteger(page.slot) && page.slot > 0 ? page.slot : index + 1
}));

export function editPages(edit) {
  const task = pageQueue.then(async () => {
    const stored = await chrome.storage.local.get(PAGES_KEY);
    const pages = normalizePages(Array.isArray(stored[PAGES_KEY]) ? stored[PAGES_KEY] : []);
    const result = await edit(pages);
    await chrome.storage.local.set({ [PAGES_KEY]: pages });
    return result;
  });
  pageQueue = task.catch(() => {});
  return task;
}

export async function getPages() {
  await pageQueue;
  const stored = await chrome.storage.local.get(PAGES_KEY);
  return normalizePages(Array.isArray(stored[PAGES_KEY]) ? stored[PAGES_KEY] : []);
}

export async function createPage(tabId = null) {
  const tab = Number.isInteger(tabId) ? await chrome.tabs.get(tabId) : null;
  if (tab && !/^https?:\/\//i.test(tab.url || "")) {
    throw new Error("Abra uma aba HTTP/HTTPS antes de vinculá-la.");
  }
  return editPages((pages) => {
    if (pages.length >= MAX_PAGES) throw new Error("Limite de 12 páginas. Exclua uma página que não esteja em execução.");
    if (tab && pages.some((page) => page.tabId === tab.id)) {
      throw new Error("Esta aba já está vinculada. Crie uma página sem vínculo e escolha outra aba.");
    }
    const used = new Set(pages.map((page) => page.slot));
    let slot = 1;
    while (used.has(slot)) slot++;
    const page = {
      id: crypto.randomUUID(), name: `Página ${slot}`, slot,
      color: PAGE_COLORS[(slot - 1) % PAGE_COLORS.length],
      tabId: tab?.id ?? null,
      tabTitle: tab?.title || tab?.url || ""
    };
    pages.push(page);
    return page;
  });
}

export async function bindPage(id, tabId) {
  const tab = await chrome.tabs.get(tabId);
  if (!/^https?:\/\//i.test(tab.url || "")) throw new Error("Escolha uma aba HTTP/HTTPS.");
  return editPages((pages) => {
    const page = pages.find((item) => item.id === id);
    if (!page) throw new Error("Página de execução não encontrada.");
    if (pages.some((item) => item.id !== id && item.tabId === tabId)) {
      throw new Error("Esta aba já pertence a outra página. Escolha uma aba diferente.");
    }
    Object.assign(page, { tabId, tabTitle: tab.title || tab.url });
    return page;
  });
}

export async function unbindPage(id) {
  return editPages((pages) => {
    const page = pages.find((item) => item.id === id);
    if (!page) throw new Error("Página de execução não encontrada.");
    Object.assign(page, { tabId: null, tabTitle: "" });
    return page;
  });
}

export async function deletePage(id) {
  return editPages((pages) => {
    const index = pages.findIndex((item) => item.id === id);
    if (index < 0) throw new Error("Página de execução não encontrada.");
    const [deleted] = pages.splice(index, 1);
    return deleted;
  });
}
