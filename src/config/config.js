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
  // Set to the CAVE's three-projector wall: 5760×1080 (48:9). main.js
  // also auto-fits worldWidth to whatever display the browser is
  // fullscreened on at load, so a 16:9 test monitor shows the full
  // composition too — this pair is the deterministic Cave default.
  worldWidth: 5760,
  worldHeight: 1080,

  // Cap the device pixel ratio: retina 2x is plenty, more wastes GPU.
  maxPixelRatio: 2,

  // ── THE CAVE'S WALLS (intro flight wraparound, build step 9) ───────
  // The three-projector room, for the flight's 3D pass: three cameras
  // share the rail's eye, each with an off-axis frustum built from its
  // wall's REAL rectangle, composited side by side — so the side walls
  // read as continuous space, not a stretched picture. Units are
  // physical (meters); only the RATIOS matter.
  //   mode 'auto'   — rig only when the canvas is ultra-wide (the
  //                   5760×1080 wall); a 16:9 monitor stays single.
  //   mode 'rig'    — force the three-wall composite (seam rehearsal).
  //   mode 'single' — force the ordinary one-camera render.
  walls: {
    mode: 'auto',
    rigAspect: 3.0,          // canvas aspect at/above which 'auto' rigs
    width: 4,                // each wall's physical width…
    height: 2.25,            // …and height (16:9 projections)
    viewerDistance: 2.6,     // audience centre to the front wall
    interiorAngleDeg: 90,    // side↔front wall angle (90 = box U)
  },

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
    // Comet trails (world speed × this = tail length, 0..1). Off by
    // default — kept so a specific burst can opt in via its `streak`.
    streak: 0,
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
    crossfadeIntoAct1Sec: 8,   // prologue→Act I is longer so it isn't abrupt
    act1FullnessTarget: 1.0,   // energy needed to freeze the beryl ground
    act1EnergyPerStrike: 0.032, // fullness per key (slower fill → longer Act I)
    // FAILSAFE — an installation must never stall: if Act I has run this
    // long with the ground at least half-flooded, it advances anyway.
    act1FailsafeSec: 140,
    act2DialTarget: 0.55,      // EVERY dial must pass this to raise the throne
    // SOFT MINIMUMS — the show can't be rushed: each act keeps the stage
    // at least this long even when its exit condition is already met.
    // (The prison story already adds ~1 min before Act I begins.)
    act1MinSec: 95,            // Act I runtime floor (longer — more to see)
    act2MinSec: 100,           // Act II runtime floor (slower, unhurried growth)
    act3MinSec: 75,            // dissolution pad is ignored before this
    codaFadeSec: 34,           // dissolution length — the dramatic climax
                               // (three movements: fraying → storm → ascension)
    epilogueSec: 40,           // 心光 first → painting reassembles slowly → loop
    loopPauseSec: 8,           // black pause before the prologue returns
    autoIdleSec: 30,           // idle time before attract mode starts playing
    // SELF-RUNNING (demo/kiosk) — the piece plays its whole arc by
    // itself: the intro flight, then every act driven by synthetic
    // input, looping forever. Turn on with `autoRun: true` here, the
    // ?auto (or ?demo) URL param, or the `A` key live. autoIntroHoldSec
    // lets the title screen breathe before the flight auto-launches.
    autoRun: false,
    autoIntroHoldSec: 5,
  },

  // ── INTRO — the flight into Cave 217 (runs BEFORE the prologue) ────
  // A ~60s first-person glide on rails: night sky → the Gobi → the
  // Mingsha dunes → the Mogao cliff → through a cave mouth → into the
  // chamber of Cave 217 → INTO the north-wall mural, where the
  // prologue (Vaidehī in darkness) begins. The attract screen waits
  // for any key/pad (or Space); during the flight, HOLDING any key
  // holdToSkipSec skips to the prologue, Esc aborts back to attract.
  intro: {
    enabled: true,
    holdToSkipSec: 1.0,
    // The ten beats, on rails: [atSec, name, cohesion at beat start].
    // cohesion 1 = photographic (points at their depth positions),
    // 0 = free luminous motes. It FALLS on the way in and RISES again
    // as the murals condense inside the cave. Camera keyframes join
    // these in IntroFlight (build step 2); every number is tunable.
    beats: [
      [0,  'suspended', 1.0],   // night sky above cloud — hanging, stars
      [6,  'drop',      1.0],   // nose dips, horizon falls away
      [14, 'gobi',      0.97],  // the desert opens — hold the money shot
      [24, 'dunes',     0.90],  // skim the Mingsha ridgelines
      [34, 'oasis',     0.78],  // the green thread of the river valley
      [42, 'cliff',     0.60],  // the Mogao wall, honeycombed with mouths
      [50, 'doorway',   0.30],  // one dark opening — rock granulates
      [54, 'threshold', 0.05],  // blackness, the corridor — audio goes dry
      [57, 'chamber',   0.05],  // Cave 217 condenses (cohesion rises)
      [62, 'painting',  0.85],  // push into the west panel → prologue
    ],
    durationSec: 66,            // beat 10 ends here → hand off to prologue
    fadeOutSec: 2,              // the last seconds sink to black → prologue

    // ── Audio (build step 10) — the flight's score, wind, handoff ────
    // The 'intro' track (assets/music/intro.*) plays through attract +
    // flight. A wind bed rises with airspeed and ground-nearness, then
    // CUTS hard to interior silence at the threshold (beat 8) — that
    // sudden acoustic change is what convinces the body it is now
    // indoors. The intro track crossfades to 'prologue' across beats
    // 9–10, so the score arrives in the prologue already underway.
    audio: {
      windMaxDb: -8,            // flight wind at full airspeed (stronger)
      windMinHz: 240,           // bandpass sweep: slow/low → fast/bright
      windMaxHz: 1150,
      windStartFloor: 0.4,      // audible high-air wind at the very start…
      windStartFadeSec: 12,     // …tapering out over the first seconds
      thresholdCutSec: 54,      // beat 8 — wind cuts to interior silence
      toPrologueSec: 57,        // beat 9 — intro→prologue crossfade begins
    },

    // ── Procedural world (build step 4) — the flight without photos ──
    // The fallback terrain the whole 60s runs on: a value-noise dune
    // heightfield of drifting gold motes, the oasis, and the cliff.
    // Photo point clouds (step 5+) land ON TOP of this — every photo
    // improves the world, none is required.
    world: {
      duneCount: 430_000,       // dense gold spanning the FULL ground width
      duneOutskirts: 60_000,    // sparse motes reaching beyond the frame
      duneArea: [-6200, 6200, 1800, -8150], // x0, x1, z0, z1
      crestHeight: 95,          // ridge crests (world units)…
      baseHeight: 55,           // …over rolling base noise
      oasisZ: -5300,            // where the green valley crosses
      moteSize: 5.2,
      sandDark: '#4a3616',      // low sand in shadow (lifted — reads gold)…
      sandGold: '#e8b95a',      // …crests catching the dawn (brighter)
      cloudMotes: 2600,
      oasisMotes: 7000,
      cliffMotes: 64_000,       // dense, bright sandstone face (mouths carved out)
    },

    // ── Photo point clouds (build step 5) — stations on the path ─────
    // Each station is one photograph displaced into 3D by a depth map
    // (or the procedural bottom=near fallback) and parked in world
    // space so the camera flies PAST it with real parallax. All clouds
    // sample the ONE global cohesion track (the beats' third column):
    // photographic when it's high, luminous drift when it falls.
    //   file · pos · width (world units; height follows the image)
    //   ry (yaw) · depthScale (relief depth) · grid [w,h] (samples)
    // The real shot list (build step 6) lives in assets/flight/ — see
    // CREDITS.txt there for sources. crop trims skies/wires without
    // touching the files; fogMul keeps the far cloud backdrop visible
    // through the depth haze; rx leans a panel back like a hillside.
    cloudDrift: 210,            // how far loosened points wander (units)
    stations: [
      { // beats 1–2 · the sea of clouds at dawn — far backdrop panel;
        // the deck hides its lower reaches, so it reads as sky
        file: '/flight/01_clouds.jpg',
        pos: [0, 3400, -13000], width: 15000, depthScale: 1600,
        grid: [220, 140], size: 4.5, opacity: 0.85,
        crop: [0, 0, 1, 0.86], fogMul: 0.05, edgeFade: 0.3,
        tint: [0.75, 0.62, 0.5], window: [0, 15],
      },
      { // beats 3–4 · Mingsha crest line leaning on the left of the path
        file: '/flight/04_dunes_high.jpg',
        pos: [-980, 200, -2500], width: 1500, ry: 0.5, rx: -0.3,
        depthScale: 320, grid: [230, 150], size: 3.0,
        crop: [0, 0.3, 1, 1], tint: [0.5, 0.4, 0.28], edgeFade: 0.18,
      },
      { // beats 4–5 · down the dune slope into the green valley, right
        file: '/flight/05_dunes_low.jpg',
        pos: [1080, 300, -4300], width: 1400, ry: -0.55,
        depthScale: 340, grid: [230, 150], size: 3.0,
        tint: [0.52, 0.44, 0.34], edgeFade: 0.18,
      },
      { // beat 5 · Crescent Lake drifting past on the left at the oasis
        file: '/flight/06_oasis.jpg',
        pos: [-780, 260, -5450], width: 1300, ry: 0.5,
        depthScale: 300, grid: [220, 150], size: 3.0,
        tint: [0.5, 0.44, 0.36], edgeFade: 0.18,
      },
      // (The flat 07_cliff_wide photo panel was removed — it read as a
      // rectangle over the wall. The Mogao façade is now built in full by
      // IntroWorld.buildCliff: honeycomb of cave-mouths + 九层楼 pagoda,
      // which granulates with the global cohesion as we close on the door.)
    ],

    // ── Cave interior (build step 7) — murals condense from motes ────
    // The chamber's surfaces, as PhotoClouds of real Cave 217 crops.
    // Same schema as stations, plus cohesionLag: each surface samples
    // the global cohesion that many seconds LATE, so the room gathers
    // in order — niche → west panel → tableau → ceiling. All fade in
    // from t=50 (window), invisible before the threshold.
    interior: [
      // ONE clear painting, dead ahead and centered — the great Cave 217
      // Amitāyus tableau, the Pure Land we have flown to see. It
      // condenses out of the motes directly in front of the camera
      // (no side wall, no turn), dense enough that the points FUSE into
      // a readable picture, and the camera then flies straight into its
      // heart. A faint ceiling gives the enclosing cave; everything
      // else is bare rock, so nothing competes with the painting.
      { // THE PAINTING — centered on the far wall, facing the camera.
        // Normal-blended so its ink reads dark on the luminous plaster;
        // densely sampled so the points fuse into a legible picture.
        file: '/murals/cave217-northwall.jpg',
        pos: [0, 190, -8850], width: 360, blend: 'normal',
        depthScale: 26, grid: [620, 440], size: 2.7, opacity: 1.0,
        lumaCutoff: 0.02, tint: [1.35, 1.28, 1.08],
        crop: [0.03, 0.02, 0.99, 0.80], // drop faded plaster + ragged edges
        window: [50, 999], cohesionLag: 0,
      },
      { // the ceiling: heavens of music, faint overhead — the cave roof
        file: '/murals/cave-music-sky.jpg',
        pos: [0, 378, -8620], width: 420, rx: 1.5708,
        depthScale: 50, grid: [300, 190], size: 2.6, opacity: 0.4,
        lumaCutoff: 0.06, tint: [1.2, 1.1, 0.9],
        window: [50, 999], cohesionLag: 1.2,
      },
    ],

    // ── Vection layer (build step 3) — near-field motes ──────────────
    // Faint dust/sand/ice streaking past the camera: the peripheral
    // optical flow that makes the body feel the flight. Streak length
    // follows speed by construction; density thins with altitude and
    // collapses to drifting incense motes indoors. Felt, not seen.
    vection: {
      count: 2600,
      box: [1000, 560, 1300],   // camera-centered field volume (w, h, d)
      streakSec: 0.07,          // how many seconds of motion one streak spans
      opacity: 0.42,
      fullSpeed: 260,           // world units/sec that reads as "full flight"
      altFloor: 0.22,           // never thinner than this (high-air crystals)
      altFadeHeight: 2800,      // density fades toward this altitude
      colorLow: '#d8c090',      // sand-gold near the ground…
      colorHigh: '#c8d4ec',     // …ice-blue in the night sky
    },

    // ── The camera rail (build step 2) ───────────────────────────────
    // One unbroken move, Soarin'-style: weightless glide, no cuts. The
    // rail is a time-parameterized C1 spline; keyframes align with the
    // beats (extra keys allowed — 29s makes the dune glide S-curve for
    // gentle banking). Format: [t, [pos x,y,z], [look x,y,z], fov].
    // World scale: y=0 desert floor, cloud deck y≈2700, the cliff face
    // stands at z=-8200 with the doorway at (0, 110); corridor to
    // z=-8400; the chamber spans z -8400..-8860, with THE painting
    // centered on its far wall at (0, 190, -8850) — the camera flies
    // straight into it (config.intro.interior).
    camera: {
      fovBase: 55,
      fogDensity: 0.0002,       // black depth-haze — stages each reveal
      rollAmpDeg: 1.2,          // slow sinusoidal glider roll…
      rollPeriodSec: 12,
      bobAmp: 4,                // …and vertical bob (world units)
      bobPeriodSec: 8,
      bankMaxDeg: 6,            // banking into lateral drift, clamped
      bankGainDeg: 45,          //   (spec: never past ~8°)
      bankSmooth: 2,            // 1/sec — how lazily the bank settles
      calmAfter: [50, 55],      // roll/bob/bank fade out crossing indoors
      keyframes: [
        [0,  [0, 3200, 2600],    [0, 3150, -2000],  55], // 1 suspended
        [6,  [0, 3140, 2350],    [0, 2500, -1200],  57], // 2 the drop begins
        [14, [0, 2100, 900],     [0, 900, -2200],   66], // 2→3 through cloud
        [24, [0, 280, -1800],    [0, 60, -4600],    62], // 3→4 gobi → dunes
        [29, [120, 240, -3050],  [-40, 60, -5400],  61], //    (S-curve bank)
        [34, [-140, 230, -4300], [40, 40, -6600],   60], // 4→5 toward oasis
        [42, [-60, 200, -6300],  [0, 180, -8200],   58], // 5→6 cliff ahead
        [50, [0, 150, -7700],    [0, 112, -8200],   52], // 6→7 the doorway
        [54, [0, 140, -8250],    [0, 190, -8850],   52], // 7→8 threshold — already aiming at the painting
        [57, [0, 165, -8380],    [0, 190, -8850],   54], // 8→9 chamber opens, the whole painting condensing ahead
        [62, [0, 190, -8440],    [0, 190, -8850],   50], // 9 squared up — the WHOLE painting framed and clear
        [66, [0, 190, -8772],    [0, 190, -8851],   34], // 10 PUSH straight into its heart —
        // dead centre, no turn: the Pure Land fills the frame and its
        // points sweep past the lens as the black takes it → the story
      ],
    },

    // ── The handoff (build step 8) — into the painting → prologue ────
    // After the fade lands in the prologue's darkness, one line rises:
    // it seals the transition (the wall's story is now the room) and
    // quietly asks for the first key, which begins Vaidehī's story.
    handoff: {
      delaySec: 1.6,
      title: '入画 · INTO THE PAINTING',
      line: '壁上所绘，今在四周——\n击一键，让故事开始。\nWhat was painted on the wall now surrounds you —\nstrike a key, and the story begins.',
    },
  },

  // ── PRISON — the opening scene (Vaidehī's story, key-paced) ────────
  // Entered on the first key strike. Each line shows as a caption; any
  // key advances it (auto-advances after lineSec); the last line opens
  // Act I. Strikes bloom small and gray-blue — light cannot yet escape.
  prison: {
    lineSec: 9,
    mural: 'cave-prison.jpg',  // condenses dimly on the wall through the scene
    // Where each line's scenery stands (×W, ×H): strikes during the
    // scene only gather AROUND the current image, never elsewhere.
    sceneAnchors: [
      [0, -0.3],        // the city
      [0.24, -0.24],    // the seven walls
      [-0.27, -0.12],   // the queen (well left of the centre caption)
      [-0.27, -0.1],    // her cell
      [-0.36, 0.22],    // Vulture Peak
      [0.02, 0.06],     // the Buddha
    ],
    lines: [
      ['王舍城 · RĀJAGṚHA', '王舍大城之中，\n太子囚其父王。\nIn the great city of Rājagṛha,\nthe prince seized his father the king.'],
      ['七重牢 · THE SEVEN WALLS', '幽之于七重室内，\n不许一人得近。\nHe locked him behind seven walls;\nno one was allowed to go to him.'],
      ['韦提希 · QUEEN VAIDEHĪ', '韦提希夫人净身，以酥蜜和麨，\n日日密奉大王。\nQueen Vaidehī bathed, and carried honey and flour\nto the king in secret, day after day.'],
      ['幽闭 · HER OWN CELL', '太子闻之，怒而拔剑——\n遂将母后一并幽闭于暗。\nWhen the prince learned of it, he raised his sword —\nand his mother too was shut away in darkness.'],
      ['悲泣 · THE PLEA', '夫人悲泣，遥礼耆阇崛山：\n“世尊——愿示我无忧之国。”\nGrieving, she bowed toward the Vulture Peak:\n“World-Honored One — show me a land without sorrow.”'],
      ['佛来 · THE BUDDHA COMES', '世尊即现于其室中，\n教之观想，令其得见。\nAnd the Buddha appeared to her in her cell,\nand began to teach her to SEE.'],
    ],
  },

  // ── EPILOGUE — after the dissolution, before the loop ──────────────
  epilogue: {
    line: ['心光 · WHAT REMAINS', '所观之境，归于寂暗——\n然见境之心，其光犹存。\nThe vision has returned to the dark —\nbut the mind that saw it keeps its light.'],
    heartAt: 1.5,   // the 心光 heart-light (lotus + line) rises FIRST, at center
  },

  // ── INTERLUDES — breathing room after each act arrives ─────────────
  // A few seconds after the act title fades, a small scripted scene
  // surveys what has been made and speaks one linking line.
  interludes: {
    act2: {
      atSec: 9,
      line: ['大地已成 · THE GROUND IS LAID', '于心中步此琉璃之地——\n再于其上，起众宝庄严。\nWalk the beryl in your mind —\nthen raise the jeweled world upon it.'],
    },
    act3: {
      atSec: 9,
      line: ['圣众将临 · THE ASSEMBLY NEARS', '世界既成，明净安住。\n按鼓垫，请圣众降临。\nThe world stands ready, shining and still.\nCall the holy ones with the pads.'],
    },
  },

  // ── AUDIO ──────────────────────────────────────────────────────────
  audio: {
    masterVolumeDb: -6,
    // Score tracks live in assets/music/ as <name>.mp3/.ogg/.wav (first
    // found wins). Silent .wav placeholders ship; drop the real score in.
    trackNames: ['intro', 'prologue', 'part1', 'part2', 'part3', 'coda'],
    accents: {
      bpm: 48,             // the slow grid Act-1 drums quantize onto
      quantize: '8n',
      chimeLevelDb: -7,    // (legacy bell voice — kept for combo flourishes)
      chimeRoot: 3,        // pentatonic root semitone — MATCH THE SCORE's
                           // key here (0=C, 2=D, 3=D#, 5=F, 7=G, …)
      chimeMinGapSec: 0.14, // flurries thin to a cascade, never mud
      chimeLowpassHz: 3200, // rounds the bell tops into the mix
      // Act 1 keys are TUNED DRUMS (taiko/tabla): a pitched membrane +
      // a skin transient, each key snapped into the pentatonic so the
      // playing stays a drum melody, not noise.
      drumLevelDb: -3,
      drumSkinDb: -13,     // the hand-slap attack over the drum tone
      drumMinGapSec: 0.08, // tighter than the bells — rolls are allowed
      windLevelDb: -16,    // the dissolution's storm (noise bed, coda only)
      droneLevelDb: -20,   // the prison's cold drone (prologue/prison)
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
      act1: ['ACT I · THE FLOOD OF LIGHT\n第一幕 · 光明之潮', '击键引光。水结为冰，冰化琉璃，\n光明大地，就此铺成。\nPlay the keys. Water becomes ice; ice becomes beryl.\nA ground of light is laid.'],
      act2: ['ACT II · THE JEWELED WORLD\n第二幕 · 众宝庄严', '转动旋钮。宝树、莲池、天乐、香风——\n凡你所立，皆不散灭。\nTurn the dials. Trees, ponds, music, wind —\nwhat you raise remains.'],
      act3: ['ACT III · THE SIXTEEN CONTEMPLATIONS\n第三幕 · 十六观', '轻按鼓垫——每按一次，观法向前一境。\n诸观自有其时，静待其成。\nPress any pad — each press carries the rite one vision onward.\nThe visions keep their own pace; let each one finish.'],
      // The Diamond Sutra's closing gatha — the dissolution is not an
      // ending announced, but a truth contemplated.
      coda: ['一切有为法 · 如梦幻泡影', 'All conditioned things are as dreams,\nillusions, bubbles, shadows…'],
    },
    // …the gatha completes mid-storm (scheduled by StoryScenes).
    codaSecond: ['如露亦如电 · 应作如是观', '…as dew, as a flash of lightning.\nContemplate them thus — and let the vision go.'],
    // Shown if a pad or dial is used before its act has arrived.
    padsLocked: '鼓垫于第三幕方启——\n先以旋钮，培育此世界。\nThe pads awaken in Act III —\ncultivate the world with the dials first.',
    dialsLocked: '旋钮于第二幕方启——\n先以键光，充满此黑暗。\nThe dials awaken in Act II —\nflood the darkness with the keys first.',
    dissolutionEarly: '此境尚未可释——\n且令诸观，再深一层。\nThe vision is not ready to be released —\nlet the contemplations deepen a little longer.',
    // Shown when an act's meter is satisfied but its runtime floor isn't:
    // the performer must know the piece is soaking, not stuck.
    floodHolds: '满潮 · THE FLOOD HOLDS\n光须浸透——继续击键，大地正凝。\nThe light must soak deep — keep playing, the ground is setting.',
    // {pct} is replaced with the live meter percentage.
    floodRising: '光未满 · THE FLOOD RISES\n大地已纳所需之光 {pct}%——\n继续击键，重按则光愈盛。\nThe ground holds {pct}% of the light it needs —\nstrike on; harder keys pour more.',
    worldHolds: '世界将熟 · THE WORLD RIPENS\n八钮皆举——且持之，宝座正成。\nAll eight are raised — hold them there; the throne is forming.',

    // When no one interacts for a while, the piece meditates aloud:
    // sutra passages surface one at a time (idleSec to start, everySec
    // between passages). Adapted from the Contemplation Sutra.
    meditation: {
      idleSec: 18,
      everySec: 32,
      passages: {
        act1: [
          '正坐面西，观日如鼓，\n悬于天际——系心一处，令其不移。\nSit facing the west. Perceive the sun as a drum\nhanging in the sky — let the mind dwell there, unwavering.',
          '屏除散乱之想。\n令此影像分明，开目闭目皆见。\nShut out scattered thought.\nLet the image stay clear, eyes open or closed.',
          '水结为冰，冰化琉璃，\n净土初地，于是得见。\nWhen water turns to ice, and ice to beryl,\nthe first ground of the Pure Land is seen.',
        ],
        act2: [
          '一一宝树，高八千由旬，\n其叶其华，皆七宝所成。\nEach jeweled tree is eight thousand yojanas tall,\nits leaves and flowers made of seven gems.',
          '八功德水，流注有声，\n演说苦、空、无常、无我。\nThe water of eight virtues murmurs as it flows:\nsuffering, emptiness, impermanence, no-self.',
          '境界现时，莫生取著——\n任其自然，渐次深入。\nDo not grasp at the vision when it comes —\nlet it deepen of its own accord.',
        ],
        act3: [
          '见此一佛，即见一切诸佛；\n见佛之心，即是佛心。\nTo see this Buddha is to see all Buddhas;\nthe mind that sees the Buddha IS the Buddha-mind.',
          '其光普摄念佛众生，\n一一摄取，不舍一人。\nHis light embraces every being who remembers him,\nand never lets a single one fall.',
          '成就此观者，\n将于莲华之中开目。\nThose who complete this contemplation\nwill open their eyes inside a lotus.',
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
    subtitle: '观想净土 · Visualizing the Pure Land',
    quote: '“愿示我无忧之国。” ——韦提希夫人<br>“Reveal to me a land without sorrow.” — Queen Vaidehī',
    steps: [
      ['一 · 键 · THE KEYS', '以光充满黑暗。或轻或重击键——音高定其绽放之处，和弦开为曼陀罗。填满黑暗，直至琉璃大地凝结而成。<br>Flood the darkness with light. Strike softly or hard — pitch places the bloom, chords open into mandalas. Fill the dark until the beryl ground freezes into being.'],
      ['二 · 钮 · THE KNOBS', '培育此众宝世界：宝树、莲池、自鸣之乐、香风。凡你所立，皆不散灭——持之则不坏。<br>Cultivate the jeweled world: trees, lotus ponds, self-playing music, wind. What you raise remains — nothing decays while you hold it.'],
      ['三 · 垫 · THE PADS', '任按一垫，皆引十六观法前行一境——一境未终，不入其次。末垫一按，尽释此境，复归于暗。<br>Any pad carries the rite of sixteen contemplations one vision onward — each must finish before the next. The last releases it all back into darkness.'],
    ],
    hint: "No controller?  ` turns on keyboard play — letter rows = keys · 1–8 = pads (9 flips bank) · , . / ; ' [ ] \\ = the 8 dials (hold to raise, Shift lowers) · Shift +/− = sound on/off · Shift+letter for toggles",
    begin: '击任意键以启 · strike any key to begin',
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

    // Extra quiet captions (no scene effect) woven between the milestones
    // so Act I unfolds with more to read as the light gathers.
    loreBeats: [
      [0.12, ['第一观 · THE SETTING SUN', '先观落日，悬鼓西垂——\n心中一轮，明照未来。\nFirst behold the setting sun, a hanging drum in the west —\nhold that one disc of light in the mind.']],
      [0.46, ['水想成 · THE WATER HOLDS', '水既澄清，遍照无碍——\n渐见琉璃，光自内生。\nThe water clears and holds; through it a beryl light\nbegins to shine from within.']],
      [0.82, ['地渐成 · THE GROUND FORMS', '光明渐凝，坚固不动——\n琉璃为地，众宝间错。\nThe light slowly sets, firm and unmoving:\na ground of beryl, inlaid with every jewel.']],
    ],

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

  // ── DARK SPACE — the black emptiness itself is alive ───────────────
  // Three barely-there layers populate the negative space (all colors
  // kept under the bloom threshold so the darkness never competes with
  // the fireworks), plus faint ripples that answer the performer.
  darkspace: {
    enabled: true,
    // brightness scale per phase (coda inherits its own fade on top)
    phaseScale: {
      prologue: 0.35, prison: 0.6, act1: 1, act2: 1, act3: 1,
      coda: 0.5, epilogue: 0.6,
    },
    dust: {              // drifting dust-motes / distant stars, everywhere
      everySec: 0.4,
      perSpawn: 14,
      brightness: 0.22,
    },
    ink: {               // slow ink-wash clouds roiling through the dark
      clouds: 6,
      everySec: 0.24,
      brightness: 0.3,
      driftSpeed: 0.05,  // how fast the cloud centers wander
    },
    ghosts: {            // mural fragments surfacing in far corners
      everySec: 45,      // average; ±40% jitter
      brightness: 0.16,
      lifeSec: 7,
      heightFrac: 0.22,
    },
    ripple: {            // strikes send slow faint rings through the dark
      minGapSec: 0.5,
      brightness: 0.3,
      speed: 260,
      count: 90,
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
    // Peak opacity per phase — raised so the painted wall reads through
    // the (now luma-keyed) particles during the acts, still low enough
    // to stay a backdrop. The prologue stays a black prison.
    opacityByPhase: {
      prologue: 0, prison: 0.02, act1: 0.03, act2: 0.045, act3: 0.06,
      coda: 0, epilogue: 0.02, // the cave wall itself glows once, then fades
    },
    panAmount: 0.035,   // slow horizontal drift (×worldWidth)
    breatheAmount: 0.05, // slow scale breathing

    // 若隐若现 — on its own clock the wall SURFACES into visibility for a
    // few breaths, then sinks back to its faint base (acts only).
    surface: {
      everySec: 40,     // average time between surfacings (±40%)
      holdSec: 9,       // one full swell: rise, hold a moment, sink
      opacity: 0.1,     // the peak (well above the phase base levels)
    },

    // THE ENDING — after the dissolution, the VIVID Pure-Land tableau
    // (Wikimedia Dunhuang217.jpg) comes fully out for the first time,
    // height-fit and centered, holds over the epilogue line, and sinks
    // to black before the loop returns.
    endImage: 'purelands-vivid.jpg',
    endReveal: {
      inAt: 5,          // starts a short beat AFTER the 心光 particles appear
      inSec: 16,        // parts fade in gently one by one over this span (slower)
      holdSec: 8,       // the whole picture holds
      outSec: 5,
      opacity: 0.6,     // bright — the reveal is the point
      tiles: [16, 9],   // reveal grid (cols, rows): parts appear one by one
    },
  },

  // ── ACT 2 — the knob-grown world ───────────────────────────────────
  act2: {
    smoothing: 0.5,     // slower — the world grows in unhurried, not snapping
    trees: {
      rows: 7,          // the sutra's seven rows of jeweled trees
      perSide: 4,       // trees per row on each side third
      height: 185,      // base trunk+canopy height (world units)
      rowShrink: 0.085, // each farther row is this much smaller/dimmer
    },
    ponds: {
      count: 7,         // glowing lotus ponds along the ground
      lotusPerPond: 5,
    },
    instruments: {
      count: 14,            // self-playing instruments as orbs of light
      xSpanFrac: 0.42,      // arc spread (×worldWidth/2 each side)
      yFracRange: [0.16, 0.33], // arc height band (×worldHeight)
      sparkMaxRate: 2.4,    // rising note-motes/sec at full K3 (calmer pace)
    },
    wind: {
      seedInterval: 0.22, // seconds between drift-seed spawns at full K4 (calmer)
      seedCount: 12,      // seeds per spawn (×density ×quality)
      seedSpeed: 90,      // horizontal drift speed at full wind
      rotMax: 0.018,      // whole-world mandala sway (radians) at full wind
    },

    // SURGES — turning a dial should feel DRAMATIC: every time a dial
    // crosses a threshold, its part of the world answers with a wave of
    // celebratory bursts through its own region.
    surge: {
      thresholds: [0.3, 0.6, 0.9],
      bursts: 6,          // bursts per surge (× tier) — gentler answer
      count: 85,          // particles per burst
    },
    // Every dial grows its own part of the story and tells it (caption)
    // the first time it is raised in Act 2 ([title, line] per knob).
    knobStories: [
      ['第四观 · THE JEWELED TREES', '七重行树，次第而起——\n一一叶间，各放异光。\nSeven rows of jeweled trees rise —\nevery leaf a different light.'],
      ['第五观 · THE PONDS', '八功德水，充满诸池；\n滴滴落下，皆演妙法。\nPonds of the eight virtues; each drop\nspeaks the Dharma as it falls.'],
      ['第六观 · THE TOWERS OF MUSIC', '五百宝楼庄严，空中乐器，\n不鼓自鸣。\nFive hundred jeweled towers, and in the sky\ninstruments that sound themselves.'],
      ['风 · THE WIND', '微风徐动，光影流转；\n净土全境，如一息呼吸。\nA soft wind turns the light;\nthe whole paradise breathes.'],
      ['妙音鸟 · THE KALAVINKA BIRDS', '妙音之鸟，回翔空中，\n其飞其鸣，皆是法音。\nJeweled birds wheel through the sky,\ntheir flight itself a song of Dharma.'],
      ['宝光 · THE RAYS OF LIGHT', '自天之顶，金光垂布，\n遍照温煦，彻满全地。\nFrom the height of the sky, rays of golden light\nfan out and warm the whole land.'],
      ['幢幡 · THE JEWELED BANNERS', '幢幡宝盖，众色相间，\n悬于虚空，随香风摇曳。\nBanners and canopies of every color\nhang in the air, swaying in the fragrant wind.'],
      ['天云 · THE CLOUDS OF LIGHT', '光明之云，浮于楼阁之上，\n载持天华，散布妙香。\nClouds of soft light drift above the towers,\ncarrying flowers and perfume.'],
    ],

    // K5–K8 sky layers
    birds: {
      max: 16,             // K5: flock size follows the dial
      trailInterval: 0.055, // calligraphy trail behind each bird
      glyphEverySec: 0.05, // how often each bird redraws its body
      wingLen: 27,         // wing length (world units) — REAL birds now
      bodySize: 3.4,       // body mote size
      wingSize: 2.9,       // wing motes taper from this
      flapHz: [2.6, 4.2],  // per-bird flap speed range
      steerAccel: 320,     // joystick pull on the flock center (X and Y)
      wanderAccel: 42,     // autonomous group-drift when the stick is idle
      maxSpeed: 250,       // flock-center speed limit
      yMinFrac: -0.35,     // the flock may swoop nearly to the ground…
      yMaxFrac: 0.46,      // …and climb to the top of the wall
    },
    rays: { count: 32 },                       // K6: fan of light from the apex
    banners: { count: 14 },                    // K7: hanging ribbon-banners
    clouds: { count: 20 },                     // K8: drifting bands of light

    // THE DISSOLUTION'S FINALE (see Act2 coda): the whole wall becomes
    // ONE calm field of light (一片), held, then the standing sheet
    // drifts slowly apart and fades away together (慢慢消失分散) — no
    // flicker, no shards, no whiteout collapse.
    coda: {
      formEnd: 0.42,        // the field builds to full by this fraction…
      holdEnd: 0.6,         // …holds full to here, then replenishment stops
      fieldEverySec: 0.06,  // how often field points spawn
      fieldBursts: 10,      // scatter points per tick (× the build ramp)
      fieldCount: 38,       // motes per point
      fieldLifeMin: 5,      // long life → the sheet lingers as it disperses
      fieldLifeMax: 8.5,
      disperseSpeed: 150,   // gentle outward drift (× position) — never fast
    },

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
    // THE RITE — Act 3 keeps its own pace: ANY pad press advances to the
    // next contemplation IN ORDER, and only once the current vision has
    // finished (busySec). No skipping, no going back, no pile-ups.
    rite: [
      'sun', 'water', 'groundFreeze', 'treesStory', 'pondsStory',
      'musicStory', 'throne', 'image', 'amitabha', 'avalokitesvara',
      'mahasthamaprapta', 'universal', 'mixed', 'gradesHigh', 'gradesMid',
      'gradesLow', 'awakening', 'dissolution',
    ],
    busyDefaultSec: 9,   // a vision owns the stage at least this long
    busySec: {           // per-story overrides (match their durations)
      sun: 11, water: 8, universal: 11, mixed: 9, awakening: 13,
      amitabha: 11, avalokitesvara: 8, mahasthamaprapta: 8,
    },

    // THE WALL KNOWS EACH 观 — the real north wall paints the sixteen
    // contemplations, so each story lights its own painted panel:
    // [u, v, radius] in fractions of the image (v from the TOP).
    // The contemplation strip runs down the RIGHT edge; the true body is
    // the central Amitāyus himself; the attendants flank him; the three
    // rebirth grades are the bottom terrace scenes. Tune freely.
    spotlightOpacity: 0.34,
    muralRegions: {
      sun:              [0.935, 0.10, 0.07],
      water:            [0.935, 0.175, 0.07],
      groundFreeze:     [0.935, 0.25, 0.07],
      treesStory:       [0.935, 0.325, 0.07],
      pondsStory:       [0.935, 0.40, 0.07],
      musicStory:       [0.935, 0.475, 0.07],
      throne:           [0.935, 0.55, 0.07],
      image:            [0.935, 0.625, 0.07],
      amitabha:         [0.565, 0.36, 0.10],   // the central true body
      avalokitesvara:   [0.42, 0.37, 0.075],   // his left hand
      mahasthamaprapta: [0.71, 0.37, 0.075],   // his right hand
      universal:        [0.565, 0.52, 0.17],   // the whole assembly
      mixed:            [0.935, 0.70, 0.06],
      gradesHigh:       [0.35, 0.68, 0.08],    // the bottom terraces
      gradesMid:        [0.565, 0.72, 0.08],
      gradesLow:        [0.78, 0.68, 0.08],
      awakening:        [0.115, 0.30, 0.07],   // the story strip, west
    },

    // Every pad's story — [title, line] shown as a caption when pressed.
    stories: {
      prison: ['缘起 · THE PRISON', '韦提希为其子所囚，哀求于佛：\n愿见无忧之国。\nQueen Vaidehī, imprisoned by her own son, begged the Buddha:\nreveal to me a land without sorrow.'],
      sun: ['第一观 · THE SETTING SUN', '面向西方，谛观落日，\n悬于天际，状如悬鼓。\nFace the west. See the sun about to set,\nhanging in the sky like a suspended drum.'],
      water: ['第二观 · WATER & ICE', '观水澄清，湛然不动——\n复见其凝，成莹澈之冰。\nSee water, clear and still —\nthen see it freeze to shining, translucent ice.'],
      groundFreeze: ['第三观 · THE BERYL GROUND', '冰化琉璃，成光明地，\n平正如掌。\nThe ice becomes beryl: a ground of light,\nlevel as the palm of a hand.'],
      treesStory: ['第四观 · THE JEWELED TREES', '七重行树，皆已成就——\n谛观一一叶，各现异光。\nSeven rows of jeweled trees stand full-grown —\ncontemplate each leaf, a different light.'],
      pondsStory: ['第五观 · THE PONDS', '八功德水，光明莹澈；\n滴滴落时，皆演妙法。\nThe water of eight virtues shines;\neach drop speaks the Dharma as it falls.'],
      musicStory: ['第六观 · THE TOWERS OF MUSIC', '宝楼耸立，乐器悬空，\n无人抚弄，自然成音。\nThe towers stand; instruments hang in the sky,\nsounding themselves without a hand.'],
      throne: ['第七观 · THE LOTUS THRONE', '宝地之上，大莲华开——\n为无量寿佛之座。\nOn the jeweled ground a great lotus unfolds —\na seat awaiting the Buddha of Infinite Life.'],
      image: ['第八观 · THE IMAGE', '先观其像：金色之身，坐于莲上——\n是心作佛，是心是佛。\nFirst see his image only: golden, seated on the lotus —\nthe mind that makes the Buddha is the Buddha.'],
      amitabha: ['第九观 · THE TRUE BODY', '无量寿佛真身：其身金色，\n如百千万亿日。\nAmitāyus himself: his body the gold\nof a hundred thousand million suns.'],
      avalokitesvara: ['第十观 · AVALOKITEŚVARA', '大悲观世音，侍佛之左，\n宝冠之中，有一立佛放光。\nThe bodhisattva of compassion at his left hand,\na standing Buddha shining in her crown.'],
      mahasthamaprapta: ['第十一观 · MAHĀSTHĀMAPRĀPTA', '大势至菩萨，侍佛之右——\n所行之处，世界震动华开。\nThe bodhisattva of great power at his right hand —\nwhere he walks, worlds tremble into bloom.'],
      universal: ['第十二观 · THE UNIVERSAL VISION', '观自身生于彼土，坐莲华中——\n光华如雨，遍洒全地。\nSee yourself born there, seated in a lotus bud —\nflowers of light rain over the whole land.'],
      mixed: ['第十三观 · THE MIXED VISION', '或大或小，或像或真——\n于诸形相间，明灭变现。\nNow vast, now small, now image, now true —\nthe vision flickers between all of his forms.'],
      gradesHigh: ['第十四观 · THE HIGHEST REBIRTHS', '上品至诚者，乘金刚台而升，\n圣众全体，前来迎接。\nThose of deepest devotion rise on diamond daises,\nwelcomed by the entire holy assembly.'],
      gradesMid: ['第十五观 · THE MIDDLE REBIRTHS', '中品往生者，处莲华中，\n经一日一夜，华乃开敷。\nThe middle-born arrive in lotuses\nthat open after a night and a day.'],
      gradesLow: ['第十六观 · THE LOWEST REBIRTHS', '虽极重罪人，称名十念，\n命终之时，金莲来迎。\nEven the greatest sinner, saying the Name ten times,\nis met at death by a lotus of gold.'],
      awakening: ['开悟 · THE AWAKENING', '见此国土，韦提希欢喜，\n其心开解，如莲华于初光中绽放。\nSeeing the land, Vaidehī rejoiced;\nher mind opened like a lotus at first light.'],
      dissolution: ['一切有为法 · 如梦幻泡影', 'All conditioned things are as dreams,\nillusions, bubbles, shadows…'],
    },

    // Grade groups for the three rebirth pads (soul-mote heights/colors).
    gradeGroups: { gradesHigh: [8, 7, 6], gradesMid: [5, 4, 3], gradesLow: [2, 1, 0] },
    // Timed story visions (sun sinking, water sweeping) — long, unhurried
    sun: { durationSec: 10, x: -0.27, yTopFrac: 0.30, yEndFrac: 0.02 },
    water: { sweepSec: 4.2 },
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
    rain: { durationSec: 9, interval: 0.1, fallDrift: -70 }, // blossom rain
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
    intensity: 0.8,               // additive glow — Act 3 must not blow out
    panels: [
      // 第七观 THE LOTUS THRONE — the real jeweled pedestal beneath the
      // central Buddha (cropped from the same scan): the flower seat
      // condenses at center and the photograph comes through.
      { file: 'lotus-throne.jpg', role: 'story', story: 'throne',
        x: 0, yFrac: -0.02, heightFrac: 0.34, plasterSkip: false,
        maskShape: 'lotus', // a scalloped bloom, not a rectangle
        retint: 0.1, intensity: 0.62, photoThrough: true, photoMax: 0.36 },
      // 第八观 THE IMAGE — the same Buddha, but seen first as pure GOLD:
      // heavy retint turns the whole figure into a golden idea of him
      // (particles only, no photo — the truth waits for 第九观).
      { file: 'buddha-true-body.jpg', role: 'story', story: 'image',
        x: 0, yFrac: 0.06, heightFrac: 0.46, plasterSkip: false,
        maskShape: 'mandorla', mask: [0.5, 0.46, 0.46, 0.5], // aura of light
        retint: 0.85, intensity: 0.85 },
      // 第九观 THE TRUE BODY — the real central Amitāyus of the vivid
      // tableau (Wikimedia Dunhuang217.jpg, cropped): particles condense,
      // then the photograph itself comes through, red robe and green
      // mandorla true. The procedural figure stands beneath it.
      { file: 'buddha-true-body.jpg', role: 'story', story: 'amitabha',
        x: 0, yFrac: 0.06, heightFrac: 0.52, plasterSkip: false,
        maskShape: 'mandorla', mask: [0.5, 0.46, 0.46, 0.5], // his mandorla
        retint: 0.12, intensity: 0.58, photoThrough: true, photoMax: 0.38 },
      // 第十观 / 第十一观 — the REAL standing attendants who flank him in
      // the same scan, each condensing at their canonical side.
      { file: 'avalokitesvara.jpg', role: 'story', story: 'avalokitesvara',
        x: -0.15, yFrac: 0.04, heightFrac: 0.46, plasterSkip: false,
        maskShape: 'arch', // a standing figure in a niche
        retint: 0.12, intensity: 0.58, photoThrough: true, photoMax: 0.36 },
      { file: 'mahasthamaprapta.jpg', role: 'story', story: 'mahasthamaprapta',
        x: 0.15, yFrac: 0.04, heightFrac: 0.46, plasterSkip: false,
        maskShape: 'arch',
        retint: 0.12, intensity: 0.58, photoThrough: true, photoMax: 0.36 },
      // 第六观 THE TOWERS OF MUSIC — the jeweled-pavilion detail of the
      // same wall (Mogao Cave 217 architecture 01).
      { file: 'pavilion-music.jpg', role: 'story', story: 'musicStory',
        x: 0, yFrac: 0.2, heightFrac: 0.34, plasterSkip: false,
        maskShape: 'arch', // the jeweled pavilion, an arched hall
        retint: 0.1, intensity: 0.58, photoThrough: true, photoMax: 0.36 },
      // role 'panel': materialize on the Universal Vision pad (B1),
      // scatter in the coda.
      // REAL 飞天 (Wikimedia scans): the ribbon-pair on a dark ground
      // (gamma thins the ochre) in the west; the flute-player on white
      // plaster (plasterSkip keeps only the figure) in the east. Both
      // reveal their actual photograph at the Universal Vision.
      { file: 'apsara-pair.jpg', role: 'panel',
        x: -0.335, yFrac: 0.27, heightFrac: 0.2, cutoff: 0.3,
        gamma: 1.3, gain: 1.9, retint: 0.25, intensity: 0.55,
        photoThrough: true, photoMax: 0.2 },
      // (no photoThrough here: its WHITE plaster ground would flare into
      //  a bright oval under additive blending — the plaster-skipped
      //  particles alone draw the figure cleanly.)
      { file: 'apsara-flute.jpg', role: 'panel',
        x: 0.335, yFrac: 0.27, heightFrac: 0.2, plasterSkip: true,
        retint: 0.2, intensity: 0.7 },
      // role 'story': real Cave 217 details that condense while their
      // pad's story is told, then fray away again. plasterSkip drops the
      // pale plaster background so only the painting becomes particles;
      // photoThrough fades the ACTUAL photograph in through the held
      // particles (soft-edged), so the image finally reads clearly.
      { file: 'cave-sun-contemplation.jpg', role: 'story', story: 'sun',
        x: -0.3, yFrac: 0.16, heightFrac: 0.4, plasterSkip: true,
        maskShape: 'oval', // a soft disc, and made more legible:
        intensity: 1.05, photoThrough: true, photoMax: 0.62 },
      { file: 'cave-prison.jpg', role: 'story', story: 'prison',
        x: 0.3, yFrac: 0.16, heightFrac: 0.34, plasterSkip: true,
        photoThrough: true, photoMax: 0.36 },
      { file: 'cave-music-sky.jpg', role: 'story', story: 'mixed',
        x: 0, yFrac: 0.3, heightFrac: 0.24, plasterSkip: true,
        maskShape: 'oval', // a soft band of sky, not a rectangle
        photoThrough: true, photoMax: 0.36 },
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
