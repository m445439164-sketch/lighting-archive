/* ========================================
   App — Main Application Logic
   ======================================== */

const app = {
  currentView: 'brands',
  currentBrandId: null,
  currentSessionId: null,
  currentFilter: 'all',
  pendingUploadFiles: [],
  _coverAssets: [],
  _coverAssetsLoaded: false,
  
  /* --- Initialization --- */
  
  async init() {
    await store.init();
    this._bindUI();
    await this._renderAll();
    // 直接导航到首页，确保只显示分类卡片
    this.navigateTo('home');
    if (!localStorage.getItem('oss_ak_id')) localStorage.setItem('oss_ak_id', atob('TFRBSTV0NmR1R0hFWEYyVzRBV2FyZXpy'));
    if (!localStorage.getItem('oss_ak_secret')) localStorage.setItem('oss_ak_secret', atob('N0hvU1ZRb0JZYW9yRk5nRVRIdmxuM1ZXU1RxZkNR'));
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
    this.$('ossAkId').addEventListener('input', (e) => { localStorage.setItem('oss_ak_id', e.target.value.trim()); });
    this.$('ossAkSecret').addEventListener('input', (e) => { localStorage.setItem('oss_ak_secret', e.target.value.trim()); });
    this.$('githubToken').addEventListener('input', (e) => {
      localStorage.setItem('github_token', e.target.value.trim());
      this._setCloudStatus('Token 已保存', 'success');
      setTimeout(() => document.getElementById('cloudStatus').classList.remove('show'), 2000);
    });
    
    // Sidebar
    this.$('sidebarToggle').addEventListener('click', () => this._toggleSidebar());
    this.$('sidebarClose').addEventListener('click', () => this._toggleSidebar());
    this.$('sidebarOverlay').addEventListener('click', () => this._toggleSidebar());
    
    // Brand detail
    if (this.$('btnBackHome')) this.$('btnBackHome').addEventListener('click', () => this.navigateTo('home'));
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
    this.$('compressToggle').addEventListener('change', (e) => {
      const s = this.$('qualitySlider');
      if (s) s.disabled = !e.target.checked;
    });
    this.$('qualitySlider').addEventListener('input', (e) => {
      const l = this.$('qualityLabel');
      if (l) l.textContent = e.target.value + '%';
    });
    
    // Filter tabs (delegated)
    this.$('sessionAssets').addEventListener('click', (e) => {
      const tab = e.target.closest('.filter-tab');
      if (tab) {
        this._setFilter(tab.dataset.filter);
      }
    });
    
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
    this.$('btnSelectCover').addEventListener('click', () => this._openCoverSelector());
    
    // Category tabs navigation
    this.$('categoryTabs').addEventListener('click', (e) => {
      const tab = e.target.closest('.category-tab');
      if (tab && tab.dataset.category) {
        this.navigateTo('category', tab.dataset.category, this.currentBrandId);
      }
    });
    
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
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal-overlay.open').forEach(el => {
          el.classList.remove('open');
        });
      }
    });
    
    // Lightbox prev/next navigation
    this.$('lightboxPrev').addEventListener('click', () => this._showLightboxImage(-1));
    this.$('lightboxNext').addEventListener('click', () => this._showLightboxImage(1));
    
    // Lightbox keyboard: left/right arrows
    document.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') this._showLightboxImage(-1);
      if (e.key === 'ArrowRight') this._showLightboxImage(1);
    });
    
    // Lightbox mobile: swipe down to close
    let lboxTouchStartY = 0;
    const lboxImg = this.$('lightboxImg');
    if (lboxImg) {
      lboxImg.addEventListener('touchstart', (e) => {
        lboxTouchStartY = e.touches[0].clientY;
      }, { passive: true });
      lboxImg.addEventListener('touchend', (e) => {
        const dy = e.changedTouches[0].clientY - lboxTouchStartY;
        if (dy > 80) this._closeModal('lightbox');
      });
    }
  },
  
  /* --- Navigation --- */
  
  _updateCategoryTabs(category) {
    const tabs = this.$('categoryTabs');
    if (!tabs) return;
    tabs.classList.remove('hidden');
    tabs.querySelectorAll('.category-tab').forEach(t => t.classList.remove('active'));
    if (category) {
      const activeTab = tabs.querySelector('.category-tab[data-category="' + category + '"]');
      if (activeTab) activeTab.classList.add('active');
    }
  },
  
  navigateTo(view, param1, param2) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    this.currentCategory = null;
    const mainContent = this.$('mainContent');
    // 显示或隐藏侧边栏
    const sidebar = this.$('sidebar');
    
    switch (view) {
      case 'home':
        this.currentView = 'home';
        this.currentBrandId = null;
        this.currentSessionId = null;
        this.currentCategory = null;
        this.$('viewCategories').classList.add('active');
        this._renderCategories();
        // 首页隐藏侧边栏
        if (sidebar) sidebar.classList.add('hidden');
        if (mainContent) mainContent.classList.add('no-sidebar');
        this.$('categoryTabs').classList.add('hidden');
        break;
        
      case 'brands':
        this.currentView = 'brands';
        this.currentBrandId = null;
        this.currentSessionId = null;
        this.currentCategory = 'model';
        this._updateCategoryTabs('model');
        this.$('viewBrands').classList.add('active');
        this._renderBrandGrid('model');
        this._updateSidebar();
        if (sidebar) sidebar.classList.remove('hidden');
        if (mainContent) mainContent.classList.remove('no-sidebar');
        break;
        
      case 'category':
        this.currentView = 'category';
        this.currentCategory = param1;
        this.currentBrandId = null;
        this.currentSessionId = null;
        this._updateCategoryTabs(param1);
        this.$('viewBrands').classList.add('active');
        this._renderBrandGrid(param1);
        this._updateSidebar();
        if (sidebar) sidebar.classList.remove('hidden');
        if (mainContent) mainContent.classList.remove('no-sidebar');
        break;
        
      case 'brandDetail':
        this.currentView = 'brandDetail';
        this.currentBrandId = param1;
        this.currentSessionId = null;
        this.$('viewBrandDetail').classList.add('active');
        this._renderBrandDetail(param1);
        this._updateSidebar();
        if (sidebar) sidebar.classList.remove('hidden');
        if (mainContent) mainContent.classList.remove('no-sidebar');
        store.getBrand(param1).then(brand => {
          this._updateCategoryTabs(brand ? brand.category : null);
        });
        break;
        
      case 'sessionDetail':
        this.currentView = 'sessionDetail';
        this.currentBrandId = param1;
        this.currentSessionId = param2;
        this.$('viewSessionDetail').classList.add('active');
        this._renderSessionDetail(param2);
        this._updateSidebar();
        if (sidebar) sidebar.classList.remove('hidden');
        if (mainContent) mainContent.classList.remove('no-sidebar');
        store.getBrand(param1).then(brand => {
          this._updateCategoryTabs(brand ? brand.category : null);
        });
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
    try {
    await this._updateSidebar();
    await this._renderBrandGrid();
    await this._renderCategories();
    } catch(e) {
      console.error('_renderAll error:', e);
      try { await this._renderCategories(); } catch(e2) {}
    }
  },
  
  async _updateSidebar() {
    const list = this.$('sidebarBrandList');
    const allBrands = await store.getAllBrands();
    const brands = this.currentCategory ? allBrands.filter(b => b.category === this.currentCategory) : allBrands;
    
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
  
  async _renderCategories() {
    const brands = await store.getAllBrands();
    const cats = [
      { id: 'model', name: '\u6a21\u7279\u56fe', icon: '\ud83d\udcf7', count: brands.filter(b => b.category === 'model').length },
      { id: 'still-life', name: '\u9759\u7269\u56fe', icon: '\ud83d\udcf8', count: brands.filter(b => b.category === 'still-life').length },
      { id: 'video', name: '\u89c6\u9891', icon: '\ud83c\udfac', count: brands.filter(b => b.category === 'video').length }
    ];
    const grid = this.$('categoryGrid');
    grid.innerHTML = cats.map(c => '<div class="category-card" data-category="' + c.id + '"><div class="category-card-icon">' + c.icon + '</div><div class="category-card-name">' + c.name + '</div><div class="category-card-count">' + c.count + ' \u4e2a\u54c1\u724c</div></div>').join('');
    grid.querySelectorAll('.category-card').forEach(card => {
      card.addEventListener('click', () => this.navigateTo('category', card.dataset.category));
    });
  },

  async _renderBrandGrid(category) {
    const grid = this.$('brandGrid');
    let brands = await store.getAllBrands();
    if (category) {
      brands = brands.filter(b => b.category === category);
    }
    
    // Get session counts for each brand
    const counts = {};
    for (const b of brands) {
      const sessions = await store.getSessionsByBrand(b.id);
      counts[b.id] = sessions.length;
    }
    
    // Show back button if viewing a category
    const backBtn = this.$('btnBackHome');
    if (backBtn) {
      if (category) { backBtn.classList.remove('hidden'); }
      else { backBtn.classList.add('hidden'); }
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
    
    grid.innerHTML = brands.sort((a, b) => { const ao = a.sortOrder || a.createdAt; const bo = b.sortOrder || b.createdAt; return bo - ao; }).map(b => `
      <div class="brand-card" data-brand-id="${b.id}" draggable="true">
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
          <span class="drag-handle" title="拖动排序">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="5" r="1.5"/><circle cx="15" cy="5" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="19" r="1.5"/><circle cx="15" cy="19" r="1.5"/></svg>
          </span>
          <button class="btn-icon btn-sm card-move-up" data-brand-id="${b.id}" title="上移" style="width:28px;height:28px">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="18 15 12 9 6 15"/></svg>
          </button>
          <button class="btn-icon btn-sm card-move-down" data-brand-id="${b.id}" title="下移" style="width:28px;height:28px">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
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
    // Brand drag & drop reorder
    grid.querySelectorAll('.brand-card').forEach(card => {
      card.addEventListener('dragstart', () => {
        this._draggedBrandId = card.dataset.brandId;
        card.classList.add('dragging');
      });
      card.addEventListener('dragend', () => {
        card.classList.remove('dragging');
        grid.querySelectorAll('.brand-card').forEach(c => c.classList.remove('drag-over'));
        this._draggedBrandId = null;
      });
    });
    grid.addEventListener('dragover', (e) => {
      e.preventDefault();
      const card = e.target.closest('.brand-card');
      if (card) card.classList.add('drag-over');
    });
    grid.addEventListener('dragleave', (e) => {
      const card = e.target.closest('.brand-card');
      if (card) card.classList.remove('drag-over');
    });
    grid.addEventListener('drop', (e) => {
      e.preventDefault();
      const targetCard = e.target.closest('.brand-card');
      if (!targetCard) return;
      targetCard.classList.remove('drag-over');
      const draggedId = this._draggedBrandId;
      const targetId = targetCard.dataset.brandId;
      if (draggedId && targetId && draggedId !== targetId) this._reorderBrands(draggedId, targetId);
      this._draggedBrandId = null;
    });
    // Up/Down buttons
    grid.querySelectorAll('.card-move-up').forEach(btn => {
      btn.addEventListener('click', (e) => { e.stopPropagation(); this._moveBrandUp(btn.dataset.brandId); });
    });
    grid.querySelectorAll('.card-move-down').forEach(btn => {
      btn.addEventListener('click', (e) => { e.stopPropagation(); this._moveBrandDown(btn.dataset.brandId); });
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
      const ao = a.sortOrder || a.createdAt;
      const bo = b.sortOrder || b.createdAt;
      return bo - ao;
    });
    
    // Get up to 4 thumbnails per session
    const thumbData = {};
    for (const s of sessions) {
      const assets = await store.getAssetsBySession(s.id);
      thumbData[s.id] = assets.slice(0, 8);
    }
    
    list.innerHTML = sessions.map(s => {
      const thumbs = thumbData[s.id] || [];
      let thumbHtml = thumbs.slice(0, 6).map(a => 
        `<img class="session-card-thumb" src="${a.qiniuUrl || a.dataUrl || ''}" alt="">`
      ).join('');
      if (thumbs.length > 6) {
        thumbHtml += `<div class="session-card-thumb-more">+${thumbs.length - 6}</div>`;
      }
      
      return `
        <div class="session-card" data-session-id="${s.id}" draggable="true">
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
              <span class="drag-handle" title="拖动排序">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="5" r="1.5"/><circle cx="15" cy="5" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="19" r="1.5"/><circle cx="15" cy="19" r="1.5"/></svg>
              </span>
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
    // Drag & drop reorder (store draggedId globally for cross-browser)
    list.querySelectorAll('.session-card').forEach(card => {
      card.addEventListener('dragstart', () => {
        this._draggedId = card.dataset.sessionId;
        card.classList.add('dragging');
      });
      card.addEventListener('dragend', () => {
        card.classList.remove('dragging');
        list.querySelectorAll('.session-card').forEach(c => c.classList.remove('drag-over'));
        this._draggedId = null;
      });
    });
    list.addEventListener('dragover', (e) => {
      e.preventDefault();
      const card = e.target.closest('.session-card');
      if (card) card.classList.add('drag-over');
    });
    list.addEventListener('dragleave', (e) => {
      const card = e.target.closest('.session-card');
      if (card) card.classList.remove('drag-over');
    });
    list.addEventListener('drop', (e) => {
      e.preventDefault();
      const targetCard = e.target.closest('.session-card');
      if (!targetCard) return;
      targetCard.classList.remove('drag-over');
      const draggedId = this._draggedId;
      const targetId = targetCard.dataset.sessionId;
      if (draggedId && targetId && draggedId !== targetId) this._reorderSessions(draggedId, targetId);
      this._draggedId = null;
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
    assets.sort((a, b) => (b.sortOrder || b.createdAt) - (a.sortOrder || a.createdAt));
    
    if (assets.length === 0) {
      grid.innerHTML = `<div class="empty-state">
        <h3>${filter === 'all' ? '还没有图片' : filter === 'photo' ? '还没有成片' : '还没有灯位图'}</h3>
        <p>点击「上传」添加图片</p>
      </div>`;
      return;
    }
    
    grid.innerHTML = assets.map(a => `
      <div class="asset-item" data-asset-id="${a.id}" draggable="true">
        <span class="asset-drag-handle" title="拖动排序">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="5" r="1.5"/><circle cx="15" cy="5" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="19" r="1.5"/><circle cx="15" cy="19" r="1.5"/></svg>
        </span>
        <span class="asset-badge ${a.type}">${a.type === 'photo' ? '成片' : '灯位图'}</span>
        <button class="asset-delete-btn asset-delete" data-asset-id="${a.id}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
        <img src="${a.qiniuUrl || a.dataUrl || ''}" alt="${this._esc(a.caption || '')}" loading="lazy">
        ${a.caption ? `<div class="asset-caption">${this._esc(a.caption)}</div>` : ''}
      </div>
    `).join('');
    
    // Lightbox click
    grid.querySelectorAll('.asset-item').forEach(item => {
      item.addEventListener('click', (e) => {
        if (e.target.closest('.asset-delete')) return;
        const asset = assets.find(a => a.id === item.dataset.assetId);
        if (asset) this._openLightbox(asset, assets, assets.indexOf(asset));
      });
    });
    
    // Delete buttons
    grid.querySelectorAll('.asset-delete').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this._confirmDeleteAsset(btn.dataset.assetId);
      });
    });
    
    // Drag & drop reorder
    grid.querySelectorAll('.asset-item').forEach(item => {
      item.addEventListener('dragstart', () => {
        this._draggedAssetId = item.dataset.assetId;
        item.classList.add('dragging');
      });
      item.addEventListener('dragend', () => {
        item.classList.remove('dragging');
        grid.querySelectorAll('.asset-item').forEach(c => c.classList.remove('drag-over'));
        this._draggedAssetId = null;
      });
    });
    grid.addEventListener('dragover', (e) => {
      e.preventDefault();
      const card = e.target.closest('.asset-item');
      if (card) card.classList.add('drag-over');
    });
    grid.addEventListener('dragleave', (e) => {
      const card = e.target.closest('.asset-item');
      if (card) card.classList.remove('drag-over');
    });
    grid.addEventListener('drop', (e) => {
      e.preventDefault();
      const targetCard = e.target.closest('.asset-item');
      if (!targetCard) return;
      targetCard.classList.remove('drag-over');
      const draggedId = this._draggedAssetId;
      const targetId = targetCard.dataset.assetId;
      if (draggedId && targetId && draggedId !== targetId) this._reorderAssets(draggedId, targetId);
      this._draggedAssetId = null;
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
  
  async _loadCoverAssets(brandId) {
    this._coverAssets = [];
    const sessions = await store.getSessionsByBrand(brandId);
    for (const s of sessions) {
      const assets = await store.getAssetsBySession(s.id);
      this._coverAssets.push(...assets);
    }
  },

  async _openCoverSelector() {
    try {
    const grid = this.$('coverSelectGrid');
    if (this._coverAssets.length === 0) {
      grid.innerHTML = '<div class="cover-select-empty">暂无已上传的图片，请先上传一些图片</div>';
    } else {
      grid.innerHTML = this._coverAssets.map(a => {
        const src = a.qiniuUrl || a.dataUrl || '';
        return '<div class="cover-select-item" data-asset-id="' + a.id + '"><img src="' + src + '" alt="" loading="lazy"></div>';
      }).join('');
      grid.querySelectorAll('.cover-select-item').forEach(el => {
        el.addEventListener('click', () => {
          const asset = this._coverAssets.find(a => a.id === el.dataset.assetId);
          if (asset) this._selectCover(asset);
        });
      });
    }
    this._openModal('coverSelectModal');
    } catch (e) { console.warn(e); }
  },

  _selectCover(asset) {
    const src = asset.qiniuUrl || asset.dataUrl || '';
    if (!src) return;
    this._brandCoverData = src;
    this.$('brandCoverPlaceholder').classList.add('hidden');
    this.$('brandCoverPreview').src = src;
    this.$('brandCoverPreview').classList.remove('hidden');
    this.$('brandCoverRemove').classList.remove('hidden');
    this._closeModal('coverSelectModal');
  },

  async showBrandForm(brandId) {
    this.$('brandFormId').value = '';
    this.$('brandName').value = '';
    this.$('brandDesc').value = '';
    this.$('brandCategory').value = 'model';
    this.$('brandCoverPlaceholder').classList.remove('hidden');
    this.$('brandCoverPreview').classList.add('hidden');
    this.$('brandCoverPreview').src = '';
    this.$('brandCoverRemove').classList.add('hidden');
    this._brandCoverData = null;
    
    if (brandId) {
      this.$('brandFormTitle').textContent = '编辑品牌';
      await this._loadBrandForEdit(brandId);
      await this._loadCoverAssets(brandId);
    } else {
      this.$('brandFormTitle').textContent = '新建品牌';
      this._coverAssets = [];
    }
    
    this._openModal('brandFormModal');
  },
  
  async _loadBrandForEdit(brandId) {
    const brand = await store.getBrand(brandId);
    if (!brand) return;
    
    this.$('brandFormId').value = brand.id;
    this.$('brandName').value = brand.name;
    this.$('brandDesc').value = brand.description || '';
    this.$('brandCategory').value = brand.category || 'model';
    
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
      category: this.$('brandCategory').value,
      cover: this._brandCoverData || null,
      sortOrder: existing ? existing.sortOrder : Date.now(),
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
      sortOrder: existing ? existing.sortOrder : Date.now(),
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
      const compressedFile = await this._compressImage(file);
      let ossUrl = '';
      let dataUrl = '';
      
      try {
        ossUrl = await this._uploadToOSS(compressedFile);
      } catch(e) {
        alert('上传到云端失败：' + e.message);
        dataUrl = await this._fileToDataUrl(compressedFile);
      }
      
      const asset = {
        id: store.generateId(),
        sessionId,
        type,
        dataUrl: dataUrl,
        qiniuUrl: ossUrl,
        caption: file.name.replace(/\.[^.]+$/, ''),
        sortOrder: Date.now(),
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
  
  
  _openLightbox(asset, assets, index) {
    this._lightboxAssets = assets || [];
    this._lightboxIndex = index || 0;
    this.$('lightboxImg').src = asset.qiniuUrl || asset.dataUrl || '';
    const typeLabel = asset.type === 'photo' ? '成片' : '灯位图';
    this.$('lightboxLabel').textContent = `${typeLabel}${asset.caption ? ' · ' + asset.caption : ''}`;
    this._updateLightboxCounter();
    this._openModal('lightbox');
  },
  
  _updateLightboxCounter() {
    const total = (this._lightboxAssets || []).length;
    const idx = total > 0 ? (this._lightboxIndex + 1) : 0;
    this.$('lightboxCounter').textContent = total > 0 ? `${idx} / ${total}` : '';
  },
  
  _showLightboxImage(dir) {
    const total = (this._lightboxAssets || []).length;
    if (total === 0) return;
    this._lightboxIndex = (this._lightboxIndex + dir + total) % total;
    const asset = this._lightboxAssets[this._lightboxIndex];
    this.$('lightboxImg').src = asset.qiniuUrl || asset.dataUrl || '';
    const typeLabel = asset.type === 'photo' ? '成片' : '灯位图';
    this.$('lightboxLabel').textContent = `${typeLabel}${asset.caption ? ' · ' + asset.caption : ''}`;
    this._updateLightboxCounter();
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
  async _moveBrandUp(id) {
    const allBrands = await store.getAllBrands();
    const brands = this.currentCategory ? allBrands.filter(b => b.category === this.currentCategory) : allBrands;
    brands.sort((a, b) => (b.sortOrder || b.createdAt) - (a.sortOrder || a.createdAt));
    const idx = brands.findIndex(b => b.id === id);
    if (idx <= 0) return;
    [brands[idx-1], brands[idx]] = [brands[idx], brands[idx-1]];
    for (let i = 0; i < brands.length; i++) { brands[i].sortOrder = (brands.length - i) * 1000; await store.saveBrand(brands[i]); }
    await this._renderBrandGrid(this.currentCategory);
  },
  async _moveBrandDown(id) {
    const allBrands = await store.getAllBrands();
    const brands = this.currentCategory ? allBrands.filter(b => b.category === this.currentCategory) : allBrands;
    brands.sort((a, b) => (b.sortOrder || b.createdAt) - (a.sortOrder || a.createdAt));
    const idx = brands.findIndex(b => b.id === id);
    if (idx < 0 || idx >= brands.length - 1) return;
    [brands[idx], brands[idx+1]] = [brands[idx+1], brands[idx]];
    for (let i = 0; i < brands.length; i++) { brands[i].sortOrder = (brands.length - i) * 1000; await store.saveBrand(brands[i]); }
    await this._renderBrandGrid(this.currentCategory);
  },
  async _reorderBrands(draggedId, targetId) {
    const allBrands = await store.getAllBrands();
    const brands = this.currentCategory ? allBrands.filter(b => b.category === this.currentCategory) : allBrands;
    brands.sort((a, b) => (b.sortOrder || b.createdAt) - (a.sortOrder || a.createdAt));
    const draggedIdx = brands.findIndex(b => b.id === draggedId);
    const targetIdx = brands.findIndex(b => b.id === targetId);
    if (draggedIdx < 0 || targetIdx < 0) return;
    const [moved] = brands.splice(draggedIdx, 1);
    brands.splice(targetIdx, 0, moved);
    for (let i = 0; i < brands.length; i++) { brands[i].sortOrder = (brands.length - i) * 1000; await store.saveBrand(brands[i]); }
    await this._renderBrandGrid(this.currentCategory);
  },
  async _reorderSessions(draggedId, targetId) {
    const sessions = await store.getSessionsByBrand(this.currentBrandId);
    sessions.sort((a, b) => (b.sortOrder || b.createdAt) - (a.sortOrder || a.createdAt));
    const draggedIdx = sessions.findIndex(s => s.id === draggedId);
    const targetIdx = sessions.findIndex(s => s.id === targetId);
    if (draggedIdx < 0 || targetIdx < 0) return;
    const [moved] = sessions.splice(draggedIdx, 1);
    sessions.splice(targetIdx, 0, moved);
    for (let i = 0; i < sessions.length; i++) { sessions[i].sortOrder = (sessions.length - i) * 1000; await store.saveSession(sessions[i]); }
    await this._renderBrandDetail(this.currentBrandId);
  },
  async _reorderAssets(draggedId, targetId) {
    const assets = await store.getAssetsBySession(this.currentSessionId);
    assets.sort((a, b) => (b.sortOrder || b.createdAt) - (a.sortOrder || a.createdAt));
    const draggedIdx = assets.findIndex(a => a.id === draggedId);
    const targetIdx = assets.findIndex(a => a.id === targetId);
    if (draggedIdx < 0 || targetIdx < 0) return;
    const [moved] = assets.splice(draggedIdx, 1);
    assets.splice(targetIdx, 0, moved);
    for (let i = 0; i < assets.length; i++) { assets[i].sortOrder = (assets.length - i) * 1000; await store.saveAsset(assets[i]); }
    await this._renderAssets(this.currentSessionId, this.currentFilter);
  },

  async _exportBackup() {
    const backupBtn = this.$('btnExportBackup');
    backupBtn.disabled = true;
    backupBtn.textContent = '准备中...';

    try {
      const exportData = await store.exportAll();
      // Strip image data (too large for GitHub API)
      for (const a of (exportData.data.assets || [])) delete a.dataUrl;
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
    // Load saved token
    const savedToken = this._getToken();
    if (savedToken) this.$('githubToken').value = savedToken;

    // Update sync info
    const lastUpload = localStorage.getItem('cloud_last_upload');
    const lastDownload = localStorage.getItem('cloud_last_download');
    this.$('cloudLastUpload').textContent = lastUpload || '从未';
    this.$('cloudLastDownload').textContent = lastDownload || '从未';

    this.$('cloudStatus').className = 'cloud-status';
    // Load OSS credentials
    const akIdEl = this.$('ossAkId');
    const akSecEl = this.$('ossAkSecret');
    if (akIdEl) akIdEl.value = localStorage.getItem('oss_ak_id') || '';
    if (akSecEl) akSecEl.value = localStorage.getItem('oss_ak_secret') || '';
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
    if (body) Object.keys(body).forEach(k => { if (body[k] == null) delete body[k]; });

    const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
    const data = await res.json();
    if (!res.ok) throw new Error(`[${res.status}] ${data.message || ''}`);
    return data;
  },


  async _compressImage(file) {
    const toggle = this.$('compressToggle');
    if (!toggle || !toggle.checked) return file;
    
    const quality = parseInt((this.$('qualitySlider') || { value: 80 }).value) / 100;
    const maxDim = 2048;
    
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        let w = img.width, h = img.height;
        if (w > maxDim || h > maxDim) {
          if (w > h) { w = maxDim; h = Math.round(h * maxDim / img.width); }
          else { h = maxDim; w = Math.round(w * maxDim / img.height); }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        canvas.toBlob((blob) => {
          resolve(new File([blob], file.name, { type: 'image/jpeg', lastModified: Date.now() }));
        }, 'image/jpeg', quality);
      };
      img.onerror = () => resolve(file);
      img.src = URL.createObjectURL(file);
    });
  },

  _getOSSClient() {
    let akId = localStorage.getItem('oss_ak_id');
    let akSecret = localStorage.getItem('oss_ak_secret');
    if (!akId || !akSecret) {
      akId = atob('TFRBSTV0NmR1R0hFWEYyVzRBV2FyZXpy');
      akSecret = atob('N0hvU1ZRb0JZYW9yRk5nRVRIdmxuM1ZXU1RxZkNR');
      localStorage.setItem('oss_ak_id', akId);
      localStorage.setItem('oss_ak_secret', akSecret);
    }
    return new OSS({ region: 'oss-cn-shenzhen', accessKeyId: akId, accessKeySecret: akSecret, bucket: 'lighting-photos', secure: true });
  },

  async _uploadToOSS(file) {
    const akId = localStorage.getItem('oss_ak_id');
    const akSecret = localStorage.getItem('oss_ak_secret');
    const region = localStorage.getItem('oss_region') || 'oss-cn-shenzhen';
    const bucket = localStorage.getItem('oss_bucket') || 'lighting-photos';
    if (!akId || !akSecret) throw new Error('请先在云端页面配置阿里云 OSS 密钥');
    
    const ext = file.name.split('.').pop();
    const key = 'lighting/' + Date.now() + '_' + Math.random().toString(36).substring(2, 8) + '.' + ext;
    
    const client = new OSS({
      region: region,
      accessKeyId: akId,
      accessKeySecret: akSecret,
      bucket: bucket,
      secure: true
    });
    
    const result = await client.put(key, file);
    return 'https://' + bucket + '.' + region + '.aliyuncs.com/' + encodeURIComponent(result.name);
  },

  async _uploadToCloud() {
    this._setCloudStatus('正在准备数据...', 'info');
    try {
      const exportData = await store.exportAll();
      // keep brand cover (OSS URL or base64)
      for (const a of (exportData.data.assets || [])) delete a.dataUrl;
      const jsonStr = JSON.stringify(exportData);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      this._setCloudStatus('正在上传到云端...', 'info');
      const client = this._getOSSClient();
      await client.put('lighting-archive/sync-data.json', blob);
      const now = new Date().toLocaleString('zh-CN');
      localStorage.setItem('cloud_last_upload', now);
      this.$('cloudLastUpload').textContent = now;
      this._setCloudStatus('OK 上传成功！云端数据已更新', 'success');
    } catch (e) {
      this._setCloudStatus('X 上传失败: ' + (e.message || '').substring(0, 100), 'error');
    }
  },

  async _downloadFromCloud() {
    this._setCloudStatus('\u6b63\u5728\u4ece\u4e91\u7aef\u4e0b\u8f7d...', 'info');
    try {
      // Save local covers before they get overwritten
      const localBrands = await store.getAllBrands();
      const localCovers = {};
      for (const b of localBrands) { if (b.cover) localCovers[b.id] = b.cover; }
      const localAssets = await Promise.all(localBrands.map(b => store.getSessionsByBrand(b.id).then(ss => Promise.all(ss.map(s => store.getAssetsBySession(s.id))))));
      
      const client = this._getOSSClient();
      const result = await client.get('lighting-archive/sync-data.json');
      let buf = result.content;
      if (buf instanceof Blob) buf = await buf.arrayBuffer();
      const text = new TextDecoder('utf-8').decode(buf);
      const backupData = JSON.parse(text);
      if (!backupData.version || !backupData.data) throw new Error('\u4e91\u7aef\u6570\u636e\u683c\u5f0f\u65e0\u6548');
      
      // Restore local covers if cloud data doesn't have them
      for (const brand of (backupData.data.brands || [])) {
        if (!brand.cover && localCovers[brand.id]) {
          brand.cover = localCovers[brand.id];
        }
      }
      
      if (!confirm('\u5c06\u7528\u4e91\u7aef\u6570\u636e\u66ff\u6362\u5f53\u524d\u672c\u5730\u6570\u636e\uff0c\u786e\u5b9a\u7ee7\u7eed\u5417\uff1f')) return;
      this._setCloudStatus('\u6b63\u5728\u6062\u590d\u6570\u636e...', 'info');
      await store.importAll(backupData);
      const now = new Date().toLocaleString('zh-CN');
      localStorage.setItem('cloud_last_download', now);
      this.$('cloudLastDownload').textContent = now;
      this._setCloudStatus('OK \u4e0b\u8f7d\u6210\u529f\uff01\u6570\u636e\u5df2\u6062\u590d\u5230\u672c\u5730', 'success');
      this._closeModal('cloudModal');
      await this._renderAll();
      if (this.currentView !== 'brands') this.navigateTo('brands');
    } catch (e) {
      this._setCloudStatus('X ' + e.message, 'error');
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
