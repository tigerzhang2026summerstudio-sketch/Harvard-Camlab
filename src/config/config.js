/**
 * config.js — EVERY artist-tunable value lives here.
 *
 * Open this file, change a number, save: the dev server hot-reloads.
 * No visual/audio constant should be buried inside a module.
 *
 * Sections: DISPLAY · PALETTE · PARTICLES · ACTS & TRANSITIONS ·
 *           AUDIO · CAPTIONS · QUALITY
 */

export const config = {
  // ── DISPLAY / WORLD ────────────────────────────────────────────────
  // The "world" is one continuous horizontal panorama across all walls.
  // All layout math is done in world units relative to these two values,
  // so switching from a single monitor to the three-projector Cave is
  // ONLY a config change (e.g. worldWidth: 5760, worldHeight: 1080).
  worldWidth: 1920,
  worldHeight: 1080,

  // Cap the device pixel ratio: retina 2x is plenty, more wastes GPU.
  maxPixelRatio: 2,

  // Hide the mouse cursor after this many ms of inactivity (show mode).
  cursorHideDelayMs: 3000,

  // ── PALETTE (Dunhuang Cave 217 mineral pigments, as light) ─────────
  palette: {
    background: '#000000',   // pure black — bloom threshold must keep it black
    beryl:      '#1e6fb0',   // luminous beryl blue (the ground, low keys)
    lapis:      '#173d7a',   // deep lapis blue (shadow tones, sky depth)
    gold:       '#e8c15a',   // gold (high keys, Buddha light, fruit of trees)
    cinnabar:   '#c34a33',   // cinnabar red accent (lotus hearts, banners)
    malachite:  '#3f9b6e',   // malachite green accent (leaves, pond glints)
    white:      '#fff6e0',   // warm white (peak highlights, Vaidehī)
  },

  // ── PARTICLES ──────────────────────────────────────────────────────
  particles: {
    // Total pooled particle budget (scaled by quality, see below).
    maxCount: 300_000,
    // Emissive intensity of each mote. >1 lets bloom catch the cores;
    // too high and dense clusters blow out to white fog.
    intensity: 1.12,
  },

  // ── KEY BURSTS (Act 1 blooms; sizes/speeds are in world units) ─────
  keyBurst: {
    noteLow: 48,        // this played range spreads across the panorama…
    noteHigh: 72,       // …low-left/beryl → high-right/gold-white
    xSpan: 0.88,        // fraction of worldWidth the keys cover
    yLowFrac: -0.32,    // low notes bloom near the ground…
    yHighFrac: 0.24,    // …high notes bloom in the sky (fractions of height)
    countMin: 180,      // particles per burst at velocity 0…
    countMax: 900,      // …and at full strike (× quality particleScale)
    speedMin: 110,
    speedMax: 330,
    sizeMin: 2.2,
    sizeMax: 4.8,
    lifeMin: 1.8,
    lifeMax: 3.4,
    upBias: 0.35,       // how much bursts rise (light is buoyant)
    jitter: 14,         // spawn-point scatter
    velocityCurve: 1.3, // >1 = soft touches stay small, hard hits blossom
  },

  // ── QUALITY ────────────────────────────────────────────────────────
  // 'low' | 'medium' | 'high' — scales particle counts and bloom cost.
  quality: 'high',
  qualityScale: {
    low:    { particleScale: 0.15, bloom: false },
    medium: { particleScale: 0.5,  bloom: true },
    high:   { particleScale: 1.0,  bloom: true },
  },

  // ── POSTPROCESSING ─────────────────────────────────────────────────
  bloom: {
    strength: 0.55,   // overall glow amount (K7 refines this live)
    radius: 0.5,
    threshold: 0.2,   // keep high enough that black stays black
  },

  // ── ACTS & TRANSITIONS (thresholds/durations, seconds) ─────────────
  acts: {
    crossfadeSec: 3,           // audio crossfade on act change
    act1FullnessTarget: 1.0,   // energy needed to freeze the beryl ground
    act1EnergyPerStrike: 0.03, // fullness added per key at full velocity
    act2LushnessTarget: 0.75,  // avg K1..K3 level that raises the throne
    codaFadeSec: 20,           // dissolution length
    loopPauseSec: 8,           // black pause before the prologue returns
    autoIdleSec: 30,           // idle time before attract mode starts playing
  },

  // ── AUDIO ──────────────────────────────────────────────────────────
  audio: {
    masterVolumeDb: -6,
    // Score tracks live in assets/music/ as <name>.mp3/.ogg/.wav (first
    // found wins). Silent .wav placeholders ship; drop the real score in.
    trackNames: ['prologue', 'part1', 'part2', 'part3', 'coda'],
    accents: {
      bpm: 48,             // the slow grid Act-1 chimes quantize onto
      quantize: '8n',
      chimeLevelDb: -8,    // Act 1 key chimes
      bedLevelDb: -14,     // Act 2 generative self-playing layer
      padLevelDb: -6,      // Act 3 bells / gongs / swells
      reverbDecaySec: 7,
      reverbWet: 0.4,
    },
  },

  // ── CAPTIONS & TRANSITION SCENES ───────────────────────────────────
  // Each act change plays a small "scene": the caption fades in and holds,
  // the whole vision swells softly, and a wash of motes rises across the
  // panorama. Toggle captions with C (or pad B7).
  captions: {
    enabled: true,
    fadeInSec: 2.2,
    holdSec: 6.5,
    fadeOutSec: 3,
    phases: {
      prologue: '',   // the tutorial speaks for the prologue
      act1: 'Water becomes ice. Ice becomes beryl.\nA ground of light is laid.',
      act2: 'Seven rows of jeweled trees. Ponds of lotus.\nInstruments that play themselves.',
      act3: 'The Buddha of Infinite Life appears,\nand souls are reborn in opening lotuses.',
      coda: 'What was visualized into being\nreturns to the dark that held it.',
    },
  },

  transitions: {
    swell: 1.16,      // gentle global radiance bump on each act change…
    swellSec: 4.5,    // …rising and settling over this long (never a flash)
    washBursts: 9,    // soft motes released across the panorama
  },

  // The opening screen. Shows during the prologue (and again each time the
  // loop returns); dissolves at the first key strike. H (Shift+H) re-shows.
  tutorial: {
    enabled: true,
    title: 'THE PAINTED CAVE',
    subtitle: 'Visualizing the Pure Land',
    quote: '“Reveal to me a land without sorrow.” — Queen Vaidehī',
    steps: [
      ['I · THE KEYS', 'Flood the darkness with light. Strike softly or hard — pitch places the bloom, chords open into mandalas. Fill the dark until the beryl ground freezes into being.'],
      ['II · THE KNOBS', 'Cultivate the jeweled world: trees, lotus ponds, self-playing music, wind. What you raise remains — nothing decays while you hold it.'],
      ['III · THE PADS', 'Summon the holy assembly, and souls reborn in opening lotuses. The final pad releases the vision back into darkness.'],
    ],
    hint: 'No controller?  ` turns on keyboard play — bottom letter row = keys · 1–8 = pads (9 flips bank) · arrow keys = knobs',
    begin: 'strike any key to begin',
  },

  // ── ACT 1 — chords & symmetry ──────────────────────────────────────
  act1: {
    mirrorMinX: 0.03,        // don't mirror bursts this close to center (×width)
    mirrorScale: 0.8,        // mirrored copy: fraction of main burst count
    satelliteMin: 3,         // chord size that opens a radial mandala…
    satelliteMax: 8,         // …max satellites in the ring
    satelliteRadius: 110,    // ring base radius (world units)
    satelliteRadiusPer: 36,  // + this per chord note
    satelliteScale: 0.35,    // satellite burst count fraction
  },

  // ── ACT 2 — the knob-grown world ───────────────────────────────────
  act2: {
    smoothing: 1.1,     // how quickly the world follows the knobs (1/sec)
    trees: {
      rows: 7,          // the sutra's seven rows of jeweled trees
      perSide: 3,       // trees per row on each side third
      height: 135,      // base trunk+canopy height (world units)
      rowShrink: 0.085, // each farther row is this much smaller/dimmer
    },
    ponds: {
      count: 5,         // glowing lotus ponds along the ground
      lotusPerPond: 3,
    },
    instruments: {
      count: 10,            // self-playing instruments as orbs of light
      xSpanFrac: 0.42,      // arc spread (×worldWidth/2 each side)
      yFracRange: [0.16, 0.33], // arc height band (×worldHeight)
      sparkMaxRate: 3.0,    // rising note-motes per second at full K3
    },
    wind: {
      seedInterval: 0.12, // seconds between drift-seed spawns at full K4
      seedCount: 8,       // seeds per spawn (×density ×quality)
      seedSpeed: 90,      // horizontal drift speed at full wind
      rotMax: 0.018,      // whole-world mandala sway (radians) at full wind
    },
    // Each growth knob tells its contemplation the first time it is
    // raised in Act 2 ([title, line] captions).
    knobStories: [
      ['第四观 · THE JEWELED TREES', 'Seven rows of jeweled trees rise —\nevery leaf a different light.'],
      ['第五观 · THE PONDS', 'Ponds of the eight virtues; each drop\nspeaks the Dharma as it falls.'],
      ['第六观 · THE TOWERS OF MUSIC', 'Five hundred jeweled towers, and in the sky\ninstruments that sound themselves.'],
      ['风 · THE WIND', 'A soft wind turns the light;\nthe whole paradise breathes.'],
    ],

    // K5–K8 refinement ranges
    refine: {
      warmthDefault: 0.5,      // neutral color temperature
      densityRange: [0.35, 1.2],  // K6: burst counts + layer alpha
      bloomRange: [0.45, 1.7],    // K7: × bloom.strength
      swayRange: [0.4, 2.2],      // K8: global drift/sway speed
    },
  },

  // ── ACT 3 — the sixteen contemplations ─────────────────────────────
  // The sutra teaches SIXTEEN contemplations; the MPK has sixteen pads.
  // Each pad tells one story: its caption appears and its vision plays.
  // Change assignments here, not in code.
  act3: {
    padMap: {
      A1: 'sun', A2: 'water', A3: 'groundFreeze', A4: 'throne',
      A5: 'image', A6: 'amitabha', A7: 'avalokitesvara', A8: 'mahasthamaprapta',
      B1: 'universal', B2: 'mixed', B3: 'gradesHigh', B4: 'gradesMid',
      B5: 'gradesLow', B6: 'awakening', B7: 'prison', B8: 'dissolution',
    },

    // Every pad's story — [title, line] shown as a caption when pressed.
    stories: {
      prison: ['缘起 · THE PRISON', 'Queen Vaidehī, imprisoned by her own son, begged the Buddha:\nreveal to me a land without sorrow.'],
      sun: ['第一观 · THE SETTING SUN', 'Face the west. See the sun about to set,\nhanging in the sky like a suspended drum.'],
      water: ['第二观 · WATER & ICE', 'See water, clear and still —\nthen see it freeze to shining, translucent ice.'],
      groundFreeze: ['第三观 · THE BERYL GROUND', 'The ice becomes beryl: a ground of light,\nlevel as the palm of a hand.'],
      throne: ['第七观 · THE LOTUS THRONE', 'On the jeweled ground a great lotus unfolds —\na seat awaiting the Buddha of Infinite Life.'],
      image: ['第八观 · THE IMAGE', 'First see his image only: golden, seated on the lotus —\nthe mind that makes the Buddha is the Buddha.'],
      amitabha: ['第九观 · THE TRUE BODY', 'Amitāyus himself: his body the gold\nof a hundred thousand million suns.'],
      avalokitesvara: ['第十观 · AVALOKITEŚVARA', 'The bodhisattva of compassion at his left hand,\na standing Buddha shining in her crown.'],
      mahasthamaprapta: ['第十一观 · MAHĀSTHĀMAPRĀPTA', 'The bodhisattva of great power at his right hand —\nwhere he walks, worlds tremble into bloom.'],
      universal: ['第十二观 · THE UNIVERSAL VISION', 'See yourself born there, seated in a lotus bud —\nflowers of light rain over the whole land.'],
      mixed: ['第十三观 · THE MIXED VISION', 'Now vast, now small, now image, now true —\nthe vision flickers between all of his forms.'],
      gradesHigh: ['第十四观 · THE HIGHEST REBIRTHS', 'Those of deepest devotion rise on diamond daises,\nwelcomed by the entire holy assembly.'],
      gradesMid: ['第十五观 · THE MIDDLE REBIRTHS', 'The middle-born arrive in lotuses\nthat open after a night and a day.'],
      gradesLow: ['第十六观 · THE LOWEST REBIRTHS', 'Even the greatest sinner, saying the Name ten times,\nis met at death by a lotus of gold.'],
      awakening: ['开悟 · THE AWAKENING', 'Seeing the land, Vaidehī rejoiced;\nher mind opened like a lotus at first light.'],
      dissolution: ['归寂 · DISSOLUTION', 'What was visualized into being\nreturns to the dark that held it.'],
    },

    // Grade groups for the three rebirth pads (soul-mote heights/colors).
    gradeGroups: { gradesHigh: [8, 7, 6], gradesMid: [5, 4, 3], gradesLow: [2, 1, 0] },
    // Timed story visions (sun sinking, water sweeping)
    sun: { durationSec: 8, x: -0.27, yTopFrac: 0.30, yEndFrac: 0.02 },
    water: { sweepSec: 2.6 },
    storyFlash: { inSec: 2.2, holdSec: 7, outSec: 3.5 },
    throne: { riseSec: 5 },     // the great lotus throne rises on act entry
    figures: {
      assembleSec: 4.5,         // how long a figure takes to materialize
      amitabha:        { x: 0,      height: 0.5,  seated: true,  tone: 'gold' },
      avalokitesvara:  { x: -0.14,  height: 0.38, seated: false, tone: 'beryl' },
      mahasthamaprapta:{ x: 0.14,   height: 0.38, seated: false, tone: 'malachite' },
    },
    grades: {                   // nine grades of rebirth (soul → lotus)
      xSpread: 0.36,            // souls land within ±this ×worldWidth
      yMinFrac: -0.05,          // humblest lotus height…
      yMaxFrac: 0.30,           // …highest grade
      riseSec: 2.2,             // soul flight time
      lotusScaleMin: 0.7,
      lotusScaleMax: 1.7,
    },
    rain: { durationSec: 7, interval: 0.1, fallDrift: -70 }, // blossom rain
    awakening: { swell: 1.35, riseSec: 2.5, holdSec: 3, fallSec: 6 },
  },

  // ── MURALS — real imagery that dissolves in and out of particles ──
  // Drop Cave 217 crops (JPG/PNG, ideally on dark/transparent ground)
  // into assets/murals/ and reference them here. Placeholders ship so the
  // system runs before the real scans arrive.
  murals: {
    maxParticlesPerMural: 45_000, // × quality particleScale
    luminanceCutoff: 0.09,        // pixels darker than this are skipped
    // plasterSkip panels also drop bright, weakly-colored pixels (bare
    // wall plaster) so only the painting itself becomes particles:
    plasterLum: 0.42,             // "bright" =
    plasterSat: 0.36,             // …and less saturated than this
    retint: 0.35,                 // 0 = photo colors · 1 = full mineral palette
    scatterDist: 300,             // how far motes fly when dissolved
    intensity: 1.15,
    panels: [
      // role 'amitabha': assembled by the true-body pad (A6) in place of
      // the procedural figure (delete to fall back to the silhouette).
      { file: 'buddha-placeholder.svg', role: 'amitabha',
        x: 0, yFrac: 0.02, heightFrac: 0.52 },
      // role 'panel': materialize on the Universal Vision pad (B1),
      // scatter in the coda.
      { file: 'apsara-left-placeholder.svg', role: 'panel',
        x: -0.335, yFrac: 0.27, heightFrac: 0.17 },
      { file: 'apsara-right-placeholder.svg', role: 'panel',
        x: 0.335, yFrac: 0.27, heightFrac: 0.17 },
      // role 'story': real Cave 217 details that condense while their
      // pad's story is told, then fray away again. plasterSkip drops the
      // pale plaster background so only the painting becomes particles.
      { file: 'cave-sun-contemplation.jpg', role: 'story', story: 'sun',
        x: -0.3, yFrac: 0.16, heightFrac: 0.34, plasterSkip: true },
      { file: 'cave-prison.jpg', role: 'story', story: 'prison',
        x: 0.3, yFrac: 0.16, heightFrac: 0.34, plasterSkip: true },
      { file: 'cave-music-sky.jpg', role: 'story', story: 'mixed',
        x: 0, yFrac: 0.3, heightFrac: 0.24, plasterSkip: true },
    ],
  },

  // ── GROUND — the beryl floor that freezes into being (Act 1) ──────
  ground: {
    count: 26_000,        // × quality particleScale
    bandFrac: 0.17,       // ground occupies this fraction of world height
    sizeMin: 1.4,
    sizeMax: 3.2,
    goldFrac: 0.05,       // occasional gold glints among the blue
    twinkleSpeed: 0.9,    // slow shimmer; calms as the ground freezes
    intensity: 0.95,      // dimmer than key bursts; mostly below bloom
  },
};
