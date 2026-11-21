/* ============================================================================
   BULLPEN — Interactive Design State Store, Pathfinding & Agent FSM
   Features: Campus Patrol, Waiting Queue at Door, Construction Hovering,
   Ribbon-Cutting Completion, & Dramatic Kick-Out on Error / Time Limit.
   ============================================================================ */

window.BullpenState = (function () {
  const Data = window.BullpenCampusData;

  const listeners = new Set();

  function cloneDefaultBuildings() {
    return Data.DEFAULT_BUILDINGS.map(b => ({
      ...b,
      door: { ...b.door },
      changes: b.changes.map(c => ({
        ...c,
        files: c.files.map(f => ({ ...f, diff: f.diff.map(d => ({ ...d })) }))
      }))
    }));
  }

  function createInitialAgents() {
    return [
      {
        id: 'agent-1',
        name: 'Agent 1 (Opus)',
        shortLabel: 'OPUS',
        modelId: 'claude-opus-4-6',
        x: 170, y: 158,
        facing: 1,
        state: 'idle', // idle | walking | waiting | working | kicked | celebrating
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
        name: 'Agent 2 (Sonnet)',
        shortLabel: 'SONNET',
        modelId: 'claude-sonnet-4-6',
        x: 170, y: 62,
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
        name: 'Agent 3 (Haiku)',
        shortLabel: 'HAIKU',
        modelId: 'claude-haiku-4-5',
        x: 276, y: 276,
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

  function nowTimeLabel() {
    const d = new Date();
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }

  function randomCommitHash() {
    return Math.random().toString(16).substring(2, 9);
  }

  let kickReasonToggle = 0;

  const state = {
    rootFolder: 'bullpen-app/',
    viewMode: 'pixel', // 'pixel' | 'traditional'
    timeLimitSec: 15,  // Configurable time limit before agent gets kicked out!
    buildings: cloneDefaultBuildings(),
    agents: createInitialAgents(),
    hoveredBuildingId: null,
    selectedBuildingId: null,
    ribbons: [],       // { buildingId, progress, folder, agentName }
    kickouts: [],      // { id, buildingId, agentId, reasonType, reasonText, progress, duration, startX, startY, landX, landY, dirX, handoffDone }
    announcement: null,// { kind: 'ribbon'|'kickout', title, subtitle, buildingId, timer }
    screenShake: 0,
    autoDemoRunning: false,
    autoDemoTimers: [],
    oracleFeed: [
      {
        id: 'orc-init-1',
        type: 'commit',
        time: '11:23 AM',
        buildingId: 'LIB',
        agentId: 'agent-3',
        modelId: 'claude-haiku-4-5',
        title: 'Updated /docs/LEASE_PROTOCOL.md',
        detail: 'Documented folder lease queue & automatic timeout eviction.',
        commit: '71d4e9a',
      },
      {
        id: 'orc-init-2',
        type: 'commit',
        time: '11:21 AM',
        buildingId: 'MSC',
        agentId: 'agent-2',
        modelId: 'claude-sonnet-4-6',
        title: 'Applied USF Green & Gold tokens in /frontend',
        detail: 'Official #006747 and #CFC493 palette synced to Campus HUD.',
        commit: 'c82e0b7',
      },
      {
        id: 'orc-init-3',
        type: 'commit',
        time: '11:18 AM',
        buildingId: 'ENB',
        agentId: 'agent-1',
        modelId: 'claude-opus-4-6',
        title: 'Hardened /backend/auth/login.ts token refresh',
        detail: 'Added atomic lease lock so waiting agents enter cleanly in order.',
        commit: 'a4f91c2',
      },
      {
        id: 'orc-init-4',
        type: 'guarded',
        time: '11:15 AM',
        buildingId: 'SUN',
        agentId: 'agent-1',
        modelId: 'claude-opus-4-6',
        title: 'Guarded Zone migration approved in /database',
        detail: 'Added non-destructive 004_agent_leases.sql schema.',
        commit: 'e09a31f',
      },
    ],

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
      const cleaned = (folder || 'bullpen-app/').trim();
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
      let clean = (folderPath || b.defaultFolder).trim();
      if (!clean.startsWith('/')) clean = '/' + clean;
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
      state.rootFolder = 'bullpen-app/';
      state.timeLimitSec = 15;
      state.buildings.forEach(b => {
        b.folder = b.defaultFolder;
        b.guarded = b.id === 'SUN';
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
            task: `Refactor module logic in ${b ? b.folder : buildingId}`,
            reason: 'Improve reliability and test coverage for this folder.',
            summary: `Updated core handlers inside ${b ? b.folder : buildingId}.`,
            file: `${b ? b.folder : '/src'}/index.ts`,
            diff: [
              { type: 'add', text: '// Updated by Bullpen Claude agent' },
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

    // Dispatch an agent to walk to a building (waits in line if occupied!)
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

    // Preview Helper 1: Show an active agent working & a second agent waiting politely at the door!
    testQueueDemo(buildingId = 'ENB') {
      const b = state.getBuilding(buildingId) || state.buildings[0];
      const active = state.getActiveAgentOnBuilding(b.id);

      if (active) {
        // Already someone working here -> send another available agent to wait at the door!
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

      // Otherwise start Agent 1 immediately working here & send Agent 2 walking up to wait!
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

      a2.x = Math.max(24, b.door.x - 42);
      a2.y = b.door.y;
      state.dispatchAgent(a2.id, b.id, {
        duration: 9,
        task: `Queued UI/API follow-up in ${b.folder}`,
        reason: `Waiting politely for ${a1.shortLabel} to finish in ${b.folder}.`,
      });
    },

    // Preview Helper 2: Dramatically kick out an active agent (Error or Time Limit) so the waiting agent enters!
    testKickOutDemo(buildingId = 'ENB', forceType = null) {
      const reasonType = forceType || (kickReasonToggle++ % 2 === 0 ? 'error' : 'timeout');
      const reasonText = reasonType === 'error'
        ? 'Runtime error: TypeScript build failed & hook aborted edit'
        : `Time limit exceeded (${state.timeLimitSec}s lease cap reached)`;

      // Prefer a building that already has an active working agent (especially one with a waiter!)
      const activeWithWaiter = state.agents.find(
        a => a.state === 'working' && state.getWaitingAgentsOnBuilding(a.targetBuildingId).length > 0
      );
      const anyActive = activeWithWaiter || state.agents.find(a => a.state === 'working');

      if (anyActive) {
        // Make sure there is a waiting agent at the door if one is idle so user sees the handoff!
        const b = state.getBuilding(anyActive.targetBuildingId);
        const existingWaiters = b ? state.getWaitingAgentsOnBuilding(b.id) : [];
        if (b && existingWaiters.length === 0) {
          const idlePeer = state.agents.find(a => a.id !== anyActive.id && a.state === 'idle');
          if (idlePeer) {
            placeAgentInQueue(idlePeer, b, {
              task: `Recovery task in ${b.folder}`,
              reason: `Queued at ${b.code} door ready to take over.`,
            });
          }
        }
        kickOutAgent(anyActive, reasonType, reasonText);
        return;
      }

      // If no one is working right now, set up Opus working + Sonnet waiting at door, then boot Opus!
      const b = state.getBuilding(buildingId) || state.buildings[0];
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
        reason: `Waiting at ${b.code} door to enter once lease opens.`,
      });

      setTimeout(() => {
        if (a1.state === 'working' && a1.targetBuildingId === b.id) {
          kickOutAgent(a1, reasonType, reasonText);
        }
      }, 650);
    },

    // Finish work immediately on any currently active building (triggers ribbon-cutting & lets next waiter enter!)
    finishActiveWork() {
      const working = state.agents.find(a => a.state === 'working');
      if (working) {
        completeWork(working);
        return true;
      }
      const fallback = state.agents[0];
      const b = state.getBuilding('MSC') || state.buildings[0];
      fallback.targetBuildingId = b.id;
      fallback.pendingPayload = state.pickTaskPayload(b.id);
      fallback.x = b.x + b.w / 2;
      fallback.y = b.y + b.h * 0.4;
      completeWork(fallback);
      return true;
    },

    resetCampus() {
      stopAutoDemo();
      state.buildings = cloneDefaultBuildings();
      state.agents = createInitialAgents();
      state.ribbons = [];
      state.kickouts = [];
      state.announcement = null;
      state.selectedBuildingId = null;
      state.screenShake = 0;
      state.notify('reset');
    },

    // Scripted Auto-Demo showcasing: Wait-in-line -> Kick-Out on Error/Timeout -> Waiting Agent Enters -> Ribbon-Cutting!
    toggleAutoDemo() {
      if (state.autoDemoRunning) {
        stopAutoDemo();
        state.notify('demo');
        return;
      }
      state.autoDemoRunning = true;
      state.notify('demo');

      // Step 1: Opus walks to ENB (/backend) with a long task; Sonnet walks right behind to WAIT at the door!
      state.dispatchAgent('agent-1', 'ENB', { duration: 16 });
      const t1 = setTimeout(() => {
        if (!state.autoDemoRunning) return;
        state.dispatchAgent('agent-2', 'ENB', {
          duration: 8,
          task: 'Ship clean token middleware in /backend',
          reason: 'Queued outside ENB waiting for Opus to finish.',
        });
      }, 1400);

      // Step 2: Haiku works cleanly on LIB (/docs) for a ribbon-cutting
      const t2 = setTimeout(() => {
        if (!state.autoDemoRunning) return;
        state.dispatchAgent('agent-3', 'LIB', { duration: 7 });
      }, 2800);

      // Step 3: Opus runs into an error inside ENB -> dramatic KICK-OUT -> Sonnet immediately enters ENB!
      const t3 = setTimeout(() => {
        if (!state.autoDemoRunning) return;
        const opus = state.getAgent('agent-1');
        if (opus && opus.state === 'working') {
          kickOutAgent(opus, 'error', 'Build error in /backend/auth/login.ts — evicted from building!');
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
    // Line up waiting Bulls cleanly outside the building's door
    const spacing = 16;
    const offset = (index % 2 === 0 ? -1 : 1) * (10 + Math.floor(index / 2) * spacing);
    return {
      x: Math.max(18, Math.min(Data.WORLD_W - 18, b.door.x + offset)),
      y: Math.min(Data.WORLD_H - 18, b.door.y + 4),
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
    // Don't admit if someone is already working on this building
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
    // Hover centered over the building!
    agent.x = b.x + b.w / 2;
    agent.y = b.y + b.h * 0.42;
    agent.workProgress = Math.max(0.02, agent.workProgress || 0);
    state.notify('agents');
  }

  // ==========================================================================
  // DRAMATIC KICK-OUT (on Error or Time Limit Exceeded!)
  // ==========================================================================
  function kickOutAgent(agent, reasonType = 'error', reasonText = 'Agent encountered an error') {
    const b = state.getBuilding(agent.targetBuildingId);
    if (!b) return;

    const startX = b.door.x;
    const startY = b.door.y - 4;
    // Kick away from nearest horizontal screen edge so the flight arc is always fully visible!
    const dirX = startX > Data.WORLD_W * 0.62 ? -1 : 1;
    const landX = Math.max(28, Math.min(Data.WORLD_W - 28, startX + dirX * 56));
    const landY = Math.max(28, Math.min(Data.WORLD_H - 28, startY + 14));

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
      reasonType, // 'error' | 'timeout'
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
    agent.x = b.door.x + 12;
    agent.y = b.door.y - 2;
    agent.targetBuildingId = null;
    agent.pendingPayload = null;

    state.notify('ribbon');
  }

  function pickNextIdleWaypoint(agent) {
    const wpIds = Object.keys(Data.WAYPOINTS);
    const nextId = wpIds[Math.floor(Math.random() * wpIds.length)];
    agent.path = Data.findPath(agent.x, agent.y, nextId);
  }

  // ==========================================================================
  // SIMULATION TICK (called at 60 FPS)
  // ==========================================================================
  function tick(dt) {
    const safeDt = Math.min(dt, 0.08);
    let uiNeedsSync = false;

    // Decay screen shake
    if (state.screenShake > 0) {
      state.screenShake = Math.max(0, state.screenShake - safeDt * 2.5);
    }

    // Update top announcement banner timer
    if (state.announcement) {
      state.announcement.timer -= safeDt;
      if (state.announcement.timer <= 0) {
        state.announcement = null;
        uiNeedsSync = true;
      }
    }

    // Update Dramatic Kick-Out Animations
    for (let i = state.kickouts.length - 1; i >= 0; i--) {
      const k = state.kickouts[i];
      k.progress += safeDt / k.duration;
      const p = Math.min(1, k.progress);
      const evicted = state.getAgent(k.agentId);

      if (evicted && evicted.state === 'kicked') {
        if (p < 0.16) {
          // Beat 1: Moment of boot impact right at the doorway
          evicted.x = k.startX + k.dirX * (p / 0.16) * 4;
          evicted.y = k.startY - (p / 0.16) * 4;
          evicted.spinAngle = k.dirX * (p / 0.16) * 0.5;
        } else if (p < 0.72) {
          // Beat 2: High parabolic airborne tumble!
          const t = (p - 0.16) / 0.56; // 0..1
          const arcY = Math.sin(t * Math.PI) * 38;
          evicted.x = k.startX + (k.landX - k.startX) * t;
          evicted.y = k.startY + (k.landY - k.startY) * t - arcY;
          evicted.spinAngle = k.dirX * (0.5 + t * Math.PI * 4.5);
        } else {
          // Beat 3: Ground bounce + dizzy sit!
          const t = (p - 0.72) / 0.28; // 0..1
          const bounce = t < 0.45 ? Math.sin((t / 0.45) * Math.PI) * 7 : 0;
          evicted.x = k.landX + k.dirX * t * 5;
          evicted.y = k.landY - bounce;
          evicted.spinAngle = 0;
        }
      }

      // As soon as the evicted Bull is launched clear of the doorway, admit the waiting Bull!
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

    // Update Ribbon-Cutting Transitions -> admit waiting agent once finished!
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

    // Update Agents
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
          // If the building is currently occupied (working, ribbon-cutting, or mid kick-out), WAIT IN LINE!
          if ((activeWorker && activeWorker.id !== agent.id) || status === 'ribbon' || status === 'kickout') {
            placeAgentInQueue(agent, b);
          } else {
            startWorkingOnBuilding(agent, b);
          }
        }
      } else if (agent.state === 'working') {
        agent.workElapsed += safeDt;
        agent.workProgress += safeDt / (agent.workDuration || 10);

        // Automatic dramatic kick-out if agent exceeds the configured time limit!
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

  function startOpeningScene() {
    setTimeout(() => {
      if (state.agents[0].state === 'idle') {
        state.dispatchAgent('agent-1', 'ENB', { duration: 11 });
      }
    }, 700);
  }

  // Clean design hook API for future integration
  window.BullpenDesignAPI = {
    dispatchAgent: (agentId, buildingId, opts) => state.dispatchAgent(agentId, buildingId, opts),
    testQueue: (buildingId) => state.testQueueDemo(buildingId),
    triggerKickOut: (buildingId, type) => state.testKickOutDemo(buildingId, type),
    finishActive: () => state.finishActiveWork(),
    setViewMode: (mode) => state.setViewMode(mode),
    setTimeLimit: (sec) => state.setTimeLimit(sec),
    setBuildingFolder: (buildingId, path) => state.updateBuildingFolder(buildingId, path),
    getState: () => state,
  };

  return { state, tick, startOpeningScene };
})();
