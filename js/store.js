/* ========================================
   Store — IndexedDB Data Layer
   ======================================== */

const DB_NAME = 'LightingDiagramArchive';
const DB_VERSION = 1;

const store = {
  db: null,
  
  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        if (!db.objectStoreNames.contains('brands')) {
          const brandStore = db.createObjectStore('brands', { keyPath: 'id' });
          brandStore.createIndex('name', 'name', { unique: false });
          brandStore.createIndex('createdAt', 'createdAt', { unique: false });
        }
        
        if (!db.objectStoreNames.contains('sessions')) {
          const sessionStore = db.createObjectStore('sessions', { keyPath: 'id' });
          sessionStore.createIndex('brandId', 'brandId', { unique: false });
          sessionStore.createIndex('date', 'date', { unique: false });
          sessionStore.createIndex('createdAt', 'createdAt', { unique: false });
        }
        
        if (!db.objectStoreNames.contains('assets')) {
          const assetStore = db.createObjectStore('assets', { keyPath: 'id' });
          assetStore.createIndex('sessionId', 'sessionId', { unique: false });
          assetStore.createIndex('type', 'type', { unique: false });
          assetStore.createIndex('createdAt', 'createdAt', { unique: false });
        }
      };
      
      request.onsuccess = (event) => {
        this.db = event.target.result;
        resolve();
      };
      
      request.onerror = (event) => {
        reject(event.target.error);
      };
    });
  },
  
  /* --- Brands --- */
  
  async getAllBrands() {
    return this._getAll('brands', 'createdAt');
  },
  
  async getBrand(id) {
    return this._get('brands', id);
  },
  
  async saveBrand(brand) {
    return this._put('brands', brand);
  },
  
  async deleteBrand(id) {
    const sessions = await this.getSessionsByBrand(id);
    for (const session of sessions) {
      await this.deleteSession(session.id);
    }
    return this._delete('brands', id);
  },
  
  /* --- Sessions --- */
  
  async getSessionsByBrand(brandId) {
    return this._getByIndex('sessions', 'brandId', brandId);
  },
  
  async getSession(id) {
    return this._get('sessions', id);
  },
  
  async saveSession(session) {
    return this._put('sessions', session);
  },
  
  async deleteSession(id) {
    const assets = await this.getAssetsBySession(id);
    for (const asset of assets) {
      await this._delete('assets', asset.id);
    }
    return this._delete('sessions', id);
  },
  
  /* --- Assets --- */
  
  async getAssetsBySession(sessionId) {
    return this._getByIndex('assets', 'sessionId', sessionId);
  },
  
  async getAsset(id) {
    return this._get('assets', id);
  },
  
  async saveAsset(asset) {
    return this._put('assets', asset);
  },
  
  async deleteAsset(id) {
    return this._delete('assets', id);
  },
  
  async deleteAssetsBySession(sessionId) {
    const assets = await this.getAssetsBySession(sessionId);
    for (const asset of assets) {
      await this._delete('assets', asset.id);
    }
  },
  
  /* --- Utility: ID generation --- */
  
  generateId() {
    return Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 9);
  },
  


  /* --- Export / Import (backup) --- */
  
  async exportAll() {
    const brands = await this.getAllBrands();
    const allSessions = [];
    const allAssets = [];
    
    for (const brand of brands) {
      const sessions = await this.getSessionsByBrand(brand.id);
      allSessions.push(...sessions);
      for (const session of sessions) {
        const assets = await this.getAssetsBySession(session.id);
        allAssets.push(...assets);
      }
    }
    
    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      data: {
        brands,
        sessions: allSessions,
        assets: allAssets
      }
    };
  },
  
  async importAll(backupData) {
    if (!backupData || !backupData.data) {
      throw new Error('无效的备份文件');
    }
    
    const { brands, sessions, assets } = backupData.data;
    
    // Use a single transaction to avoid premature auto-commit
    const tx = this.db.transaction(['brands', 'sessions', 'assets'], 'readwrite');
    const brandStore = tx.objectStore('brands');
    const sessionStore = tx.objectStore('sessions');
    const assetStore = tx.objectStore('assets');
    
    // Clear all stores
    brandStore.clear();
    sessionStore.clear();
    assetStore.clear();
    
    // Put all data (synchronous queuing within the same transaction)
    for (const brand of (brands || [])) {
      brandStore.put(brand);
    }
    for (const session of (sessions || [])) {
      sessionStore.put(session);
    }
    for (const asset of (assets || [])) {
      assetStore.put(asset);
    }
    
    // Wait for the single transaction to complete
    await new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = (e) => reject(e.target.error);
      tx.onabort = (e) => reject(e.target.error || new Error('Transaction aborted'));
    });
    
    return { brands: (brands || []).length, sessions: (sessions || []).length, assets: (assets || []).length };
  },
  

  /* --- Internal helpers --- */
  
  _getAll(storeName, indexName) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const index = store.index(indexName);
      const request = index.getAll();
      
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  },
  
  _get(storeName, id) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const request = store.get(id);
      
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  },
  
  _put(storeName, obj) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const request = store.put(obj);
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },
  
  _delete(storeName, id) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const request = store.delete(id);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },
  
  _getByIndex(storeName, indexName, value) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const index = store.index(indexName);
      const request = index.getAll(value);
      
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }
};
