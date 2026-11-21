/* ============================================================================
   BULLPEN — Interactive Pixel-Art UI Controller
   Handles Hover Tooltips, Building Change Inspector, Options Menu (View Toggle,
   Time Limit, & Folder Mapping), The Oracle Feed, Announcements, & Main Loop.
   ============================================================================ */

(function () {
  const { CLAUDE_MODELS } = window.BullpenPalette;
  const { state, tick, startOpeningScene } = window.BullpenState;
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

  // Drawer & Options Modal
  const buildingDrawerEl = document.getElementById('buildingDrawer');
  const buildingDrawerBody = document.getElementById('buildingDrawerBody');
  const optionsModalEl = document.getElementById('optionsModal');
  const optionsRootInput = document.getElementById('optionsRootInput');
  const optionsTimeLimitInput = document.getElementById('optionsTimeLimitInput');
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
  // 1. CLAUDE MODEL COLOR LEGEND (Header)
  // ==========================================================================
  function renderModelLegend() {
    legendEl.innerHTML = state.agents.map(agent => {
      const m = CLAUDE_MODELS[agent.modelId];
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
      const m = CLAUDE_MODELS[active.modelId];
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

    tooltipEl.innerHTML = `
      <div class="tt-head">
        <span class="tt-code">${escapeHtml(b.code)}</span>
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
  // 3. BUILDING INSPECTOR DRAWER (Exact Agent Changes + Summary + Queue)
  // ==========================================================================
  function renderBuildingDrawer() {
    if (!state.selectedBuildingId) {
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
      const m = CLAUDE_MODELS[active.modelId];
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
            const m = CLAUDE_MODELS[w.modelId];
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
          const m = CLAUDE_MODELS[c.modelId] || CLAUDE_MODELS['claude-opus-4-6'];
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
      : `<div class="empty-changes">No agent commits recorded in <code>${escapeHtml(b.folder)}</code> yet. Dispatch a Claude Bull to see live construction &amp; diffs!</div>`;

    buildingDrawerBody.innerHTML = `
      <div class="drawer-bldg-hero">
        <div class="drawer-code-badge">${escapeHtml(b.code)}</div>
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
  // 4. OPTIONS MENU (View Toggle, Time Limit, & Building -> Folder Mapping)
  // ==========================================================================
  function renderOptionsModal() {
    optionsRootInput.value = state.rootFolder;
    optionsTimeLimitInput.value = String(state.timeLimitSec);

    optModePixel.classList.toggle('active', state.viewMode === 'pixel');
    optModeTrad.classList.toggle('active', state.viewMode === 'traditional');

    optionsMappingsList.innerHTML = state.buildings.map(b => `
      <div class="opt-map-row">
        <div class="opt-bldg-info">
          <span class="opt-code">${escapeHtml(b.code)}</span>
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
      </div>
    `).join('');

    optionsMappingsList.querySelectorAll('[data-map-bldg]').forEach(input => {
      input.addEventListener('change', (e) => {
        state.updateBuildingFolder(e.target.dataset.mapBldg, e.target.value);
      });
    });

    optionsMappingsList.querySelectorAll('[data-guard-bldg]').forEach(chk => {
      chk.addEventListener('change', (e) => {
        state.toggleBuildingGuarded(e.target.dataset.guardBldg);
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
      const m = CLAUDE_MODELS[item.modelId] || CLAUDE_MODELS['claude-opus-4-6'];
      return `
        <button class="oracle-item type-${item.type}" data-oracle-bldg="${escapeHtml(item.buildingId || '')}">
          <div class="oracle-item-top">
            <span class="oracle-icon">${iconFor[item.type] || '📌'}</span>
            <span class="oracle-model-dot" style="background:${m.primary}"></span>
            <span class="oracle-bldg">${escapeHtml(item.buildingId || 'CAMPUS')}</span>
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
  // 6. ANNOUNCEMENT BANNER (Ribbon-Cutting & Dramatic Kick-Out!)
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
      const m = CLAUDE_MODELS[a.modelId];
      return `<option value="${a.id}">${escapeHtml(a.shortLabel)} (${escapeHtml(m.shortName)})</option>`;
    }).join('');

    const prevB = demoBuildingSelect.value || 'ENB';
    demoBuildingSelect.innerHTML = state.buildings.map(b =>
      `<option value="${b.id}">${escapeHtml(b.code)} — ${escapeHtml(b.folder)}</option>`
    ).join('');
    demoBuildingSelect.value = prevB;
  }

  btnAutoDemo.addEventListener('click', () => state.toggleAutoDemo());
  btnDispatch.addEventListener('click', () => {
    state.dispatchAgent(demoAgentSelect.value, demoBuildingSelect.value, { duration: 10 });
  });
  btnTestQueue.addEventListener('click', () => {
    state.testQueueDemo(demoBuildingSelect.value || 'ENB');
  });
  btnTestKickOut.addEventListener('click', () => {
    state.testKickOutDemo(demoBuildingSelect.value || 'ENB');
  });
  btnFinishActive.addEventListener('click', () => state.finishActiveWork());
  btnResetCampus.addEventListener('click', () => state.resetCampus());

  // ==========================================================================
  // 8. VIEW MODE & FULL UI SYNC
  // ==========================================================================
  function syncUI(reason) {
    rootChipEl.textContent = state.rootFolder;

    const isPixel = state.viewMode === 'pixel';
    mapStage.classList.toggle('hidden', !isPixel);
    tradViewEl.classList.toggle('hidden', isPixel);
    btnViewPixel.classList.toggle('active', isPixel);
    btnViewTrad.classList.toggle('active', !isPixel);
    optModePixel.classList.toggle('active', isPixel);
    optModeTrad.classList.toggle('active', !isPixel);

    btnAutoDemo.textContent = state.autoDemoRunning ? '⏹ STOP DEMO' : '▶ AUTO DEMO';
    btnAutoDemo.classList.toggle('active', state.autoDemoRunning);

    renderModelLegend();
    renderOracleFeed();
    renderAnnouncement();

    if (reason === 'options' || reason === 'reset') {
      populateDemoSelectors();
    }
    if (reason === 'selection' || reason === 'ribbon' || reason === 'kickout' || reason === 'options' || state.selectedBuildingId) {
      renderBuildingDrawer();
    }
    if (!isPixel) {
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

    if (state.viewMode === 'pixel') {
      renderer.render(state, sec);
    }

    if (ts - lastSlowSync > 250) {
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

  // Boot!
  populateDemoSelectors();
  syncUI('init');
  startOpeningScene();
  requestAnimationFrame(frame);
})();
