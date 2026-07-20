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
    act2DialTarget: 0.55,      // EVERY dial must pass this to raise the throne
    // SOFT MINIMUMS — the show can't be rushed: each act keeps the stage
    // at least this long even when its exit condition is already met.
    act1MinSec: 100,           // Act I runtime floor (meter can fill early)
    act2MinSec: 90,            // Act II runtime floor (dials can finish early)
    act3MinSec: 75,            // dissolution pad is ignored before this
    codaFadeSec: 20,           // dissolution length
    epilogueSec: 22,           // one lotus in the dark, then the loop
    loopPauseSec: 8,           // black pause before the prologue returns
    autoIdleSec: 30,           // idle time before attract mode starts playing
  },

  // ── PRISON — the opening scene (Vaidehī's story, key-paced) ────────
  // Entered on the first key strike. Each line shows as a caption; any
  // key advances it (auto-advances after lineSec); the last line opens
  // Act I. Strikes bloom small and gray-blue — light cannot yet escape.
  prison: {
    lineSec: 9,
    mural: 'cave-prison.jpg',  // condenses dimly on the wall through the scene
    lines: [
      ['王舍城 · RĀJAGṚHA', 'In the great city of Rājagṛha,\nthe prince seized his father the king.'],
      ['七重牢 · THE SEVEN WALLS', 'He locked him behind seven walls;\nno one was allowed to go to him.'],
      ['韦提希 · QUEEN VAIDEHĪ', 'Queen Vaidehī bathed, and carried honey and flour\nto the king in secret, day after day.'],
      ['幽闭 · HER OWN CELL', 'When the prince learned of it, he raised his sword —\nand his mother too was shut away in darkness.'],
      ['悲泣 · THE PLEA', 'Grieving, she bowed toward the Vulture Peak:\n“World-Honored One — show me a land without sorrow.”'],
      ['佛来 · THE BUDDHA COMES', 'And the Buddha appeared to her in her cell,\nand began to teach her to SEE.'],
    ],
  },

  // ── EPILOGUE — after the dissolution, before the loop ──────────────
  epilogue: {
    line: ['心光 · WHAT REMAINS', 'The vision has returned to the dark —\nbut the mind that saw it keeps its light.'],
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
    // [big act title shown center-screen, poetic line shown lower-third]
    phases: {
      prologue: ['', ''],   // the tutorial speaks for the prologue
      prison: ['', ''],     // the prison scene tells its own lines
      epilogue: ['', ''],   // …as does the epilogue
      act1: ['ACT I · THE FLOOD OF LIGHT', 'Play the keys. Water becomes ice; ice becomes beryl.\nA ground of light is laid.'],
      act2: ['ACT II · THE JEWELED WORLD', 'Turn the dials. Trees, ponds, music, wind —\nwhat you raise remains.'],
      act3: ['ACT III · THE SIXTEEN CONTEMPLATIONS', 'Press the pads — each tells one vision of the sutra.\nPad 8, again and again, carries it to the end.'],
      coda: ['CODA · DISSOLUTION', 'What was visualized into being\nreturns to the dark that held it.'],
    },
    // Shown if a pad or dial is used before its act has arrived.
    padsLocked: 'The pads awaken in Act III —\ncultivate the world with the dials first.',
    dialsLocked: 'The dials awaken in Act II —\nflood the darkness with the keys first.',
    dissolutionEarly: 'The vision is not ready to be released —\nlet the contemplations deepen a little longer.',

    // When no one interacts for a while, the piece meditates aloud:
    // sutra passages surface one at a time (idleSec to start, everySec
    // between passages). Adapted from the Contemplation Sutra.
    meditation: {
      idleSec: 18,
      everySec: 32,
      passages: {
        act1: [
          'Sit facing the west. Perceive the sun as a drum\nhanging in the sky — let the mind dwell there, unwavering.',
          'Shut out scattered thought.\nLet the image stay clear, eyes open or closed.',
          'When water turns to ice, and ice to beryl,\nthe first ground of the Pure Land is seen.',
        ],
        act2: [
          'Each jeweled tree is eight thousand yojanas tall,\nits leaves and flowers made of seven gems.',
          'The water of eight virtues murmurs as it flows:\nsuffering, emptiness, impermanence, no-self.',
          'Do not grasp at the vision when it comes —\nlet it deepen of its own accord.',
        ],
        act3: [
          'To see this Buddha is to see all Buddhas;\nthe mind that sees the Buddha IS the Buddha-mind.',
          'His light embraces every being who remembers him,\nand never lets a single one fall.',
          'Those who complete this contemplation\nwill open their eyes inside a lotus.',
        ],
      },
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
    hint: "No controller?  ` turns on keyboard play — letter rows = keys · 1–8 = pads (9 flips bank) · , . / ; ' [ ] \\ = the 8 dials (hold to raise, Shift lowers) · Shift+letter for toggles",
    begin: 'strike any key to begin',
  },

  // ── ACT 1 — chords, symmetry, and the rising-sun ritual ────────────
  act1: {
    mirrorMinX: 0.03,        // don't mirror bursts this close to center (×width)
    mirrorScale: 0.8,        // mirrored copy: fraction of main burst count
    satelliteMin: 3,         // chord size that opens a radial mandala…
    satelliteMax: 8,         // …max satellites in the ring
    satelliteRadius: 110,    // ring base radius (world units)
    satelliteRadiusPer: 36,  // + this per chord note
    satelliteScale: 0.35,    // satellite burst count fraction

    // MILESTONES — Act I tells its first three contemplations as visible
    // chapters while the fullness meter climbs: still water sweeps in,
    // then it crystallizes to ice, then the beryl ground freezes true.
    milestones: {
      water: {
        at: 0.3,
        caption: ['第二观 · THE WATER', 'See the water, clear and still —\nlet it spread level to every horizon.'],
      },
      ice: {
        at: 0.65,
        caption: ['冰想 · THE FREEZING', 'Now see the water freeze:\ncrystal by crystal, the stillness locks.'],
        flakes: 6,           // frost stars that crystallize along the floor
      },
      beryl: {
        at: 1.0,
        caption: ['第三观 · THE BERYL GROUND', 'The ice becomes beryl — a ground of light,\nlevel as the palm of a hand.'],
      },
    },

    // 第一观 begins the show: an ember sun on the western horizon that
    // every key strike feeds — it brightens and climbs as the act fills.
    sun: {
      x: -0.3,               // ×worldWidth (the west)
      yLowFrac: -0.34,       // horizon at fullness 0…
      yHighFrac: -0.02,      // …risen at fullness 1
      radius: 62,            // world units
      count: 900,            // disc particles (× quality scale)
      flarePerStrike: 26,    // extra motes fed to the sun per key strike
    },
    // …and softly re-blooms as fading echoes (1..N fire per strike, with
    // randomized timing and placement).
    echo: {
      delays: [0.75, 1.5],   // base seconds after the strike
      scale: 0.3,            // echo burst count fraction
      spread: 120,           // echoes land this far from the original (±)
    },

    // VARIETY — what keeps Act I unpredictable. Every strike draws a
    // random FORM from a pool (soft touches → quiet forms, hard strikes
    // → dramatic ones), may wander in color or place, leaves embers, and
    // sometimes sends a streak; meteors cross the sky on their own clock.
    variety: {
      forms: {
        soft: ['bloom', 'puff', 'ring', 'swirl', 'bloom', 'puff'],
        hard: ['bloom', 'fountain', 'willow', 'swirl', 'fan', 'ring', 'bloom'],
      },
      accentChance: 0.16,    // stray malachite/cinnabar tint
      displacedChance: 0.09, // bloom appears somewhere unexpected
      streakChance: 0.6,     // strikes that also paint a rising streak
      emberCount: 6,         // long-lived motes left glowing at the spot
      meteorEverySec: 20,    // avg seconds between shooting lights (act 1)
      // Hard strikes may throw a COMET: a curved, trailing light that
      // arcs across part of the wall and bursts where it dies.
      cometChance: 0.22,     // chance on strikes with velocity ≥ cometMinVel
      cometMinVel: 0.78,
    },

    // CONSTELLATION — while two or more keys are HELD, threads of light
    // run between their bloom points, making held playing visible.
    constellation: {
      emitEverySec: 0.14,    // thread refresh rate while holding
      pointsPerLine: 13,     // motes along each thread per refresh
    },

    // COMBOS — special ways of playing that gather the fire into
    // recognizable 图案, and (rate-limited) into ember-formed lines of
    // the sutra as the pattern frays. Four gestures:
    //   chord   3+ different keys at once → lotus/moon/sun/canopy/pagoda
    //           (5+ keys may condense a real Cave-217 mural crop)
    //   run     6+ notes in 2s across the keys → a sweeping ribbon
    //   repeat  one key 3+ times in rhythm → a mandala that grows
    //   lowHigh a bass + a treble key together → a pillar of light
    combos: {
      enabled: true,
      globalCooldownSec: 2.6,   // min gap between any two combo patterns
      familyCooldownSec: { chord: 7, run: 9, repeat: 5, lowHigh: 12 },
      chordWindowSec: 0.14,     // keys this close together count as one chord
      chordMin: 3,              // distinct notes needed
      runWindowSec: 2.0,        // a flurry inside this window…
      runMin: 6,                // …of at least this many notes…
      runSpanMin: 7,            // …spanning at least this many semitones
      repeatWindowSec: 2.6,     // same key struck repeatMin+ times
      repeatMin: 3,
      lowHighWindowSec: 0.2,    // bass + treble struck near-together
      lowNote: 52,
      highNote: 66,
      patternPoints: 2600,      // motes per 图案 (× quality particleScale)
      patternLifeSec: 5.5,      // resolve ≈1.5s in, hold, then sublime away
      gatherDist: 170,          // how far the embers fly in from
      muralChance: 0.35,        // big chords: chance of a real mural crop
      muralMinChord: 5,
      muralFiles: ['cave-sun-contemplation.jpg', 'cave-prison.jpg', 'cave-music-sky.jpg'],
      // The dying light re-forms as a bilingual line of the sutra.
      text: {
        enabled: true,
        everySec: 15,           // at most one passage this often
        delaySec: 3.4,          // after the 图案 begins (≈ as it frays)
        lifeSec: 5.2,
        widthFrac: 0.36,        // Chinese line width ×worldWidth
        points: 3400,           // motes for the characters (× quality)
        passages: [
          ['西方净土', 'In the west — a land without sorrow'],
          ['光明遍照', 'Its light floods the ten directions'],
          ['日悬如鼓', 'The sun hangs in the sky like a drum'],
          ['水想成冰', 'See the water; see it become ice'],
          ['冰化琉璃', 'The ice turns to shining beryl'],
          ['心作心是', 'The mind that sees it becomes it'],
          ['莲华化生', 'Souls awaken inside opening lotuses'],
          ['无有众苦', 'There, no suffering is even heard'],
          ['一心不乱', 'Hold the image; let nothing scatter'],
          ['皆说妙法', 'Every light there speaks the Dharma'],
        ],
      },
    },
  },

  // ── BACKDROP — the cave wall breathing behind the darkness ─────────
  backdrop: {
    enabled: true,
    image: 'cave217-northwall.jpg',   // in assets/murals/
    // Optional video (assets/video/<file>): loops muted behind the scene
    // and replaces the image when present. Missing file = warn + skip.
    video: 'backdrop.mp4',
    // Peak opacity per phase — the prologue stays a black prison.
    // (Values are tiny because the sRGB output transform lifts darks a lot.)
    opacityByPhase: {
      prologue: 0, prison: 0.004, act1: 0.006, act2: 0.011, act3: 0.017,
      coda: 0, epilogue: 0.02, // the cave wall itself glows once, then fades
    },
    panAmount: 0.035,   // slow horizontal drift (×worldWidth)
    breatheAmount: 0.05, // slow scale breathing
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
    // Every dial grows its own part of the story and tells it (caption)
    // the first time it is raised in Act 2 ([title, line] per knob).
    knobStories: [
      ['第四观 · THE JEWELED TREES', 'Seven rows of jeweled trees rise —\nevery leaf a different light.'],
      ['第五观 · THE PONDS', 'Ponds of the eight virtues; each drop\nspeaks the Dharma as it falls.'],
      ['第六观 · THE TOWERS OF MUSIC', 'Five hundred jeweled towers, and in the sky\ninstruments that sound themselves.'],
      ['风 · THE WIND', 'A soft wind turns the light;\nthe whole paradise breathes.'],
      ['妙音鸟 · THE KALAVINKA BIRDS', 'Jeweled birds wheel through the sky,\ntheir flight itself a song of Dharma.'],
      ['宝光 · THE RAYS OF LIGHT', 'From the height of the sky, rays of golden light\nfan out and warm the whole land.'],
      ['幢幡 · THE JEWELED BANNERS', 'Banners and canopies of every color\nhang in the air, swaying in the fragrant wind.'],
      ['天云 · THE CLOUDS OF LIGHT', 'Clouds of soft light drift above the towers,\ncarrying flowers and perfume.'],
    ],

    // K5–K8 sky layers
    birds: { max: 10, trailInterval: 0.038 },  // K5: flock size follows the dial
    rays: { count: 22 },                       // K6: fan of light from the apex
    banners: { count: 10 },                    // K7: hanging ribbon-banners
    clouds: { count: 14 },                     // K8: drifting bands of light

    // Side-effects that ride along with the sky dials
    refine: {
      warmthDefault: 0.5,        // neutral color temperature at rest
      warmthRange: [0.45, 0.8],  // K6 rays gild the whole palette…
      bloomRange: [0.92, 1.38],  // …and swell the glow
      swayRange: [0.55, 1.9],    // K8 clouds quicken the world's drift
    },
  },

  // ── ACT 3 — the sixteen contemplations ─────────────────────────────
  // The sutra teaches SIXTEEN contemplations; the MPK has sixteen pads.
  // Each pad tells one story: its caption appears and its vision plays.
  // Change assignments here, not in code.
  act3: {
    // Eight physical pads: 1–7 tell the first seven stories; pad 8 is
    // "continue the sutra" — each press advances through everything else
    // (see `sequence`). Bank B (if the performer flips banks) keeps
    // direct access to the later stories.
    // Pads 1–7 = 第一观…第七观 with no gaps (4/5/6 celebrate the trees,
    // ponds and music the dials grew); pad 8 continues from 第八观 on.
    padMap: {
      A1: 'sun', A2: 'water', A3: 'groundFreeze', A4: 'treesStory',
      A5: 'pondsStory', A6: 'musicStory', A7: 'throne', A8: 'nextStory',
      B1: 'universal', B2: 'mixed', B3: 'gradesHigh', B4: 'gradesMid',
      B5: 'gradesLow', B6: 'awakening', B7: 'prison', B8: 'dissolution',
    },
    // What pad 8 steps through, in the sutra's order (八观 → the end).
    sequence: [
      'image', 'amitabha', 'avalokitesvara', 'mahasthamaprapta',
      'universal', 'mixed', 'gradesHigh', 'gradesMid', 'gradesLow',
      'awakening', 'dissolution',
    ],

    // Every pad's story — [title, line] shown as a caption when pressed.
    stories: {
      prison: ['缘起 · THE PRISON', 'Queen Vaidehī, imprisoned by her own son, begged the Buddha:\nreveal to me a land without sorrow.'],
      sun: ['第一观 · THE SETTING SUN', 'Face the west. See the sun about to set,\nhanging in the sky like a suspended drum.'],
      water: ['第二观 · WATER & ICE', 'See water, clear and still —\nthen see it freeze to shining, translucent ice.'],
      groundFreeze: ['第三观 · THE BERYL GROUND', 'The ice becomes beryl: a ground of light,\nlevel as the palm of a hand.'],
      treesStory: ['第四观 · THE JEWELED TREES', 'Seven rows of jeweled trees stand full-grown —\ncontemplate each leaf, a different light.'],
      pondsStory: ['第五观 · THE PONDS', 'The water of eight virtues shines;\neach drop speaks the Dharma as it falls.'],
      musicStory: ['第六观 · THE TOWERS OF MUSIC', 'The towers stand; instruments hang in the sky,\nsounding themselves without a hand.'],
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
      // The REAL Cave 217 central Amitāyus, cropped from the north wall:
      // low retint keeps his red robe and green mandorla true; slightly
      // reduced intensity stops the bloom from washing his face out.
      // mask isolates the seated figure + mandorla from the busy tableau;
      // true photo colors (low retint) so his red robe and green mandorla
      // read clearly.
      // The stylized Buddha reads most clearly at distance; the real
      // north-wall crop (cave217-buddha.jpg) is too weathered for a crisp
      // particle figure — swap the file back anytime; the sampling tools
      // (mask/invert/gamma/gain) are all wired for a cleaner scan.
      { file: 'buddha-placeholder.svg', role: 'amitabha',
        x: 0, yFrac: 0.02, heightFrac: 0.52, intensity: 0.95 },
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
