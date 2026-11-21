/* ============================================================================
   BULLPEN — Zoomed-In USF Tampa Central Campus Map Data (512 x 320 pixel world)
   Exclusively modeled on the Central & Athletics section of the provided
   USF Tampa Campus Greenway reference map (removing USF Health & north of MSC).
   ============================================================================ */

window.BullpenCampusData = (function () {
  const WORLD_W = 512;
  const WORLD_H = 320;

  // Inner campus viewport frame
  const BORDER = { x: 6, y: 6, w: 500, h: 308 };

  // Helper: clean folder name displayed on building plaques (e.g. "/backend" -> "BACKEND")
  function getFolderLabel(folderPath) {
    const clean = String(folderPath || '')
      .trim()
      .replace(/^\/+/, '')
      .replace(/\/+$/, '');
    return clean ? clean.toUpperCase() : 'ROOT';
  }

  // Diagonal-hatched USF Tampa Campus Greenway polygons (exact zoomed Central section!)
  const GREENWAY_POLYGONS = [
    // 1. Central Campus Greenway Strip (west edge past FAH & MSC -> Castor Pond -> NE Athletics edge)
    [
      [7, 58], [134, 58], [204, 58], [218, 44], [268, 36], [316, 32],
      [316, 62], [270, 66], [250, 82], [202, 82], [190, 92], [54, 92],
      [42, 108], [7, 108]
    ],
    // 2. Lower edge of Northeast Greenway Forest (top-right corner above Track & Field!)
    [
      [320, 7], [505, 7], [505, 42], [320, 42]
    ],
  ];

  // Water bodies inside the zoomed Central Campus section
  const PONDS = [
    // Castor Pond (inside Central Campus Greenway east of MSC, north of SVC)
    { id: 'castor', name: 'Castor Pond', x: 244, y: 55, rx: 22, ry: 11 },
  ];

  // Major USF roads in the zoomed Central & SE Campus
  const ROADS = [
    // USF Leroy Collins Blvd (prominent N-S central spine between ENB/ISA and LIB/MSC!)
    { name: 'USF Leroy Collins Blvd', width: 10, pts: [[170, 6], [170, 314]] },
    // USF Genshaft Dr (east-central N-S spine between Central Campus & REC/SUN!)
    { name: 'USF Genshaft Dr',        width: 9,  pts: [[322, 6], [322, 46], [312, 84], [312, 276], [324, 314]] },
    // USF Maple Dr / Cherry Dr (central E-W road north of LIB & CPR)
    { name: 'USF Maple Dr',           width: 7,  pts: [[44, 158], [312, 158]] },
    // USF Cedar Dr (west engineering / Juniper-Poplar loop)
    { name: 'USF Cedar Dr',           width: 6,  pts: [[44, 106], [108, 106]] },
    { name: 'USF Cedar West',         width: 6,  pts: [[44, 106], [44, 266]] },
    // USF Alumni Dr (southern sweeping boulevard south of ENB, LIB, BSN & SUN!)
    { name: 'USF Alumni Dr',          width: 9,  pts: [[6, 264], [134, 264], [170, 276], [312, 276], [362, 292], [468, 292]] },
    // USF Palm Dr (eastern road between REC/SUN & Soccer/Baseball!)
    { name: 'USF Palm Dr',            width: 6,  pts: [[312, 174], [434, 174], [434, 292]] },
    // USF Sage Dr (between LIB/CPR & BSN)
    { name: 'USF Sage Dr',            width: 6,  pts: [[242, 158], [242, 276]] },
    // MLK Plaza / North MSC crosswalk lane
    { name: 'USF Holly Plaza',        width: 6,  pts: [[170, 60], [208, 60]] },
  ];

  // USF Recreation & Athletics venues on the East side (exact reference positions!)
  const ATHLETICS = [
    // Track & Field Stadium (oval terracotta track + green infield + bleachers)
    { type: 'track',    label: 'TRACK',    x: 334, y: 46,  w: 76, h: 40 },
    // Recreation Softball Field (NE of Track)
    { type: 'softball', label: 'REC FIELD',x: 420, y: 46,  w: 74, h: 38 },
    // Tennis / Basketball Courts (south of Track)
    { type: 'courts',   label: 'COURTS',   x: 334, y: 90,  w: 36, h: 28 },
    // Athletic Practice Field
    { type: 'field',    label: '',         x: 376, y: 90,  w: 36, h: 30 },
    // Football Practice Fields (with crisp white yard lines)
    { type: 'football', label: 'PRACTICE', x: 420, y: 88,  w: 62, h: 42 },
    // Corbett Soccer Park Stadium
    { type: 'soccer',   label: 'SOCCER',   x: 440, y: 136, w: 62, h: 40 },
    // Baseball Stadium (east of SUN)
    { type: 'baseball', label: 'BASEBALL', x: 444, y: 184, w: 54, h: 46 },
    // Softball Stadium (south of Baseball)
    { type: 'softball', label: 'SOFTBALL', x: 444, y: 236, w: 46, h: 36 },
  ];

  // Supporting non-interactive context buildings ONLY within the zoomed Central section
  const CONTEXT_BUILDINGS = [
    // Central Campus supporting buildings
    { code: 'SVC', x: 182, y: 66,  w: 30, h: 30 },
    { code: 'CBG', x: 194, y: 104, w: 46, h: 34, isGarage: true },
    { code: 'ALN', x: 162, y: 108, w: 26, h: 20 },
    { code: 'EDU', x: 252, y: 122, w: 30, h: 24 },
    { code: 'SOC', x: 286, y: 102, w: 22, h: 24 },
    { code: 'CPR', x: 248, y: 168, w: 42, h: 22 },
    { code: 'BGD', x: 34,  y: 204, w: 28, h: 42, isGarage: true },
    { code: 'JP',  x: 10,  y: 162, w: 28, h: 30 },
    { code: 'ENG', x: 76,  y: 168, w: 24, h: 24 },
    { code: 'ENC', x: 108, y: 164, w: 28, h: 24 },
    { code: 'ATH', x: 404, y: 132, w: 26, h: 34 },
  ];

  // District labels matching the zoomed reference map
  const DISTRICT_LABELS = [
    { text: 'CENTRAL CAMPUS', x: 112, y: 74 },
    { text: 'USF ATHLETICS',  x: 416, y: 38 },
  ];

  // ==========================================================================
  // INTERACTIVE BUILDINGS (Enlarged & Detailed — Labeled by Folder Name!)
  // ==========================================================================
  const DEFAULT_BUILDINGS = [
    {
      id: 'ENB',
      code: 'ENB',
      name: 'Engineering Building II',
      defaultFolder: '/backend',
      folder: '/backend',
      x: 74, y: 204, w: 72, h: 46,
      door: { x: 110, y: 264 }, // on Alumni Dr
      roofStyle: 'engineering',
      primary: true,
      guarded: false,
      description: 'Core API services, auth controllers, and business logic.',
      summary: 'Refactored JWT session middleware and added rate-limit guard for login routes.',
      changes: [
        {
          id: 'chg-enb-1',
          commit: 'a4f91c2',
          agentId: 'agent-1',
          modelId: 'claude-opus-4-6',
          time: '11:18 AM',
          task: 'Harden /api/auth/login token refresh',
          reason: 'Prevent race conditions when concurrent agents refresh OAuth tokens.',
          summary: 'Added atomic token rotation lock and unit-tested expiry edge cases.',
          files: [
            {
              path: '/backend/auth/login.ts',
              added: 18, removed: 6,
              diff: [
                { type: 'ctx', text: 'export async function refreshSession(userId: string) {' },
                { type: 'del', text: '  const token = await db.tokens.findLatest(userId);' },
                { type: 'add', text: '  const lease = await bullpen.acquireLease(`token:${userId}`);' },
                { type: 'add', text: '  const token = await db.tokens.rotateAtomic(userId, lease.id);' },
                { type: 'add', text: '  if (!token) throw new AuthError("Token expired");' },
                { type: 'ctx', text: '  return signJwt(token.payload);' },
              ]
            },
            {
              path: '/backend/middleware/rateLimit.ts',
              added: 12, removed: 0,
              diff: [
                { type: 'add', text: 'export const loginLimiter = createWindowLimiter({ max: 20, windowMs: 60_000 });' },
              ]
            }
          ]
        }
      ]
    },
    {
      id: 'MSC',
      code: 'MSC',
      name: 'Marshall Student Center',
      defaultFolder: '/frontend',
      folder: '/frontend',
      x: 136, y: 12, w: 68, h: 44,
      door: { x: 170, y: 62 }, // right on Leroy Collins Blvd / MLK Plaza
      roofStyle: 'marshall',
      primary: true,
      guarded: false,
      description: 'User-facing React/Canvas components, theme tokens, and interactive HUD.',
      summary: 'Implemented USF Green & Gold theme tokens and responsive Bullpen dashboard header.',
      changes: [
        {
          id: 'chg-msc-1',
          commit: 'c82e0b7',
          agentId: 'agent-2',
          modelId: 'claude-sonnet-4-6',
          time: '11:21 AM',
          task: 'Build USF brand palette CSS tokens & header',
          reason: 'Match official USF Marketing green (#006747) and gold (#CFC493) specs.',
          summary: 'Created pixel-art beveled panel components and accessible contrast tokens.',
          files: [
            {
              path: '/frontend/styles/theme.css',
              added: 24, removed: 4,
              diff: [
                { type: 'del', text: '--primary-color: #1e7a4c;' },
                { type: 'add', text: '--usf-green: #006747;' },
                { type: 'add', text: '--usf-gold: #CFC493;' },
                { type: 'add', text: '--usf-evergreen: #005432;' },
              ]
            },
            {
              path: '/frontend/components/CampusHud.tsx',
              added: 31, removed: 2,
              diff: [
                { type: 'add', text: '<PixelBanner title="BULLPEN" badge="USF TAMPA" />' },
              ]
            }
          ]
        }
      ]
    },
    {
      id: 'LIB',
      code: 'LIB',
      name: 'USF Tampa Library',
      defaultFolder: '/docs',
      folder: '/docs',
      x: 184, y: 170, w: 52, h: 42,
      door: { x: 170, y: 194 }, // facing Leroy Collins Blvd
      roofStyle: 'library',
      primary: true,
      guarded: false,
      description: 'Architecture specs, API reference docs, onboarding guides, and ADRs.',
      summary: 'Updated LEASE_PROTOCOL.md with waiting-queue and timeout eviction rules.',
      changes: [
        {
          id: 'chg-lib-1',
          commit: '71d4e9a',
          agentId: 'agent-3',
          modelId: 'claude-haiku-4-5',
          time: '11:23 AM',
          task: 'Document folder lease queue & timeout eviction',
          reason: 'Keep contributor docs aligned with waiting-at-door and kick-out handoff.',
          summary: 'Added state diagram and examples for queued agents and lease timeouts.',
          files: [
            {
              path: '/docs/LEASE_PROTOCOL.md',
              added: 42, removed: 5,
              diff: [
                { type: 'ctx', text: '## Lease Queue & Eviction' },
                { type: 'add', text: 'When a building already has an active Claude agent, arriving agents' },
                { type: 'add', text: 'wait in line outside the door and enter on completion or eviction.' },
              ]
            }
          ]
        }
      ]
    },
    {
      id: 'SUN',
      code: 'SUN',
      name: 'Sun Dome (Yuengling Center)',
      defaultFolder: '/database',
      folder: '/database',
      x: 348, y: 184, w: 76, h: 62,
      door: { x: 312, y: 214 }, // facing Genshaft Dr
      roofStyle: 'dome',
      primary: true,
      guarded: true,
      description: 'Guarded Zone — SQL schemas, migrations, and production seed scripts.',
      summary: 'Guarded schema intact. Added non-destructive migration 004_agent_leases.sql.',
      changes: [
        {
          id: 'chg-sun-1',
          commit: 'e09a31f',
          agentId: 'agent-1',
          modelId: 'claude-opus-4-6',
          time: '11:15 AM',
          task: 'Add additive migration for agent_leases table',
          reason: 'Avoided altering live users table after guarded-zone policy review.',
          summary: 'Created indexed agent_leases table with foreign key to commits.',
          files: [
            {
              path: '/database/migrations/004_agent_leases.sql',
              added: 16, removed: 0,
              diff: [
                { type: 'add', text: 'CREATE TABLE agent_leases (' },
                { type: 'add', text: '  folder_path TEXT PRIMARY KEY,' },
                { type: 'add', text: '  agent_id TEXT NOT NULL,' },
                { type: 'add', text: '  acquired_at TIMESTAMPTZ DEFAULT NOW()' },
                { type: 'add', text: ');' },
              ]
            }
          ]
        }
      ]
    },
    {
      id: 'BSN',
      code: 'BSN',
      name: 'Muma College of Business',
      defaultFolder: '/config',
      folder: '/config',
      x: 248, y: 204, w: 56, h: 52,
      door: { x: 276, y: 276 }, // Alumni Dr
      roofStyle: 'courtyard',
      primary: false,
      guarded: false,
      description: 'Environment presets, model routing rules, and workspace configs.',
      summary: 'Registered Claude Opus, Sonnet, and Haiku color & capability profiles.',
      changes: [
        {
          id: 'chg-bsn-1',
          commit: '5b912cc',
          agentId: 'agent-2',
          modelId: 'claude-sonnet-4-6',
          time: '11:12 AM',
          task: 'Configure Claude model roster',
          reason: 'Assign distinct visual identities per Claude model tier.',
          summary: 'Added model registry JSON with USF color tokens.',
          files: [
            {
              path: '/config/models.json',
              added: 15, removed: 0,
              diff: [
                { type: 'add', text: '{ "models": ["claude-opus-4-6", "claude-sonnet-4-6", "claude-haiku-4-5"] }' },
              ]
            }
          ]
        }
      ]
    },
    {
      id: 'ISA',
      code: 'ISA',
      name: 'Interdisciplinary Sciences',
      defaultFolder: '/tests',
      folder: '/tests',
      x: 102, y: 98, w: 52, h: 38,
      door: { x: 170, y: 118 }, // Leroy Collins Blvd
      roofStyle: 'science',
      primary: false,
      guarded: false,
      description: 'Automated integration suites, fuzzers, and regression harnesses.',
      summary: 'Added 14 lease queue unit tests — all passing.',
      changes: []
    },
    {
      id: 'REC',
      code: 'REC',
      name: 'Campus Recreation Center',
      defaultFolder: '/scripts',
      folder: '/scripts',
      x: 326, y: 124, w: 66, h: 38,
      door: { x: 312, y: 144 }, // Genshaft Dr
      roofStyle: 'rec',
      primary: false,
      guarded: false,
      description: 'Build scripts, dev utilities, and deployment helpers.',
      summary: 'No recent edits yet — ready for agent dispatch.',
      changes: []
    },
    {
      id: 'FAH',
      code: 'FAH',
      name: 'Fine Arts Hall',
      defaultFolder: '/assets',
      folder: '/assets',
      x: 36, y: 16, w: 48, h: 40,
      door: { x: 64, y: 106 }, // Cedar / Central Walkway
      roofStyle: 'arts',
      primary: false,
      guarded: false,
      description: 'Pixel sprites, campus tilesets, and USF mascot artwork.',
      summary: 'Exported crisp 16x16 Rocky Bull walk-cycle frames.',
      changes: []
    }
  ];

  // ==========================================================================
  // CAMPUS WALKING PATH GRAPH (Exact zoomed Central Campus road network!)
  // ==========================================================================
  const WAYPOINTS = {
    // Leroy Collins Blvd (N-S central spine)
    lc_msc:     { x: 170, y: 62 },
    lc_isa:     { x: 170, y: 118 },
    lc_maple:   { x: 170, y: 158 },
    lc_lib:     { x: 170, y: 194 },
    lc_alumni:  { x: 170, y: 276 },
    lc_south:   { x: 170, y: 304 },

    // Cedar & West Engineering Loop
    cedar_nw:   { x: 44,  y: 106 },
    fah_door:   { x: 64,  y: 106 },
    cedar_isa:  { x: 108, y: 106 },
    cedar_mid:  { x: 44,  y: 158 },
    cedar_s:    { x: 44,  y: 264 },
    enb_door:   { x: 110, y: 264 },

    // Maple Dr & Sage Dr (Central)
    maple_mid:  { x: 242, y: 158 },
    maple_e:    { x: 312, y: 158 },
    sage_s:     { x: 242, y: 276 },
    bsn_door:   { x: 276, y: 276 },

    // Genshaft Dr (East-Central)
    gen_north:  { x: 312, y: 84 },
    gen_rec:    { x: 312, y: 144 },
    gen_palm:   { x: 312, y: 174 },
    gen_sun:    { x: 312, y: 214 },
    gen_alumni: { x: 312, y: 276 },

    // Palm Dr & Athletics
    palm_e:     { x: 434, y: 174 },
    palm_s:     { x: 434, y: 292 },
    alumni_se:  { x: 362, y: 292 },
  };

  const WAYPOINT_EDGES = [
    ['lc_msc', 'lc_isa'],
    ['lc_isa', 'lc_maple'],
    ['lc_maple', 'lc_lib'],
    ['lc_lib', 'lc_alumni'],
    ['lc_alumni', 'lc_south'],

    ['cedar_nw', 'fah_door'],
    ['fah_door', 'cedar_isa'],
    ['cedar_isa', 'lc_isa'],
    ['cedar_nw', 'cedar_mid'],
    ['cedar_mid', 'cedar_s'],
    ['cedar_mid', 'lc_maple'],
    ['cedar_s', 'enb_door'],
    ['enb_door', 'lc_alumni'],

    ['lc_maple', 'maple_mid'],
    ['maple_mid', 'maple_e'],
    ['maple_mid', 'sage_s'],
    ['lc_alumni', 'sage_s'],
    ['sage_s', 'bsn_door'],
    ['bsn_door', 'gen_alumni'],

    ['lc_msc', 'gen_north'],
    ['gen_north', 'gen_rec'],
    ['gen_rec', 'maple_e'],
    ['maple_e', 'gen_palm'],
    ['gen_palm', 'gen_sun'],
    ['gen_sun', 'gen_alumni'],

    ['gen_palm', 'palm_e'],
    ['palm_e', 'palm_s'],
    ['gen_alumni', 'alumni_se'],
    ['alumni_se', 'palm_s'],
  ];

  const BUILDING_WAYPOINT = {
    ENB: 'enb_door',
    MSC: 'lc_msc',
    LIB: 'lc_lib',
    SUN: 'gen_sun',
    BSN: 'bsn_door',
    ISA: 'lc_isa',
    REC: 'gen_rec',
    FAH: 'fah_door',
  };

  const ADJACENCY = {};
  Object.keys(WAYPOINTS).forEach(k => { ADJACENCY[k] = []; });
  WAYPOINT_EDGES.forEach(([a, b]) => {
    const dx = WAYPOINTS[a].x - WAYPOINTS[b].x;
    const dy = WAYPOINTS[a].y - WAYPOINTS[b].y;
    const d = Math.hypot(dx, dy);
    ADJACENCY[a].push({ id: b, dist: d });
    ADJACENCY[b].push({ id: a, dist: d });
  });

  function nearestWaypoint(x, y) {
    let best = 'lc_maple';
    let bestD = Infinity;
    for (const [id, pt] of Object.entries(WAYPOINTS)) {
      const d = Math.hypot(pt.x - x, pt.y - y);
      if (d < bestD) { bestD = d; best = id; }
    }
    return best;
  }

  function findPath(fromX, fromY, targetNodeId) {
    const startId = nearestWaypoint(fromX, fromY);
    if (startId === targetNodeId) {
      return [{ ...WAYPOINTS[targetNodeId] }];
    }
    const dist = {};
    const prev = {};
    const visited = new Set();
    Object.keys(WAYPOINTS).forEach(k => { dist[k] = Infinity; });
    dist[startId] = 0;

    while (true) {
      let u = null;
      let uDist = Infinity;
      for (const k of Object.keys(WAYPOINTS)) {
        if (!visited.has(k) && dist[k] < uDist) {
          u = k; uDist = dist[k];
        }
      }
      if (!u || u === targetNodeId) break;
      visited.add(u);
      for (const edge of ADJACENCY[u]) {
        const alt = dist[u] + edge.dist;
        if (alt < dist[edge.id]) {
          dist[edge.id] = alt;
          prev[edge.id] = u;
        }
      }
    }

    const path = [];
    let cur = targetNodeId;
    while (cur) {
      path.unshift({ ...WAYPOINTS[cur] });
      if (cur === startId) break;
      cur = prev[cur];
    }
    return path.length ? path : [{ ...WAYPOINTS[targetNodeId] }];
  }

  // Pixel trees placed cleanly across parks, greenways & lawns inside zoomed Central Campus
  const TREES = [
    // Central Campus Greenway canopy
    [18,74],[34,88],[62,72],[96,84],[144,78],[214,76],[286,54],[302,44],
    // NE Greenway edge
    [348,22],[386,20],[426,24],[468,20],[494,30],
    // Legacy Park (south of LIB) & South Alumni lawn
    [194,232],[214,244],[202,258],[226,238],
    [22,286],[58,294],[94,290],[132,296],[198,296],[244,298],[288,298],[344,302],[408,304],
    // West & North lawns around FAH / Engineering
    [16,32],[20,128],[66,134],[90,142],[148,144],
    // East campus edges
    [328,118],[492,126],[498,232],[496,282],
  ];

  // Sample realistic tasks & generated diffs for dynamic agent dispatches
  const SAMPLE_TASKS = {
    ENB: [
      {
        task: 'Optimize WebSocket lease broadcast loop',
        reason: 'Reduce heartbeat jitter when 3+ Claude agents edit concurrently.',
        summary: 'Batched lease state deltas into 60ms frames with zero dropped packets.',
        file: '/backend/ws/leaseHub.ts',
        diff: [
          { type: 'del', text: 'clients.forEach(c => c.send(JSON.stringify(fullState)));' },
          { type: 'add', text: 'const delta = computeLeaseDelta(prevState, nextState);' },
          { type: 'add', text: 'broadcastDelta(clients, delta);' },
        ]
      },
      {
        task: 'Add rollback endpoint for single-agent undo',
        reason: 'Allow engineers to revert only Agent 2 commits without touching peers.',
        summary: 'Implemented selective cherry-revert filter keyed by Agent-Id trailer.',
        file: '/backend/git/undoAgent.ts',
        diff: [
          { type: 'add', text: 'export async function undoAgentCommits(agentId: string) {' },
          { type: 'add', text: '  const shas = await findCommitsByAgent(agentId);' },
          { type: 'add', text: '  return gitRevertSequence(shas);' },
          { type: 'add', text: '}' },
        ]
      }
    ],
    MSC: [
      {
        task: 'Add pixel-art construction crane & ribbon FX',
        reason: 'Give immediate visual feedback when a folder enters build or completion.',
        summary: 'Built multi-frame crane swing, safety cones, scaffolding, and scissor snip.',
        file: '/frontend/canvas/buildingFx.ts',
        diff: [
          { type: 'add', text: 'if (bldg.state === "working") drawConstructionSite(ctx, bldg, t);' },
          { type: 'add', text: 'if (bldg.state === "ribbon") drawRibbonCutting(ctx, bldg, t);' },
        ]
      },
      {
        task: 'Wire building hover tooltip & folder mapper',
        reason: 'Let users inspect mapped folders and customize paths in Options.',
        summary: 'Added instant hover folder badge and live building-to-path rebinding.',
        file: '/frontend/ui/optionsModal.ts',
        diff: [
          { type: 'add', text: 'building.folder = sanitizeFolderPath(input.value);' },
          { type: 'add', text: 'emit("campus:mapping-updated", building);' },
        ]
      }
    ],
    LIB: [
      {
        task: 'Write USF HackJam Devpost architecture guide',
        reason: 'Document how Bullpen separates agent leases from human git workflows.',
        summary: 'Added Campus Metaphor table and 3-minute live demo walkthrough.',
        file: '/docs/ARCHITECTURE.md',
        diff: [
          { type: 'add', text: '| Building | Folder | Protection |' },
          { type: 'add', text: '| Sun Dome | /database | Guarded Zone |' },
        ]
      }
    ],
    SUN: [
      {
        task: 'Add safe additive index on audit_events(agent_id)',
        reason: 'Speed up "why did login change?" history queries by 8x.',
        summary: 'Created CONCURRENTLY index with zero table lock downtime.',
        file: '/database/migrations/005_audit_idx.sql',
        diff: [
          { type: 'add', text: 'CREATE INDEX CONCURRENTLY idx_audit_agent ON audit_events(agent_id);' },
        ]
      }
    ],
    BSN: [
      {
        task: 'Update Claude Haiku fallback concurrency limit',
        reason: 'Prevent burst edits during rapid doc updates.',
        summary: 'Set max concurrent leases per Claude model in bullpen.config.json.',
        file: '/config/bullpen.config.json',
        diff: [
          { type: 'add', text: '"maxConcurrentLeasesPerAgent": 1,' },
        ]
      }
    ],
    ISA: [
      {
        task: 'Add lease queue & timeout kick-out test suite',
        reason: 'Verify waiting agents enter /backend cleanly after completion or eviction.',
        summary: 'Added 6 deterministic waiting-queue and timeout handoff tests.',
        file: '/tests/queue.spec.ts',
        diff: [
          { type: 'add', text: 'expect(state.getWaitingAgentsOnBuilding("ENB").length).toBe(1);' },
        ]
      }
    ],
    REC: [
      {
        task: 'Add pixel sprite atlas verification script',
        reason: 'Ensure every mascot color passes USF contrast guidelines.',
        summary: 'Added automated hex palette checker for USF brand compliance.',
        file: '/scripts/checkPalette.mjs',
        diff: [
          { type: 'add', text: 'assertColorInPalette(agent.primary, USF_OFFICIAL_HEX);' },
        ]
      }
    ],
    FAH: [
      {
        task: 'Polish Rocky Bull pixel mascot walk frames',
        reason: 'Make idle campus patrol lively and crisp at 2x pixel scale.',
        summary: 'Added 4-frame hoof animation and hover halo particles.',
        file: '/assets/sprites/bullMascot.ts',
        diff: [
          { type: 'add', text: 'const bob = state === "working" ? Math.sin(t * 6) * 2.5 : (frame % 2);' },
        ]
      }
    ],
  };

  return {
    WORLD_W,
    WORLD_H,
    BORDER,
    GREENWAY_POLYGONS,
    PONDS,
    ROADS,
    ATHLETICS,
    CONTEXT_BUILDINGS,
    DISTRICT_LABELS,
    DEFAULT_BUILDINGS,
    WAYPOINTS,
    BUILDING_WAYPOINT,
    TREES,
    SAMPLE_TASKS,
    getFolderLabel,
    findPath,
    nearestWaypoint,
  };
})();
