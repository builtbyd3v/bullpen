/* ============================================================================
   BULLPEN — Official USF Brand Palette & Agent Mascot Colors
   Source: https://www.usf.edu/ucm/marketing/colors.aspx
   ============================================================================ */

window.BullpenPalette = (function () {
  const USF = {
    // Primary Core Colors
    green:      '#006747', // USF Green (PMS 342)
    gold:       '#CFC493', // USF Gold (PMS 4535)
    white:      '#FFFFFF',

    // Alternates (Digital Contrast / Accents)
    evergreen:  '#005432', // Evergreen (PMS 3435)
    sand:       '#EDEBD1', // Sand (PMS 614)

    // Official Accent Palette
    lemongrass: '#DBE442', // Lemongrass
    apple:      '#9CCB3B', // Apple (PMS 376)
    teal:       '#009374', // Teal (PMS 341)
    seaglass:   '#80B0A6', // Seaglass (PMS 5503)
    storm:      '#006484', // Storm
    sky:        '#29AFCE', // Sky

    // Official Neutrals
    silver:     '#CAD2D8', // Silver
    gray:       '#7E96A0', // Gray
    slate:      '#466069', // Slate (PMS 7545)

    // Pixel Art Derived Tones (deep shadows & semantic hazard/ribbon accents)
    deepForest: '#003822', // Deep evergreen pixel outline / night shadow
    ink:        '#0D231B', // Pixel ink border (tinted USF Evergreen)
    turfLight:  '#A9C97E', // Campus lawn light (blend of Apple & Sand)
    turfMid:    '#7FA95B', // Campus lawn mid
    turfDark:   '#4E7F47', // Tree canopy mid
    bldgLight:  '#F3D99C', // Reference map warm tan/gold building top
    bldgMid:    '#E2BE74', // Reference map building body
    bldgDark:   '#A68344', // Building pixel shadow
    roadLight:  '#E6EAE7', // Main campus road
    roadMid:    '#C8D1CC', // Road curb / parking lot
    roadDark:   '#8B9B95', // Road edge outline

    // Semantic Construction & Ribbon Accents (used strictly for cones, cranes, alerts, ribbons)
    coneOrange: '#E86A17',
    craneGold:  '#F2B705',
    alertRed:   '#D64045',
    ribbonRed:  '#C8373B',
  };

  // Distinct USF-harmonized colors assigned to each agent (api, web, db)
  const AGENT_COLORS = {
    'agent-api': {
      id: 'agent-api',
      shortName: 'api',
      displayName: 'api agent',
      primary: '#DBE442',     // Lemongrass / Gold jersey
      secondary: '#CFC493',   // USF Gold trim
      accent: '#005432',      // Evergreen outline
      badgeBg: '#3D3B0A',
      badgeText: '#DBE442',
      bullFur: '#5C3A21',     // Warm espresso bull coat
      bullFurLight: '#7A5033',
      horns: '#EDEBD1',
    },
    'agent-web': {
      id: 'agent-web',
      shortName: 'web',
      displayName: 'web agent',
      primary: '#29AFCE',     // Sky jersey
      secondary: '#006484',   // Storm trim
      accent: '#0D231B',
      badgeBg: '#093445',
      badgeText: '#7CE4FA',
      bullFur: '#4E3829',
      bullFurLight: '#6B4E3B',
      horns: '#EDEBD1',
    },
    'agent-db': {
      id: 'agent-db',
      shortName: 'db',
      displayName: 'db agent',
      primary: '#9CCB3B',     // Apple green jersey
      secondary: '#009374',   // Teal trim
      accent: '#003822',
      badgeBg: '#123A24',
      badgeText: '#C5F06B',
      bullFur: '#63412B',
      bullFurLight: '#82583D',
      horns: '#FFFFFF',
    },
  };

  return { USF, AGENT_COLORS };
})();
