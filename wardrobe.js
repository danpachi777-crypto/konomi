(() => {
  const dbName = 'konomi-wardrobe-v1';
  function open() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(dbName, 1);
      request.onupgradeneeded = () => request.result.createObjectStore('items', { keyPath: 'id' });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  async function transact(mode, action) {
    const db = await open();
    try {
      return await new Promise((resolve, reject) => {
        const transaction = db.transaction('items', mode);
        const request = action(transaction.objectStore('items'));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    } finally { db.close(); }
  }
  async function list(owner) {
    const all = await transact('readonly', store => store.getAll());
    return all.filter(item => item.owner === owner).sort((a, b) => b.createdAt - a.createdAt);
  }
  async function add(owner, item) {
    const record = { ...item, id: crypto.randomUUID(), owner, createdAt: Date.now() };
    await transact('readwrite', store => store.put(record));
    return record;
  }
  async function remove(owner, id) {
    const item = await transact('readonly', store => store.get(id));
    if (item?.owner !== owner) return false;
    await transact('readwrite', store => store.delete(id));
    return true;
  }
  function resize(file) {
    return new Promise((resolve, reject) => {
      const image = new Image(), url = URL.createObjectURL(file);
      image.onload = () => {
        const scale = Math.min(1, 720 / Math.max(image.width, image.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(image.width * scale);
        canvas.height = Math.round(image.height * scale);
        canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('写真を変換できませんでした')), 'image/jpeg', .78);
      };
      image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('写真を読み込めませんでした')); };
      image.src = url;
    });
  }
  window.KonomiWardrobe = { list, add, remove, resize };
})();
