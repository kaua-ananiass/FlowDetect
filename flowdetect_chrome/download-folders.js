// FileSystemHandle objects cannot be stored in chrome.storage; IndexedDB keeps
// the user-granted directory handles available to the popup and service worker.
(() => {
  const DATABASE = "flowdetect-download-folders";
  const STORE = "handles";

  function database() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DATABASE, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function access(key, value, write = false) {
    const db = await database();
    try {
      return await new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE, write ? "readwrite" : "readonly");
        const request = write ? transaction.objectStore(STORE).put(value, key)
          : transaction.objectStore(STORE).get(key);
        request.onsuccess = () => { if (!write) resolve(request.result); };
        transaction.oncomplete = () => { if (write) resolve(); };
        request.onerror = () => reject(request.error);
        transaction.onerror = () => reject(transaction.error);
      });
    } finally { db.close(); }
  }

  globalThis.FlowDetectDownloadFolders = {
    get: (key) => access(key),
    put: (key, handle) => access(key, handle, true),
  };
})();
