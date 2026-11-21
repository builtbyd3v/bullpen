/* ============================================================================
   BULLPEN — Adaptive USF Tampa Campus Greenway Map Data (580 x 364 Master World)
   Exclusively modeled on the provided USF Tampa Campus Greenway reference map.
   Dynamically activates N buildings to match the analyzed repo's folder count
   and computes an exact viewport crop so ALL folders are visible on the map.
   ============================================================================ */

window.BullpenCampusData = (function () {
  const WORLD_W = 580;
  const WORLD_H = 364;

  // Clean folder name shown on building plaques (e.g. "/backend" -> "BACKEND")
  function getFolderLabel(folderPath) {
    const clean = String(folderPath || '')
      .trim()
      .replace(/^\/+/, '')
      .replace(/\/+$/, '');
    return clean ? clean.toUpperCase() : 'ROOT';
  }

  // Diagonal-hatched USF Tampa Campus Greenway polygons (exact reference map)
  const GREENWAY_POLYGONS = [
    // Central Campus Greenway Strip (FAH/MSC -> Castor Pond -> NE Athletics edge)
    [
      [4, 68], [156, 68], [226, 68], [240, 52], [292, 44], [338, 40],
      [338, 70], [292, 74], [272, 92], [224, 92], [212, 102], [76, 102],
      [62, 118], [4, 118]
    ],
    // Lower edge of Northeast Greenway Forest (top-right above Track & Field)
    [
      [342, 4], [576, 4], [576, 52], [342, 52]
    ],
  ];

  // Water bodies inside the master Central Campus region
  const PONDS = [
    { id: 'castor', name: 'Castor Pond', x: 266, y: 64, rx: 22, ry: 11 },
  ];

  // Major USF roads matching the provided reference map
  const ROADS = [
    // USF Leroy Collins Blvd (central N-S spine)
    { name: 'USF Leroy Collins Blvd', width: 10, pts: [[192, 4], [192, 360]] },
    // USF Genshaft Dr (east-central N-S spine)
    { name: 'USF Genshaft Dr',        width: 9,  pts: [[344, 4], [344, 54], [334, 92], [334, 286], [346, 360]] },
    // USF Maple Dr (central E-W avenue above LIB & CPR)
    { name: 'USF Maple Dr',           width: 7,  pts: [[66, 166], [334, 166]] },
    // USF Cedar Dr (west engineering / JP loop)
    { name: 'USF Cedar Dr',           width: 6,  pts: [[66, 116], [126, 116]] },
    { name: 'USF Cedar West',         width: 6,  pts: [[66, 116], [66, 272]] },
    // USF Alumni Dr (southern sweeping boulevard)
    { name: 'USF Alumni Dr',          width: 9,  pts: [[4, 272], [156, 272], [192, 284], [334, 284], [386, 300], [500, 300]] },
    // USF Palm Dr (eastern road between REC/SUN & Athletics)
    { name: 'USF Palm Dr',            width: 6,  pts: [[334, 182], [456, 182], [456, 300]] },
    // USF Sage Dr (between LIB/CPR & BSN)
    { name: 'USF Sage Dr',            width: 6,  pts: [[264, 166], [264, 284]] },
    // MLK Plaza north walkway
    { name: 'USF Holly Plaza',        width: 6,  pts: [[192, 72], [230, 72]] },
  ];

  // USF Recreation & Athletics venues (East side of reference map)
  const ATHLETICS = [
    { type: 'track',    label: 'TRACK',    x: 356, y: 56,  w: 76, h: 40 },
    { type: 'softball', label: 'REC FIELD',x: 444, y: 56,  w: 76, h: 38 },
    { type: 'courts',   label: 'COURTS',   x: 356, y: 100, w: 36, h: 28 },
    { type: 'field',    label: '',         x: 398, y: 100, w: 36, h: 30 },
    { type: 'football', label: 'PRACTICE', x: 444, y: 98,  w: 62, h: 42 },
    { type: 'soccer',   label: 'SOCCER',   x: 462, y: 146, w: 64, h: 40 },
    { type: 'baseball', label: 'BASEBALL', x: 466, y: 194, w: 54, h: 46 },
    { type: 'softball', label: 'SOFTBALL', x: 466, y: 246, w: 46, h: 36 },
    { type: 'football', label: 'FOWLER',   x: 364, y: 312, w: 72, h: 36 },
  ];

  // Always-context supporting campus structures (garages & minor halls)
  const CONTEXT_BUILDINGS = [
    { code: 'CBG', x: 214, y: 118, w: 44, h: 34, isGarage: true },
    { code: 'ALN', x: 184, y: 118, w: 24, h: 20 },
    { code: 'SOC', x: 308, y: 100, w: 20, h: 18 },
    { code: 'BGD', x: 56,  y: 212, w: 28, h: 42, isGarage: true },
    { code: 'ENG', x: 98,  y: 176, w: 24, h: 24 },
    { code: 'ENC', x: 130, y: 172, w: 28, h: 24 },
    { code: 'ATH', x: 426, y: 142, w: 24, h: 34 },
  ];

  const DISTRICT_LABELS = [
    { text: 'CENTRAL CAMPUS', x: 134, y: 84 },
    { text: 'USF ATHLETICS',  x: 438, y: 46 },
  ];

  // ==========================================================================
  // 14-BUILDING MASTER CATALOG (ordered outward from Central Campus heart!)
  // Depending on how many folders the analyzed repo has, the first N slots
  // become active interactive buildings and the map crops tightly around them!
  // ==========================================================================
  const BUILDING_CATALOG = [
    {
      id: 'ENB',
      code: 'ENB',
      name: 'Engineering Building II',
      preferredNames: ['backend', 'server', 'api', 'src', 'core', 'app'],
      x: 96, y: 212, w: 72, h: 46,
      door: { x: 132, y: 272 },
      roofStyle: 'engineering',
      primary: true,
    },
    {
      id: 'LIB',
      code: 'LIB',
      name: 'USF Tampa Library',
      preferredNames: ['docs', 'doc', 'documentation', 'shared', 'wiki', 'guides'],
      x: 206, y: 178, w: 52, h: 42,
      door: { x: 192, y: 202 },
      roofStyle: 'library',
      primary: true,
    },
    {
      id: 'MSC',
      code: 'MSC',
      name: 'Marshall Student Center',
      preferredNames: ['frontend', 'web', 'client', 'ui', 'design', 'pages'],
      x: 158, y: 24, w: 68, h: 44,
      door: { x: 192, y: 74 },
      roofStyle: 'marshall',
      primary: true,
    },
    {
      id: 'SUN',
      code: 'SUN',
      name: 'Sun Dome (Yuengling Center)',
      preferredNames: ['database', 'db', 'sql', 'migrations', 'prisma', 'jetson', 'data'],
      x: 370, y: 192, w: 76, h: 62,
      door: { x: 334, y: 222 },
      roofStyle: 'dome',
      primary: true,
    },
    {
      id: 'BSN',
      code: 'BSN',
      name: 'Muma College of Business',
      preferredNames: ['config', 'configs', 'settings', 'campus', 'packages', 'lib'],
      x: 270, y: 212, w: 56, h: 52,
      door: { x: 298, y: 284 },
      roofStyle: 'courtyard',
      primary: false,
    },
    {
      id: 'ISA',
      code: 'ISA',
      name: 'Interdisciplinary Sciences',
      preferredNames: ['tests', 'test', '__tests__', 'spec', 'hooks', 'evals'],
      x: 124, y: 108, w: 52, h: 38,
      door: { x: 192, y: 128 },
      roofStyle: 'science',
      primary: false,
    },
    {
      id: 'REC',
      code: 'REC',
      name: 'Campus Recreation Center',
      preferredNames: ['scripts', 'tools', 'cli', 'bin', 'ops', 'workflows'],
      x: 348, y: 132, w: 66, h: 38,
      door: { x: 334, y: 152 },
      roofStyle: 'rec',
      primary: false,
    },
    {
      id: 'FAH',
      code: 'FAH',
      name: 'Fine Arts Hall',
      preferredNames: ['assets', 'public', 'static', 'media', 'images', 'styles'],
      x: 56, y: 28, w: 48, h: 40,
      door: { x: 84, y: 116 },
      roofStyle: 'arts',
      primary: false,
    },
    {
      id: 'CPR',
      code: 'CPR',
      name: 'Cooper Hall',
      preferredNames: ['components', 'modules', 'features', 'services', 'routes'],
      x: 270, y: 174, w: 50, h: 26,
      door: { x: 264, y: 186 },
      roofStyle: 'cooper',
      primary: false,
    },
    {
      id: 'SVC',
      code: 'SVC',
      name: 'Student Services',
      preferredNames: ['auth', 'security', 'middleware', 'guards', 'iam'],
      x: 204, y: 78, w: 42, h: 32,
      door: { x: 192, y: 94 },
      roofStyle: 'services',
      primary: false,
    },
    {
      id: 'EDU',
      code: 'EDU',
      name: 'College of Education',
      preferredNames: ['examples', 'demo', 'samples', 'tutorials', 'notebooks'],
      x: 274, y: 122, w: 44, h: 32,
      door: { x: 264, y: 166 },
      roofStyle: 'education',
      primary: false,
    },
    {
      id: 'JP',
      code: 'JP',
      name: 'Juniper-Poplar Hall',
      preferredNames: ['mobile', 'ios', 'android', 'desktop', 'native'],
      x: 18, y: 174, w: 44, h: 38,
      door: { x: 66, y: 192 },
      roofStyle: 'residence',
      primary: false,
    },
    {
      id: 'UTB',
      code: 'UTB',
      name: 'University Tower South',
      preferredNames: ['infra', 'deploy', 'terraform', 'docker', 'k8s', 'ci'],
      x: 96, y: 298, w: 56, h: 42,
      door: { x: 124, y: 272 },
      roofStyle: 'tower',
      primary: false,
    },
    {
      id: 'ALC',
      code: 'ALC',
      name: 'USF Alumni Center',
      preferredNames: ['analytics', 'metrics', 'telemetry', 'monitoring', 'logs'],
      x: 268, y: 300, w: 60, h: 42,
      door: { x: 298, y: 284 },
      roofStyle: 'alumni',
      primary: false,
    },
  ];

  // Quick presets for the Pre-Map Repository Analyzer
  const REPO_PRESETS = [
    {
      id: 'micro',
      label: 'Micro Repo (3 folders)',
      root: 'bullpen-micro/',
      folders: ['/backend', '/frontend', '/docs'],
      desc: 'Tightly cropped Core Campus — 3 large buildings',
    },
    {
      id: 'mvp',
      label: 'Bullpen MVP (4 folders)',
      root: 'bullpen-mvp/',
      folders: ['/backend', '/frontend', '/docs', '/database'],
      desc: 'Focused Core Campus — 4 primary buildings',
    },
    {
      id: 'bullpen',
      label: 'builtbyd3v/bullpen (8 folders)',
      root: 'bullpen/',
      folders: ['/server', '/web', '/campus', '/jetson', '/shared', '/hooks', '/scripts', '/assets'],
      desc: 'Actual Bullpen repo layout — Central Campus + Athletics',
    },
    {
      id: 'monorepo',
      label: 'USF Monorepo (12 folders)',
      root: 'usf-monorepo/',
      folders: ['/backend', '/frontend', '/docs', '/database', '/config', '/tests', '/scripts', '/assets', '/services', '/auth', '/mobile', '/infra'],
      desc: 'Expanded Campus view — 12 buildings across campus',
    },
  ];

  // ==========================================================================
  // SMART FOLDER -> BUILDING ASSIGNMENT & DYNAMIC CAMPUS CROP CALCULATION
  // ==========================================================================
  function normalizeFolder(f) {
    const clean = String(f || '').trim().replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '');
    return clean ? '/' + clean : '';
  }

  function isGuardedFolder(folder) {
    const lower = folder.toLowerCase();
    return /database|(^|\/)db($|\/)|migrations|schema|prod|secrets|jetson/.test(lower);
  }

  function createSampleChangeForFolder(folder, idx) {
    const label = getFolderLabel(folder).toLowerCase();
    const models = ['claude-opus-4-6', 'claude-sonnet-4-6', 'claude-haiku-4-5'];
    const modelId = models[idx % models.length];
    const agentId = `agent-${(idx % 3) + 1}`;
    const commits = ['a4f91c2', 'c82e0b7', '71d4e9a', 'e09a31f', '5b912cc', '9d3a10e', '3f88b21', 'f12c4d9'];
    const times = ['11:24 AM', '11:21 AM', '11:18 AM', '11:15 AM', '11:12 AM', '11:09 AM', '11:05 AM', '11:02 AM'];
    return {
      id: `chg-init-${idx}`,
      commit: commits[idx % commits.length],
      agentId,
      modelId,
      time: times[idx % times.length],
      task: `Initialize & verify module structure in ${folder}`,
      reason: `Scanned from repository analysis for ${folder} folder lease.`,
      summary: `Synced ${folder} handlers and verified lease boundaries.`,
      files: [
        {
          path: `${folder}/index.ts`,
          added: 14 + (idx * 3) % 18,
          removed: 2 + (idx % 4),
          diff: [
            { type: 'ctx', text: `// Folder lease root: ${folder}` },
            { type: 'add', text: `export const MODULE_NAME = "${label}";` },
            { type: 'add', text: `export const LEASE_GUARD = ${isGuardedFolder(folder)};` },
          ]
        }
      ]
    };
  }

  // Build exactly N active buildings for the analyzed repository folders
  function buildBuildingsForFolders(rawFolders) {
    const unique = [];
    const seen = new Set();
    rawFolders.forEach(f => {
      const norm = normalizeFolder(f);
      if (norm && !seen.has(norm.toLowerCase())) {
        seen.add(norm.toLowerCase());
        unique.push(norm);
      }
    });

    const capped = unique.slice(0, BUILDING_CATALOG.length);
    if (!capped.length) capped.push('/src');

    const count = capped.length;
    // Choose the tightest N building slots from the master catalog (ordered from center outward!)
    const activeSlots = BUILDING_CATALOG.slice(0, count);

    // Smart semantic matching within the active N slots so /backend -> ENB, /frontend -> MSC, /docs -> LIB, /database -> SUN!
    const assigned = new Map(); // slotIndex -> folder
    const unassignedFolders = [];

    capped.forEach(folder => {
      const seg = getFolderLabel(folder).toLowerCase().split('/').pop();
      const matchIdx = activeSlots.findIndex((slot, i) =>
        !assigned.has(i) && slot.preferredNames.includes(seg)
      );
      if (matchIdx !== -1) {
        assigned.set(matchIdx, folder);
      } else {
        unassignedFolders.push(folder);
      }
    });

    // Fill remaining active slots in order
    let u = 0;
    for (let i = 0; i < activeSlots.length; i++) {
      if (!assigned.has(i) && u < unassignedFolders.length) {
        assigned.set(i, unassignedFolders[u++]);
      }
    }

    return activeSlots.map((slot, idx) => {
      const folder = assigned.get(idx) || `/folder-${idx + 1}`;
      const guarded = isGuardedFolder(folder);
      const change = createSampleChangeForFolder(folder, idx);
      return {
        ...slot,
        door: { ...slot.door },
        defaultFolder: folder,
        folder,
        guarded,
        description: `Mapped repository folder ${folder} (${slot.name}).`,
        summary: change.summary,
        changes: [change],
      };
    });
  }

  // Compute an exact pixel viewport crop that guarantees ALL active buildings
  // (plus their construction cranes, doors, & waiting lines) are 100% visible!
  function computeCropRect(activeBuildings) {
    if (!activeBuildings || !activeBuildings.length) {
      return { x: 0, y: 0, w: WORLD_W, h: WORLD_H, tierLabel: 'FULL CAMPUS' };
    }

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    activeBuildings.forEach(b => {
      minX = Math.min(minX, b.x - 24, b.door.x - 24);
      minY = Math.min(minY, b.y - 24, b.door.y - 20);
      // Right padding includes tower crane (~24px); bottom padding includes plaque & waiting Bull (~30px)
      maxX = Math.max(maxX, b.x + b.w + 34, b.door.x + 28);
      maxY = Math.max(maxY, b.y + b.h + 32, b.door.y + 26);
    });

    const n = activeBuildings.length;
    // Allow small repos (1-3 folders) to crop tighter instead of pulling in empty eastern lots
    const targetAspect = n <= 3 ? 1.28 : 1.60;
    let cw = Math.max(260, maxX - minX);
    let ch = Math.max(182, maxY - minY);

    if (cw / ch < targetAspect) {
      cw = ch * targetAspect;
    } else {
      ch = cw / targetAspect;
    }

    cw = Math.min(WORLD_W, Math.ceil(cw));
    ch = Math.min(WORLD_H, Math.ceil(ch));

    if (cw === WORLD_W) ch = Math.min(WORLD_H, Math.max(ch, Math.round(WORLD_W / targetAspect)));
    if (ch === WORLD_H) cw = Math.min(WORLD_W, Math.max(cw, Math.round(WORLD_H * targetAspect)));

    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    let rx = Math.round(cx - cw / 2);
    let ry = Math.round(cy - ch / 2);

    rx = Math.max(0, Math.min(WORLD_W - cw, rx));
    ry = Math.max(0, Math.min(WORLD_H - ch, ry));

    const tierLabel = n <= 3
      ? 'TIGHT CORE CROP'
      : (n <= 5 ? 'CORE CAMPUS CROP' : (n <= 8 ? 'CENTRAL + ATHLETICS CROP' : 'EXPANDED CAMPUS VIEW'));

    return { x: rx, y: ry, w: cw, h: ch, tierLabel };
  }

  // ==========================================================================
  // CAMPUS WALKING PATH GRAPH (Covers all 14 master campus buildings!)
  // ==========================================================================
  const WAYPOINTS = {
    lc_msc:     { x: 192, y: 74 },
    lc_svc:     { x: 192, y: 94 },
    lc_isa:     { x: 192, y: 128 },
    lc_maple:   { x: 192, y: 166 },
    lc_lib:     { x: 192, y: 202 },
    lc_alumni:  { x: 192, y: 284 },
    lc_south:   { x: 192, y: 332 },

    cedar_nw:   { x: 66,  y: 116 },
    fah_door:   { x: 84,  y: 116 },
    cedar_isa:  { x: 126, y: 116 },
    cedar_mid:  { x: 66,  y: 166 },
    jp_door:    { x: 66,  y: 192 },
    cedar_s:    { x: 66,  y: 272 },
    enb_door:   { x: 132, y: 272 },

    maple_mid:  { x: 264, y: 166 },
    cpr_door:   { x: 264, y: 186 },
    maple_e:    { x: 334, y: 166 },
    sage_s:     { x: 264, y: 284 },
    bsn_door:   { x: 298, y: 284 },

    gen_north:  { x: 334, y: 92 },
    gen_rec:    { x: 334, y: 152 },
    gen_palm:   { x: 334, y: 182 },
    gen_sun:    { x: 334, y: 222 },
    gen_alumni: { x: 334, y: 284 },

    palm_e:     { x: 456, y: 182 },
    palm_s:     { x: 456, y: 300 },
    alumni_se:  { x: 386, y: 300 },
  };

  const WAYPOINT_EDGES = [
    ['lc_msc', 'lc_svc'],
    ['lc_svc', 'lc_isa'],
    ['lc_isa', 'lc_maple'],
    ['lc_maple', 'lc_lib'],
    ['lc_lib', 'lc_alumni'],
    ['lc_alumni', 'lc_south'],

    ['cedar_nw', 'fah_door'],
    ['fah_door', 'cedar_isa'],
    ['cedar_isa', 'lc_isa'],
    ['cedar_nw', 'cedar_mid'],
    ['cedar_mid', 'jp_door'],
    ['jp_door', 'cedar_s'],
    ['cedar_mid', 'lc_maple'],
    ['cedar_s', 'enb_door'],
    ['enb_door', 'lc_alumni'],

    ['lc_maple', 'maple_mid'],
    ['maple_mid', 'maple_e'],
    ['maple_mid', 'cpr_door'],
    ['cpr_door', 'sage_s'],
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
    CPR: 'cpr_door',
    SVC: 'lc_svc',
    EDU: 'maple_mid',
    JP:  'jp_door',
    UTB: 'enb_door',
    ALC: 'bsn_door',
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

  const TREES = [
    [24,84],[46,98],[84,82],[118,94],[164,88],[236,84],[308,64],[324,52],
    [370,26],[410,22],[450,28],[492,24],[540,34],
    [216,242],[236,254],[224,268],[248,248],
    [30,308],[66,316],[168,318],[226,318],[252,334],[344,332],[454,328],[510,322],
    [22,42],[30,140],[88,144],[112,152],[170,152],
    [350,126],[534,136],[540,242],[534,296],
  ];

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
      }
    ],
    LIB: [
      {
        task: 'Document folder lease queue & timeout eviction',
        reason: 'Keep contributor docs aligned with waiting-at-door and kick-out handoff.',
        summary: 'Added state diagram and examples for queued agents and lease timeouts.',
        file: '/docs/LEASE_PROTOCOL.md',
        diff: [
          { type: 'add', text: 'Waiting agents line up outside the door and enter on release or eviction.' },
        ]
      }
    ],
    SUN: [
      {
        task: 'Add safe additive index on audit_events(agent_id)',
        reason: 'Speed up history queries with zero table lock downtime.',
        summary: 'Created CONCURRENTLY index for fast agent commit lookups.',
        file: '/database/migrations/005_audit_idx.sql',
        diff: [
          { type: 'add', text: 'CREATE INDEX CONCURRENTLY idx_audit_agent ON audit_events(agent_id);' },
        ]
      }
    ],
  };

  return {
    WORLD_W,
    WORLD_H,
    GREENWAY_POLYGONS,
    PONDS,
    ROADS,
    ATHLETICS,
    CONTEXT_BUILDINGS,
    DISTRICT_LABELS,
    BUILDING_CATALOG,
    REPO_PRESETS,
    WAYPOINTS,
    BUILDING_WAYPOINT,
    TREES,
    SAMPLE_TASKS,
    getFolderLabel,
    normalizeFolder,
    buildBuildingsForFolders,
    computeCropRect,
    findPath,
    nearestWaypoint,
  };
})();
