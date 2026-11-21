/* ============================================================================
   BULLPEN — Traditional Workflow Representation
   Live-synced alternative view (Folder Tree, Agent Swimlanes, Lease Table)
   toggled from Options Menu or quick View Switcher.
   ============================================================================ */

window.BullpenTraditionalView = (function () {
  const { CLAUDE_MODELS } = window.BullpenPalette;

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function statusBadgeHtml(status) {
    const map = {
      idle:     { cls: 'badge-idle',     label: 'IDLE' },
      working:  { cls: 'badge-working',  label: 'LEASE ACTIVE' },
      conflict: { cls: 'badge-conflict', label: 'CONFLICT!' },
      ribbon:   { cls: 'badge-complete', label: 'COMPLETE' },
    };
    const info = map[status] || map.idle;
    return `<span class="trad-badge ${info.cls}">${info.label}</span>`;
  }

  function agentStateLabel(agent, state) {
    const b = agent.targetBuildingId ? state.getBuilding(agent.targetBuildingId) : null;
    switch (agent.state) {
      case 'working':     return `Editing ${b ? b.folder : ''} (${b ? b.code : ''})`;
      case 'walking':     return `Acquiring lease on ${b ? b.folder : ''}`;
      case 'waiting':     return `Queued at door: ${b ? b.folder : ''}`;
      case 'conflict':    return `Collision on ${b ? b.folder : ''} — Needs Decision`;
      case 'celebrating': return `Completed task — Releasing lease`;
      default:            return 'Idle — Monitoring workspace';
    }
  }

  function render(container, state) {
    if (!container) return;

    // 1. Folder Tree (maps 1:1 with Campus Buildings)
    const folderItemsHtml = state.buildings.map(b => {
      const status = state.getBuildingStatus(b.id);
      const activeAgent = state.getActiveAgentOnBuilding(b.id);
      const isSelected = state.selectedBuildingId === b.id;
      return `
        <button class="trad-folder-row ${isSelected ? 'selected' : ''} status-${status}" data-building-id="${b.id}">
          <div class="trad-folder-main">
            <span class="trad-folder-icon">${status === 'working' ? '🚧' : (status === 'conflict' ? '💥' : (b.guarded ? '🛡️' : '📁'))}</span>
            <span class="trad-folder-path">${escapeHtml(b.folder)}</span>
            <span class="trad-bldg-chip">${escapeHtml(b.code)}</span>
          </div>
          <div class="trad-folder-meta">
            ${statusBadgeHtml(status)}
            ${activeAgent ? `<span class="trad-owner-dot" style="background:${CLAUDE_MODELS[activeAgent.modelId].primary}"></span>` : ''}
          </div>
        </button>
      `;
    }).join('');

    // 2. Agent Swimlanes
    const agentCardsHtml = state.agents.map(agent => {
      const model = CLAUDE_MODELS[agent.modelId];
      const pct = Math.round((agent.workProgress || 0) * 100);
      const targetB = agent.targetBuildingId ? state.getBuilding(agent.targetBuildingId) : null;

      return `
        <div class="trad-agent-card state-${agent.state}" style="border-left-color: ${model.primary}">
          <div class="trad-agent-header">
            <div class="trad-agent-id">
              <span class="model-swatch" style="background:${model.primary}"></span>
              <strong>${escapeHtml(agent.name)}</strong>
              <span class="trad-model-tag" style="background:${model.badgeBg};color:${model.badgeText}">${escapeHtml(model.displayName)}</span>
            </div>
            <span class="trad-agent-state">${escapeHtml(agent.state.toUpperCase())}</span>
          </div>
          <div class="trad-agent-body">
            <div class="trad-agent-line"><strong>Status:</strong> ${escapeHtml(agentStateLabel(agent, state))}</div>
            <div class="trad-agent-line"><strong>Task:</strong> ${escapeHtml(agent.task)}</div>
            <div class="trad-agent-line muted"><strong>Why:</strong> ${escapeHtml(agent.reason)}</div>
            ${agent.state === 'working' ? `
              <div class="trad-progress-wrap">
                <div class="trad-progress-bar">
                  <div class="trad-progress-fill" style="width:${pct}%;background:${model.primary}"></div>
                </div>
                <span class="trad-progress-pct">${pct}%</span>
              </div>
            ` : ''}
          </div>
          ${targetB ? `
            <div class="trad-agent-foot">
              <button class="pixel-btn sm" data-inspect-bldg="${targetB.id}">Inspect ${escapeHtml(targetB.folder)}</button>
            </div>
          ` : ''}
        </div>
      `;
    }).join('');

    // 3. Recent Commits & Changes Table across all folders
    const allChanges = [];
    state.buildings.forEach(b => {
      b.changes.forEach(c => allChanges.push({ ...c, building: b }));
    });

    const tableRowsHtml = allChanges.slice(0, 8).map(c => {
      const model = CLAUDE_MODELS[c.modelId] || CLAUDE_MODELS['claude-opus-4-6'];
      return `
        <tr data-inspect-bldg="${c.building.id}" class="trad-commit-row">
          <td><code class="commit-sha">${escapeHtml(c.commit)}</code></td>
          <td><span class="trad-folder-inline">${escapeHtml(c.building.folder)}</span> <span class="trad-bldg-chip">${escapeHtml(c.building.code)}</span></td>
          <td><span class="trad-model-tag" style="background:${model.badgeBg};color:${model.badgeText}">${escapeHtml(model.shortName)}</span></td>
          <td>${escapeHtml(c.summary)}</td>
          <td class="muted">${escapeHtml(c.time)}</td>
        </tr>
      `;
    }).join('');

    // Conflict alert bar inside Traditional View
    let conflictBannerHtml = '';
    if (state.pendingConflict) {
      const cb = state.getBuilding(state.pendingConflict.buildingId);
      conflictBannerHtml = `
        <div class="trad-conflict-banner">
          <div>
            <strong>💥 LEASE CONFLICT ON ${escapeHtml(cb ? cb.folder : '')} (${escapeHtml(cb ? cb.code : '')})</strong>
            <span>Two Claude agents collided trying to edit the same folder.</span>
          </div>
          <button class="pixel-btn danger" data-open-conflict="1">Resolve Conflict</button>
        </div>
      `;
    }

    container.innerHTML = `
      <div class="trad-shell">
        <div class="trad-top-meta">
          <div class="trad-root-pill">📂 ROOT REPO: <strong>${escapeHtml(state.rootFolder)}</strong></div>
          <div class="trad-hint">Click any folder or commit row to inspect exact agent diffs & summaries.</div>
        </div>
        ${conflictBannerHtml}
        <div class="trad-grid">
          <section class="trad-panel trad-tree-panel">
            <div class="trad-panel-title">WORKSPACE FOLDERS (LEASE MAP)</div>
            <div class="trad-folder-list">${folderItemsHtml}</div>
          </section>
          <section class="trad-panel trad-lanes-panel">
            <div class="trad-panel-title">ACTIVE CLAUDE AGENTS (WORKFLOW LANES)</div>
            <div class="trad-agent-list">${agentCardsHtml}</div>
          </section>
        </div>
        <section class="trad-panel trad-commits-panel">
          <div class="trad-panel-title">RECENT FOLDER CHANGES &amp; SUMMARIES</div>
          <div class="trad-table-scroll">
            <table class="trad-table">
              <thead>
                <tr>
                  <th>COMMIT</th>
                  <th>FOLDER</th>
                  <th>MODEL</th>
                  <th>SUMMARY</th>
                  <th>TIME</th>
                </tr>
              </thead>
              <tbody>
                ${tableRowsHtml || '<tr><td colspan="5" class="muted">No changes recorded yet.</td></tr>'}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    `;

    // Bind clicks inside Traditional View
    container.querySelectorAll('[data-building-id]').forEach(el => {
      el.addEventListener('click', () => state.selectBuilding(el.dataset.buildingId));
    });
    container.querySelectorAll('[data-inspect-bldg]').forEach(el => {
      el.addEventListener('click', () => state.selectBuilding(el.dataset.inspectBldg));
    });
    const openConf = container.querySelector('[data-open-conflict]');
    if (openConf) {
      openConf.addEventListener('click', () => {
        const modal = document.getElementById('conflictModal');
        if (modal) modal.classList.remove('hidden');
      });
    }
  }

  return { render };
})();
