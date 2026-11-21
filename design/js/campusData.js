/* ============================================================================
   BULLPEN — USF Tampa Campus Greenway Map Data (512 x 350 pixel-art world)
   Coordinates mapped exclusively from the provided USF Tampa Campus Greenway
   reference map (E Fletcher Ave, E Fowler Ave, Bruce B Downs Blvd, N 50th St).
   ============================================================================ */

window.BullpenCampusData = (function () {
  const WORLD_W = 512;
  const WORLD_H = 350;

  // Campus boundary inside the four perimeter roads
  const BORDER = { x: 10, y: 10, w: 490, h: 326 };

  // Diagonal-hatched USF Tampa Campus Greenway polygons (exact map reference)
  const GREENWAY_POLYGONS = [
    // 1. West Greenway Preserve (south of USF Health, wrapping around HPC & Lake Behnke)
    [
      [11, 158], [46, 158], [52, 168], [52, 194], [64, 200], [82, 198],
      [88, 184], [90, 160], [110, 152], [182, 152], [182, 178], [134, 178],
      [130, 212], [126, 258], [66, 258], [62, 282], [11, 282]
    ],
    // 2. Central Campus Greenway Strip (cutting E-W between FAH/MSC and ISA/SVC to Castor Pond)
    [
      [182, 146], [286, 146], [292, 130], [344, 126], [378, 124],
      [378, 146], [336, 148], [322, 160], [284, 160], [276, 168], [182, 168]
    ],
    // 3. Northeast Greenway Forest (huge NE preserve bordering Fletcher Ave & N 50th St)
    [
      [432, 11], [499, 11], [499, 134], [380, 134], [380, 74],
      [402, 58], [420, 44], [430, 24]
    ],
  ];

  // Water bodies on the reference map
  const PONDS = [
    // Lake Behnke (West Greenway)
    { id: 'behnke', name: 'Lake Behnke', x: 34, y: 204, rx: 14, ry: 22 },
    // Simmons Park Pond (SW below Alumni Dr)
    { id: 'simmons', name: 'Simmons Pond', x: 118, y: 296, rx: 22, ry: 12 },
    // Castor Pond (Central Campus Greenway NE of SVC)
    { id: 'castor', name: 'Castor Pond', x: 312, y: 142, rx: 14, ry: 8 },
    // North Village Pond (top center-east near Fletcher)
    { id: 'north_pond', name: 'North Pond', x: 348, y: 20, rx: 10, ry: 5 },
  ];

  // Major internal & perimeter campus roads (drawn as crisp pixel corridors)
  const ROADS = [
    // Perimeter roads
    { name: 'E Fletcher Ave',   width: 8, pts: [[0, 5], [512, 5]] },
    { name: 'E Fowler Ave',     width: 8, pts: [[0, 343], [512, 343]] },
    { name: 'Bruce B Downs',    width: 8, pts: [[5, 0], [5, 350]] },
    { name: 'N 50th St',        width: 8, pts: [[506, 0], [506, 350]] },

    // USF Leroy Collins Blvd (central main N-S spine)
    { name: 'USF Leroy Collins Blvd', width: 7, pts: [[270, 10], [270, 343]] },
    // USF Genshaft Dr (east-central N-S spine between Central Campus & Athletics/SUN)
    { name: 'USF Genshaft Dr',        width: 6, pts: [[378, 10], [378, 136], [362, 162], [362, 286], [370, 336]] },
    // USF Magnolia Dr (west-central N-S road east of USF Health)
    { name: 'USF Magnolia Dr',        width: 5, pts: [[124, 10], [124, 152], [134, 178], [134, 266]] },
    // USF Holly Dr (northern E-W corridor)
    { name: 'USF Holly Dr',           width: 5, pts: [[10, 79], [160, 79], [186, 106], [378, 106]] },
    // USF Maple Dr / Cherry Dr (central E-W road north of LIB & CPR)
    { name: 'USF Maple Dr',           width: 5, pts: [[182, 212], [362, 212]] },
    // USF Cedar Dr (loop around Juniper-Poplar & Engineering)
    { name: 'USF Cedar Dr',           width: 4, pts: [[134, 188], [190, 188], [190, 266]] },
    // USF Alumni Dr (southern curved E-W boulevard)
    { name: 'USF Alumni Dr',          width: 6, pts: [[134, 266], [224, 266], [250, 280], [362, 280], [398, 294], [462, 294]] },
    // USF Palm Dr (Athletics / Sun Dome east road)
    { name: 'USF Palm Dr',            width: 4, pts: [[362, 224], [434, 224], [434, 294]] },
    // USF Pine Dr / Simmons Park path (SW)
    { name: 'USF Pine Dr',            width: 4, pts: [[10, 284], [64, 284], [94, 266], [134, 266]] },
    // USF Sage Dr (south-east of Library)
    { name: 'USF Sage Dr',            width: 4, pts: [[306, 212], [306, 280]] },
  ];

  // Athletic fields & stadiums on the East side (USF Recreation & Athletics) + South Fowler Fields
  const ATHLETICS = [
    // Track & Field Stadium (oval terracotta track + green infield)
    { type: 'track',    label: 'TRACK',    x: 382, y: 138, w: 46, h: 25 },
    // Recreation Softball Complex (NE of Track)
    { type: 'softball', label: 'REC FIELD',x: 438, y: 138, w: 44, h: 24 },
    // Tennis / Basketball Courts (south of Track)
    { type: 'courts',   label: 'COURTS',   x: 382, y: 166, w: 22, h: 18 },
    // Athletic Practice Field
    { type: 'field',    label: '',         x: 408, y: 166, w: 26, h: 22 },
    // Football Practice Fields (with white yard lines)
    { type: 'football', label: 'PRACTICE', x: 438, y: 166, w: 36, h: 26 },
    // Corbett Soccer Park Stadium
    { type: 'soccer',   label: 'SOCCER',   x: 442, y: 198, w: 44, h: 26 },
    // Baseball Stadium (east of SUN)
    { type: 'baseball', label: 'BASEBALL', x: 442, y: 232, w: 34, h: 28 },
    // Softball Stadium (south of Baseball)
    { type: 'softball', label: 'SOFTBALL', x: 442, y: 265, w: 28, h: 22 },
    // Fowler Fields Complex (SE near Fowler Ave)
    { type: 'football', label: 'FOWLER',   x: 382, y: 306, w: 40, h: 22 },
    // North Tennis Courts (near Village)
    { type: 'courts',   label: '',         x: 346, y: 46,  w: 16, h: 20 },
  ];

  // Non-interactive context buildings matching the reference map's exact clusters
  const CONTEXT_BUILDINGS = [
    // USF Health (NW cluster)
    { code: 'NEC', x: 18, y: 18, w: 20, h: 20 },
    { code: 'CPH', x: 24, y: 42, w: 16, h: 16 },
    { code: 'VHA', x: 44, y: 36, w: 14, h: 20 },
    { code: 'MDT', x: 56, y: 18, w: 24, h: 24 },
    { code: 'VDA', x: 16, y: 92, w: 26, h: 22 },
    { code: 'MDC', x: 20, y: 116, w: 34, h: 30 },
    { code: 'MCR', x: 74, y: 94, w: 28, h: 42 },
    { code: 'CRB', x: 84, y: 78, w: 24, h: 12 },
    // West-Center (between Magnolia & Central)
    { code: 'MDH', x: 132, y: 44, w: 22, h: 22 },
    { code: 'LDG', x: 158, y: 46, w: 22, h: 16 },
    { code: 'MDC2',x: 132, y: 14, w: 28, h: 22 },
    { code: 'MUS', x: 160, y: 96, w: 22, h: 18 },
    { code: 'PED', x: 144, y: 118, w: 34, h: 12 },
    // HPC inside West Greenway clearing
    { code: 'HPC', x: 60, y: 168, w: 24, h: 24 },
    // North Central & The Village / Holly Apartments / Greek Village
    { code: 'CPT', x: 200, y: 44, w: 46, h: 42 },
    { code: 'VIL1',x: 284, y: 34, w: 18, h: 28 },
    { code: 'VIL2',x: 306, y: 34, w: 24, h: 24 },
    { code: 'HLY', x: 296, y: 68, w: 62, h: 24 },
    { code: 'GRK1',x: 388, y: 20, w: 16, h: 14 },
    { code: 'GRK2',x: 408, y: 30, w: 14, h: 14 },
    // Central Campus supporting buildings
    { code: 'SVC', x: 274, y: 150, w: 22, h: 24 },
    { code: 'CBG', x: 282, y: 176, w: 30, h: 22, isGarage: true },
    { code: 'ALN', x: 256, y: 178, w: 20, h: 14 },
    { code: 'EDU', x: 316, y: 190, w: 22, h: 18 },
    { code: 'SOC', x: 342, y: 174, w: 20, h: 16 },
    { code: 'CPR', x: 314, y: 218, w: 26, h: 14 },
    { code: 'CIS', x: 312, y: 242, w: 14, h: 18 },
    { code: 'BGD', x: 184, y: 234, w: 20, h: 26, isGarage: true },
    { code: 'JP',  x: 148, y: 214, w: 26, h: 20 },
    { code: 'ENG', x: 214, y: 218, w: 16, h: 16 },
    { code: 'ENC', x: 234, y: 214, w: 18, h: 16 },
    // South / SW below Alumni Dr
    { code: 'OHB', x: 112, y: 274, w: 22, h: 14 },
    { code: 'UTB', x: 156, y: 276, w: 16, h: 22 },
    { code: 'UTA', x: 180, y: 276, w: 16, h: 22 },
    { code: 'ESH', x: 176, y: 308, w: 20, h: 18 },
    { code: 'ALC', x: 318, y: 306, w: 24, h: 18 },
    { code: 'ATH', x: 422, y: 194, w: 16, h: 24 },
    { code: 'IPF', x: 478, y: 166, w: 16, h: 28 },
  ];

  // District labels matching the reference map
  const DISTRICT_LABELS = [
    { text: 'USF HEALTH',       x: 68,  y: 112 },
    { text: 'CENTRAL CAMPUS',   x: 228, y: 158 },
    { text: 'USF ATHLETICS',    x: 452, y: 128 },
    { text: 'SIMMONS PARK',     x: 114, y: 320 },
  ];

  // ==========================================================================
  // INTERACTIVE BUILDINGS (Each represents a repository folder — editable in Options!)
  // Default mapping directly follows the Bullpen spec:
  //   ENB = /backend, MSC = /frontend, LIB = /docs, SUN = /database (Guarded)
  // Plus 4 additional real USF campus landmarks from the exact map!
  // ==========================================================================
  const DEFAULT_BUILDINGS = [
    {
      id: 'ENB',
      code: 'ENB',
      name: 'Engineering Building II',
      defaultFolder: '/backend',
      folder: '/backend',
      x: 210, y: 238, w: 40, h: 24,
      door: { x: 232, y: 266 }, // on Alumni Dr
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
      x: 248, y: 112, w: 38, h: 28,
      door: { x: 270, y: 142 }, // right on Leroy Collins Blvd / MLK Plaza
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
      x: 278, y: 218, w: 30, h: 22,
      door: { x: 270, y: 228 }, // facing Leroy Collins Blvd
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
      x: 386, y: 226, w: 42, h: 36,
      door: { x: 362, y: 244 }, // facing Genshaft Dr
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
      x: 326, y: 242, w: 30, h: 28,
      door: { x: 340, y: 280 }, // Alumni Dr
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
      x: 224, y: 170, w: 28, h: 22,
      door: { x: 270, y: 184 }, // Leroy Collins Blvd
      roofStyle: 'science',
      primary: false,
      guarded: false,
      description: 'Automated integration suites, fuzzers, and regression harnesses.',
      summary: 'Added 14 lease contention unit tests — all passing.',
      changes: []
    },
    {
      id: 'REC',
      code: 'REC',
      name: 'Campus Recreation Center',
      defaultFolder: '/scripts',
      folder: '/scripts',
      x: 372, y: 190, w: 38, h: 22,
      door: { x: 362, y: 202 }, // Genshaft Dr
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
      x: 188, y: 120, w: 24, h: 26,
      door: { x: 214, y: 146 },
      roofStyle: 'arts',
      primary: false,
      guarded: false,
      description: 'Pixel sprites, campus tilesets, and USF mascot artwork.',
      summary: 'Exported crisp 16x16 Rocky Bull walk-cycle frames.',
      changes: []
    }
  ];

  // ==========================================================================
  // CAMPUS WALKING PATH GRAPH (so idle & dispatched Bulls walk on REAL roads!)
  // ==========================================================================
  const WAYPOINTS = {
    // Leroy Collins Blvd (N-S spine)
    lc_north:   { x: 270, y: 106 },
    lc_msc:     { x: 270, y: 142 },
    lc_isa:     { x: 270, y: 184 },
    lc_maple:   { x: 270, y: 212 },
    lc_lib:     { x: 270, y: 228 },
    lc_alumni:  { x: 270, y: 280 },
    lc_south:   { x: 270, y: 318 },

    // Holly Dr & North Plaza
    holly_w:    { x: 186, y: 106 },
    fah_door:   { x: 214, y: 146 },
    holly_e:    { x: 378, y: 106 },

    // Magnolia & Cedar Dr (West Central)
    mag_holly:  { x: 124, y: 79 },
    cedar_nw:   { x: 190, y: 188 },
    cedar_mid:  { x: 190, y: 212 },
    cedar_s:    { x: 190, y: 266 },
    enb_door:   { x: 232, y: 266 },

    // Maple Dr & Sage Dr (Central)
    maple_mid:  { x: 306, y: 212 },
    maple_e:    { x: 362, y: 212 },
    sage_s:     { x: 306, y: 280 },
    bsn_door:   { x: 340, y: 280 },

    // Genshaft Dr (East-Central)
    gen_north:  { x: 378, y: 136 },
    gen_rec:    { x: 362, y: 202 },
    gen_palm:   { x: 362, y: 224 },
    gen_sun:    { x: 362, y: 244 },
    gen_alumni: { x: 362, y: 280 },

    // Athletics & Palm Dr
    palm_e:     { x: 434, y: 224 },
    palm_s:     { x: 434, y: 294 },
    alumni_se:  { x: 398, y: 294 },
  };

  const WAYPOINT_EDGES = [
    ['lc_north', 'lc_msc'],
    ['lc_msc', 'lc_isa'],
    ['lc_isa', 'lc_maple'],
    ['lc_maple', 'lc_lib'],
    ['lc_lib', 'lc_alumni'],
    ['lc_alumni', 'lc_south'],

    ['holly_w', 'lc_north'],
    ['lc_north', 'holly_e'],
    ['holly_w', 'fah_door'],
    ['fah_door', 'lc_msc'],
    ['holly_e', 'gen_north'],

    ['cedar_nw', 'cedar_mid'],
    ['cedar_mid', 'cedar_s'],
    ['cedar_mid', 'lc_maple'],
    ['cedar_s', 'enb_door'],
    ['enb_door', 'lc_alumni'],
    ['fah_door', 'cedar_nw'],

    ['lc_maple', 'maple_mid'],
    ['maple_mid', 'maple_e'],
    ['maple_mid', 'sage_s'],
    ['lc_alumni', 'sage_s'],
    ['sage_s', 'bsn_door'],
    ['bsn_door', 'gen_alumni'],

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

  // Building ID -> nearest graph waypoint for clean pathfinding
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

  // Precomputed adjacency list for shortest-path BFS/Dijkstra on campus roads
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

  // Pixel trees placed authentically around campus parks & greenways
  const TREES = [
    // Simmons Park & SW
    [22,298],[42,312],[60,300],[78,318],[92,312],[146,312],[158,322],[212,312],[232,324],[252,306],
    // Legacy Park (below LIB) & South Lawn
    [282,254],[294,262],[288,298],[302,316],[352,310],[366,298],
    // Central Campus & Greenway edges
    [152,164],[170,160],[200,158],[236,154],[298,154],[332,158],[352,148],[358,132],
    // North Campus & Village lawns
    [104,24],[114,54],[190,26],[252,26],[262,64],[334,24],[364,26],[366,86],
    // East & Athletics perimeter
    [412,30],[448,30],[474,42],[484,78],[458,92],[422,94],[400,114],[472,114],
    [486,240],[486,272],[476,304],[444,316],[486,320],
    // West Preserve canopy accents
    [26,172],[48,224],[72,236],[96,222],[110,192],[94,166],[22,256],[44,268],
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
          { type: 'add', text: '| SUN (Sun Dome) | /database | Guarded Zone |' },
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
    findPath,
    nearestWaypoint,
  };
})();
