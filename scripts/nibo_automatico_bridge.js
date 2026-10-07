/* Adaptador de arquivos para o modo automatizado; injetado apenas na aba do Nibo. */
(() => {
  const call = async (action, parts, extra = {}) => {
    const result = await window.__flowdetectNiboFs({ action, parts, ...extra });
    if (result?.error) {
      const error = new Error(result.message || result.error);
      error.name = result.error;
      throw error;
    }
    return result;
  };

  class FileHandle {
    constructor(parts) { this.parts = parts; }
    async getFile() {
      const result = await call("read", this.parts);
      return { size: result.size, lastModified: result.lastModified, text: async () => result.text };
    }
    async createWritable() {
      return {
        write: async (value) => {
          if (typeof value === "string") {
            await call("write", this.parts, { encoding: "utf8", content: value });
            return;
          }
          const blob = value instanceof Blob ? value : new Blob([value]);
          const base64 = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onerror = () => reject(reader.error);
            reader.onload = () => resolve(String(reader.result).split(",", 2)[1]);
            reader.readAsDataURL(blob);
          });
          await call("write", this.parts, { encoding: "base64", content: base64 });
        },
        close: async () => {}
      };
    }
  }

  class DirectoryHandle {
    constructor(parts = []) { this.parts = parts; }
    async getDirectoryHandle(name, options = {}) {
      const parts = [...this.parts, name];
      await call("directory", parts, { create: Boolean(options.create) });
      return new DirectoryHandle(parts);
    }
    async getFileHandle(name, options = {}) {
      const parts = [...this.parts, name];
      await call("file", parts, { create: Boolean(options.create) });
      return new FileHandle(parts);
    }
  }

  window.__flowdetectNiboDirectory = new DirectoryHandle();
})();
