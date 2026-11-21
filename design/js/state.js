/* ============================================================================
   BULLPEN — Interactive Design State Store, Repo Analyzer & Agent FSM
   Analyzes repository folders first, dynamically maps N buildings, computes an
   exact USF Campus crop so ALL folders remain visible, and animates Bulls.
   ============================================================================ */

window.BullpenState = (function () {
  const Data = window.BullpenCampusData;

  const listeners = new Set();

  function nowTimeLabel() {
    const d = new Date();
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }

  function randomCommitHash() {
    return Math.random().toString(16).substring(2, 9);
  }

  function getVisibleWaypoints(crop) {
    const pad = 12;
    const valid = Object.entries(Data.WAYPOINTS).filter(([, pt]) =>
      pt.x >= crop.x + pad &&
      pt.x <= crop.x + crop.w - pad &&
      pt.y >= crop.y + pad &&
      pt.y <= crop.y + crop.h - pad
    );
    return valid.length ? valid.map(([id]) => id) : ['lc_maple', 'lc_lib', 'enb_door'];
  }

  function createAgentsForCrop(crop, buildings) {
    const visibleIds = getVisibleWaypoints(crop);
    const pickPos = (idx) => {
      if (visibleIds.length) {
        const id = visibleIds[idx % visibleIds.length];
        return { ...Data.WAYPOINTS[id] };
      }
      const b = buildings[idx % buildings.length];
      return b ? { ...b.door } : { x: 192, y: 166 };
    };

    const p0 = pickPos(0);
    const p1 = pickPos(1);
    const p2 = pickPos(2);

    return [
      {
        id: 'agent-1',
        name: 'Agent 1 (api)',
        shortLabel: 'API',
        modelId: 'agent-api',
        x: p0.x, y: p0.y,
        facing: 1,
        state: 'idle',
        path: [],
        targetBuildingId: null,
        task: 'Patrolling USF Campus',
        reason: 'Awaiting next task assignment.',
        workProgress: 0,
        workElapsed: 0,
        workDuration: 10,
        queuePos: 0,
        spinAngle: 0,
        celebrateTimer: 0,
        idlePause: 0.4,
        phase: 0.0,
      },
      {
        id: 'agent-2',
        name: 'Agent 2 (web)',
        shortLabel: 'WEB',
        modelId: 'agent-web',
        x: p1.x, y: p1.y,
        facing: -1,
        state: 'idle',
        path: [],
        targetBuildingId: null,
        task: 'Patrolling USF Campus',
        reason: 'Awaiting next task assignment.',
        workProgress: 0,
        workElapsed: 0,
        workDuration: 9,
        queuePos: 0,
        spinAngle: 0,
        celebrateTimer: 0,
        idlePause: 0.9,
        phase: 2.1,
      },
      {
        id: 'agent-3',
        name: 'Agent 3 (db)',
        shortLabel: 'DB',
        modelId: 'agent-db',
        x: p2.x, y: p2.y,
        facing: 1,
        state: 'idle',
        path: [],
        targetBuildingId: null,
        task: 'Patrolling USF Campus',
        reason: 'Awaiting next task assignment.',
        workProgress: 0,
        workElapsed: 0,
        workDuration: 8,
        queuePos: 0,
        spinAngle: 0,
        celebrateTimer: 0,
        idlePause: 1.4,
        phase: 4.2,
      },
    ];
  }

  let kickReasonToggle = 0;

  // Initial default dataset (pre-loaded behind the Pre-Map Repo Analyzer)
  const initialPreset = Data.REPO_PRESETS[2]; // builtbyd3v/bullpen (8 folders)
  const initialBuildings = Data.buildBuildingsForFolders(initialPreset.folders);
  const initialCrop = Data.computeCropRect(initialBuildings);

  const state = {
    repoAnalyzed: false, // Analyzer screen displays BEFORE showing the map!
    rootFolder: initialPreset.root,
    analyzedFolders: [...initialPreset.folders],
    truncatedExtraCount: 0,
    viewMode: 'pixel',
    timeLimitSec: 15,
    buildings: initialBuildings,
    cropRect: initialCrop,
    agents: createAgentsForCrop(initialCrop, initialBuildings),
    hoveredBuildingId: null,
    selectedBuildingId: null,
    ribbons: [],
    kickouts: [],
    announcement: null,
    screenShake: 0,
    autoDemoRunning: false,
    autoDemoTimers: [],
    oracleFeed: [],

    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },

    notify(reason = 'update') {
      listeners.forEach(fn => fn(state, reason));
    },

    getBuilding(id) {
      return state.buildings.find(b => b.id === id) || null;
    },

    getAgent(id) {
      return state.agents.find(a => a.id === id) || null;
    },

    getBuildingStatus(buildingId) {
      if (state.kickouts.some(k => k.buildingId === buildingId && k.progress < 0.72)) {
        return 'kickout';
      }
      if (state.ribbons.some(r => r.buildingId === buildingId)) {
        return 'ribbon';
      }
      if (state.agents.some(a => a.state === 'working' && a.targetBuildingId === buildingId)) {
        return 'working';
      }
      return 'idle';
    },

    getActiveAgentOnBuilding(buildingId) {
      return state.agents.find(a => a.state === 'working' && a.targetBuildingId === buildingId) || null;
    },

    getWaitingAgentsOnBuilding(buildingId) {
      return state.agents
        .filter(a => a.state === 'waiting' && a.targetBuildingId === buildingId)
        .sort((a, b) => (a.queuePos || 0) - (b.queuePos || 0));
    },

    // ========================================================================
    // ANALYZE REPOSITORY -> DYNAMIC BUILDING COUNT & CAMPUS CROP
    // ========================================================================
    analyzeRepository(rootName, rawFolders, extraIgnoredCount = 0) {
      stopAutoDemo();

      const cleanedRoot = String(rootName || 'bullpen/').trim();
      state.rootFolder = cleanedRoot.endsWith('/') ? cleanedRoot : cleanedRoot + '/';

      const uniqueCount = new Set(
        rawFolders.map(f => Data.normalizeFolder(f).toLowerCase()).filter(Boolean)
      ).size;
      state.truncatedExtraCount = Math.max(0, uniqueCount - Data.BUILDING_CATALOG.length) + extraIgnoredCount;

      state.buildings = Data.buildBuildingsForFolders(rawFolders);
      state.analyzedFolders = state.buildings.map(b => b.folder);
      state.cropRect = Data.computeCropRect(state.buildings);
      state.agents = createAgentsForCrop(state.cropRect, state.buildings);

      state.hoveredBuildingId = null;
      state.selectedBuildingId = null;
      state.ribbons = [];
      state.kickouts = [];
      state.announcement = null;
      state.screenShake = 0;
      state.repoAnalyzed = true;

      // Seed Oracle feed with repository scan + initial folder summaries
      state.oracleFeed = [
        {
          id: 'orc-scan-' + Date.now(),
          type: 'enter',
          time: nowTimeLabel(),
          buildingId: state.buildings[0] ? state.buildings[0].id : null,
          agentId: 'agent-1',
          modelId: 'agent-api',
          title: `Analyzed ${state.rootFolder}: ${state.buildings.length} folder${state.buildings.length === 1 ? '' : 's'} mapped`,
          detail: `Campus cropped to ${state.cropRect.tierLabel} (${state.cropRect.w}x${state.cropRect.h}) — all ${state.buildings.length} visible.`,
        },
        ...state.buildings.slice(0, 4).map((b, idx) => {
          const chg = b.changes[0];
          return {
            id: 'orc-init-' + idx + '-' + Date.now(),
            type: b.guarded ? 'guarded' : 'commit',
            time: chg ? chg.time : nowTimeLabel(),
            buildingId: b.id,
            agentId: chg ? chg.agentId : 'agent-1',
            modelId: chg ? chg.modelId : 'agent-api',
            title: b.guarded
              ? `Guarded Zone detected in ${b.folder}`
              : `Mapped ${b.folder} -> ${b.name}`,
            detail: b.summary,
            commit: chg ? chg.commit : undefined,
          };
        }),
      ];

      state.notify('analyze');

      // Kick off a lively opening dispatch on the first detected building!
      const firstB = state.buildings[0];
      if (firstB) {
        setTimeout(() => {
          if (state.repoAnalyzed && state.agents[0] && state.agents[0].state === 'idle' && state.getBuilding(firstB.id)) {
            state.dispatchAgent('agent-1', firstB.id, { duration: 11 });
          }
        }, 550);
      }
    },

    openRepoAnalyzer() {
      stopAutoDemo();
      state.repoAnalyzed = false;
      state.notify('analyzerOpen');
    },

    // Live add/remove folders from Options (dynamically re-crops campus!)
    addFolderBuilding(folderPath) {
      const norm = Data.normalizeFolder(folderPath);
      if (!norm) return false;
      if (state.buildings.length >= Data.BUILDING_CATALOG.length) return false;
      if (state.buildings.some(b => b.folder.toLowerCase() === norm.toLowerCase())) return false;

      const nextFolders = [...state.buildings.map(b => b.folder), norm];
      state.analyzeRepository(state.rootFolder, nextFolders);
      return true;
    },

    removeFolderBuilding(buildingId) {
      if (state.buildings.length <= 1) return false;
      const nextFolders = state.buildings.filter(b => b.id !== buildingId).map(b => b.folder);
      state.analyzeRepository(state.rootFolder, nextFolders);
      return true;
    },

    addOracleEntry(entry) {
      state.oracleFeed.unshift({
        id: 'orc-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
        time: nowTimeLabel(),
        ...entry,
      });
      if (state.oracleFeed.length > 30) state.oracleFeed.pop();
      state.notify('oracle');
    },

    setViewMode(mode) {
      if (mode !== 'pixel' && mode !== 'traditional') return;
      state.viewMode = mode;
      state.notify('viewMode');
    },

    setRootFolder(folder) {
      const cleaned = (folder || 'bullpen/').trim();
      state.rootFolder = cleaned.endsWith('/') ? cleaned : cleaned + '/';
      state.notify('options');
    },

    setTimeLimit(seconds) {
      const val = Math.max(5, Math.min(60, Math.round(Number(seconds) || 15)));
      state.timeLimitSec = val;
      state.notify('options');
    },

    updateBuildingFolder(buildingId, folderPath) {
      const b = state.getBuilding(buildingId);
      if (!b) return;
      const clean = Data.normalizeFolder(folderPath) || b.defaultFolder;
      b.folder = clean;
      state.notify('options');
    },

    toggleBuildingGuarded(buildingId) {
      const b = state.getBuilding(buildingId);
      if (!b) return;
      b.guarded = !b.guarded;
      state.notify('options');
    },

    resetBuildingMappings() {
      state.timeLimitSec = 15;
      state.buildings.forEach(b => {
        b.folder = b.defaultFolder;
      });
      state.notify('options');
    },

    selectBuilding(buildingId) {
      state.selectedBuildingId = buildingId;
      state.notify('selection');
    },

    setHoveredBuilding(buildingId) {
      if (state.hoveredBuildingId === buildingId) return;
      state.hoveredBuildingId = buildingId;
      state.notify('hover');
    },

    pickTaskPayload(buildingId, customTask, customReason) {
      const b = state.getBuilding(buildingId);
      const samples = Data.SAMPLE_TASKS[buildingId] || [];
      const pick = samples.length
        ? samples[Math.floor(Math.random() * samples.length)]
        : {
            task: `Refactor module logic in ${b ? b.folder : '/src'}`,
            reason: 'Improve reliability and test coverage for this folder.',
            summary: `Updated core handlers inside ${b ? b.folder : '/src'}.`,
            file: `${b ? b.folder : '/src'}/index.ts`,
            diff: [
              { type: 'add', text: '// Updated by Bullpen agent' },
              { type: 'add', text: 'export const status = "verified";' },
            ]
          };
      return {
        ...pick,
        task: customTask || pick.task,
        reason: customReason || pick.reason,
        file: pick.file.replace(/^\/[^/]+/, b ? b.folder : '/src'),
      };
    },

    dispatchAgent(agentId, buildingId, opts = {}) {
      const agent = state.getAgent(agentId);
      const b = state.getBuilding(buildingId);
      if (!agent || !b) return;
      if (agent.state === 'kicked') return;

      const payload = state.pickTaskPayload(buildingId, opts.task, opts.reason);
      agent.targetBuildingId = buildingId;
      agent.task = payload.task;
      agent.reason = payload.reason;
      agent.pendingPayload = payload;
      agent.workProgress = 0;
      agent.workElapsed = 0;
      agent.workDuration = opts.duration || 10;
      agent.spinAngle = 0;
      agent.state = 'walking';

      const wpId = Data.BUILDING_WAYPOINT[buildingId] || 'lc_maple';
      const roadPath = Data.findPath(agent.x, agent.y, wpId);
      roadPath.push({ x: b.door.x, y: b.door.y });
      agent.path = roadPath;

      state.addOracleEntry({
        type: 'walk',
        buildingId,
        agentId: agent.id,
        modelId: agent.modelId,
        title: `${agent.shortLabel} heading to ${b.folder}`,
        detail: payload.task,
      });
      state.notify('agents');
    },

    testQueueDemo(buildingId) {
      const b = state.getBuilding(buildingId) || state.buildings[0];
      if (!b) return;
      const active = state.getActiveAgentOnBuilding(b.id);

      if (active) {
        const waiter = state.agents.find(a => a.id !== active.id && a.state !== 'working' && a.state !== 'kicked')
          || state.agents.find(a => a.id !== active.id);
        if (waiter) {
          state.dispatchAgent(waiter.id, b.id, {
            duration: 9,
            task: `Follow-up integration patch in ${b.folder}`,
            reason: `Waiting for ${active.shortLabel} to release ${b.folder} lease.`,
          });
        }
        return;
      }

      const a1 = state.agents[0];
      const a2 = state.agents[1];
      const p1 = state.pickTaskPayload(b.id);
      a1.pendingPayload = p1;
      a1.task = p1.task;
      a1.reason = p1.reason;
      a1.workDuration = 10;
      a1.workElapsed = 0;
      a1.workProgress = 0.1;
      startWorkingOnBuilding(a1, b);

      a2.x = Math.max(state.cropRect.x + 18, b.door.x - 42);
      a2.y = b.door.y;
      state.dispatchAgent(a2.id, b.id, {
        duration: 9,
        task: `Queued follow-up in ${b.folder}`,
        reason: `Waiting politely for ${a1.shortLabel} to finish in ${b.folder}.`,
      });
    },

    testKickOutDemo(buildingId, forceType = null) {
      const reasonType = forceType || (kickReasonToggle++ % 2 === 0 ? 'error' : 'timeout');
      const reasonText = reasonType === 'error'
        ? 'Runtime error: TypeScript build failed & hook aborted edit'
        : `Time limit exceeded (${state.timeLimitSec}s lease cap reached)`;

      const activeWithWaiter = state.agents.find(
        a => a.state === 'working' && state.getWaitingAgentsOnBuilding(a.targetBuildingId).length > 0
      );
      const anyActive = activeWithWaiter || state.agents.find(a => a.state === 'working');

      if (anyActive) {
        const b = state.getBuilding(anyActive.targetBuildingId);
        const existingWaiters = b ? state.getWaitingAgentsOnBuilding(b.id) : [];
        if (b && existingWaiters.length === 0) {
          const idlePeer = state.agents.find(a => a.id !== anyActive.id && a.state === 'idle');
          if (idlePeer) {
            placeAgentInQueue(idlePeer, b, {
              task: `Recovery task in ${b.folder}`,
              reason: `Queued outside ${b.folder} ready to take over.`,
            });
          }
        }
        kickOutAgent(anyActive, reasonType, reasonText);
        return;
      }

      const b = state.getBuilding(buildingId) || state.buildings[0];
      if (!b) return;
      const a1 = state.agents[0];
      const a2 = state.agents[1];

      const p1 = state.pickTaskPayload(b.id);
      a1.pendingPayload = p1;
      a1.task = p1.task;
      a1.reason = p1.reason;
      a1.workDuration = 12;
      a1.workElapsed = reasonType === 'timeout' ? state.timeLimitSec - 0.5 : 4;
      a1.workProgress = 0.45;
      startWorkingOnBuilding(a1, b);

      placeAgentInQueue(a2, b, {
        task: `Take over ${b.folder} after eviction`,
        reason: `Waiting outside ${b.folder} to enter once lease opens.`,
      });

      setTimeout(() => {
        if (a1.state === 'working' && a1.targetBuildingId === b.id) {
          kickOutAgent(a1, reasonType, reasonText);
        }
      }, 650);
    },

    finishActiveWork() {
      const working = state.agents.find(a => a.state === 'working');
      if (working) {
        completeWork(working);
        return true;
      }
      const fallback = state.agents[0];
      const b = state.buildings[0];
      if (!b) return false;
      fallback.targetBuildingId = b.id;
      fallback.pendingPayload = state.pickTaskPayload(b.id);
      fallback.x = b.x + b.w / 2;
      fallback.y = b.y + b.h * 0.4;
      completeWork(fallback);
      return true;
    },

    resetCampus() {
      state.analyzeRepository(state.rootFolder, state.analyzedFolders);
    },

    toggleAutoDemo() {
      if (state.autoDemoRunning) {
        stopAutoDemo();
        state.notify('demo');
        return;
      }
      state.autoDemoRunning = true;
      state.notify('demo');

      const b0 = state.buildings[0];
      const b1 = state.buildings[1] || b0;
      if (!b0) return;

      state.dispatchAgent('agent-1', b0.id, { duration: 16 });
      const t1 = setTimeout(() => {
        if (!state.autoDemoRunning) return;
        state.dispatchAgent('agent-2', b0.id, {
          duration: 8,
          task: `Ship clean follow-up in ${b0.folder}`,
          reason: `Queued outside ${b0.folder} waiting for api to finish.`,
        });
      }, 1400);

      const t2 = setTimeout(() => {
        if (!state.autoDemoRunning) return;
        if (b1 && b1.id !== b0.id) {
          state.dispatchAgent('agent-3', b1.id, { duration: 7 });
        }
      }, 2800);

      const t3 = setTimeout(() => {
        if (!state.autoDemoRunning) return;
        const apiAgent = state.getAgent('agent-1');
        if (apiAgent && apiAgent.state === 'working') {
          kickOutAgent(apiAgent, 'error', `Build error in ${b0.folder} — evicted from building!`);
        }
      }, 8200);

      state.autoDemoTimers.push(t1, t2, t3);
    },
  };

  function stopAutoDemo() {
    state.autoDemoRunning = false;
    state.autoDemoTimers.forEach(t => clearTimeout(t));
    state.autoDemoTimers = [];
  }

  function getQueueSlotPosition(b, index) {
    const crop = state.cropRect;
    const spacing = 16;
    const offset = (index % 2 === 0 ? -1 : 1) * (10 + Math.floor(index / 2) * spacing);
    return {
      x: Math.max(crop.x + 16, Math.min(crop.x + crop.w - 16, b.door.x + offset)),
      y: Math.min(crop.y + crop.h - 18, b.door.y + 4),
    };
  }

  function placeAgentInQueue(agent, b, customOpts = null) {
    if (customOpts) {
      const payload = state.pickTaskPayload(b.id, customOpts.task, customOpts.reason);
      agent.task = payload.task;
      agent.reason = payload.reason;
      agent.pendingPayload = payload;
    }
    const existing = state.getWaitingAgentsOnBuilding(b.id).filter(a => a.id !== agent.id);
    const slotIdx = existing.length;
    const pos = getQueueSlotPosition(b, slotIdx);

    agent.state = 'waiting';
    agent.targetBuildingId = b.id;
    agent.path = [];
    agent.queuePos = slotIdx + 1;
    agent.x = pos.x;
    agent.y = pos.y;
    agent.facing = pos.x <= b.x + b.w / 2 ? 1 : -1;

    state.addOracleEntry({
      type: 'wait',
      buildingId: b.id,
      agentId: agent.id,
      modelId: agent.modelId,
      title: `${agent.shortLabel} waiting outside ${b.folder}`,
      detail: `Queue #${agent.queuePos} — waiting for active agent to finish.`,
    });
    state.notify('agents');
  }

  function reflowQueuePositions(buildingId) {
    const b = state.getBuilding(buildingId);
    if (!b) return;
    const waiters = state.getWaitingAgentsOnBuilding(buildingId);
    waiters.forEach((w, idx) => {
      w.queuePos = idx + 1;
      const pos = getQueueSlotPosition(b, idx);
      w.x = pos.x;
      w.y = pos.y;
    });
  }

  function admitNextWaitingAgent(buildingId) {
    const b = state.getBuilding(buildingId);
    if (!b) return false;
    if (state.getActiveAgentOnBuilding(buildingId)) return false;

    const waiters = state.getWaitingAgentsOnBuilding(buildingId);
    if (!waiters.length) return false;

    const next = waiters[0];
    next.queuePos = 0;
    next.workProgress = 0;
    next.workElapsed = 0;
    startWorkingOnBuilding(next, b);
    reflowQueuePositions(buildingId);

    state.addOracleEntry({
      type: 'enter',
      buildingId: b.id,
      agentId: next.id,
      modelId: next.modelId,
      title: `${next.shortLabel} entered ${b.folder}!`,
      detail: `Lease acquired from queue: ${next.task}`,
    });
    state.notify('agents');
    return true;
  }

  function startWorkingOnBuilding(agent, b) {
    agent.state = 'working';
    agent.targetBuildingId = b.id;
    agent.path = [];
    agent.queuePos = 0;
    agent.spinAngle = 0;
    agent.x = b.x + b.w / 2;
    agent.y = b.y + b.h * 0.42;
    agent.workProgress = Math.max(0.02, agent.workProgress || 0);
    state.notify('agents');
  }

  function kickOutAgent(agent, reasonType = 'error', reasonText = 'Agent encountered an error') {
    const b = state.getBuilding(agent.targetBuildingId);
    if (!b) return;

    const crop = state.cropRect;
    const startX = b.door.x;
    const startY = b.door.y - 4;
    const cropMidX = crop.x + crop.w * 0.55;
    const dirX = startX > cropMidX ? -1 : 1;
    const landX = Math.max(crop.x + 24, Math.min(crop.x + crop.w - 24, startX + dirX * 52));
    const landY = Math.max(crop.y + 26, Math.min(crop.y + crop.h - 24, startY + 12));

    agent.state = 'kicked';
    agent.path = [];
    agent.workProgress = 0;
    agent.workElapsed = 0;
    agent.targetBuildingId = null;
    agent.pendingPayload = null;
    agent.x = startX;
    agent.y = startY;
    agent.facing = dirX;
    agent.spinAngle = 0;
    agent.task = reasonType === 'timeout' ? 'Kicked out (Time Limit Exceeded)' : 'Kicked out (Error Encountered)';
    agent.reason = reasonText;

    state.kickouts.push({
      id: 'kick-' + Date.now() + '-' + Math.random().toString(36).slice(2, 5),
      buildingId: b.id,
      agentId: agent.id,
      reasonType,
      reasonText,
      progress: 0,
      duration: 2.35,
      startX,
      startY,
      landX,
      landY,
      dirX,
      handoffDone: false,
    });

    state.screenShake = 1.7;

    const label = reasonType === 'timeout' ? 'TIME LIMIT EXCEEDED' : 'ERROR EVICTION';
    const folderTag = Data.getFolderLabel(b.folder);
    state.announcement = {
      kind: 'kickout',
      title: `KICKED OUT — ${agent.shortLabel} BOOTED FROM ${folderTag} (${b.folder})!`,
      subtitle: `${label}: ${reasonText}`,
      buildingId: b.id,
      timer: 4.2,
    };

    state.addOracleEntry({
      type: 'kickout',
      buildingId: b.id,
      agentId: agent.id,
      modelId: agent.modelId,
      title: `${agent.shortLabel} kicked out of ${b.folder} (${label})!`,
      detail: reasonText,
    });

    state.notify('kickout');
  }

  function completeWork(agent) {
    const b = state.getBuilding(agent.targetBuildingId);
    if (!b) {
      agent.state = 'idle';
      return;
    }

    const payload = agent.pendingPayload || state.pickTaskPayload(b.id);
    const commitHash = randomCommitHash();
    const changeEntry = {
      id: 'chg-' + Date.now(),
      commit: commitHash,
      agentId: agent.id,
      modelId: agent.modelId,
      time: nowTimeLabel(),
      task: payload.task,
      reason: payload.reason,
      summary: payload.summary,
      files: [
        {
          path: payload.file,
          added: payload.diff.filter(d => d.type === 'add').length * 4 + 3,
          removed: payload.diff.filter(d => d.type === 'del').length * 2,
          diff: payload.diff,
        }
      ],
    };

    b.changes.unshift(changeEntry);
    b.summary = payload.summary;

    state.ribbons.push({
      buildingId: b.id,
      progress: 0,
      folder: b.folder,
      agentName: agent.shortLabel,
    });

    const folderTag = Data.getFolderLabel(b.folder);
    state.announcement = {
      kind: 'ribbon',
      title: `RIBBON CUTTING — ${folderTag} (${b.folder}) COMPLETE!`,
      subtitle: `${agent.name} finished: ${payload.summary}`,
      buildingId: b.id,
      timer: 4.5,
    };

    state.addOracleEntry({
      type: 'ribbon',
      buildingId: b.id,
      agentId: agent.id,
      modelId: agent.modelId,
      title: `Ribbon cut! Work complete in ${b.folder}`,
      detail: payload.summary,
      commit: commitHash,
    });

    agent.state = 'celebrating';
    agent.celebrateTimer = 2.1;
    agent.workProgress = 0;
    agent.workElapsed = 0;
    agent.x = Math.min(state.cropRect.x + state.cropRect.w - 16, b.door.x + 12);
    agent.y = b.door.y - 2;
    agent.targetBuildingId = null;
    agent.pendingPayload = null;

    state.notify('ribbon');
  }

  function pickNextIdleWaypoint(agent) {
    // Only patrol roads INSIDE the currently cropped campus so Bulls stay visible!
    const visibleIds = getVisibleWaypoints(state.cropRect);
    const nextId = visibleIds[Math.floor(Math.random() * visibleIds.length)];
    agent.path = Data.findPath(agent.x, agent.y, nextId);
  }

  function tick(dt) {
    if (!state.repoAnalyzed) return; // Pause simulation until repository is analyzed!

    const safeDt = Math.min(dt, 0.08);
    let uiNeedsSync = false;

    if (state.screenShake > 0) {
      state.screenShake = Math.max(0, state.screenShake - safeDt * 2.5);
    }

    if (state.announcement) {
      state.announcement.timer -= safeDt;
      if (state.announcement.timer <= 0) {
        state.announcement = null;
        uiNeedsSync = true;
      }
    }

    for (let i = state.kickouts.length - 1; i >= 0; i--) {
      const k = state.kickouts[i];
      k.progress += safeDt / k.duration;
      const p = Math.min(1, k.progress);
      const evicted = state.getAgent(k.agentId);

      if (evicted && evicted.state === 'kicked') {
        if (p < 0.16) {
          evicted.x = k.startX + k.dirX * (p / 0.16) * 4;
          evicted.y = k.startY - (p / 0.16) * 4;
          evicted.spinAngle = k.dirX * (p / 0.16) * 0.5;
        } else if (p < 0.72) {
          const t = (p - 0.16) / 0.56;
          const arcY = Math.sin(t * Math.PI) * 38;
          evicted.x = k.startX + (k.landX - k.startX) * t;
          evicted.y = k.startY + (k.landY - k.startY) * t - arcY;
          evicted.spinAngle = k.dirX * (0.5 + t * Math.PI * 4.5);
        } else {
          const t = (p - 0.72) / 0.28;
          const bounce = t < 0.45 ? Math.sin((t / 0.45) * Math.PI) * 7 : 0;
          evicted.x = k.landX + k.dirX * t * 5;
          evicted.y = k.landY - bounce;
          evicted.spinAngle = 0;
        }
      }

      if (p >= 0.58 && !k.handoffDone) {
        k.handoffDone = true;
        admitNextWaitingAgent(k.buildingId);
      }

      if (k.progress >= 1) {
        state.kickouts.splice(i, 1);
        if (evicted && evicted.state === 'kicked') {
          evicted.state = 'idle';
          evicted.spinAngle = 0;
          evicted.task = 'Recovering — Patrolling USF Campus';
          evicted.reason = 'Ready for next assignment.';
          pickNextIdleWaypoint(evicted);
        }
        uiNeedsSync = true;
      }
    }

    for (let i = state.ribbons.length - 1; i >= 0; i--) {
      const rib = state.ribbons[i];
      rib.progress += safeDt / 3.6;
      if (rib.progress >= 1) {
        const finishedBuildingId = rib.buildingId;
        state.ribbons.splice(i, 1);
        admitNextWaitingAgent(finishedBuildingId);
        uiNeedsSync = true;
      }
    }

    state.agents.forEach(agent => {
      if (agent.state === 'idle') {
        if (!agent.path.length) {
          agent.idlePause -= safeDt;
          if (agent.idlePause <= 0) {
            pickNextIdleWaypoint(agent);
            agent.idlePause = 0.7 + Math.random() * 1.4;
          }
        } else {
          moveAlongPath(agent, 28, safeDt);
        }
      } else if (agent.state === 'walking') {
        const arrived = moveAlongPath(agent, 48, safeDt);
        const b = state.getBuilding(agent.targetBuildingId);

        if (arrived && b) {
          const status = state.getBuildingStatus(b.id);
          const activeWorker = state.getActiveAgentOnBuilding(b.id);
          if ((activeWorker && activeWorker.id !== agent.id) || status === 'ribbon' || status === 'kickout') {
            placeAgentInQueue(agent, b);
          } else {
            startWorkingOnBuilding(agent, b);
          }
        }
      } else if (agent.state === 'working') {
        agent.workElapsed += safeDt;
        agent.workProgress += safeDt / (agent.workDuration || 10);

        if (agent.workElapsed >= state.timeLimitSec) {
          kickOutAgent(
            agent,
            'timeout',
            `Exceeded configured ${state.timeLimitSec}s building lease time limit.`
          );
          return;
        }

        if (agent.workProgress >= 1) {
          completeWork(agent);
        }
      } else if (agent.state === 'celebrating') {
        agent.celebrateTimer -= safeDt;
        if (agent.celebrateTimer <= 0) {
          agent.state = 'idle';
          agent.task = 'Patrolling USF Campus';
          agent.reason = 'Ready for next folder assignment.';
          pickNextIdleWaypoint(agent);
          uiNeedsSync = true;
        }
      }
    });

    if (uiNeedsSync) state.notify('tick');
  }

  function moveAlongPath(agent, speed, dt) {
    if (!agent.path.length) return true;
    const target = agent.path[0];
    const dx = target.x - agent.x;
    const dy = target.y - agent.y;
    const dist = Math.hypot(dx, dy);

    if (Math.abs(dx) > 0.4) {
      agent.facing = dx >= 0 ? 1 : -1;
    }

    const step = speed * dt;
    if (dist <= step) {
      agent.x = target.x;
      agent.y = target.y;
      agent.path.shift();
      return agent.path.length === 0;
    } else {
      agent.x += (dx / dist) * step;
      agent.y += (dy / dist) * step;
      return false;
    }
  }

  window.BullpenDesignAPI = {
    analyzeRepository: (root, folders) => state.analyzeRepository(root, folders),
    dispatchAgent: (agentId, buildingId, opts) => state.dispatchAgent(agentId, buildingId, opts),
    testQueue: (buildingId) => state.testQueueDemo(buildingId),
    triggerKickOut: (buildingId, type) => state.testKickOutDemo(buildingId, type),
    finishActive: () => state.finishActiveWork(),
    setViewMode: (mode) => state.setViewMode(mode),
    setTimeLimit: (sec) => state.setTimeLimit(sec),
    setBuildingFolder: (buildingId, path) => state.updateBuildingFolder(buildingId, path),
    getState: () => state,
  };

  return { state, tick };
})();
