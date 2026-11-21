/* ============================================================================
   BULLPEN — Interactive Pixel-Art UI Controller
   Includes Pre-Map Repository Analyzer (local folder scan, presets, live crop
   preview), Hover Tooltips, Building Inspector, Options, & The Oracle Feed.
   ============================================================================ */

(function () {
  const { AGENT_COLORS } = window.BullpenPalette;
  const Data = window.BullpenCampusData;
  const { state, tick } = window.BullpenState;
  const { CampusMapRenderer } = window.BullpenMapRenderer;
  const TraditionalView = window.BullpenTraditionalView;

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // DOM References
  const canvas = document.getElementById('campusCanvas');
  const mapStage = document.getElementById('mapStage');
  const tradViewEl = document.getElementById('traditionalView');
  const tooltipEl = document.getElementById('mapTooltip');
  const ribbonBannerEl = document.getElementById('ribbonBanner');
  const oracleListEl = document.getElementById('oracleList');
  const legendEl = document.getElementById('modelLegend');
  const rootChipEl = document.getElementById('headerRootFolder');
  const cropChipEl = document.getElementById('headerCropChip');

  // Pre-Map Repository Analyzer
  const analyzerOverlay = document.getElementById('repoAnalyzerOverlay');
  const localRepoInput = document.getElementById('localRepoInput');
  const btnPickLocalRepo = document.getElementById('btnPickLocalRepo');
  const localScanStatus = document.getElementById('localScanStatus');
  const analyzerPresetsEl = document.getElementById('analyzerPresets');
  const analyzerRootInput = document.getElementById('analyzerRootInput');
  const analyzerFoldersInput = document.getElementById('analyzerFoldersInput');
  const analyzerCountBadge = document.getElementById('analyzerCountBadge');
  const analyzerFolderChips = document.getElementById('analyzerFolderChips');
  const analyzerCropSummary = document.getElementById('analyzerCropSummary');
  const analyzerScanBarWrap = document.getElementById('analyzerScanBarWrap');
  const analyzerScanMsg = document.getElementById('analyzerScanMsg');
  const analyzerScanFill = document.getElementById('analyzerScanFill');
  const btnLaunchCampus = document.getElementById('btnLaunchCampus');
  const btnOpenAnalyzer = document.getElementById('btnOpenAnalyzer');

  // Drawer & Options Modal
  const buildingDrawerEl = document.getElementById('buildingDrawer');
  const buildingDrawerBody = document.getElementById('buildingDrawerBody');
  const optionsModalEl = document.getElementById('optionsModal');
  const optionsRootInput = document.getElementById('optionsRootInput');
  const optionsTimeLimitInput = document.getElementById('optionsTimeLimitInput');
  const optionsAddFolderInput = document.getElementById('optionsAddFolderInput');
  const btnAddFolder = document.getElementById('btnAddFolder');
  const optionsMappingsList = document.getElementById('optionsMappingsList');

  // Buttons & Controls
  const btnViewPixel = document.getElementById('btnViewPixel');
  const btnViewTrad = document.getElementById('btnViewTrad');
  const btnOpenOptions = document.getElementById('btnOpenOptions');
  const btnCloseOptions = document.getElementById('btnCloseOptions');
  const btnResetMappings = document.getElementById('btnResetMappings');
  const btnCloseDrawer = document.getElementById('btnCloseDrawer');
  const optModePixel = document.getElementById('optModePixel');
  const optModeTrad = document.getElementById('optModeTrad');

  // Preview controls
  const btnAutoDemo = document.getElementById('btnAutoDemo');
  const demoAgentSelect = document.getElementById('demoAgentSelect');
  const demoBuildingSelect = document.getElementById('demoBuildingSelect');
  const btnDispatch = document.getElementById('btnDispatch');
  const btnTestQueue = document.getElementById('btnTestQueue');
  const btnTestKickOut = document.getElementById('btnTestKickOut');
  const btnFinishActive = document.getElementById('btnFinishActive');
  const btnResetCampus = document.getElementById('btnResetCampus');

  const renderer = new CampusMapRenderer(canvas);

  // ==========================================================================
  // 0. PRE-MAP REPOSITORY ANALYZER (Runs BEFORE showing the campus map!)
  // ==========================================================================
  const IGNORED_DIRS = new Set([
    '.git', 'node_modules', '.venv', 'venv', '__pycache__', '.next', '.nuxt',
    'dist', 'build', 'out', '.idea', '.vscode', '.cache', 'coverage', '.DS_Store', 'target'
  ]);

  let selectedPresetId = 'bullpen';

  function parseFoldersText(str) {
    return String(str || '')
      .split(/[\n,;]+/)
      .map(s => Data.normalizeFolder(s))
      .filter(Boolean);
  }

  function renderAnalyzerPresets() {
    analyzerPresetsEl.innerHTML = Data.REPO_PRESETS.map(p => `
      <button type="button" class="preset-card ${selectedPresetId === p.id ? 'active' : ''}" data-preset-id="${p.id}">
        <div class="preset-title">${escapeHtml(p.label)}</div>
        <div class="preset-desc">${escapeHtml(p.desc)}</div>
      </button>
    `).join('');

    analyzerPresetsEl.querySelectorAll('[data-preset-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        const preset = Data.REPO_PRESETS.find(p => p.id === btn.dataset.presetId);
        if (!preset) return;
        selectedPresetId = preset.id;
        analyzerRootInput.value = preset.root;
        analyzerFoldersInput.value = preset.folders.join(', ');
        localScanStatus.textContent = `Loaded preset: ${preset.label}`;
        localScanStatus.classList.remove('success');
        renderAnalyzerPresets();
        updateAnalyzerPreview();
      });
    });
  }

  function updateAnalyzerPreview() {
    const folders = parseFoldersText(analyzerFoldersInput.value);
    const previewBuildings = Data.buildBuildingsForFolders(folders);
    const previewCrop = Data.computeCropRect(previewBuildings);
    const count = previewBuildings.length;
    const maxCap = Data.BUILDING_CATALOG.length;

    analyzerCountBadge.textContent = `${count} FOLDER${count === 1 ? '' : 'S'}`;

    analyzerFolderChips.innerHTML = previewBuildings.map(b => `
      <span class="analyzer-chip ${b.guarded ? 'guarded' : ''}">
        ${b.guarded ? '🛡️ ' : ''}${escapeHtml(Data.getFolderLabel(b.folder))}
      </span>
    `).join('');

    const extraNote = folders.length > maxCap
      ? ` (capped to ${maxCap} campus buildings)`
      : '';

    analyzerCropSummary.innerHTML = `
      <strong>${previewCrop.tierLabel}</strong> —
      Showing <strong>${count} building${count === 1 ? '' : 's'}</strong> inside a
      <strong>${previewCrop.w}×${previewCrop.h}</strong> cropped USF Campus viewport so all ${count} folder${count === 1 ? '' : 's'} fit cleanly on screen${extraNote}.
    `;
  }

  // Real client-side local repository directory scanner (HTML5 webkitdirectory)
  btnPickLocalRepo.addEventListener('click', () => localRepoInput.click());
  localRepoInput.addEventListener('change', (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const firstRel = files[0].webkitRelativePath || '';
    const rootName = firstRel.split('/')[0] || 'local-repo';
    const topFolders = new Set();

    files.forEach(file => {
      const parts = (file.webkitRelativePath || '').split('/');
      if (parts.length >= 3) {
        const dir = parts[1];
        if (dir && !dir.startsWith('.') && !IGNORED_DIRS.has(dir.toLowerCase())) {
          topFolders.add('/' + dir);
        }
      }
    });

    const sorted = Array.from(topFolders).sort();
    selectedPresetId = null;
    analyzerRootInput.value = rootName + '/';
    analyzerFoldersInput.value = sorted.length ? sorted.join(', ') : '/src';
    localScanStatus.textContent = sorted.length
      ? `Scanned "${rootName}/" — detected ${sorted.length} top-level folder${sorted.length === 1 ? '' : 's'}!`
      : `Scanned "${rootName}/" — no subdirectories found (defaulted to /src).`;
    localScanStatus.classList.add('success');

    renderAnalyzerPresets();
    updateAnalyzerPreview();
    localRepoInput.value = '';
  });

  analyzerFoldersInput.addEventListener('input', () => {
    selectedPresetId = null;
    renderAnalyzerPresets();
    updateAnalyzerPreview();
  });

  // Launch analysis scan animation -> dynamically crop & reveal the USF Campus!
  let isScanning = false;
  btnLaunchCampus.addEventListener('click', () => {
    if (isScanning) return;
    isScanning = true;

    const root = analyzerRootInput.value.trim() || 'bullpen/';
    const folders = parseFoldersText(analyzerFoldersInput.value);
    const previewBuildings = Data.buildBuildingsForFolders(folders);
    const previewCrop = Data.computeCropRect(previewBuildings);

    btnLaunchCampus.disabled = true;
    analyzerScanBarWrap.classList.remove('hidden');
    analyzerScanFill.style.width = '20%';
    analyzerScanMsg.textContent = `Scanning ${root} — found ${previewBuildings.length} folders...`;

    setTimeout(() => {
      analyzerScanFill.style.width = '65%';
      analyzerScanMsg.textContent = `Cropping USF Campus to ${previewCrop.tierLabel} (${previewCrop.w}x${previewCrop.h})...`;
    }, 240);

    setTimeout(() => {
      analyzerScanFill.style.width = '100%';
      analyzerScanMsg.textContent = `Mapping all ${previewBuildings.length} buildings — launching campus!`;
    }, 520);

    setTimeout(() => {
      isScanning = false;
      btnLaunchCampus.disabled = false;
      analyzerScanBarWrap.classList.add('hidden');
      analyzerScanFill.style.width = '0%';
      state.analyzeRepository(root, folders);
    }, 760);
  });

  btnOpenAnalyzer.addEventListener('click', () => {
    analyzerRootInput.value = state.rootFolder;
    analyzerFoldersInput.value = state.buildings.map(b => b.folder).join(', ');
    renderAnalyzerPresets();
    updateAnalyzerPreview();
    state.openRepoAnalyzer();
  });

  // ==========================================================================
  // 1. AGENT COLOR LEGEND (Header)
  // ==========================================================================
  function renderModelLegend() {
    legendEl.innerHTML = state.agents.map(agent => {
      const m = AGENT_COLORS[agent.modelId];
      const dotPulse = agent.state === 'working' ? 'pulsing' : '';
      const stateLabel = agent.state === 'waiting'
        ? `WAIT #${agent.queuePos || 1}`
        : agent.state.toUpperCase();
      return `
        <div class="legend-pill" title="${escapeHtml(m.displayName)} — ${escapeHtml(agent.task)}">
          <span class="legend-swatch ${dotPulse}" style="background:${m.primary};border-color:${m.secondary}"></span>
          <span class="legend-name">${escapeHtml(m.shortName)}</span>
          <span class="legend-state state-txt-${agent.state}">${escapeHtml(stateLabel)}</span>
        </div>
      `;
    }).join('');
  }

  // ==========================================================================
  // 2. CANVAS HOVER TOOLTIP & CLICK INSPECTOR
  // ==========================================================================
  let lastPointer = { x: 0, y: 0 };

  canvas.addEventListener('mousemove', (e) => {
    if (!state.repoAnalyzed) return;
    const world = renderer.clientToWorld(e.clientX, e.clientY);
    const hit = renderer.hitTestBuilding(state.buildings, world.x, world.y);
    lastPointer = { x: e.clientX, y: e.clientY };

    if (hit) {
      canvas.style.cursor = 'pointer';
      state.setHoveredBuilding(hit.id);
      showTooltip(hit, e.clientX, e.clientY);
    } else {
      canvas.style.cursor = 'default';
      state.setHoveredBuilding(null);
      tooltipEl.classList.add('hidden');
    }
  });

  canvas.addEventListener('mouseleave', () => {
    state.setHoveredBuilding(null);
    tooltipEl.classList.add('hidden');
  });

  canvas.addEventListener('click', (e) => {
    if (!state.repoAnalyzed) return;
    const world = renderer.clientToWorld(e.clientX, e.clientY);
    const hit = renderer.hitTestBuilding(state.buildings, world.x, world.y);
    if (hit) {
      state.selectBuilding(hit.id);
    }
  });

  function showTooltip(b, clientX, clientY) {
    const status = state.getBuildingStatus(b.id);
    const active = state.getActiveAgentOnBuilding(b.id);
    const waiters = state.getWaitingAgentsOnBuilding(b.id);

    const statusText = {
      idle:    'IDLE — READY',
      working: '🚧 UNDER CONSTRUCTION',
      kickout: '🥾 AGENT KICKED OUT!',
      ribbon:  '✂️ RIBBON CUTTING!',
    }[status];

    let activeHtml = '';
    if (active) {
      const m = AGENT_COLORS[active.modelId];
      const pct = Math.round(active.workProgress * 100);
      const rem = Math.max(0, Math.ceil(state.timeLimitSec - (active.workElapsed || 0)));
      activeHtml += `
        <div class="tt-agent">
          <span class="model-swatch" style="background:${m.primary}"></span>
          <span>${escapeHtml(m.shortName)} working (${pct}% • ${rem}s left)</span>
        </div>
      `;
    }
    if (waiters.length) {
      const names = waiters.map(w => w.shortLabel).join(', ');
      activeHtml += `<div class="tt-agent">⏳ Waiting at door: ${escapeHtml(names)}</div>`;
    }

    const folderTag = Data.getFolderLabel(b.folder);
    tooltipEl.innerHTML = `
      <div class="tt-head">
        <span class="tt-code">${escapeHtml(folderTag)}</span>
        <span class="tt-name">${escapeHtml(b.name)}</span>
      </div>
      <div class="tt-folder">
        <span class="tt-folder-label">FOLDER:</span>
        <code>${escapeHtml(state.rootFolder)}${escapeHtml(b.folder.replace(/^\//, ''))}</code>
        ${b.guarded ? '<span class="tt-guard">🛡️ GUARDED</span>' : ''}
      </div>
      <div class="tt-status status-${status}">${statusText}</div>
      ${activeHtml}
      <div class="tt-hint">Click building to inspect agent changes &amp; summary</div>
    `;

    tooltipEl.classList.remove('hidden');

    const pad = 16;
    const tw = tooltipEl.offsetWidth || 260;
    const th = tooltipEl.offsetHeight || 110;
    let left = clientX + pad;
    let top = clientY - th - 10;
    if (left + tw > window.innerWidth - 12) left = clientX - tw - pad;
    if (top < 12) top = clientY + pad;
    tooltipEl.style.left = `${Math.max(8, left)}px`;
    tooltipEl.style.top = `${Math.max(8, top)}px`;
  }

  // ==========================================================================
  // 3. BUILDING INSPECTOR DRAWER
  // ==========================================================================
  function renderBuildingDrawer() {
    if (!state.selectedBuildingId || !state.repoAnalyzed) {
      buildingDrawerEl.classList.add('hidden');
      return;
    }
    const b = state.getBuilding(state.selectedBuildingId);
    if (!b) {
      buildingDrawerEl.classList.add('hidden');
      return;
    }

    const active = state.getActiveAgentOnBuilding(b.id);
    const waiters = state.getWaitingAgentsOnBuilding(b.id);

    let activeBlock = '';
    if (active) {
      const m = AGENT_COLORS[active.modelId];
      const pct = Math.round(active.workProgress * 100);
      const rem = Math.max(0, Math.ceil(state.timeLimitSec - (active.workElapsed || 0)));
      activeBlock = `
        <div class="drawer-active-card" style="border-color:${m.primary}">
          <div class="drawer-active-top">
            <span class="model-swatch" style="background:${m.primary}"></span>
            <strong>${escapeHtml(active.name)} IS BUILDING HERE</strong>
            <span>${pct}% • ⏱ ${rem}s</span>
          </div>
          <div class="drawer-active-task">${escapeHtml(active.task)}</div>
          <div class="drawer-progress-track">
            <div class="drawer-progress-bar" style="width:${pct}%;background:${m.primary}"></div>
          </div>
        </div>
      `;
    }

    let queueBlock = '';
    if (waiters.length) {
      queueBlock = `
        <div class="drawer-queue-box">
          <div class="drawer-section-label">⏳ WAITING OUTSIDE DOOR (${waiters.length})</div>
          ${waiters.map(w => {
            const m = AGENT_COLORS[w.modelId];
            return `
              <div class="drawer-queue-item">
                <span class="model-swatch" style="background:${m.primary}"></span>
                <strong>#${w.queuePos} ${escapeHtml(w.name)}</strong>
                <span class="muted">— ${escapeHtml(w.task)}</span>
              </div>
            `;
          }).join('')}
        </div>
      `;
    }

    const changesHtml = b.changes.length
      ? b.changes.map(c => {
          const m = AGENT_COLORS[c.modelId] || AGENT_COLORS['agent-api'];
          const filesHtml = c.files.map(f => `
            <div class="diff-file">
              <div class="diff-file-head">
                <span class="diff-file-path">${escapeHtml(f.path)}</span>
                <span class="diff-counts">
                  <span class="cnt-add">+${f.added}</span>
                  <span class="cnt-del">-${f.removed}</span>
                </span>
              </div>
              <div class="diff-lines">
                ${f.diff.map(line => `
                  <div class="diff-line diff-${line.type}">
                    <span class="diff-sign">${line.type === 'add' ? '+' : (line.type === 'del' ? '-' : ' ')}</span>
                    <code>${escapeHtml(line.text)}</code>
                  </div>
                `).join('')}
              </div>
            </div>
          `).join('');

          return `
            <article class="change-card">
              <div class="change-head">
                <span class="trad-model-tag" style="background:${m.badgeBg};color:${m.badgeText}">${escapeHtml(m.displayName)}</span>
                <code class="commit-sha">${escapeHtml(c.commit)}</code>
                <span class="change-time">${escapeHtml(c.time)}</span>
              </div>
              <div class="change-task">${escapeHtml(c.task)}</div>
              <div class="change-why"><strong>WHY:</strong> ${escapeHtml(c.reason)}</div>
              <div class="change-summary">${escapeHtml(c.summary)}</div>
              ${filesHtml}
            </article>
          `;
        }).join('')
      : `<div class="empty-changes">No agent commits recorded in <code>${escapeHtml(b.folder)}</code> yet.</div>`;

    const folderTag = Data.getFolderLabel(b.folder);
    buildingDrawerBody.innerHTML = `
      <div class="drawer-bldg-hero">
        <div class="drawer-code-badge">${escapeHtml(folderTag)}</div>
        <div class="drawer-bldg-titles">
          <h3>${escapeHtml(b.name)}</h3>
          <div class="drawer-folder-line">
            <span>📂 ${escapeHtml(state.rootFolder)}${escapeHtml(b.folder.replace(/^\//, ''))}</span>
            ${b.guarded ? '<span class="guard-pill">🛡️ GUARDED ZONE</span>' : ''}
          </div>
        </div>
      </div>

      <div class="drawer-summary-box">
        <div class="drawer-section-label">LATEST FOLDER SUMMARY</div>
        <p>${escapeHtml(b.summary)}</p>
        <div class="drawer-actions-row">
          <button class="pixel-btn primary sm" id="drawerDispatchBtn">🔨 Send Agent Here</button>
          <button class="pixel-btn sm" id="drawerRemapBtn">⚙ Remap Folder</button>
        </div>
      </div>

      ${activeBlock}
      ${queueBlock}

      <div class="drawer-section-label">EXACT AGENT CHANGES (${b.changes.length})</div>
      <div class="drawer-changes-list">${changesHtml}</div>
    `;

    buildingDrawerEl.classList.remove('hidden');

    const dispBtn = document.getElementById('drawerDispatchBtn');
    if (dispBtn) {
      dispBtn.addEventListener('click', () => {
        const idle = state.agents.find(a => a.state === 'idle') || state.agents[0];
        state.dispatchAgent(idle.id, b.id);
      });
    }
    const remapBtn = document.getElementById('drawerRemapBtn');
    if (remapBtn) {
      remapBtn.addEventListener('click', () => openOptionsModal());
    }
  }

  btnCloseDrawer.addEventListener('click', () => state.selectBuilding(null));

  // ==========================================================================
  // 4. OPTIONS MENU (View Toggle, Time Limit, & Dynamic Building Mapping)
  // ==========================================================================
  function renderOptionsModal() {
    optionsRootInput.value = state.rootFolder;
    optionsTimeLimitInput.value = String(state.timeLimitSec);

    optModePixel.classList.toggle('active', state.viewMode === 'pixel');
    optModeTrad.classList.toggle('active', state.viewMode === 'traditional');

    const canRemove = state.buildings.length > 1;
    optionsMappingsList.innerHTML = state.buildings.map(b => `
      <div class="opt-map-row">
        <div class="opt-bldg-info">
          <span class="opt-code">${escapeHtml(Data.getFolderLabel(b.folder))}</span>
          <span class="opt-name">${escapeHtml(b.name)}</span>
        </div>
        <input
          type="text"
          class="pixel-input opt-folder-input"
          value="${escapeHtml(b.folder)}"
          data-map-bldg="${b.id}"
          aria-label="Folder path for ${escapeHtml(b.name)}"
        />
        <label class="opt-guard-toggle" title="Mark folder as Guarded Zone">
          <input type="checkbox" data-guard-bldg="${b.id}" ${b.guarded ? 'checked' : ''} />
          <span>🛡️ Guarded</span>
        </label>
        <button
          type="button"
          class="pixel-btn danger opt-remove-btn"
          data-remove-bldg="${b.id}"
          title="Remove folder and tighten campus crop"
          ${canRemove ? '' : 'disabled'}
        >✕</button>
      </div>
    `).join('');

    optionsMappingsList.querySelectorAll('[data-map-bldg]').forEach(input => {
      input.addEventListener('change', (e) => {
        state.updateBuildingFolder(e.target.dataset.mapBldg, e.target.value);
        renderOptionsModal();
      });
    });

    optionsMappingsList.querySelectorAll('[data-guard-bldg]').forEach(chk => {
      chk.addEventListener('change', (e) => {
        state.toggleBuildingGuarded(e.target.dataset.guardBldg);
      });
    });

    optionsMappingsList.querySelectorAll('[data-remove-bldg]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (state.removeFolderBuilding(btn.dataset.removeBldg)) {
          renderOptionsModal();
        }
      });
    });
  }

  function openOptionsModal() {
    renderOptionsModal();
    optionsModalEl.classList.remove('hidden');
  }

  btnOpenOptions.addEventListener('click', openOptionsModal);
  btnCloseOptions.addEventListener('click', () => optionsModalEl.classList.add('hidden'));
  optionsModalEl.addEventListener('click', (e) => {
    if (e.target === optionsModalEl) optionsModalEl.classList.add('hidden');
  });

  optionsRootInput.addEventListener('change', (e) => state.setRootFolder(e.target.value));
  optionsTimeLimitInput.addEventListener('change', (e) => {
    state.setTimeLimit(e.target.value);
    optionsTimeLimitInput.value = String(state.timeLimitSec);
  });
  btnAddFolder.addEventListener('click', () => {
    const val = optionsAddFolderInput.value.trim();
    if (!val) return;
    if (state.addFolderBuilding(val)) {
      optionsAddFolderInput.value = '';
      renderOptionsModal();
    }
  });
  btnResetMappings.addEventListener('click', () => {
    state.resetBuildingMappings();
    renderOptionsModal();
  });

  optModePixel.addEventListener('click', () => state.setViewMode('pixel'));
  optModeTrad.addEventListener('click', () => state.setViewMode('traditional'));
  btnViewPixel.addEventListener('click', () => state.setViewMode('pixel'));
  btnViewTrad.addEventListener('click', () => state.setViewMode('traditional'));

  // ==========================================================================
  // 5. THE ORACLE FEED PANEL
  // ==========================================================================
  function renderOracleFeed() {
    const iconFor = {
      commit:  '📝',
      walk:    '🐂',
      wait:    '⏳',
      enter:   '🚪',
      kickout: '🥾',
      ribbon:  '✂️',
      guarded: '🛡️',
    };

    oracleListEl.innerHTML = state.oracleFeed.map(item => {
      const m = AGENT_COLORS[item.modelId] || AGENT_COLORS['agent-api'];
      const b = item.buildingId ? state.getBuilding(item.buildingId) : null;
      const bldgLabel = b ? Data.getFolderLabel(b.folder) : 'CAMPUS';
      return `
        <button class="oracle-item type-${item.type}" data-oracle-bldg="${escapeHtml(item.buildingId || '')}">
          <div class="oracle-item-top">
            <span class="oracle-icon">${iconFor[item.type] || '📌'}</span>
            <span class="oracle-model-dot" style="background:${m.primary}"></span>
            <span class="oracle-bldg">${escapeHtml(bldgLabel)}</span>
            <span class="oracle-time">${escapeHtml(item.time)}</span>
          </div>
          <div class="oracle-title">${escapeHtml(item.title)}</div>
          <div class="oracle-detail">${escapeHtml(item.detail)}</div>
          ${item.commit ? `<div class="oracle-commit">commit <code>${escapeHtml(item.commit)}</code></div>` : ''}
        </button>
      `;
    }).join('');

    oracleListEl.querySelectorAll('[data-oracle-bldg]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.dataset.oracleBldg) state.selectBuilding(btn.dataset.oracleBldg);
      });
    });
  }

  // ==========================================================================
  // 6. ANNOUNCEMENT BANNER
  // ==========================================================================
  function renderAnnouncement() {
    if (!state.announcement) {
      ribbonBannerEl.classList.add('hidden');
      ribbonBannerEl.classList.remove('kickout-banner');
      return;
    }
    const isKick = state.announcement.kind === 'kickout';
    ribbonBannerEl.classList.toggle('kickout-banner', isKick);
    ribbonBannerEl.innerHTML = `
      <div class="ribbon-banner-inner">
        <span class="ribbon-scissors">${isKick ? '🥾' : '✂️'}</span>
        <div>
          <div class="ribbon-title">${escapeHtml(state.announcement.title)}</div>
          <div class="ribbon-sub">${escapeHtml(state.announcement.subtitle)}</div>
        </div>
        <span class="ribbon-trophy">${isKick ? '⚠️' : '🎉'}</span>
      </div>
    `;
    ribbonBannerEl.classList.remove('hidden');
  }

  // ==========================================================================
  // 7. PREVIEW CONTROLS BAR
  // ==========================================================================
  function populateDemoSelectors() {
    demoAgentSelect.innerHTML = state.agents.map(a => {
      const m = AGENT_COLORS[a.modelId];
      return `<option value="${a.id}">${escapeHtml(a.shortLabel)} (${escapeHtml(m.shortName)})</option>`;
    }).join('');

    const prevB = demoBuildingSelect.value;
    demoBuildingSelect.innerHTML = state.buildings.map(b =>
      `<option value="${b.id}">${escapeHtml(Data.getFolderLabel(b.folder))} — ${escapeHtml(b.name)}</option>`
    ).join('');
    if (state.buildings.some(b => b.id === prevB)) {
      demoBuildingSelect.value = prevB;
    } else if (state.buildings[0]) {
      demoBuildingSelect.value = state.buildings[0].id;
    }
  }

  btnAutoDemo.addEventListener('click', () => state.toggleAutoDemo());
  btnDispatch.addEventListener('click', () => {
    state.dispatchAgent(demoAgentSelect.value, demoBuildingSelect.value, { duration: 10 });
  });
  btnTestQueue.addEventListener('click', () => {
    state.testQueueDemo(demoBuildingSelect.value);
  });
  btnTestKickOut.addEventListener('click', () => {
    state.testKickOutDemo(demoBuildingSelect.value);
  });
  btnFinishActive.addEventListener('click', () => state.finishActiveWork());
  btnResetCampus.addEventListener('click', () => state.resetCampus());

  // ==========================================================================
  // 8. VIEW MODE & FULL UI SYNC
  // ==========================================================================
  function syncUI(reason) {
    rootChipEl.textContent = state.rootFolder;
    cropChipEl.textContent = `${state.buildings.length} FOLDER${state.buildings.length === 1 ? '' : 'S'} • ${state.cropRect.tierLabel}`;

    // Show Pre-Map Repository Analyzer until repository has been analyzed!
    analyzerOverlay.classList.toggle('hidden', state.repoAnalyzed);

    const isPixel = state.viewMode === 'pixel';
    mapStage.classList.toggle('hidden', !state.repoAnalyzed || !isPixel);
    tradViewEl.classList.toggle('hidden', !state.repoAnalyzed || isPixel);
    btnViewPixel.classList.toggle('active', isPixel);
    btnViewTrad.classList.toggle('active', !isPixel);
    optModePixel.classList.toggle('active', isPixel);
    optModeTrad.classList.toggle('active', !isPixel);

    btnAutoDemo.textContent = state.autoDemoRunning ? '⏹ STOP DEMO' : '▶ AUTO DEMO';
    btnAutoDemo.classList.toggle('active', state.autoDemoRunning);

    renderModelLegend();
    renderOracleFeed();
    renderAnnouncement();

    if (reason === 'options' || reason === 'reset' || reason === 'analyze') {
      renderer.applyCrop(state.cropRect);
      populateDemoSelectors();
    }
    if (reason === 'selection' || reason === 'ribbon' || reason === 'kickout' || reason === 'options' || state.selectedBuildingId) {
      renderBuildingDrawer();
    }
    if (state.repoAnalyzed && !isPixel) {
      TraditionalView.render(tradViewEl, state);
    }
  }

  state.subscribe((_, reason) => syncUI(reason));

  let lastSlowSync = 0;

  // ==========================================================================
  // 9. MAIN 60 FPS ANIMATION LOOP
  // ==========================================================================
  let lastTs = performance.now();
  function frame(ts) {
    const dt = (ts - lastTs) / 1000;
    lastTs = ts;
    const sec = ts / 1000;

    tick(dt);

    if (state.repoAnalyzed && state.viewMode === 'pixel') {
      renderer.render(state, sec);
    }

    if (state.repoAnalyzed && ts - lastSlowSync > 250) {
      lastSlowSync = ts;
      renderModelLegend();
      if (state.viewMode === 'traditional') {
        TraditionalView.render(tradViewEl, state);
      }
      if (state.hoveredBuildingId && !tooltipEl.classList.contains('hidden')) {
        const hb = state.getBuilding(state.hoveredBuildingId);
        if (hb) showTooltip(hb, lastPointer.x, lastPointer.y);
      }
      if (state.selectedBuildingId) {
        const active = state.getActiveAgentOnBuilding(state.selectedBuildingId);
        const waiters = state.getWaitingAgentsOnBuilding(state.selectedBuildingId);
        if (active || waiters.length) renderBuildingDrawer();
      }
    }

    requestAnimationFrame(frame);
  }

  // Boot directly into the Pre-Map Repository Analyzer!
  renderAnalyzerPresets();
  updateAnalyzerPreview();
  populateDemoSelectors();
  syncUI('init');
  requestAnimationFrame(frame);
})();
