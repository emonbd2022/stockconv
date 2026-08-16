import { ConvertedImage } from './types';

const DB_NAME = 'ImageConverterQueueDB';
const DB_VERSION = 1;
const STORE_NAME = 'queue_items';
const META_KEY = 'image_converter_queue_meta_v1';

interface StoredQueueItem {
  id: string;
  originalName: string;
  originalSize: number;
  file: File | Blob;
  blob?: Blob;
  status: 'pending' | 'converting' | 'done' | 'error';
  convertedSize?: number;
  isExported?: boolean;
  order: number;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('IndexedDB not supported'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

/**
 * Persists the current queue of images and their status to IndexedDB & localStorage.
 */
export async function saveQueueToStorage(images: ConvertedImage[]): Promise<void> {
  try {
    // Save lightweight metadata in localStorage for quick presence check
    const metaList = images.map((img, index) => ({
      id: img.id,
      originalName: img.originalName,
      originalSize: img.originalSize,
      status: img.status === 'converting' ? 'pending' : img.status,
      convertedSize: img.convertedSize,
      isExported: img.isExported,
      order: index,
    }));
    
    try {
      localStorage.setItem(META_KEY, JSON.stringify(metaList));
    } catch {
      // localStorage may fail if storage is restricted
    }

    if (images.length === 0) {
      await clearQueueStorage();
      return;
    }

    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    // Clear old items and write current list
    store.clear();

    for (let i = 0; i < images.length; i++) {
      const img = images[i];
      const item: StoredQueueItem = {
        id: img.id,
        originalName: img.originalName,
        originalSize: img.originalSize,
        file: img.file,
        blob: img.blob,
        status: img.status === 'converting' ? 'pending' : img.status,
        convertedSize: img.convertedSize,
        isExported: img.isExported,
        order: i,
      };
      store.put(item);
    }

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } catch (error) {
    console.warn('Failed to save queue to IndexedDB:', error);
  }
}

/**
 * Loads and restores the saved queue from IndexedDB upon page load/refresh.
 */
export async function loadQueueFromStorage(): Promise<ConvertedImage[]> {
  try {
    // Quick check if there is any saved queue metadata
    const savedMeta = localStorage.getItem(META_KEY);
    if (!savedMeta && !('indexedDB' in window)) {
      return [];
    }

    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();

    return new Promise((resolve) => {
      request.onsuccess = () => {
        const results = (request.result as StoredQueueItem[]) || [];
        if (results.length === 0) {
          resolve([]);
          return;
        }

        // Sort by preserved order
        results.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

        const restored: ConvertedImage[] = results.map((item) => {
          // Recreate File object if needed
          let fileObj: File;
          if (item.file instanceof File) {
            fileObj = item.file;
          } else {
            fileObj = new File([item.file], item.originalName, {
              type: item.originalName.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg',
            });
          }

          const previewUrl = URL.createObjectURL(fileObj);

          return {
            id: item.id || crypto.randomUUID(),
            originalName: item.originalName,
            originalSize: item.originalSize,
            previewUrl,
            file: fileObj,
            blob: item.blob,
            status: item.status === 'converting' ? 'pending' : item.status,
            convertedSize: item.convertedSize,
            isExported: item.isExported,
          };
        });

        resolve(restored);
      };

      request.onerror = () => {
        console.warn('Error loading queue from IndexedDB:', request.error);
        resolve([]);
      };
    });
  } catch (error) {
    console.warn('Failed to load queue from storage:', error);
    return [];
  }
}

/**
 * Completely clears the saved queue from storage.
 */
export async function clearQueueStorage(): Promise<void> {
  try {
    localStorage.removeItem(META_KEY);
  } catch {}

  try {
    if (!('indexedDB' in window)) return;
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.clear();
  } catch (error) {
    console.warn('Failed to clear queue in IndexedDB:', error);
  }
}
