function openDatabase(
  factory: IDBFactory,
  name: string,
  version: number,
  storeName: string,
): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = factory.open(name, version);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(storeName)) {
        database.createObjectStore(storeName, { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("IndexedDB open failed"));
    request.onblocked = () => reject(new Error("IndexedDB upgrade is blocked"));
  });
}
export function requestResult<Result>(
  request: IDBRequest<Result>,
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("IndexedDB request failed"));
  });
}
export function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("IndexedDB transaction failed"));
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("IndexedDB transaction aborted"));
  });
}
export function createRecordStore(
  factory: IDBFactory | undefined,
  name: string,
  version: number,
  storeName: string,
) {
  let pending: Promise<IDBDatabase> | null = null;
  const database = () => {
    if (!factory) return Promise.reject(new Error("IndexedDB is unavailable"));
    pending ??= openDatabase(factory, name, version, storeName);
    return pending;
  };
  return {
    database,
    async deleteKeys(this: void, keys: readonly string[]) {
      if (keys.length === 0) return;
      const db = await database();
      const transaction = db.transaction(storeName, "readwrite");
      const store = transaction.objectStore(storeName);
      for (const key of keys) store.delete(key);
      await transactionDone(transaction);
    },
    async delete(this: void, key: string) {
      const db = await database();
      const transaction = db.transaction(storeName, "readwrite");
      transaction.objectStore(storeName).delete(key);
      await transactionDone(transaction);
    },
    async get(this: void, key: string): Promise<unknown> {
      const db = await database();
      return (
        (await requestResult(
          db.transaction(storeName, "readonly").objectStore(storeName).get(key),
        )) ?? null
      );
    },
    async put(this: void, record: unknown) {
      const db = await database();
      const transaction = db.transaction(storeName, "readwrite");
      transaction.objectStore(storeName).put(record);
      await transactionDone(transaction);
    },
  };
}
