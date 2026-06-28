/* ========================================
   App — Main Application Logic
   ======================================== */

const app = {
  currentView: 'brands',
  currentBrandId: null,
  currentSessionId: null,
  currentFilter: 'all',
  _lightboxAssets: [],
  _lightboxIndex: 0,
  _assetGridAspectRatio: '3-4',
  pendingUploadFiles: [],
  
  /* --- Initialization --- */
  
  async init() {
    await store.init();
    this._bindUI();
    await this._renderAll();
    this._checkCloudData();
  },
  
  /* --- UI Event Binding --- */
  
  _bindUI() {
    // Navigation
    this.$('btnAddBrand').addEventListener('click', () => this.showBrandForm());
    this.$('btnAddBrandEmpty').addEventListener('click', () => this.showBrandForm());
    this.$('navBrands').addEventListener('click', () => this.navigateTo('brands'));
    this.$('navBackup').addEventListener('click', () => this._openBackup());
    this.$('btnExportBackup').addEventListener('click', () => this._exportBackup());
    this.$('btnImportBackup').addEventListener('click', () => this.$('backupFileInput').click());
    this.$('backupFileInput').addEventListener('change', (e) => this._importBackup(e));
    this.$('navCloud').addEventListener('click', () => this._openCloudSync());
    this.$('btnCloudUpload').addEventListener('click', () => this._uploadToCloud());
    this.$('btnCloudDownload').addEventListener('click', () => this._downloadFromCloud());
    this.$('githubToken').addEventListener('input', (e) => {
      localStorage.setItem('github_token', e.target.value.trim());
    });
    this.$('githubToken').addEventListener('blur', (e) => {
      if (e.target.value.trim()) {
        this._setCloudStatus('Token 已保存', 'success');
        setTimeout(() => document.getElementById('cloudStatus').classList.remove('show'), 2000);
      }
    });
    
    // Sidebar
    this.$('sidebarToggle').addEventListener('click', () => this._toggleSidebar());
    this.$('sidebarClose').addEventListener('click', () => this._toggleSidebar());
    this.$('sidebarOverlay').addEventListener('click', () => this._toggleSidebar());
    
    // Brand detail
    this.$('btnBackFromBrand').addEventListener('click', () => this.navigateTo('brands'));
    this.$('btnEditBrand').addEventListener('click', () => {
      if (this.currentBrandId) this.showBrandForm(this.currentBrandId);
    });
    this.$('btnAddSession').addEventListener('click', () => this.showSessionForm());
    
    // Session detail
    this.$('btnBackFromSession').addEventListener('click', () => {
      this.navigateTo('brandDetail', this.currentBrandId);
    });
    this.$('btnEditSession').addEventListener('click', () => {
      if (this.currentSessionId) this.showSessionForm(this.currentSessionId);
    });
    
    // Upload
    this.$('btnUploadAssets').addEventListener('click', () => this._openUpload());
    this.$('uploadConfirm').addEventListener('click', () => this._confirmUpload());
    
    // Filter tabs (delegated)
    this.$('sessionAssets').addEventListener('click', (e) => {
      const tab = e.target.closest('.filter-tab');
      if (tab) {
        this._setFilter(tab.dataset.filter);
      }
    });
    
    // Ratio tabs (delegated)
    this.$('sessionAssets').addEventListener('click', (e) => {
      const tab = e.target.closest('.ratio-tab');
      if (tab) {
        this._setRatio(tab.dataset.ratio);
      }
    });
    
    // Lightbox navigation
    this.$('lightboxPrev').addEventListener('click', () => this._lightboxPrev());
    this.$('lightboxNext').addEventListener('click', () => this._lightboxNext());
    
    // Brand form
    this.$('brandFormSubmit').addEventListener('click', () => this._saveBrand());
    this.$('brandCoverUpload').addEventListener('click', (e) => {
      if (e.target.closest('.cover-remove')) return;
      this.$('brandCoverInput').click();
    });
    this.$('brandCoverInput').addEventListener('change', (e) => {
      this._handleBrandCover(e.target.files[0]);
    });
    this.$('brandCoverRemove').addEventListener('click', () => this._removeBrandCover());
    
    // Session form
    this.$('sessionFormSubmit').addEventListener('click', () => this._saveSession());
    
    // Upload modal
    this.$('uploadDropzone').addEventListener('click', () => this.$('uploadFileInput').click());
    this.$('uploadFileInput').addEventListener('change', (e) => {
      this._handleUploadFiles(e.target.files);
    });
    
    // Drag & drop
    this.$('uploadDropzone').addEventListener('dragover', (e) => {
      e.preventDefault();
      e.currentTarget.classList.add('drag-over');
    });
    this.$('uploadDropzone').addEventListener('dragleave', (e) => {
      e.preventDefault();
      e.currentTarget.classList.remove('drag-over');
    });
    this.$('uploadDropzone').addEventListener('drop', (e) => {
      e.preventDefault();
      e.currentTarget.classList.remove('drag-over');
      this._handleUploadFiles(e.dataTransfer.files);
    });
    
    // Modal close buttons
    document.querySelectorAll('.modal-close').forEach(btn => {
      btn.addEventListener('click', () => {
        this._closeModal(btn.dataset.modal);
      });
    });
    document.querySelectorAll('[data-modal]').forEach(el => {
      el.addEventListener('click', () => {
        this._closeModal(el.dataset.modal);
      });
    });
    
    // Close modals on overlay click
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay && !overlay.classList.contains('lightbox')) {
          overlay.classList.remove('open');
        }
      });
    });
    
    // Confirm dialog
    this.$('confirmDeleteBtn').addEventListener('click', () => this._executeDelete());
    
    // Keyboard: Escape to close modals
    document.addEventListener('keydown', (e) => {
      const lightboxOpen = document.getElementById('lightbox').classList.contains('open');
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal-overlay.open').forEach(el => {
          el.classList.remove('open');
        });
      }
      if (lightboxOpen) {
        if (e.key === 'ArrowLeft') this._lightboxPrev();
        if (e.key === 'ArrowRight') this._lightboxNext();
      }
    });
  },
  
  /* --- Navigation --- */
  
  navigateTo(view, param1, param2) {
    // Hide all views
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    
    switch (view) {
      case 'brands':
        this.currentView = 'brands';
        this.currentBrandId = null;
        this.currentSessionId = null;
        this.$('viewBrands').classList.add('active');
        this._renderBrandGrid();
        this._updateSidebar();
        break;
        
      case 'brandDetail':
        this.currentView = 'brandDetail';
        this.currentBrandId = param1;
        this.currentSessionId = null;
        this.$('viewBrandDetail').classList.add('active');
        this._renderBrandDetail(param1);
        this._updateSidebar();
        break;
        
      case 'sessionDetail':
        this.currentView = 'sessionDetail';
        this.currentBrandId = param1;
        this.currentSessionId = param2;
        this.$('viewSessionDetail').classList.add('active');
        this._renderSessionDetail(param2);
        this._updateSidebar();
        break;
    }
  },
  
  /* --- Sidebar --- */
  
  _toggleSidebar() {
    this.$('sidebar').classList.toggle('open');
    this.$('sidebarOverlay').classList.toggle('open');
  },
  
  _closeSidebar() {
    this.$('sidebar').classList.remove('open');
    this.$('sidebarOverlay').classList.remove('open');
  },
  
  /* --- Rendering --- */
  
  async _renderAll() {
    await this._updateSidebar();
    await this._renderBrandGrid();
  },
  
  async _updateSidebar() {
    const list = this.$('sidebarBrandList');
    const brands = await store.getAllBrands();
    
    if (brands.length === 0) {
      list.innerHTML = '<div class="sidebar-empty">暂无品牌</div>';
      return;
    }
    
    list.innerHTML = brands.map(b => {
      const isActive = b.id === this.currentBrandId;
      const sessionCount = ''; // We'll add count later if needed
      return `
        <div class="sidebar-item ${isActive ? 'active' : ''}" data-brand-id="${b.id}">
          ${b.cover 
            ? `<img class="sidebar-item-thumb" src="${b.cover}" alt="">` 
            : `<div class="sidebar-item-thumb-placeholder">${b.name.charAt(0)}</div>`
          }
          <span class="sidebar-item-name">${this._esc(b.name)}</span>
        </div>
      `;
    }).join('');
    
    list.querySelectorAll('.sidebar-item').forEach(el => {
      el.addEventListener('click', () => {
        this.navigateTo('brandDetail', el.dataset.brandId);
        this._closeSidebar();
      });
    });
  },
  
  async _renderBrandGrid() {
    const grid = this.$('brandGrid');
    const brands = await store.getAllBrands();
    
    // Get session counts for each brand
    const counts = {};
    for (const b of brands) {
      const sessions = await store.getSessionsByBrand(b.id);
      counts[b.id] = sessions.length;
    }
    
    if (brands.length === 0) {
      grid.innerHTML = `<div class="empty-state">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" class="empty-icon"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
        <h3>还没有品牌</h3>
        <p>点击「新建品牌」开始整理你的拍摄档案</p>
        <button class="btn btn-primary" id="btnAddBrandEmpty">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          新建品牌
        </button>
      </div>`;
      // Re-bind the empty state button
      this.$('btnAddBrandEmpty')?.addEventListener('click', () => this.showBrandForm());
      return;
    }
    
    grid.innerHTML = brands.sort((a, b) => b.createdAt - a.createdAt).map(b => `
      <div class="brand-card" data-brand-id="${b.id}">
        ${b.cover 
          ? `<img class="brand-card-cover" src="${b.cover}" alt="${this._esc(b.name)}">`
          : `<div class="brand-card-cover-placeholder">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
            </div>`
        }
        <div class="brand-card-body">
          <div class="brand-card-name">${this._esc(b.name)}</div>
          <div class="brand-card-desc">${this._esc(b.description || '暂无描述')}</div>
          <div class="brand-card-meta">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
            <span>${counts[b.id]} 个拍摄期次</span>
          </div>
        </div>
        <div class="brand-card-actions">
          <button class="btn btn-ghost btn-sm card-edit" data-brand-id="${b.id}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            编辑
          </button>
          <button class="btn btn-ghost btn-sm card-delete" data-brand-id="${b.id}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div>
      </div>
    `).join('');
    
    // Bind card click to navigate
    grid.querySelectorAll('.brand-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('.card-edit') || e.target.closest('.card-delete')) return;
        this.navigateTo('brandDetail', card.dataset.brandId);
      });
    });
    
    // Bind edit buttons
    grid.querySelectorAll('.card-edit').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.showBrandForm(btn.dataset.brandId);
      });
    });
    
    // Bind delete buttons
    grid.querySelectorAll('.card-delete').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this._confirmDeleteBrand(btn.dataset.brandId);
      });
    });
  },
  
  async _renderBrandDetail(brandId) {
    const brand = await store.getBrand(brandId);
    if (!brand) {
      this.navigateTo('brands');
      return;
    }
    
    this.$('detailBrandName').textContent = brand.name;
    this.$('detailBrandDesc').textContent = brand.description || '暂无描述';
    
    const sessions = await store.getSessionsByBrand(brandId);
    const list = this.$('sessionsList');
    
    if (sessions.length === 0) {
      list.innerHTML = `<div class="empty-state">
        <h3>还没有拍摄期次</h3>
        <p>点击「新建期次」添加这个品牌的拍摄记录</p>
      </div>`;
      return;
    }
    
    // Sort sessions by date descending
    sessions.sort((a, b) => {
      if (a.date && b.date) return b.date.localeCompare(a.date);
      return b.createdAt - a.createdAt;
    });
    
    // Get up to 4 thumbnails per session
    const thumbData = {};
    for (const s of sessions) {
      const assets = await store.getAssetsBySession(s.id);
      thumbData[s.id] = assets.slice(0, 5);
    }
    
    list.innerHTML = sessions.map(s => {
      const thumbs = thumbData[s.id] || [];
      const thumbHtml = thumbs.slice(0, 4).map(a => 
        `<img class="session-card-thumb" src="${a.dataUrl}" alt="">`
      ).join('');
      if (thumbs.length > 4) {
        thumbHtml += `<div class="session-card-thumb-more">+${thumbs.length - 4}</div>`;
      }
      
      return `
        <div class="session-card" data-session-id="${s.id}">
          <div class="session-card-header">
            <div>
              <div class="session-card-title">${this._esc(s.title)}</div>
              <div class="session-card-date">${s.date ? this._formatDate(s.date) : '未设置日期'}</div>
              ${s.client ? `<div class="session-card-client">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                ${this._esc(s.client)}
              </div>` : ''}
            </div>
            <div class="session-card-actions">
              <button class="btn btn-ghost btn-sm session-delete" data-session-id="${s.id}">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              </button>
            </div>
          </div>
          ${thumbs.length > 0 ? `<div class="session-card-thumbnails">${thumbHtml}</div>` : ''}
          ${s.description ? `<p style="margin-top:8px;font-size:0.82rem">${this._esc(s.description)}</p>` : ''}
        </div>
      `;
    }).join('');
    
    // Bind session click
    list.querySelectorAll('.session-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('.session-delete')) return;
        this.navigateTo('sessionDetail', brandId, card.dataset.sessionId);
      });
    });
    
    // Bind session delete
    list.querySelectorAll('.session-delete').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this._confirmDeleteSession(btn.dataset.sessionId);
      });
    });
  },
  
  async _renderSessionDetail(sessionId) {
    const session = await store.getSession(sessionId);
    if (!session) {
      if (this.currentBrandId) {
        this.navigateTo('brandDetail', this.currentBrandId);
      } else {
        this.navigateTo('brands');
      }
      return;
    }
    
    this.$('sessionDetailTitle').textContent = session.title;
    const metaParts = [];
    if (session.date) metaParts.push(this._formatDate(session.date));
    if (session.client) metaParts.push(`甲方：${session.client}`);
    this.$('sessionDetailMeta').textContent = metaParts.join(' · ') || '暂无信息';
    
    // Store sessionId on the view for upload
    this.$('viewSessionDetail').dataset.sessionId = sessionId;
    
    await this._renderAssets(sessionId, this.currentFilter);
  },
  
  async _renderAssets(sessionId, filter) {
    const grid = this.$('assetGrid');
    let assets = await store.getAssetsBySession(sessionId);
    
    if (filter && filter !== 'all') {
      assets = assets.filter(a => a.type === filter);
    }
    
    // Sort by createdAt descending
    assets.sort((a, b) => b.createdAt - a.createdAt);
    
    if (assets.length === 0) {
      grid.innerHTML = `<div class="empty-state">
        <h3>${filter === 'all' ? '还没有图片' : filter === 'photo' ? '还没有成片' : '还没有灯位图'}</h3>
        <p>点击「上传」添加图片</p>
      </div>`;
      return;
    }
    
    this._lightboxAssets = assets;

    grid.innerHTML = assets.map((a, idx) => `
      <div class="asset-item" data-index="${idx}">
        <span class="asset-badge ${a.type}">${a.type === 'photo' ? '成片' : '灯位图'}</span>
        <button class="asset-delete-btn asset-delete" data-asset-id="${a.id}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
        <img src="${a.dataUrl}" alt="${this._esc(a.caption || '')}" loading="lazy">
        ${a.caption ? `<div class="asset-caption">${this._esc(a.caption)}</div>` : ''}
      </div>
    `).join('');
    
    // Apply aspect ratio
    grid.classList.add(`ratio-${this._assetGridAspectRatio}`);
    
    // Lightbox click
    grid.querySelectorAll('.asset-item').forEach(item => {
      item.addEventListener('click', (e) => {
        if (e.target.closest('.asset-delete')) return;
        const idx = parseInt(item.dataset.index);
        if (!isNaN(idx)) this._openLightbox(idx);
      });
    });
    
    // Delete buttons
    grid.querySelectorAll('.asset-delete').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this._confirmDeleteAsset(btn.dataset.assetId);
      });
    });
  },
  
  _setFilter(filter) {
    this.currentFilter = filter;
    
    // Update tab UI
    this.$('sessionAssets').querySelectorAll('.filter-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.filter === filter);
    });
    
    if (this.currentSessionId) {
      this._renderAssets(this.currentSessionId, filter);
    }
  },
  
  /* --- Brand Form --- */
  
  showBrandForm(brandId) {
    this.$('brandFormId').value = '';
    this.$('brandName').value = '';
    this.$('brandDesc').value = '';
    this.$('brandCoverPlaceholder').classList.remove('hidden');
    this.$('brandCoverPreview').classList.add('hidden');
    this.$('brandCoverPreview').src = '';
    this.$('brandCoverRemove').classList.add('hidden');
    this._brandCoverData = null;
    
    if (brandId) {
      this.$('brandFormTitle').textContent = '编辑品牌';
      this._loadBrandForEdit(brandId);
    } else {
      this.$('brandFormTitle').textContent = '新建品牌';
    }
    
    this._openModal('brandFormModal');
  },
  
  async _loadBrandForEdit(brandId) {
    const brand = await store.getBrand(brandId);
    if (!brand) return;
    
    this.$('brandFormId').value = brand.id;
    this.$('brandName').value = brand.name;
    this.$('brandDesc').value = brand.description || '';
    
    if (brand.cover) {
      this._brandCoverData = brand.cover;
      this.$('brandCoverPlaceholder').classList.add('hidden');
      this.$('brandCoverPreview').src = brand.cover;
      this.$('brandCoverPreview').classList.remove('hidden');
      this.$('brandCoverRemove').classList.remove('hidden');
    }
  },
  
  _handleBrandCover(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      this._brandCoverData = e.target.result;
      this.$('brandCoverPlaceholder').classList.add('hidden');
      this.$('brandCoverPreview').src = e.target.result;
      this.$('brandCoverPreview').classList.remove('hidden');
      this.$('brandCoverRemove').classList.remove('hidden');
    };
    reader.readAsDataURL(file);
  },
  
  _removeBrandCover() {
    this._brandCoverData = null;
    this.$('brandCoverPlaceholder').classList.remove('hidden');
    this.$('brandCoverPreview').classList.add('hidden');
    this.$('brandCoverPreview').src = '';
    this.$('brandCoverRemove').classList.add('hidden');
    this.$('brandCoverInput').value = '';
  },
  
  async _saveBrand() {
    const name = this.$('brandName').value.trim();
    if (!name) return;
    
    const id = this.$('brandFormId').value || store.generateId();
    const existing = this.$('brandFormId').value ? await store.getBrand(this.$('brandFormId').value) : null;
    
    const brand = {
      id,
      name,
      description: this.$('brandDesc').value.trim(),
      cover: this._brandCoverData || null,
      createdAt: existing ? existing.createdAt : Date.now(),
      updatedAt: Date.now()
    };
    
    await store.saveBrand(brand);
    this._autoSync();
    this._closeModal('brandFormModal');
    
    if (this.currentView === 'brandDetail' && this.currentBrandId === id) {
      await this._renderBrandDetail(id);
    }
    await this._renderBrandGrid();
    await this._updateSidebar();
  },
  
  /* --- Session Form --- */
  
  showSessionForm(sessionId) {
    this.$('sessionFormId').value = '';
    this.$('sessionTitle').value = '';
    this.$('sessionDate').value = '';
    this.$('sessionClient').value = '';
    this.$('sessionDesc').value = '';
    
    if (sessionId) {
      this.$('sessionFormTitle').textContent = '编辑拍摄期次';
      this._loadSessionForEdit(sessionId);
    } else {
      this.$('sessionFormTitle').textContent = '新建拍摄期次';
      // Set default date to today
      this.$('sessionDate').value = new Date().toISOString().split('T')[0];
    }
    
    this._openModal('sessionFormModal');
  },
  
  async _loadSessionForEdit(sessionId) {
    const session = await store.getSession(sessionId);
    if (!session) return;
    
    this.$('sessionFormId').value = session.id;
    this.$('sessionTitle').value = session.title;
    this.$('sessionDate').value = session.date || '';
    this.$('sessionClient').value = session.client || '';
    this.$('sessionDesc').value = session.description || '';
  },
  
  async _saveSession() {
    const title = this.$('sessionTitle').value.trim();
    if (!title || !this.currentBrandId) return;
    
    const id = this.$('sessionFormId').value || store.generateId();
    const existing = this.$('sessionFormId').value ? await store.getSession(this.$('sessionFormId').value) : null;
    
    const session = {
      id,
      brandId: existing ? existing.brandId : this.currentBrandId,
      title,
      date: this.$('sessionDate').value || null,
      client: this.$('sessionClient').value.trim() || null,
      description: this.$('sessionDesc').value.trim() || null,
      createdAt: existing ? existing.createdAt : Date.now(),
      updatedAt: Date.now()
    };
    
    await store.saveSession(session);
    this._autoSync();
    this._closeModal('sessionFormModal');
    
    if (this.currentView === 'sessionDetail') {
      await this._renderSessionDetail(id);
    }
    await this._renderBrandDetail(this.currentBrandId);
    await this._updateSidebar();
  },
  
  /* --- Upload --- */
  
  _openUpload() {
    this.pendingUploadFiles = [];
    this.$('uploadPreviewList').innerHTML = '';
    this.$('uploadConfirm').disabled = true;
    this.$('uploadConfirm').textContent = '上传 (0)';
    this.$('uploadFileInput').value = '';
    this._openModal('uploadModal');
  },
  
  _handleUploadFiles(files) {
    if (!files || files.length === 0) return;
    
    for (const file of files) {
      if (!file.type.startsWith('image/')) continue;
      this.pendingUploadFiles.push(file);
    }
    
    this._renderUploadPreviews();
  },
  
  _renderUploadPreviews() {
    const list = this.$('uploadPreviewList');
    
    const loadPromises = this.pendingUploadFiles.map((file, index) => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          resolve({ index, dataUrl: e.target.result, name: file.name });
        };
        reader.readAsDataURL(file);
      });
    });
    
    Promise.all(loadPromises).then(results => {
      results.sort((a, b) => a.index - b.index);
      list.innerHTML = results.map(r => `
        <div class="upload-preview-item">
          <img src="${r.dataUrl}" alt="${this._esc(r.name)}">
        </div>
      `).join('');
      
      this.$('uploadConfirm').disabled = false;
      this.$('uploadConfirm').textContent = `上传 (${results.length})`;
    });
  },
  
  async _confirmUpload() {
    if (this.pendingUploadFiles.length === 0) return;
    
    const sessionId = this.$('viewSessionDetail').dataset.sessionId;
    if (!sessionId) return;
    
    const typeEl = document.querySelector('input[name="uploadType"]:checked');
    const type = typeEl ? typeEl.value : 'photo';
    
    this.$('uploadConfirm').disabled = true;
    this.$('uploadConfirm').textContent = '上传中...';
    
    for (const file of this.pendingUploadFiles) {
      const dataUrl = await this._fileToDataUrl(file);
      const asset = {
        id: store.generateId(),
        sessionId,
        type,
        dataUrl,
        caption: file.name.replace(/\.[^.]+$/, ''),
        createdAt: Date.now()
      };
      await store.saveAsset(asset);
    }
    
    this.pendingUploadFiles = [];
    this._closeModal('uploadModal');
    await this._renderAssets(sessionId, this.currentFilter);
    await this._renderBrandDetail(this.currentBrandId);
    this._autoSync();
  },
  
  _fileToDataUrl(file) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.readAsDataURL(file);
    });
  },
  
  /* --- Lightbox --- */
  
  _openLightbox(index) {
    this._lightboxIndex = index;
    this._updateLightbox();
    this._openModal('lightbox');
  },
  
  _updateLightbox() {
    const assets = this._lightboxAssets;
    if (!assets.length) return;
    const asset = assets[this._lightboxIndex];
    if (!asset) return;
    
    this.$('lightboxImg').src = asset.dataUrl;
    const typeLabel = asset.type === 'photo' ? '成片' : '灯位图';
    this.$('lightboxLabel').textContent = `${typeLabel}${asset.caption ? ' · ' + asset.caption : ''}`;
    this.$('lightboxCounter').textContent = `${this._lightboxIndex + 1} / ${assets.length}`;
    
    this.$('lightboxPrev').style.display = this._lightboxIndex > 0 ? 'flex' : 'none';
    this.$('lightboxNext').style.display = this._lightboxIndex < assets.length - 1 ? 'flex' : 'none';
  },
  
  _lightboxPrev() {
    if (this._lightboxIndex > 0) {
      this._lightboxIndex--;
      this._updateLightbox();
    }
  },
  
  _lightboxNext() {
    if (this._lightboxIndex < this._lightboxAssets.length - 1) {
      this._lightboxIndex++;
      this._updateLightbox();
    }
  },
  
  _setRatio(ratio) {
    this._assetGridAspectRatio = ratio;
    const grid = this.$('assetGrid');
    grid.classList.remove('ratio-3-4', 'ratio-4-5');
    grid.classList.add('ratio-' + ratio);
    
    this.$('sessionAssets').querySelectorAll('.ratio-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.ratio === ratio);
    });
  },
  
  /* --- Delete Confirmations --- */
  
  _pendingDeleteAction: null,
  
  _confirmDeleteBrand(brandId) {
    this._pendingDeleteAction = async () => {
      await store.deleteBrand(brandId);
      if (this.currentBrandId === brandId) {
        this.navigateTo('brands');
      } else {
        await this._renderAll();
      }
    };
    this.$('confirmMessage').textContent = '确认删除这个品牌吗？该品牌下的所有拍摄期次和图片将一并删除，此操作不可撤销。';
    this._openModal('confirmModal');
  },
  
  _confirmDeleteSession(sessionId) {
    this._pendingDeleteAction = async () => {
      await store.deleteSession(sessionId);
      if (this.currentSessionId === sessionId) {
        this.navigateTo('brandDetail', this.currentBrandId);
      } else {
        await this._renderBrandDetail(this.currentBrandId);
      }
    };
    this.$('confirmMessage').textContent = '确认删除这个拍摄期次吗？该期次下的所有图片将一并删除，此操作不可撤销。';
    this._openModal('confirmModal');
  },
  
  _confirmDeleteAsset(assetId) {
    this._pendingDeleteAction = async () => {
      await store.deleteAsset(assetId);
      if (this.currentSessionId) {
        await this._renderAssets(this.currentSessionId, this.currentFilter);
        await this._renderBrandDetail(this.currentBrandId);
      }
    };
    this.$('confirmMessage').textContent = '确认删除这张图片吗？此操作不可撤销。';
    this._openModal('confirmModal');
  },
  
  async _executeDelete() {
    if (this._pendingDeleteAction) {
      await this._pendingDeleteAction();
      this._pendingDeleteAction = null;
    }
    this._closeModal('confirmModal');
    await this._updateSidebar();
    this._autoSync();
  },
  
  /* --- Modal Helpers --- */
  
  _openModal(id) {
    this.$(id).classList.add('open');
  },
  
  _closeModal(id) {
    this.$(id).classList.remove('open');
  },
  
  /* --- Utility --- */
  
  $(id) {
    return document.getElementById(id);
  },
  
  _esc(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },
  
  _formatDate(dateStr) {
    const d = new Date(dateStr);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y} 年 ${m} 月 ${day} 日`;
  },

  /* --- Backup --- */

  async _openBackup() {
    // Track last backup time
    const lastBackup = localStorage.getItem('lastBackupTime');
    this.$('backupLastBackupTime').textContent = lastBackup || '暂无';

    await this._updateBackupStats();
    this._openModal('backupModal');
  },

  async _updateBackupStats() {
    const brands = await store.getAllBrands();
    let totalSessions = 0;
    let totalAssets = 0;

    for (const b of brands) {
      const sessions = await store.getSessionsByBrand(b.id);
      totalSessions += sessions.length;
      for (const s of sessions) {
        const assets = await store.getAssetsBySession(s.id);
        totalAssets += assets.length;
      }
    }

    this.$('backupBrandCount').textContent = brands.length;
    this.$('backupSessionCount').textContent = totalSessions;
    this.$('backupAssetCount').textContent = totalAssets;

    // Estimate data size
    const exportData = await store.exportAll();
    const jsonStr = JSON.stringify(exportData);
    const sizeKB = (new Blob([jsonStr]).size / 1024).toFixed(1);
    this.$('backupDataSize').textContent = sizeKB < 1024 ? `${sizeKB} KB` : `${(sizeKB / 1024).toFixed(1)} MB`;
  },

  async _exportBackup() {
    const backupBtn = this.$('btnExportBackup');
    backupBtn.disabled = true;
    backupBtn.textContent = '准备中...';

    try {
      const exportData = await store.exportAll();
      const jsonStr = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      const dateStr = new Date().toISOString().split('T')[0];
      a.href = url;
      a.download = `灯位图归档_${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      localStorage.setItem('lastBackupTime', new Date().toLocaleString('zh-CN'));
      this.$('backupLastBackupTime').textContent = localStorage.getItem('lastBackupTime');

      backupBtn.textContent = '✓ 导出成功';
      setTimeout(() => {
        backupBtn.textContent = '下载备份文件';
        backupBtn.disabled = false;
      }, 2000);
    } catch (e) {
      backupBtn.textContent = '导出失败';
      backupBtn.disabled = false;
      console.error(e);
    }
  },

  async _importBackup(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (!confirm('恢复备份将替换当前所有数据，包括所有品牌、期次和图片。确定要继续吗？')) {
      event.target.value = '';
      return;
    }

    const importBtn = this.$('btnImportBackup');
    importBtn.disabled = true;
    importBtn.textContent = '恢复中...';

    try {
      const text = await file.text();
      const backupData = JSON.parse(text);

      if (!backupData.version || !backupData.data) {
        throw new Error('无效的备份文件格式');
      }

      await store.importAll(backupData);
      importBtn.textContent = '✓ 恢复成功';

      this._closeModal('backupModal');
      await this._renderAll();
      if (this.currentView !== 'brands') {
        this.navigateTo('brands');
      }

      event.target.value = '';
      setTimeout(() => {
        importBtn.textContent = '选择备份文件';
        importBtn.disabled = false;
      }, 2000);
    } catch (e) {
      importBtn.textContent = '恢复失败';
      importBtn.disabled = false;
      event.target.value = '';
      alert('备份恢复失败：' + e.message);
      setTimeout(() => {
        importBtn.textContent = '选择备份文件';
      }, 2000);
    }
  },

  _formatDate(dateStr) {
    const d = new Date(dateStr);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y} 年 ${m} 月 ${day} 日`;
  },

  /* --- Cloud Sync (GitHub) --- */

  GITHUB_OWNER: 'm445439164-sketch',
  GITHUB_REPO: 'lighting-archive',
  GITHUB_BRANCH: 'main',
  GITHUB_PATH: 'sync-data.json',

  _getToken() {
    return localStorage.getItem('github_token') || '';
  },

  _setCloudStatus(msg, type) {
    const el = this.$('cloudStatus');
    el.textContent = msg;
    el.className = 'cloud-status show ' + (type || 'info');
  },

  async _openCloudSync() {
    // Load saved token into input
    const savedToken = this._getToken();
    if (savedToken) this.$('githubToken').value = savedToken;
    // Show confirmation that token is loaded
    if (savedToken) {
      this.$('cloudStatus').textContent = 'Token 已配置';
      this.$('cloudStatus').className = 'cloud-status show success';
      setTimeout(() => document.getElementById('cloudStatus').classList.remove('show'), 3000);
    }

    // Update sync info
    const lastUpload = localStorage.getItem('cloud_last_upload');
    const lastDownload = localStorage.getItem('cloud_last_download');
    this.$('cloudLastUpload').textContent = lastUpload || '从未';
    this.$('cloudLastDownload').textContent = lastDownload || '从未';

    this.$('cloudStatus').className = 'cloud-status';
    this._openModal('cloudModal');
  },

  async _githubApi(method, endpoint, body) {
    const token = this._getToken();
    if (!token) throw new Error('请先配置 GitHub Token');

    const url = `https://api.github.com/repos/${this.GITHUB_OWNER}/${this.GITHUB_REPO}${endpoint}`;
    const headers = {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github.v3+json'
    };
    if (body) headers['Content-Type'] = 'application/json';

    // Remove null/undefined values (GitHub API rejects them)
    if (body) {
      Object.keys(body).forEach(k => { if (body[k] == null) delete body[k]; });
    }

    const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
    return data;
  },

  async _uploadToCloud() {
    this._setCloudStatus('正在准备数据...', 'info');
    try {
      // Export all data
      const exportData = await store.exportAll();
      const jsonStr = JSON.stringify(exportData, null, 2);
      const base64Content = btoa(unescape(encodeURIComponent(jsonStr)));

      this._setCloudStatus('正在上传到 GitHub...', 'info');

      // Check if file already exists to get SHA
      let sha = null;
      try {
        const existing = await this._githubApi('GET', `/contents/${this.GITHUB_PATH}?ref=${this.GITHUB_BRANCH}`);
        sha = existing.sha;
      } catch (e) {
        // File doesn't exist yet, will create new
      }

      // Create or update file
      await this._githubApi('PUT', `/contents/${this.GITHUB_PATH}`, {
        message: `sync: 数据同步 ${new Date().toLocaleString('zh-CN')}`,
        content: base64Content,
        sha: sha,
        if (sha) bodyData.sha = sha;
        branch: this.GITHUB_BRANCH
      });

      // Update status
      const now = new Date().toLocaleString('zh-CN');
      localStorage.setItem('cloud_last_upload', now);
      this.$('cloudLastUpload').textContent = now;
      this._setCloudStatus('✓ 上传成功！云端数据已更新', 'success');

      // Also save to local as backup reference
      localStorage.setItem('cloud_data_hash', btoa(jsonStr.substring(0, 100)));
    } catch (e) {
      this._setCloudStatus('✗ 上传失败：' + e.message, 'error');
    }
  },

  async _downloadFromCloud() {
    this._setCloudStatus('正在从云端下载...', 'info');
    try {
      const token = this._getToken();

      // Fetch from raw GitHub
      const rawUrl = `https://raw.githubusercontent.com/${this.GITHUB_OWNER}/${this.GITHUB_REPO}/${this.GITHUB_BRANCH}/${this.GITHUB_PATH}`;
      const headers = token ? { 'Authorization': `token ${token}` } : {};
      const res = await fetch(rawUrl, { headers });

      if (!res.ok) {
        if (res.status === 404) throw new Error('云端暂无数据，请先上传');
        throw new Error(`下载失败 (HTTP ${res.status})`);
      }

      const backupData = await res.json();

      if (!backupData.version || !backupData.data) {
        throw new Error('云端数据格式无效');
      }

      // Confirm restore
      if (!confirm('将用云端数据替换当前本地数据，确定继续吗？')) return;

      this._setCloudStatus('正在恢复数据...', 'info');

      await store.importAll(backupData);

      // Update status
      const now = new Date().toLocaleString('zh-CN');
      localStorage.setItem('cloud_last_download', now);
      this.$('cloudLastDownload').textContent = now;
      this._setCloudStatus('✓ 下载成功！数据已恢复到本地', 'success');

      // Refresh UI
      this._closeModal('cloudModal');
      await this._renderAll();
      if (this.currentView !== 'brands') this.navigateTo('brands');

    } catch (e) {
      this._setCloudStatus('✗ ' + e.message, 'error');
    }
  },

  _autoSyncTimer: null,

  async _autoSync() {
    const token = this._getToken();
    if (!token) return;

    // Debounce: wait 3s after last change
    if (this._autoSyncTimer) clearTimeout(this._autoSyncTimer);
    this._autoSyncTimer = setTimeout(async () => {
      try {
        const exportData = await store.exportAll();
        if (!exportData.data.brands.length && !exportData.data.sessions.length && !exportData.data.assets.length) return;
        
        const jsonStr = JSON.stringify(exportData, null, 2);
        const base64Content = btoa(unescape(encodeURIComponent(jsonStr)));

        let sha = null;
        try {
          const existing = await this._githubApi('GET', `/contents/${this.GITHUB_PATH}?ref=${this.GITHUB_BRANCH}`);
          sha = existing.sha;
        } catch (e) {}

        await this._githubApi('PUT', `/contents/${this.GITHUB_PATH}`, {
          message: `sync: 数据同步 ${new Date().toLocaleString('zh-CN')}`,
          content: base64Content,
          sha: sha,
          branch: this.GITHUB_BRANCH
        });

        localStorage.setItem('cloud_last_upload', new Date().toLocaleString('zh-CN'));
      } catch (e) {
        console.warn('Auto-sync failed:', e.message);
      }
    }, 3000);
  },

  async _checkCloudData() {
    try {
      const token = this._getToken();
      const rawUrl = `https://raw.githubusercontent.com/${this.GITHUB_OWNER}/${this.GITHUB_REPO}/${this.GITHUB_BRANCH}/${this.GITHUB_PATH}`;
      const headers = token ? { 'Authorization': `token ${token}` } : {};
      const res = await fetch(rawUrl, { headers });
      if (!res.ok) return;

      const backupData = await res.json();
      if (!backupData.version || !backupData.data) return;
      if (!backupData.data.brands || backupData.data.brands.length === 0) return;

      // Check if local data is empty vs cloud has data
      const localBrands = await store.getAllBrands();
      if (localBrands.length > 0) return;

      if (confirm('检测到云端有共享数据，是否加载到本地？')) {
        await store.importAll(backupData);
        await this._renderAll();
        if (this.currentView !== 'brands') this.navigateTo('brands');
      }
    } catch (e) {
      // Silently fail - first time users won't have cloud data
    }
  },

  _formatDate(dateStr) {
    const d = new Date(dateStr);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y} 年 ${m} 月 ${day} 日`;
  }
};

/* --- Boot --- */
document.addEventListener('DOMContentLoaded', () => app.init());
