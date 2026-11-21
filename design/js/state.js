/* ============================================================================
   BULLPEN — Interactive Design State Store, Pathfinding & Agent FSM
   Design-only visual simulation (with clean hooks for future integration).
   ============================================================================ */

window.BullpenState = (function () {
  const Data = window.BullpenCampusData;
  const { CLAUDE_MODELS } = window.BullpenPalette;

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
        x: 270, y: 184,
        facing: 1,
        state: 'idle', // idle | walking | working | waiting | conflict | celebrating
        path: [],
        targetBuildingId: null,
        task: 'Patrolling USF Campus',
        reason: 'Awaiting next task assignment.',
        workProgress: 0,
        workDuration: 11,
        celebrateTimer: 0,
        idlePause: 0.4,
        phase: 0.0,
      },
      {
        id: 'agent-2',
        name: 'Agent 2 (Sonnet)',
        shortLabel: 'SONNET',
        modelId: 'claude-sonnet-4-6',
        x: 270, y: 142,
        facing: -1,
        state: 'idle',
        path: [],
        targetBuildingId: null,
        task: 'Patrolling USF Campus',
        reason: 'Awaiting next task assignment.',
        workProgress: 0,
        workDuration: 10,
        celebrateTimer: 0,
        idlePause: 0.9,
        phase: 2.1,
      },
      {
        id: 'agent-3',
        name: 'Agent 3 (Haiku)',
        shortLabel: 'HAIKU',
        modelId: 'claude-haiku-4-5',
        x: 340, y: 280,
        facing: 1,
        state: 'idle',
        path: [],
        targetBuildingId: null,
        task: 'Patrolling USF Campus',
        reason: 'Awaiting next task assignment.',
        workProgress: 0,
        workDuration: 9,
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

  const state = {
    rootFolder: 'bullpen-app/',
    viewMode: 'pixel', // 'pixel' | 'traditional'
    buildings: cloneDefaultBuildings(),
    agents: createInitialAgents(),
    hoveredBuildingId: null,
    selectedBuildingId: null,
    pendingConflict: null, // { buildingId, agentAId, agentBId }
    ribbons: [],           // { buildingId, progress, folder, agentName }
    announcement: null,    // { title, subtitle, timer }
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
        detail: 'Documented folder lease lifecycle & conflict prompts.',
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
        detail: 'Added atomic lease lock to prevent concurrent token collision.',
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
      if (state.pendingConflict && state.pendingConflict.buildingId === buildingId) {
        return 'conflict';
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
      return state.agents.filter(a => a.state === 'waiting' && a.targetBuildingId === buildingId);
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

    // Pick a realistic task payload for a building
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

    // Dispatch an agent to walk to a building & begin working!
    dispatchAgent(agentId, buildingId, opts = {}) {
      const agent = state.getAgent(agentId);
      const b = state.getBuilding(buildingId);
      if (!agent || !b) return;

      // Don't interrupt an unresolved conflict involving this agent unless forced
      if (state.pendingConflict && (state.pendingConflict.agentAId === agentId || state.pendingConflict.agentBId === agentId)) {
        return;
      }

      const payload = state.pickTaskPayload(buildingId, opts.task, opts.reason);
      agent.targetBuildingId = buildingId;
      agent.task = payload.task;
      agent.reason = payload.reason;
      agent.pendingPayload = payload;
      agent.workProgress = 0;
      agent.workDuration = opts.duration || 10;
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
        title: `${agent.shortLabel} heading to ${b.code} (${b.folder})`,
        detail: payload.task,
      });
      state.notify('agents');
    },

    // Trigger a dramatic 2-agent work conflict crash on a building!
    triggerConflictDemo(buildingId = 'ENB') {
      if (state.pendingConflict) return;
      const b = state.getBuilding(buildingId) || state.buildings[0];

      // Pick 2 agents (prefer agent-1 & agent-2)
      const a1 = state.agents[0];
      const a2 = state.agents[1];

      // Place them rushing from opposite sides of the building so they visibly walk & CRASH!
      const p1 = state.pickTaskPayload(
        b.id,
        `Rewrite auth session middleware in ${b.folder}`,
        'Needed to support multi-agent lease validation.'
      );
      const p2 = state.pickTaskPayload(
        b.id,
        `Add hot-reload metrics hook in ${b.folder}`,
        'Needed live telemetry for the HackJam campus feed.'
      );

      a1.targetBuildingId = b.id;
      a1.task = p1.task;
      a1.reason = p1.reason;
      a1.pendingPayload = p1;
      a1.workProgress = 0;
      a1.state = 'walking';
      a1.x = Math.max(20, b.door.x - 42);
      a1.y = b.door.y;
      a1.path = [{ x: b.door.x - 8, y: b.door.y }];

      a2.targetBuildingId = b.id;
      a2.task = p2.task;
      a2.reason = p2.reason;
      a2.pendingPayload = p2;
      a2.workProgress = 0;
      a2.state = 'walking';
      a2.x = Math.min(Data.WORLD_W - 20, b.door.x + 42);
      a2.y = b.door.y;
      a2.path = [{ x: b.door.x + 8, y: b.door.y }];

      state.addOracleEntry({
        type: 'walk',
        buildingId: b.id,
        agentId: a1.id,
        modelId: a1.modelId,
        title: `Opus & Sonnet both targeting ${b.code} (${b.folder})!`,
        detail: 'Collision imminent on shared folder lease...',
      });
      state.notify('agents');
    },

    // Initiate the physical crash animation first; open User Selection Prompt after animation finishes!
    initiateConflict(buildingId, agentA, agentB) {
      const b = state.getBuilding(buildingId);
      if (!b) return;

      agentA.state = 'conflict';
      agentB.state = 'conflict';
      agentA.path = [];
      agentB.path = [];
      agentA.x = b.door.x - 6;
      agentA.y = b.door.y;
      agentA.facing = 1;
      agentB.x = b.door.x + 6;
      agentB.y = b.door.y;
      agentB.facing = -1;

      state.pendingConflict = {
        buildingId,
        agentAId: agentA.id,
        agentBId: agentB.id,
        clashProgress: 0,
        clashDuration: 2.3,
        secondHitShaken: false,
        modalReady: false,
      };
      state.screenShake = 1.5;

      state.addOracleEntry({
        type: 'conflict',
        buildingId,
        agentId: agentA.id,
        modelId: agentA.modelId,
        title: `CLASH at ${b.code} (${b.folder})!`,
        detail: `${agentA.shortLabel} & ${agentB.shortLabel} collided — awaiting user selection.`,
      });
      state.notify('conflict');
    },

    // User chooses which colliding agent gets to work on the building!
    resolveConflict(winningAgentId) {
      if (!state.pendingConflict) return;
      const { buildingId, agentAId, agentBId } = state.pendingConflict;
      const b = state.getBuilding(buildingId);
      const winner = state.getAgent(winningAgentId);
      const loser = state.getAgent(winningAgentId === agentAId ? agentBId : agentAId);

      state.pendingConflict = null;

      if (winner && b) {
        startWorkingOnBuilding(winner, b);
      }
      if (loser && b) {
        // Losing agent waits politely at the building door until winner finishes!
        loser.state = 'waiting';
        loser.x = b.door.x + (loser.x < b.door.x ? -12 : 12);
        loser.y = b.door.y + 4;
        loser.facing = loser.x < b.x + b.w / 2 ? 1 : -1;
      }

      if (winner && loser && b) {
        state.addOracleEntry({
          type: 'resolved',
          buildingId,
          agentId: winner.id,
          modelId: winner.modelId,
          title: `Lease granted to ${winner.shortLabel} at ${b.code}`,
          detail: `${loser.shortLabel} waiting politely at the door until ${b.folder} completes.`,
        });
      }
      state.notify('conflict');
    },

    // Finish work immediately on any currently active building (great for testing ribbon-cutting!)
    finishActiveWork() {
      const working = state.agents.find(a => a.state === 'working');
      if (working) {
        completeWork(working);
        return true;
      }
      // If none currently working, quickly finish a ribbon-cutting preview on ENB!
      const fallback = state.agents[0];
      const b = state.getBuilding('MSC') || state.buildings[0];
      fallback.targetBuildingId = b.id;
      fallback.pendingPayload = state.pickTaskPayload(b.id);
      fallback.x = b.x + b.w / 2;
      fallback.y = b.y + b.h * 0.4;
      completeWork(fallback);
      return true;
    },

    // Reset campus cleanly
    resetCampus() {
      stopAutoDemo();
      state.buildings = cloneDefaultBuildings();
      state.agents = createInitialAgents();
      state.pendingConflict = null;
      state.ribbons = [];
      state.announcement = null;
      state.selectedBuildingId = null;
      state.screenShake = 0;
      state.notify('reset');
    },

    // Scripted Auto-Demo matching the USF HackJam showcase flow!
    toggleAutoDemo() {
      if (state.autoDemoRunning) {
        stopAutoDemo();
        state.notify('demo');
        return;
      }
      state.autoDemoRunning = true;
      state.notify('demo');

      // Step 1: Opus walks to MSC (/frontend) & starts construction
      state.dispatchAgent('agent-1', 'MSC', { duration: 7 });
      // Step 2: Haiku walks to LIB (/docs) & starts construction
      const t1 = setTimeout(() => {
        if (!state.autoDemoRunning) return;
        state.dispatchAgent('agent-3', 'LIB', { duration: 8 });
      }, 2200);
      // Step 3: After MSC completes with ribbon-cutting, Opus & Sonnet crash on ENB (/backend)!
      const t2 = setTimeout(() => {
        if (!state.autoDemoRunning) return;
        state.triggerConflictDemo('ENB');
      }, 11500);

      state.autoDemoTimers.push(t1, t2);
    },
  };

  function stopAutoDemo() {
    state.autoDemoRunning = false;
    state.autoDemoTimers.forEach(t => clearTimeout(t));
    state.autoDemoTimers = [];
  }

  function startWorkingOnBuilding(agent, b) {
    agent.state = 'working';
    agent.targetBuildingId = b.id;
    agent.path = [];
    // Hover centered over the building!
    agent.x = b.x + b.w / 2;
    agent.y = b.y + b.h * 0.42;
    agent.workProgress = Math.max(0.02, agent.workProgress || 0);
    state.notify('agents');
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

    // Trigger Ribbon-Cutting Transition on this building!
    state.ribbons.push({
      buildingId: b.id,
      progress: 0,
      folder: b.folder,
      agentName: agent.shortLabel,
    });

    // Top Ribbon-Cutting Banner Announcement!
    state.announcement = {
      title: `RIBBON CUTTING — ${b.code} (${b.folder}) COMPLETE!`,
      subtitle: `${agent.name} finished: ${payload.summary}`,
      buildingId: b.id,
      timer: 4.5,
    };

    state.addOracleEntry({
      type: 'ribbon',
      buildingId: b.id,
      agentId: agent.id,
      modelId: agent.modelId,
      title: `Ribbon cut! Work complete in ${b.folder} (${b.code})`,
      detail: payload.summary,
      commit: commitHash,
    });

    // Agent lands at door and hops happily
    agent.state = 'celebrating';
    agent.celebrateTimer = 2.2;
    agent.workProgress = 0;
    agent.x = b.door.x;
    agent.y = b.door.y;
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
  // SIMULATION TICK (called at 60 FPS from main loop)
  // ==========================================================================
  function tick(dt) {
    const safeDt = Math.min(dt, 0.08);
    let uiNeedsSync = false;

    // Decay screen shake
    if (state.screenShake > 0) {
      state.screenShake = Math.max(0, state.screenShake - safeDt * 2.4);
    }

    // Animate 3-beat Bull Clash BEFORE opening the user selection prompt!
    if (state.pendingConflict && !state.pendingConflict.modalReady) {
      const conf = state.pendingConflict;
      conf.clashProgress = Math.min(1, conf.clashProgress + safeDt / conf.clashDuration);
      const p = conf.clashProgress;
      const b = state.getBuilding(conf.buildingId);
      const agentA = state.getAgent(conf.agentAId);
      const agentB = state.getAgent(conf.agentBId);

      if (b && agentA && agentB) {
        let sep = 12;
        let hopY = 0;

        if (p < 0.22) {
          // Beat 1: Head-to-head horn lock impact!
          const t = p / 0.22;
          sep = 5 + Math.sin(t * Math.PI) * 2;
          hopY = -Math.sin(t * Math.PI) * 3;
        } else if (p < 0.44) {
          // Recoil back to wind up for second clash!
          const t = (p - 0.22) / 0.22;
          sep = 5 + Math.sin(t * Math.PI * 0.5) * 12;
          hopY = -Math.sin(t * Math.PI) * 4;
        } else if (p < 0.66) {
          // Beat 2: Second fierce headbutt slam!
          const t = (p - 0.44) / 0.22;
          sep = 17 - Math.sin(t * Math.PI) * 12;
          hopY = -Math.sin(t * Math.PI) * 5;
          if (t > 0.45 && !conf.secondHitShaken) {
            conf.secondHitShaken = true;
            state.screenShake = 1.3;
          }
        } else {
          // Beat 3: Staggered recoil into dizzy standoff before prompt opens
          const t = (p - 0.66) / 0.34;
          sep = 10 + Math.sin(t * Math.PI * 0.5) * 4;
          hopY = 0;
        }

        agentA.x = b.door.x - sep;
        agentA.y = b.door.y + hopY;
        agentA.facing = 1;
        agentB.x = b.door.x + sep;
        agentB.y = b.door.y + hopY;
        agentB.facing = -1;
      }

      if (conf.clashProgress >= 1) {
        conf.modalReady = true;
        state.notify('conflict');
      }
    }

    // Update banner announcement timer
    if (state.announcement) {
      state.announcement.timer -= safeDt;
      if (state.announcement.timer <= 0) {
        state.announcement = null;
        uiNeedsSync = true;
      }
    }

    // Update Ribbon-Cutting transitions
    for (let i = state.ribbons.length - 1; i >= 0; i--) {
      const rib = state.ribbons[i];
      rib.progress += safeDt / 3.6; // 3.6 second ceremonial snip + confetti!
      if (rib.progress >= 1) {
        const finishedBuildingId = rib.buildingId;
        state.ribbons.splice(i, 1);
        uiNeedsSync = true;

        // If an agent was waiting at this building's door, grant them the lease next!
        const waiter = state.agents.find(a => a.state === 'waiting' && a.targetBuildingId === finishedBuildingId);
        const b = state.getBuilding(finishedBuildingId);
        if (waiter && b && !state.pendingConflict) {
          startWorkingOnBuilding(waiter, b);
          state.addOracleEntry({
            type: 'walk',
            buildingId: b.id,
            agentId: waiter.id,
            modelId: waiter.modelId,
            title: `${waiter.shortLabel} entered ${b.code} (${b.folder})`,
            detail: `Queued work started: ${waiter.task}`,
          });
        }
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

        // Check if another walking agent targeting the SAME building is right next to us!
        if (b && !state.pendingConflict) {
          const otherWalker = state.agents.find(o =>
            o.id !== agent.id &&
            o.state === 'walking' &&
            o.targetBuildingId === b.id &&
            Math.hypot(o.x - agent.x, o.y - agent.y) < 20 &&
            Math.hypot(agent.x - b.door.x, agent.y - b.door.y) < 28
          );
          if (otherWalker) {
            state.initiateConflict(b.id, agent, otherWalker);
            return;
          }
        }

        if (arrived && b) {
          // Check if someone is ALREADY working on this building -> CRASH CONFLICT!
          const activeWorker = state.getActiveAgentOnBuilding(b.id);
          if (activeWorker && activeWorker.id !== agent.id && !state.pendingConflict) {
            state.initiateConflict(b.id, activeWorker, agent);
          } else if (state.pendingConflict && state.pendingConflict.buildingId === b.id) {
            agent.state = 'waiting';
            agent.x = b.door.x;
            agent.y = b.door.y + 10;
          } else {
            startWorkingOnBuilding(agent, b);
          }
        }
      } else if (agent.state === 'working') {
        agent.workProgress += safeDt / (agent.workDuration || 10);
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

  // Kick off an immediate lively initial showcase so the user sees Bulls walking & building right away!
  function startOpeningScene() {
    setTimeout(() => {
      if (state.agents[0].state === 'idle') {
        state.dispatchAgent('agent-1', 'ENB', { duration: 12 });
      }
    }, 800);
  }

  // Expose a clean design hook API for future team integration (Dev / Monisha)
  window.BullpenDesignAPI = {
    dispatchAgent: (agentId, buildingId, opts) => state.dispatchAgent(agentId, buildingId, opts),
    triggerConflict: (buildingId) => state.triggerConflictDemo(buildingId),
    finishActive: () => state.finishActiveWork(),
    setViewMode: (mode) => state.setViewMode(mode),
    setBuildingFolder: (buildingId, path) => state.updateBuildingFolder(buildingId, path),
    getState: () => state,
  };

  return { state, tick, startOpeningScene };
})();
