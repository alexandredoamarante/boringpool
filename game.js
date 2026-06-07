(() => {
  'use strict';

  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');

  const ui = {
    score: document.getElementById('scoreLabel'),
    ballsLeft: document.getElementById('ballsLeftLabel'),
    level: document.getElementById('levelLabel'),
    best: document.getElementById('bestLabel'),
    shots: document.getElementById('shotsLabel'),
    newGame: document.getElementById('newGameBtn'),
    cue: document.getElementById('cueBtn'),
    theme: document.getElementById('themeBtn'),
    overlay: document.getElementById('menuOverlay'),
    startPanel: document.getElementById('startPanel'),
    statsPanel: document.getElementById('statsPanel'),
    achievementsPanel: document.getElementById('achievementsPanel'),
    startBest: document.getElementById('startBestLabel'),
    startRacks: document.getElementById('startRacksLabel'),
    start: document.getElementById('startBtn'),
    statsButton: document.getElementById('statsBtn'),
    achievementsButton: document.getElementById('achievementsBtn'),
    sound: document.getElementById('soundBtn'),
    menuTheme: document.getElementById('menuThemeBtn'),
    statsList: document.getElementById('statsList'),
    achievementsList: document.getElementById('achievementsList'),
    statsBack: document.getElementById('statsBackBtn'),
    achievementsBack: document.getElementById('achievementsBackBtn')
  };

  const WIDTH = canvas.width;
  const HEIGHT = canvas.height;
  const table = { x: 68, y: 62, w: 824, h: 404, rail: 33 };
  const play = {
    x: table.x + table.rail,
    y: table.y + table.rail,
    w: table.w - table.rail * 2,
    h: table.h - table.rail * 2
  };

  const CONFIG = {
    ballRadius: 12,
    pocketRadius: 31,
    // The visible black cup is the only drop zone. A ball drops as soon as
    // its circular edge minimally overlaps the black cup drawn in the pocket.
    // No suction, no invisible gravity and no "near pocket" scoring.
    pocketBlackRadius: 10.6,
    pocketContactSlack: 0.35,
    mouthWidth: 64,
    maxPull: 150,
    shotScale: 0.198,
    friction: 0.9889,
    rollingFriction: 0.0052,
    railRestitution: 0.875,
    ballRestitution: 0.965,
    stopThreshold: 0.024,
    maxSpeed: 32,
    spinCurve: 0,
    spinDecay: 0.988,
    railSpinTransfer: 0.28,
    minPhysicsSubsteps: 8,
    maxPhysicsSubsteps: 24
  };

  const STORAGE = {
    best: 'lcd-pocket-pool-best-v9',
    theme: 'lcd-pocket-pool-theme-v9',
    sound: 'boringpool-sound-v1',
    stats: 'boringpool-stats-v1',
    achievements: 'boringpool-achievements-v1'
  };

  const THEMES = [
    { id: 'classic', label: 'CLASSIC' },
    { id: 'brick', label: 'BRICK' },
    { id: 'pocket', label: 'POCKET' },
    { id: 'night', label: 'NIGHT' }
  ];

  const DEFAULT_STATS = {
    racksCleared: 0,
    totalPots: 0,
    totalShots: 0,
    cueFouls: 0,
    eightBallFinishes: 0,
    bestStreak: 0,
    bestCombo: 0,
    fewestShotsClear: 0,
    bankShots: 0,
    totalPlayTime: 0,
    manualCuePlaces: 0
  };

  const ACHIEVEMENTS = [
    { id: 'first-rack', name: 'FIRST RACK', desc: 'Clear one rack.' },
    { id: 'no-foul', name: 'NO FOUL', desc: 'Clear a rack without cue foul.' },
    { id: 'bank-shot', name: 'BANK SHOT', desc: 'Pot after a rail hit.' },
    { id: 'combo-2', name: 'COMBO x2', desc: 'Pot 2+ balls in one shot.' },
    { id: 'eight-finish', name: '8 BALL FINISH', desc: 'Legally pot the 8 last.' },
    { id: 'perfect-rack', name: 'PERFECT RACK', desc: 'Clear a rack with no cue foul.' },
    { id: 'xp-10k', name: '10K XP', desc: 'Reach 10,000 XP.' },
    { id: 'cue-master', name: 'CUE MASTER', desc: 'Clear without manual CUE PLACE.' },
    { id: 'sharpshooter', name: 'SHARPSHOOTER', desc: 'Clear in 14 shots or fewer.' },
    { id: 'long-run', name: 'LONG RUN', desc: 'Clear 3 racks in one session.' }
  ];

  const LCD = {
    bg: '#9bbc0f',
    panel: '#a7b188',
    dark: '#0f220f',
    mid: '#2b3d25',
    faint: 'rgba(15,34,15,0.18)'
  };

  const pockets = [
    { x: play.x, y: play.y, type: 'corner', sides: ['left', 'top'] },
    { x: play.x + play.w / 2, y: play.y, type: 'side', sides: ['top'] },
    { x: play.x + play.w, y: play.y, type: 'corner', sides: ['right', 'top'] },
    { x: play.x, y: play.y + play.h, type: 'corner', sides: ['left', 'bottom'] },
    { x: play.x + play.w / 2, y: play.y + play.h, type: 'side', sides: ['bottom'] },
    { x: play.x + play.w, y: play.y + play.h, type: 'corner', sides: ['right', 'bottom'] }
  ];

  let balls = [];
  let shots = 0;
  let score = 0;
  let level = 1;
  let streak = 0;
  let bestScore = Number(storageGet(STORAGE.best, '0') || 0);
  let lastTime = performance.now();
  let cueNeedsRespawn = false;
  let shotInProgress = false;
  let levelCleared = false;
  let nextRackAt = 0;
  let rackCueFouls = 0;
  let cuePlacesLeft = 2;
  let message = 'AIM AND DRAG POWER';
  let messageUntil = performance.now() + 2200;
  let floatingMessages = [];
  let currentShot = null;
  let eightNeedsRespawn = false;
  let earlyEightBall = null;
  let gameStarted = false;
  let stats = loadStats();
  let unlockedAchievements = loadAchievements();
  let sessionRacksCleared = 0;
  let rackManualCuePlaces = 0;
  let playTimeMark = performance.now();
  let lastStatsFlush = performance.now();
  let achievementToast = null;
  let audioEnabled = storageGet(STORAGE.sound, 'on') !== 'off';
  let audioCtx = null;
  const lastSoundAt = Object.create(null);

  const pointer = {
    x: play.x + play.w * 0.25,
    y: play.y + play.h * 0.5,
    down: false,
    dragging: false,
    id: null,
    startX: 0,
    startY: 0,
    aimX: 1,
    aimY: 0,
    lockedAimX: 1,
    lockedAimY: 0,
    pull: 0,
    displayPull: 0
  };

  class Ball {
    constructor(x, y, number, cue = false) {
      this.x = x;
      this.y = y;
      this.prevX = x;
      this.prevY = y;
      this.vx = 0;
      this.vy = 0;
      this.r = CONFIG.ballRadius;
      this.number = number;
      this.cue = cue;
      this.potted = false;
      this.sink = 0;
      this.railHits = 0;
      this.firstRailBeforePocket = false;
      this.lastPocketNear = null;
      this.spin = 0;
    }

    speed() {
      return Math.hypot(this.vx, this.vy);
    }
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function storageGet(key, fallback = '') {
    try {
      const value = localStorage.getItem(key);
      return value === null ? fallback : value;
    } catch (error) {
      return fallback;
    }
  }

  function storageSet(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (error) {
      // Storage can be blocked in private contexts; gameplay must continue.
    }
  }

  function loadStats() {
    try {
      return { ...DEFAULT_STATS, ...JSON.parse(storageGet(STORAGE.stats, '{}')) };
    } catch (error) {
      return { ...DEFAULT_STATS };
    }
  }

  function saveStats() {
    storageSet(STORAGE.stats, JSON.stringify(stats));
    updateMenuSummary();
  }

  function touchPlayTime(now = performance.now()) {
    const elapsed = Math.max(0, (now - playTimeMark) / 1000);
    if (elapsed > 0) {
      stats.totalPlayTime += elapsed;
      playTimeMark = now;
    }
  }

  function loadAchievements() {
    try {
      const parsed = JSON.parse(storageGet(STORAGE.achievements, '[]'));
      return new Set(Array.isArray(parsed) ? parsed : []);
    } catch (error) {
      return new Set();
    }
  }

  function saveAchievements() {
    storageSet(STORAGE.achievements, JSON.stringify([...unlockedAchievements]));
    updateAchievementsScreen();
  }

  function formatNumber(value, width = 0) {
    const number = Math.max(0, Math.floor(Number(value) || 0));
    return width ? String(number).padStart(width, '0') : String(number);
  }

  function formatTime(seconds) {
    const total = Math.max(0, Math.floor(Number(seconds) || 0));
    const hrs = Math.floor(total / 3600);
    const mins = Math.floor((total % 3600) / 60);
    const secs = total % 60;
    if (hrs > 0) return `${hrs}H ${String(mins).padStart(2, '0')}M`;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  function showAchievementToast(name) {
    achievementToast = { name, start: performance.now(), duration: 2100 };
  }

  function unlockAchievement(id) {
    if (unlockedAchievements.has(id)) return false;
    const achievement = ACHIEVEMENTS.find((item) => item.id === id);
    if (!achievement) return false;
    unlockedAchievements.add(id);
    saveAchievements();
    showAchievementToast(achievement.name);
    playSound('achievement', 0.9);
    return true;
  }

  function checkScoreAchievements() {
    if (score >= 10000) unlockAchievement('xp-10k');
    if (streak > stats.bestStreak) stats.bestStreak = streak;
  }

  function initAudio() {
    if (audioCtx || !audioEnabled) return audioCtx;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      audioCtx = new Ctx();
    } catch (error) {
      audioCtx = null;
    }
    return audioCtx;
  }

  function updateSoundButton() {
    const label = audioEnabled ? 'SOUND ON' : 'SOUND OFF';
    if (ui.sound) ui.sound.textContent = label;
  }

  function setSoundEnabled(enabled) {
    audioEnabled = Boolean(enabled);
    storageSet(STORAGE.sound, audioEnabled ? 'on' : 'off');
    if (audioEnabled) initAudio();
    updateSoundButton();
  }

  function toggleSound() {
    setSoundEnabled(!audioEnabled);
    playSound('button', 0.45, true);
  }

  function soundAllowed(type, gap) {
    const now = performance.now();
    if ((lastSoundAt[type] || 0) + gap > now) return false;
    lastSoundAt[type] = now;
    return true;
  }

  function playTone(ctxRef, frequency, duration, volume, type = 'square', startOffset = 0) {
    const now = ctxRef.currentTime + startOffset;
    const osc = ctxRef.createOscillator();
    const gain = ctxRef.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), now + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain).connect(ctxRef.destination);
    osc.start(now);
    osc.stop(now + duration + 0.012);
  }

  function playNoise(ctxRef, duration, volume, startOffset = 0) {
    const sampleRate = ctxRef.sampleRate;
    const buffer = ctxRef.createBuffer(1, Math.max(1, Math.floor(sampleRate * duration)), sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    }
    const src = ctxRef.createBufferSource();
    const filter = ctxRef.createBiquadFilter();
    const gain = ctxRef.createGain();
    filter.type = 'bandpass';
    filter.frequency.value = 900;
    filter.Q.value = 1.6;
    gain.gain.value = volume;
    src.buffer = buffer;
    src.connect(filter).connect(gain).connect(ctxRef.destination);
    src.start(ctxRef.currentTime + startOffset);
  }

  function playSound(type, intensity = 0.5, force = false) {
    if (!audioEnabled) return;
    const gaps = {
      collision: 48,
      rail: 70,
      pocket: 85,
      button: 45,
      cue: 120,
      foul: 160,
      eight: 240,
      clear: 400,
      achievement: 420
    };
    if (!force && !soundAllowed(type, gaps[type] || 90)) return;

    const ctxRef = initAudio();
    if (!ctxRef) return;
    if (ctxRef.state === 'suspended') {
      ctxRef.resume().catch(() => {});
    }

    const amount = clamp(Number(intensity) || 0.5, 0.08, 1);
    try {
      if (type === 'cue') {
        playNoise(ctxRef, 0.035, 0.035 + amount * 0.055);
        playTone(ctxRef, 135 + amount * 80, 0.045, 0.028 + amount * 0.03, 'square');
      } else if (type === 'collision') {
        playTone(ctxRef, 520 + amount * 260, 0.025, 0.018 + amount * 0.035, 'square');
        playNoise(ctxRef, 0.018, 0.012 + amount * 0.02);
      } else if (type === 'rail') {
        playTone(ctxRef, 220 + amount * 90, 0.038, 0.018 + amount * 0.025, 'triangle');
      } else if (type === 'pocket') {
        playTone(ctxRef, 150, 0.07, 0.045, 'square');
        playTone(ctxRef, 92, 0.09, 0.035, 'triangle', 0.022);
      } else if (type === 'foul') {
        playTone(ctxRef, 110, 0.09, 0.055, 'square');
        playTone(ctxRef, 82, 0.12, 0.045, 'square', 0.07);
      } else if (type === 'eight') {
        playTone(ctxRef, 392, 0.055, 0.04, 'square');
        playTone(ctxRef, 523, 0.065, 0.038, 'square', 0.055);
      } else if (type === 'clear') {
        [330, 392, 494, 659].forEach((freq, index) => playTone(ctxRef, freq, 0.07, 0.04, 'square', index * 0.055));
      } else if (type === 'achievement') {
        [523, 659, 784].forEach((freq, index) => playTone(ctxRef, freq, 0.055, 0.038, 'square', index * 0.048));
      } else if (type === 'button') {
        playTone(ctxRef, 440, 0.035, 0.025, 'square');
      }
    } catch (error) {
      // Audio is cosmetic; never block the game.
    }
  }

  function updateMenuSummary() {
    if (ui.startBest) ui.startBest.textContent = formatNumber(Math.max(bestScore, score), 6);
    if (ui.startRacks) ui.startRacks.textContent = formatNumber(stats.racksCleared, 4);
  }

  function updateStatsScreen() {
    if (!ui.statsList) return;
    touchPlayTime();
    const rows = [
      ['BEST XP', formatNumber(Math.max(bestScore, score), 6)],
      ['RACKS CLEARED', formatNumber(stats.racksCleared, 4)],
      ['TOTAL POTS', formatNumber(stats.totalPots, 5)],
      ['TOTAL SHOTS', formatNumber(stats.totalShots, 5)],
      ['CUE FOULS', formatNumber(stats.cueFouls, 4)],
      ['8 BALL FINISHES', formatNumber(stats.eightBallFinishes, 4)],
      ['BEST STREAK', formatNumber(stats.bestStreak, 2)],
      ['BEST COMBO', formatNumber(stats.bestCombo, 2)],
      ['FEWEST SHOTS CLEAR', stats.fewestShotsClear ? formatNumber(stats.fewestShotsClear, 2) : '--'],
      ['BANK SHOTS', formatNumber(stats.bankShots, 4)],
      ['PLAY TIME', formatTime(stats.totalPlayTime)]
    ];
    ui.statsList.innerHTML = rows.map(([label, value]) => `<div>${label}<strong>${value}</strong></div>`).join('');
  }

  function updateAchievementsScreen() {
    if (!ui.achievementsList) return;
    ui.achievementsList.innerHTML = ACHIEVEMENTS.map((achievement) => {
      const unlocked = unlockedAchievements.has(achievement.id);
      return `<div class="${unlocked ? 'is-unlocked' : 'is-locked'}">${achievement.name}<strong>${unlocked ? achievement.desc : 'LOCKED'}</strong></div>`;
    }).join('');
  }

  function showPanel(panelName) {
    if (!ui.overlay) return;
    ui.overlay.hidden = false;
    ui.startPanel.hidden = panelName !== 'start';
    ui.statsPanel.hidden = panelName !== 'stats';
    ui.achievementsPanel.hidden = panelName !== 'achievements';
    updateMenuSummary();
    updateSoundButton();
    if (panelName === 'stats') updateStatsScreen();
    if (panelName === 'achievements') updateAchievementsScreen();
  }

  function showStartScreen() {
    gameStarted = false;
    showPanel('start');
  }

  function showStatsScreen() {
    playSound('button', 0.35, true);
    showPanel('stats');
  }

  function showAchievementsScreen() {
    playSound('button', 0.35, true);
    showPanel('achievements');
  }

  function startGame() {
    gameStarted = true;
    playTimeMark = performance.now();
    if (ui.overlay) ui.overlay.hidden = true;
    initAudio();
    playSound('button', 0.45, true);
  }


  function readCssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  function syncLCDColors() {
    LCD.bg = readCssVar('--lcd-bg') || LCD.bg;
    LCD.panel = readCssVar('--lcd-panel') || LCD.panel;
    LCD.dark = readCssVar('--lcd-dark') || LCD.dark;
    LCD.mid = readCssVar('--lcd-mid') || LCD.mid;
    LCD.faint = readCssVar('--lcd-faint') || LCD.faint;
  }

  function setTheme(themeId) {
    const theme = THEMES.find((item) => item.id === themeId) || THEMES[0];
    document.documentElement.dataset.theme = theme.id;
    storageSet(STORAGE.theme, theme.id);
    ui.theme.textContent = `LCD: ${theme.label}`;
    if (ui.menuTheme) ui.menuTheme.textContent = `LCD: ${theme.label}`;
    syncLCDColors();
  }

  function cycleTheme() {
    const current = document.documentElement.dataset.theme || THEMES[0].id;
    const index = THEMES.findIndex((item) => item.id === current);
    const next = THEMES[(index + 1 + THEMES.length) % THEMES.length];
    setTheme(next.id);
    showMessage(`LCD ${next.label}`, 1100);
  }

  function cueBall() {
    return balls.find((ball) => ball.cue);
  }

  function activeBalls() {
    return balls.filter((ball) => !ball.potted);
  }

  function ballsAreMoving() {
    return balls.some((ball) => !ball.potted && ball.speed() > 0.075);
  }

  function ballsLeftCount() {
    return balls.filter((ball) => !ball.cue && !ball.potted).length;
  }

  function onlyEightBallLeft() {
    const remaining = balls.filter((ball) => !ball.cue && !ball.potted);
    return remaining.length === 1 && remaining[0].number === 8;
  }

  function showMessage(text, duration = 1450) {
    message = text;
    messageUntil = performance.now() + duration;
  }

  function addFloat(text, x, y, duration = 1500) {
    floatingMessages.push({ text, x, y, start: performance.now(), duration });
  }

  function saveBest() {
    if (score > bestScore) {
      bestScore = score;
      storageSet(STORAGE.best, String(bestScore));
      updateMenuSummary();
    }
  }

  function updateHud() {
    ui.score.textContent = String(score).padStart(6, '0');
    ui.ballsLeft.textContent = String(ballsLeftCount()).padStart(2, '0');
    ui.level.textContent = String(level).padStart(2, '0');
    ui.best.textContent = String(bestScore).padStart(6, '0');
    ui.shots.textContent = String(shots).padStart(2, '0');
    ui.cue.textContent = `CUE PLACE ${cuePlacesLeft}`;
    ui.cue.disabled = cuePlacesLeft <= 0 || ballsAreMoving() || levelCleared;
    ui.cue.title = `Cue place uses left: ${cuePlacesLeft}`;
    ui.cue.setAttribute('aria-label', `Cue place. ${cuePlacesLeft} uses left.`);
  }

  function buildRack(resetAll = true) {
    balls = [];
    cueNeedsRespawn = false;
    shotInProgress = false;
    levelCleared = false;
    nextRackAt = 0;
    rackCueFouls = 0;
    rackManualCuePlaces = 0;
    cuePlacesLeft = 2;
    currentShot = null;
    eightNeedsRespawn = false;
    earlyEightBall = null;
    pointer.down = false;
    pointer.dragging = false;
    pointer.pull = 0;
    pointer.displayPull = 0;
    floatingMessages = [];

    if (resetAll) {
      shots = 0;
      score = 0;
      level = 1;
      streak = 0;
    }

    const cueX = play.x + play.w * 0.24;
    const cueY = play.y + play.h * 0.5;
    balls.push(new Ball(cueX, cueY, 0, true));

    const rackX = play.x + play.w * 0.64;
    const rackY = play.y + play.h * 0.5;
    const xStep = CONFIG.ballRadius * 1.82;
    const yStep = CONFIG.ballRadius * 2.1;
    // Keep the 8 ball in the classic center position. The other balls rotate
    // with the level so each rack still feels a little different.
    const template = [1, 9, 2, 10, 8, 3, 4, 11, 5, 12, 13, 6, 14, 7, 15];
    const otherNumbers = template.filter((number) => number !== 8);
    const shift = (level - 1) % otherNumbers.length;
    const rotated = otherNumbers.slice(shift).concat(otherNumbers.slice(0, shift));
    const rackNumbers = [];
    let otherIndex = 0;
    for (let i = 0; i < template.length; i += 1) {
      rackNumbers[i] = i === 4 ? 8 : rotated[otherIndex++];
    }
    let index = 0;

    for (let row = 0; row < 5; row += 1) {
      for (let col = 0; col <= row; col += 1) {
        const x = rackX + row * xStep;
        const y = rackY + (col - row / 2) * yStep;
        balls.push(new Ball(x, y, rackNumbers[index], false));
        index += 1;
      }
    }

    showMessage(resetAll ? 'NEW LCD RACK' : `LEVEL ${String(level).padStart(2, '0')}`, 1700);
    updateHud();
  }

  function safeCueSpot() {
    const candidates = [
      { x: play.x + play.w * 0.24, y: play.y + play.h * 0.5 },
      { x: play.x + play.w * 0.18, y: play.y + play.h * 0.36 },
      { x: play.x + play.w * 0.18, y: play.y + play.h * 0.64 },
      { x: play.x + play.w * 0.31, y: play.y + play.h * 0.5 },
      { x: play.x + play.w * 0.13, y: play.y + play.h * 0.5 }
    ];

    for (const candidate of candidates) {
      const blocked = balls.some((ball) => {
        if (ball.cue || ball.potted) return false;
        return Math.hypot(candidate.x - ball.x, candidate.y - ball.y) < CONFIG.ballRadius * 2.45;
      });
      if (!blocked) return candidate;
    }

    return candidates[0];
  }

  function respawnCue(text = 'CUE BALL PLACED') {
    const cue = cueBall();
    if (!cue) return;
    const spot = safeCueSpot();
    cue.x = spot.x;
    cue.y = spot.y;
    cue.prevX = spot.x;
    cue.prevY = spot.y;
    cue.vx = 0;
    cue.vy = 0;
    cue.potted = false;
    cue.sink = 0;
    cue.railHits = 0;
    cueNeedsRespawn = false;
    showMessage(text, 1150);
  }

  function safeObjectSpot(preferRight = true) {
    const startX = preferRight ? play.x + play.w * 0.62 : play.x + play.w * 0.44;
    const spots = [
      { x: startX, y: play.y + play.h * 0.5 },
      { x: play.x + play.w * 0.58, y: play.y + play.h * 0.36 },
      { x: play.x + play.w * 0.58, y: play.y + play.h * 0.64 },
      { x: play.x + play.w * 0.70, y: play.y + play.h * 0.42 },
      { x: play.x + play.w * 0.70, y: play.y + play.h * 0.58 },
      { x: play.x + play.w * 0.50, y: play.y + play.h * 0.5 }
    ];

    const minGap = CONFIG.ballRadius * 2.45;
    for (const candidate of spots) {
      const blocked = balls.some((ball) => {
        if (ball.potted || ball === earlyEightBall) return false;
        return Math.hypot(candidate.x - ball.x, candidate.y - ball.y) < minGap;
      });
      if (!blocked) return candidate;
    }

    for (let gy = 0; gy <= 6; gy += 1) {
      for (let gx = 0; gx <= 10; gx += 1) {
        const candidate = {
          x: play.x + play.w * (0.34 + gx * 0.052),
          y: play.y + play.h * (0.22 + gy * 0.093)
        };
        const blocked = balls.some((ball) => {
          if (ball.potted || ball === earlyEightBall) return false;
          return Math.hypot(candidate.x - ball.x, candidate.y - ball.y) < minGap;
        });
        if (!blocked) return candidate;
      }
    }

    return { x: play.x + play.w * 0.62, y: play.y + play.h * 0.5 };
  }

  function respawnEightBall() {
    if (!eightNeedsRespawn || !earlyEightBall) return;
    const spot = safeObjectSpot(true);
    earlyEightBall.x = spot.x;
    earlyEightBall.y = spot.y;
    earlyEightBall.prevX = spot.x;
    earlyEightBall.prevY = spot.y;
    earlyEightBall.vx = 0;
    earlyEightBall.vy = 0;
    earlyEightBall.spin = 0;
    earlyEightBall.potted = false;
    earlyEightBall.sink = 0;
    earlyEightBall.railHits = 0;
    eightNeedsRespawn = false;
    earlyEightBall = null;
    showMessage('8 BALL LAST', 1350);
  }

  function repositionCueNow() {
    if (ballsAreMoving() || levelCleared) return;
    if (cuePlacesLeft <= 0) {
      showMessage('CUE PLACE EMPTY', 1200);
      return;
    }

    cuePlacesLeft -= 1;
    rackManualCuePlaces += 1;
    stats.manualCuePlaces += 1;
    saveStats();
    playSound('button', 0.35, true);
    respawnCue(cuePlacesLeft > 0 ? `CUE PLACE ${cuePlacesLeft} LEFT` : 'LAST CUE PLACE');
    updateHud();
  }

  function getPointerPos(event) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY
    };
  }

  function updateAimFromPointer(pos, options = {}) {
    const cue = cueBall();
    if (!cue || cue.potted) return;

    const dx = pos.x - cue.x;
    const dy = pos.y - cue.y;
    const len = Math.hypot(dx, dy);

    // Do not let a click/hover very close to the white ball flip the aim.
    // This preserves the chosen direction while the player grabs the cue to
    // pull power, which fixes the old inverted-taco feeling.
    const protectedRadius = CONFIG.ballRadius * 4.25;
    if (!options.force && len < protectedRadius) return;

    if (len > 8) {
      pointer.aimX = dx / len;
      pointer.aimY = dy / len;
    }
  }

  function updatePullFromPointer() {
    if (!pointer.down) return;
    const cue = cueBall();
    if (!cue || cue.potted) return;

    // Fix: the cue no longer flips while clicking/dragging.
    // The player aims before the click; the click locks that direction; dragging
    // only charges power, exactly like pulling a spring on an old LCD toy.
    pointer.aimX = pointer.lockedAimX;
    pointer.aimY = pointer.lockedAimY;

    const dragDistance = Math.hypot(pointer.x - pointer.startX, pointer.y - pointer.startY);
    pointer.pull = clamp(dragDistance, 0, CONFIG.maxPull);
  }

  function onPointerDown(event) {
    if (!gameStarted || ballsAreMoving() || levelCleared) return;
    const cue = cueBall();
    if (!cue || cue.potted) return;

    const pos = getPointerPos(event);
    const clickDistance = Math.hypot(pos.x - cue.x, pos.y - cue.y);
    updateAimFromPointer(pos, { force: clickDistance > CONFIG.ballRadius * 4.25 });
    pointer.x = pos.x;
    pointer.y = pos.y;
    pointer.startX = pos.x;
    pointer.startY = pos.y;
    pointer.lockedAimX = pointer.aimX;
    pointer.lockedAimY = pointer.aimY;
    pointer.down = true;
    pointer.dragging = true;
    pointer.pull = 0;
    pointer.id = event.pointerId;
    canvas.setPointerCapture(event.pointerId);
    showMessage('DRAG POWER', 900);
  }

  function onPointerMove(event) {
    const pos = getPointerPos(event);
    pointer.x = pos.x;
    pointer.y = pos.y;

    if (pointer.down) {
      updatePullFromPointer();
    } else if (!ballsAreMoving() && !levelCleared) {
      updateAimFromPointer(pos);
    }
  }

  function beginShot() {
    currentShot = {
      potted: [],
      cuePotted: false,
      eightEarly: false,
      firstHit: false,
      firstHitNumber: null,
      noHit: true,
      anyRailAfterContact: false,
      nonEightAtStart: balls.filter((ball) => !ball.cue && !ball.potted && ball.number !== 8).length
    };
    for (const ball of balls) {
      ball.railHits = 0;
      ball.firstRailBeforePocket = false;
      ball.lastPocketNear = null;
    }
  }

  function calculateCueSpin(cue, pull) {
    // Subtle “English”: when the shot starts on the side of the white ball,
    // the cue ball bends a little and reacts more naturally on cushions.
    // Starting the drag away from the ball keeps a straight, simple shot.
    const startDx = pointer.startX - cue.x;
    const startDy = pointer.startY - cue.y;
    const startDistance = Math.hypot(startDx, startDy);
    if (startDistance > CONFIG.ballRadius * 2.15) return 0;

    const sideX = -pointer.aimY;
    const sideY = pointer.aimX;
    const lateralOffset = startDx * sideX + startDy * sideY;
    const sideAmount = clamp(lateralOffset / (CONFIG.ballRadius * 1.25), -1, 1);
    const forceAmount = clamp(pull / CONFIG.maxPull, 0, 1);
    return sideAmount * forceAmount * 0.78;
  }

  function onPointerUp(event) {
    if (!pointer.down) return;

    const cue = cueBall();
    updatePullFromPointer();
    const pull = pointer.pull;

    if (cue && !cue.potted && pointer.dragging && pull > 9 && !ballsAreMoving()) {
      beginShot();
      cue.vx = pointer.aimX * pull * CONFIG.shotScale;
      cue.vy = pointer.aimY * pull * CONFIG.shotScale;
      cue.spin = calculateCueSpin(cue, pull);
      limitSpeed(cue);
      shots += 1;
      stats.totalShots += 1;
      saveStats();
      playSound('cue', pull / CONFIG.maxPull, true);
      shotInProgress = true;
      showMessage('SHOT!', 750);
    } else if (!ballsAreMoving()) {
      showMessage('DRAG MORE', 850);
    }

    pointer.down = false;
    pointer.dragging = false;
    pointer.pull = 0;
    pointer.displayPull = 0;
    if (pointer.id !== null) {
      try {
        canvas.releasePointerCapture(pointer.id);
      } catch (error) {
        // The pointer may already be released by the browser.
      }
    }
    pointer.id = null;
    updateHud();
  }

  function registerRailHit(ball) {
    if (ball.speed() > 0.9) {
      ball.railHits += 1;
      ball.firstRailBeforePocket = true;
      if (currentShot && currentShot.firstHit) {
        currentShot.anyRailAfterContact = true;
      }
      playSound('rail', clamp(ball.speed() / 12, 0.1, 1));
    }
  }

  function nearestPocket(ball) {
    let best = null;
    let bestDist = Infinity;
    for (const pocket of pockets) {
      const d = Math.hypot(ball.x - pocket.x, ball.y - pocket.y);
      if (d < bestDist) {
        bestDist = d;
        best = pocket;
      }
    }
    return { pocket: best, distance: bestDist };
  }

  function pocketLateralOffsetAt(x, y, pocket, side) {
    if (side === 'top' || side === 'bottom') return Math.abs(x - pocket.x);
    return Math.abs(y - pocket.y);
  }

  function pocketLateralOffset(ball, pocket, side) {
    return pocketLateralOffsetAt(ball.x, ball.y, pocket, side);
  }

  function isInsidePocketMouthAt(x, y, pocket) {
    // The pocket can only score through the visible opening. This prevents
    // side-wall "near misses" from counting while still allowing an easy,
    // arcade-friendly pocket when the ball actually touches the black cup.
    const mouth = CONFIG.pocketBlackRadius + CONFIG.ballRadius + (pocket.type === 'side' ? 5.2 : 4.2);
    return pocket.sides.some((side) => pocketLateralOffsetAt(x, y, pocket, side) <= mouth);
  }

  function isInsidePocketMouth(ball, pocket) {
    return isInsidePocketMouthAt(ball.x, ball.y, pocket);
  }

  function closestPointOnSegment(px, py, ax, ay, bx, by) {
    const abx = bx - ax;
    const aby = by - ay;
    const lengthSq = abx * abx + aby * aby;
    if (lengthSq <= 0.000001) {
      return { x: bx, y: by, distance: Math.hypot(px - bx, py - by), t: 1 };
    }

    const t = clamp(((px - ax) * abx + (py - ay) * aby) / lengthSq, 0, 1);
    const x = ax + abx * t;
    const y = ay + aby * t;
    return { x, y, distance: Math.hypot(px - x, py - y), t };
  }

  function ballEdgeTouchesVisibleCup(ball, pocket, distance) {
    if (!isInsidePocketMouth(ball, pocket)) return false;

    // Requested rule: the ball drops as soon as its edge minimally reaches the
    // visible black cup. To avoid false pots from a ball resting on the lip,
    // the edge-touch rule only fires while the ball is actually moving through
    // the cup area. A fully centered ball still drops even if almost stopped.
    const dropRadius = ball.r + CONFIG.pocketBlackRadius + CONFIG.pocketContactSlack;
    const innerCupRadius = CONFIG.pocketBlackRadius + CONFIG.pocketContactSlack;
    const prevX = Number.isFinite(ball.prevX) ? ball.prevX : ball.x;
    const prevY = Number.isFinite(ball.prevY) ? ball.prevY : ball.y;
    const moved = Math.hypot(ball.x - prevX, ball.y - prevY);
    const activelyEntering = ball.speed() > 0.018 || moved > 0.004;

    if (distance <= innerCupRadius) return true;
    if (distance <= dropRadius && activelyEntering) return true;

    // Continuous check for fast shots, so a ball does not tunnel past the cup
    // between frames. It only counts if the swept path also crosses the mouth.
    if (moved <= 0.001) return false;

    const closest = closestPointOnSegment(pocket.x, pocket.y, prevX, prevY, ball.x, ball.y);
    if (!isInsidePocketMouthAt(closest.x, closest.y, pocket)) return false;
    return closest.distance <= dropRadius;
  }

  function eightBallCanTriggerEarlyWarning(ball, pocket, distance) {
    if (!currentShot || ball.number !== 8 || currentShot.nonEightAtStart <= 0) return true;

    // When the 8 is not open yet, require a deeper, unmistakable entry before
    // showing the 8 BALL LAST foul. This prevents the warning from appearing
    // on the penultimate object ball just because the 8 brushed the pocket lip.
    const strictEarlyEightRadius = CONFIG.pocketBlackRadius + CONFIG.pocketContactSlack + 1.0;
    if (distance <= strictEarlyEightRadius) return true;

    const prevX = Number.isFinite(ball.prevX) ? ball.prevX : ball.x;
    const prevY = Number.isFinite(ball.prevY) ? ball.prevY : ball.y;
    const closest = closestPointOnSegment(pocket.x, pocket.y, prevX, prevY, ball.x, ball.y);
    return isInsidePocketMouthAt(closest.x, closest.y, pocket) && closest.distance <= strictEarlyEightRadius;
  }

  function railShouldOpenForPocket(ball, side) {
    // Rails no longer open invisibly at the mouth. The pocket is resolved
    // before the cushion collision using the visible black cup overlap above.
    // This removes the old "ball fell just because it was near the pocket" bug.
    return false;
  }

  function applyPocketJaw(ball, pocket, distance, approach, speed) {
    if (!isInsidePocketMouth(ball, pocket)) return;
    if (distance > ball.r + CONFIG.pocketBlackRadius + 7) return;

    // Very small lip energy loss only. No force points toward the pocket.
    if (approach > 0 && speed > 0.05) {
      const loss = pocket.type === 'side' ? 0.988 : 0.984;
      ball.vx *= loss;
      ball.vy *= loss;
      ball.spin *= 0.985;
    }
  }

  function applyPocketPhysics(ball, step) {
    const { pocket, distance } = nearestPocket(ball);
    if (!pocket) return false;

    const speed = ball.speed();
    const toX = pocket.x - ball.x;
    const toY = pocket.y - ball.y;
    const invD = 1 / Math.max(distance, 0.001);
    const nx = toX * invD;
    const ny = toY * invD;
    const approach = ball.vx * nx + ball.vy * ny;

    if (ballEdgeTouchesVisibleCup(ball, pocket, distance)) {
      if (eightBallCanTriggerEarlyWarning(ball, pocket, distance)) {
        potBall(ball, pocket);
        return true;
      }

      // The 8 only brushed the cup while it was not legally available yet.
      // Treat it like a lip contact, not a pocketed ball.
      ball.vx *= 0.965;
      ball.vy *= 0.965;
      ball.spin *= 0.96;
      return false;
    }

    applyPocketJaw(ball, pocket, distance, approach, speed);
    return false;
  }

  function inPocketMouth(ball, side) {
    const mouth = CONFIG.mouthWidth;
    return pockets.some((pocket) => {
      if (!pocket.sides.includes(side)) return false;
      if (side === 'top' || side === 'bottom') {
        return Math.abs(ball.x - pocket.x) < mouth * (pocket.type === 'side' ? 0.58 : 0.48);
      }
      return Math.abs(ball.y - pocket.y) < mouth * 0.48;
    });
  }

  function limitSpeed(ball) {
    const speed = ball.speed();
    if (speed > CONFIG.maxSpeed) {
      const scale = CONFIG.maxSpeed / speed;
      ball.vx *= scale;
      ball.vy *= scale;
    }
  }

  function applySpinCurve(ball, step) {
    // Keep the free-cloth path honest: side spin is conserved for cushion
    // contact instead of bending the ball unrealistically across the table.
    if (Math.abs(ball.spin) < 0.002 || ball.speed() < 0.18) {
      ball.spin *= Math.pow(CONFIG.spinDecay, step);
      if (Math.abs(ball.spin) < 0.002) ball.spin = 0;
      return;
    }

    ball.spin *= Math.pow(CONFIG.spinDecay, step);
    if (Math.abs(ball.spin) < 0.002) ball.spin = 0;
  }

  function applyRailEnglish(ball, axis) {
    const speed = ball.speed();
    if (speed > 0.05 && Math.abs(ball.spin) > 0.002) {
      const english = ball.spin * CONFIG.railSpinTransfer * Math.min(speed, 12);
      if (axis === 'vertical') {
        ball.vy += english;
      } else {
        ball.vx -= english;
      }
    }
    ball.spin *= -0.58;
  }

  function integrateBall(ball, step) {
    if (ball.potted) return;

    ball.prevX = ball.x;
    ball.prevY = ball.y;
    ball.x += ball.vx * step;
    ball.y += ball.vy * step;

    const speed = ball.speed();
    if (speed > 0) {
      const rollingLoss = Math.max(0, speed - CONFIG.rollingFriction * step);
      const scale = rollingLoss / speed;
      ball.vx *= scale;
      ball.vy *= scale;
    }

    ball.vx *= Math.pow(CONFIG.friction, step);
    ball.vy *= Math.pow(CONFIG.friction, step);
    applySpinCurve(ball, step);
    limitSpeed(ball);

    if (Math.abs(ball.vx) < CONFIG.stopThreshold) ball.vx = 0;
    if (Math.abs(ball.vy) < CONFIG.stopThreshold) ball.vy = 0;

    if (applyPocketPhysics(ball, step)) return;

    const left = play.x + ball.r;
    const right = play.x + play.w - ball.r;
    const top = play.y + ball.r;
    const bottom = play.y + play.h - ball.r;

    if (ball.x < left) {
      if (railShouldOpenForPocket(ball, 'left') && ball.x > play.x - ball.r * 0.72) {
        // The rail is open at the pocket mouth.
      } else {
        ball.x = left;
        ball.vx = Math.abs(ball.vx) * CONFIG.railRestitution;
        applyRailEnglish(ball, 'vertical');
        ball.vy *= 0.992;
        registerRailHit(ball);
      }
    } else if (ball.x > right) {
      if (railShouldOpenForPocket(ball, 'right') && ball.x < play.x + play.w + ball.r * 0.72) {
        // The rail is open at the pocket mouth.
      } else {
        ball.x = right;
        ball.vx = -Math.abs(ball.vx) * CONFIG.railRestitution;
        applyRailEnglish(ball, 'vertical');
        ball.vy *= 0.992;
        registerRailHit(ball);
      }
    }

    if (ball.y < top) {
      if (railShouldOpenForPocket(ball, 'top') && ball.y > play.y - ball.r * 0.72) {
        // The rail is open at the pocket mouth.
      } else {
        ball.y = top;
        ball.vy = Math.abs(ball.vy) * CONFIG.railRestitution;
        applyRailEnglish(ball, 'horizontal');
        ball.vx *= 0.992;
        registerRailHit(ball);
      }
    } else if (ball.y > bottom) {
      if (railShouldOpenForPocket(ball, 'bottom') && ball.y < play.y + play.h + ball.r * 0.72) {
        // The rail is open at the pocket mouth.
      } else {
        ball.y = bottom;
        ball.vy = -Math.abs(ball.vy) * CONFIG.railRestitution;
        applyRailEnglish(ball, 'horizontal');
        ball.vx *= 0.992;
        registerRailHit(ball);
      }
    }

    applyPocketPhysics(ball, step);
  }

  function potBall(ball, pocket) {
    if (ball.potted) return;

    ball.potted = true;
    ball.vx = 0;
    ball.vy = 0;
    ball.sink = 1;

    if (!currentShot) {
      currentShot = {
        potted: [],
        cuePotted: false,
        eightEarly: false,
        firstHit: false,
        firstHitNumber: null,
        noHit: true,
        anyRailAfterContact: false,
        nonEightAtStart: balls.filter((item) => !item.cue && !item.potted && item.number !== 8).length
      };
    }

    if (ball.cue) {
      cueNeedsRespawn = true;
      currentShot.cuePotted = true;
      playSound('foul', 0.8);
      addFloat('CUE -XP', pocket ? pocket.x : ball.x, pocket ? pocket.y : ball.y, 1600);
      return;
    }

    const eightWasNotOpenAtShotStart = currentShot.nonEightAtStart > 0;
    if (ball.number === 8 && eightWasNotOpenAtShotStart) {
      eightNeedsRespawn = true;
      earlyEightBall = ball;
      currentShot.eightEarly = true;
      // Keep the early 8 ball out only until the shot finishes, then respot it.
      // It is not counted as a legal pocketed ball and is hidden from DOWN.
      playSound('foul', 0.85);
      addFloat('8 LAST', pocket ? pocket.x : ball.x, pocket ? pocket.y : ball.y, 1700);
      return;
    }

    stats.totalPots += 1;
    if (ball.number === 8) {
      stats.eightBallFinishes += 1;
      unlockAchievement('eight-finish');
    }
    playSound('pocket', ball.number === 8 ? 1 : 0.65);

    currentShot.potted.push({
      number: ball.number,
      banks: Math.min(ball.railHits, 5),
      pocketType: pocket ? pocket.type : 'open'
    });
    addFloat(`+${ball.number}`, pocket ? pocket.x : ball.x, pocket ? pocket.y : ball.y, 1200);
  }

  function resolveBallCollision(a, b) {
    if (a.potted || b.potted) return;

    const dx = b.x - a.x;
    const dy = b.y - a.y;
    let dist = Math.hypot(dx, dy);
    const minDist = a.r + b.r;

    if (dist === 0) {
      dist = 0.01;
    }
    if (dist >= minDist) return;

    const nx = dx / dist;
    const ny = dy / dist;
    const tx = -ny;
    const ty = nx;
    const overlap = minDist - dist;

    // Positional correction keeps racks stable without adding energy.
    const correction = overlap * 0.505;
    a.x -= nx * correction;
    a.y -= ny * correction;
    b.x += nx * correction;
    b.y += ny * correction;

    const relativeVx = b.vx - a.vx;
    const relativeVy = b.vy - a.vy;
    const closingSpeed = relativeVx * nx + relativeVy * ny;
    if (closingSpeed > 0) return;

    if (currentShot && (a.cue || b.cue)) {
      if (!currentShot.firstHit) {
        const target = a.cue ? b : a;
        currentShot.firstHitNumber = target.cue ? null : target.number;
      }
      currentShot.firstHit = true;
      currentShot.noHit = false;
    }

    playSound('collision', clamp(Math.abs(closingSpeed) / 9, 0.08, 1));

    // Equal-mass billiard collision: decompose velocities into the line of
    // centers and tangent. The object ball leaves on the center line; the cue
    // ball keeps the tangent component, giving the expected 90-degree feel.
    const aNormal = a.vx * nx + a.vy * ny;
    const bNormal = b.vx * nx + b.vy * ny;
    const aTangent = a.vx * tx + a.vy * ty;
    const bTangent = b.vx * tx + b.vy * ty;
    const e = CONFIG.ballRestitution;

    const newANormal = ((1 - e) * aNormal + (1 + e) * bNormal) * 0.5;
    const newBNormal = ((1 + e) * aNormal + (1 - e) * bNormal) * 0.5;
    const clothTangentDamping = 0.998;

    a.vx = newANormal * nx + aTangent * clothTangentDamping * tx;
    a.vy = newANormal * ny + aTangent * clothTangentDamping * ty;
    b.vx = newBNormal * nx + bTangent * clothTangentDamping * tx;
    b.vy = newBNormal * ny + bTangent * clothTangentDamping * ty;

    const tangentSlip = (bTangent - aTangent) * 0.018;
    a.spin = clamp(a.spin + tangentSlip, -1, 1);
    b.spin = clamp(b.spin - tangentSlip, -1, 1);

    limitSpeed(a);
    limitSpeed(b);
  }

  function scoreFinishedShot() {
    if (!currentShot) return;

    let gain = 0;
    const pottedCount = currentShot.potted.length;
    const justOpenedEight = !currentShot.eightEarly
      && !currentShot.cuePotted
      && currentShot.potted.some((item) => item.number !== 8)
      && onlyEightBallLeft();
    const levelBonus = 1 + (level - 1) * 0.075;

    if (pottedCount > 0) {
      streak += 1;
      stats.bestStreak = Math.max(stats.bestStreak, streak);
      if (pottedCount >= 2) {
        stats.bestCombo = Math.max(stats.bestCombo, pottedCount);
        unlockAchievement('combo-2');
      }
      const bankPotsThisShot = currentShot.potted.filter((item) => item.banks > 0).length;
      if (bankPotsThisShot > 0) {
        stats.bankShots += bankPotsThisShot;
        unlockAchievement('bank-shot');
      }
      const base = currentShot.potted.reduce((sum, item) => {
        const ballValue = item.number === 8 ? 650 : 90 + item.number * 12;
        return sum + ballValue;
      }, 0);
      const bankBonus = currentShot.potted.reduce((sum, item) => sum + item.banks * 45, 0);
      const cleanBonus = currentShot.cuePotted ? 0 : 60;
      const streakBonus = Math.min(streak, 8) * 18;
      const comboBonus = pottedCount >= 2 ? (pottedCount - 1) * 220 : 0;
      gain = Math.round((base + bankBonus + cleanBonus + streakBonus + comboBonus) * levelBonus);
      score += gain;

      if (pottedCount >= 2) {
        showMessage(`COMBO x${pottedCount}  +${gain}`, 1750);
      } else {
        showMessage(`+${gain} XP`, 1350);
      }
    } else {
      streak = 0;
      if (!currentShot.cuePotted && !currentShot.eightEarly) {
        if (currentShot.noHit) {
          score = Math.max(0, score - 25);
          showMessage('NO HIT -25', 1100);
        } else if (!currentShot.anyRailAfterContact) {
          score = Math.max(0, score - 40);
          showMessage('NO RAIL -40', 1200);
        } else {
          score = Math.max(0, score - 10);
          showMessage('NO POCKET -10', 1100);
        }
      }
    }

    if (currentShot.firstHitNumber === 8 && currentShot.nonEightAtStart > 0) {
      const penalty = Math.round(80 + level * 25);
      score = Math.max(0, score - penalty);
      streak = 0;
      showMessage(`8 FIRST -${penalty}`, 1500);
    }

    if (currentShot.eightEarly) {
      const penalty = Math.round(300 + level * 70);
      score = Math.max(0, score - penalty);
      streak = 0;
      playSound('foul', 0.85);
      showMessage(`8 BALL LAST -${penalty}`, 1800);
    }

    if (currentShot.cuePotted) {
      const penalty = Math.round(150 + level * 45);
      rackCueFouls += 1;
      stats.cueFouls += 1;
      score = Math.max(0, score - penalty);
      streak = 0;
      const cueText = currentShot.eightEarly
        ? `8 LAST / CUE -${penalty}`
        : (pottedCount >= 2 ? `COMBO x${pottedCount} / CUE -${penalty}` : `CUE BALL -${penalty}`);
      showMessage(cueText, 1700);
    }

    if (justOpenedEight) {
      playSound('eight', 0.85);
      showMessage('8 BALL LAST', 1700);
    }

    checkScoreAchievements();
    saveBest();
    saveStats();
    currentShot = null;
    updateHud();
  }

  function clearRackIfNeeded(now) {
    if (ballsLeftCount() !== 0 || levelCleared) return;

    levelCleared = true;
    const efficiency = Math.max(0, 25 - shots) * 75;
    const perfect = rackCueFouls === 0 ? 400 : 0;
    const rackBonus = Math.round((1500 + efficiency + perfect) * (1 + level * 0.12));
    score += rackBonus;
    stats.racksCleared += 1;
    sessionRacksCleared += 1;
    if (!stats.fewestShotsClear || shots < stats.fewestShotsClear) stats.fewestShotsClear = shots;
    unlockAchievement('first-rack');
    if (rackCueFouls === 0) {
      unlockAchievement('no-foul');
      unlockAchievement('perfect-rack');
    }
    if (rackManualCuePlaces === 0) unlockAchievement('cue-master');
    if (shots <= 14) unlockAchievement('sharpshooter');
    if (sessionRacksCleared >= 3) unlockAchievement('long-run');
    checkScoreAchievements();
    saveBest();
    saveStats();
    playSound('clear', 0.9);
    showMessage(`CLEAR +${rackBonus}`, 2300);
    nextRackAt = now + 2300;
    updateHud();
  }

  function updatePhysics(dt, now) {
    const maxSpeed = Math.max(0, ...activeBalls().map((ball) => ball.speed()));
    // Final physics pass: always keep a minimum number of substeps so hard
    // shots cannot tunnel through balls, rails or the v9 pocket detector.
    const dynamicSteps = Math.ceil(dt * Math.max(4, maxSpeed / 4.2));
    const steps = clamp(Math.max(CONFIG.minPhysicsSubsteps, dynamicSteps), CONFIG.minPhysicsSubsteps, CONFIG.maxPhysicsSubsteps);
    const step = dt / steps;

    for (let s = 0; s < steps; s += 1) {
      for (const ball of balls) {
        integrateBall(ball, step);
      }

      for (let pass = 0; pass < 3; pass += 1) {
        for (let i = 0; i < balls.length; i += 1) {
          for (let j = i + 1; j < balls.length; j += 1) {
            resolveBallCollision(balls[i], balls[j]);
          }
        }
      }
    }

    floatingMessages = floatingMessages.filter((item) => now - item.start < item.duration);

    if (!ballsAreMoving()) {
      if (shotInProgress) {
        scoreFinishedShot();
        shotInProgress = false;
      }

      if (cueNeedsRespawn) {
        respawnCue();
      }

      if (eightNeedsRespawn) {
        respawnEightBall();
      }

      clearRackIfNeeded(now);

      if (levelCleared && nextRackAt && now >= nextRackAt) {
        level += 1;
        shots = 0;
        buildRack(false);
      }
    }

    if (gameStarted && now - lastStatsFlush > 5000) {
      touchPlayTime(now);
      saveStats();
      lastStatsFlush = now;
    }

    updateHud();
  }

  function clearCanvas() {
    ctx.fillStyle = LCD.bg;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  }

  function drawPixelText(text, x, y, size = 13, align = 'left', color = LCD.dark) {
    ctx.save();
    ctx.fillStyle = color;
    ctx.font = `${size}px "Press Start 2P", "Courier New", monospace`;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  function drawDitherRect(x, y, w, h, gap = 8) {
    ctx.fillStyle = LCD.faint;
    for (let px = x; px < x + w; px += gap) {
      for (let py = y; py < y + h; py += gap) {
        if (((px + py) / gap) % 2 < 1) ctx.fillRect(px, py, 2, 2);
      }
    }
  }

  function drawTable() {
    ctx.save();

    ctx.fillStyle = LCD.dark;
    ctx.fillRect(table.x, table.y, table.w, table.h);

    ctx.fillStyle = LCD.mid;
    ctx.fillRect(table.x + 10, table.y + 10, table.w - 20, table.h - 20);

    ctx.fillStyle = LCD.bg;
    ctx.fillRect(play.x, play.y, play.w, play.h);
    drawDitherRect(play.x + 4, play.y + 4, play.w - 8, play.h - 8, 10);

    const tableGlass = ctx.createLinearGradient(play.x, play.y, play.x + play.w, play.y + play.h);
    tableGlass.addColorStop(0, 'rgba(255,255,255,0.075)');
    tableGlass.addColorStop(0.38, 'rgba(255,255,255,0.025)');
    tableGlass.addColorStop(1, 'rgba(0,0,0,0.055)');
    ctx.fillStyle = tableGlass;
    ctx.fillRect(play.x, play.y, play.w, play.h);

    ctx.lineWidth = 3;
    ctx.strokeStyle = LCD.dark;
    ctx.strokeRect(play.x, play.y, play.w, play.h);

    ctx.setLineDash([7, 8]);
    ctx.lineWidth = 2;
    ctx.strokeRect(play.x + 22, play.y + 22, play.w - 44, play.h - 44);
    ctx.setLineDash([]);

    ctx.fillStyle = LCD.dark;
    ctx.fillRect(play.x + play.w * 0.25 - 1, play.y + 18, 2, play.h - 36);
    ctx.beginPath();
    ctx.arc(play.x + play.w * 0.25, play.y + play.h * 0.5, 54, -Math.PI / 2, Math.PI / 2);
    ctx.strokeStyle = LCD.dark;
    ctx.lineWidth = 2;
    ctx.stroke();

    for (const pocket of pockets) {
      const open = pocket.type === 'side' ? 1.05 : 1;
      ctx.beginPath();
      ctx.arc(pocket.x, pocket.y, CONFIG.pocketRadius * open, 0, Math.PI * 2);
      ctx.fillStyle = LCD.dark;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(pocket.x, pocket.y, CONFIG.pocketRadius * 0.55, 0, Math.PI * 2);
      ctx.fillStyle = LCD.bg;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(pocket.x, pocket.y, CONFIG.pocketRadius * 0.34, 0, Math.PI * 2);
      ctx.fillStyle = LCD.dark;
      ctx.fill();

      // Pixel jaws around the pocket mouth.
      ctx.fillStyle = LCD.dark;
      if (pocket.sides.includes('top')) ctx.fillRect(pocket.x - 36, pocket.y + 2, 18, 5), ctx.fillRect(pocket.x + 18, pocket.y + 2, 18, 5);
      if (pocket.sides.includes('bottom')) ctx.fillRect(pocket.x - 36, pocket.y - 7, 18, 5), ctx.fillRect(pocket.x + 18, pocket.y - 7, 18, 5);
      if (pocket.sides.includes('left')) ctx.fillRect(pocket.x + 2, pocket.y - 36, 5, 18), ctx.fillRect(pocket.x + 2, pocket.y + 18, 5, 18);
      if (pocket.sides.includes('right')) ctx.fillRect(pocket.x - 7, pocket.y - 36, 5, 18), ctx.fillRect(pocket.x - 7, pocket.y + 18, 5, 18);
    }

    drawPixelText(`LV ${String(level).padStart(2, '0')}`, play.x + 12, table.y - 23, 10, 'left');
    drawPixelText(`STREAK ${String(streak).padStart(2, '0')}`, WIDTH / 2, table.y - 23, 10, 'center');
    drawPixelText(`SHOTS ${String(shots).padStart(2, '0')}`, play.x + play.w - 12, table.y - 23, 10, 'right');
    drawPixelText('AIM / DRAG POWER / RELEASE', WIDTH / 2, table.y + table.h + 30, 10, 'center');

    ctx.restore();
  }

  function drawBall(ball) {
    if (ball.potted) return;

    ctx.save();
    ctx.translate(Math.round(ball.x), Math.round(ball.y));

    const speed = ball.speed();
    if (speed > 1.2) {
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = LCD.dark;
      ctx.beginPath();
      ctx.arc(-ball.vx * 0.55, -ball.vy * 0.55, ball.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    if (ball.cue) {
      ctx.fillStyle = LCD.bg;
      ctx.beginPath();
      ctx.arc(0, 0, ball.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = LCD.dark;
      ctx.stroke();

      ctx.fillStyle = LCD.dark;
      ctx.fillRect(-2, -2, 4, 4);
      ctx.fillRect(-7, 4, 4, 4);
      ctx.fillRect(4, -8, 4, 4);
    } else {
      ctx.fillStyle = LCD.dark;
      ctx.beginPath();
      ctx.arc(0, 0, ball.r, 0, Math.PI * 2);
      ctx.fill();

      if (ball.number !== 8) {
        ctx.lineWidth = 2;
        ctx.strokeStyle = LCD.bg;
        ctx.beginPath();
        ctx.arc(0, 0, ball.r - 4, 0, Math.PI * 2);
        ctx.stroke();
      }

      const numberSize = ball.number >= 10 ? 7 : 9;
      drawPixelText(String(ball.number), 0, 1, numberSize, 'center', LCD.bg);
    }

    ctx.restore();
  }

  function projectAimCollision(cue) {
    const ux = pointer.aimX;
    const uy = pointer.aimY;
    const collisionRadius = CONFIG.ballRadius * 2;
    let nearest = null;
    let nearestT = Infinity;

    for (const ball of balls) {
      if (ball.cue || ball.potted) continue;

      const ox = ball.x - cue.x;
      const oy = ball.y - cue.y;
      const projection = ox * ux + oy * uy;
      if (projection <= collisionRadius || projection >= 430) continue;

      const distanceSq = ox * ox + oy * oy - projection * projection;
      const radiusSq = collisionRadius * collisionRadius;
      if (distanceSq > radiusSq) continue;

      const impactOffset = Math.sqrt(Math.max(0, radiusSq - distanceSq));
      const t = projection - impactOffset;
      if (t <= CONFIG.ballRadius * 1.25 || t >= nearestT) continue;

      const ghostX = cue.x + ux * t;
      const ghostY = cue.y + uy * t;
      const normalLen = Math.max(Math.hypot(ball.x - ghostX, ball.y - ghostY), 0.001);
      const normalX = (ball.x - ghostX) / normalLen;
      const normalY = (ball.y - ghostY) / normalLen;
      const dot = clamp(ux * normalX + uy * normalY, -1, 1);
      let cueDefX = ux - normalX * dot;
      let cueDefY = uy - normalY * dot;
      const cueDefLen = Math.hypot(cueDefX, cueDefY);
      if (cueDefLen > 0.001) {
        cueDefX /= cueDefLen;
        cueDefY /= cueDefLen;
      } else {
        cueDefX = 0;
        cueDefY = 0;
      }

      nearestT = t;
      nearest = {
        ball,
        t,
        ghostX,
        ghostY,
        normalX,
        normalY,
        cueDefX,
        cueDefY,
        cutStrength: cueDefLen
      };
    }

    return nearest;
  }

  function clippedAimEnd(x, y, dx, dy, length, margin = 18) {
    let maxT = length;
    const minX = play.x + margin;
    const maxX = play.x + play.w - margin;
    const minY = play.y + margin;
    const maxY = play.y + play.h - margin;

    if (Math.abs(dx) > 0.0001) {
      maxT = Math.min(maxT, ((dx > 0 ? maxX : minX) - x) / dx);
    }
    if (Math.abs(dy) > 0.0001) {
      maxT = Math.min(maxT, ((dy > 0 ? maxY : minY) - y) / dy);
    }

    maxT = clamp(maxT, 0, length);
    return { x: x + dx * maxT, y: y + dy * maxT, length: maxT };
  }

  function drawAimGuide() {
    const cue = cueBall();
    if (!cue || cue.potted || ballsAreMoving() || levelCleared) return;

    const nx = pointer.aimX;
    const ny = pointer.aimY;
    const targetPull = pointer.down ? pointer.pull : 0;
    pointer.displayPull += (targetPull - pointer.displayPull) * (pointer.down ? 0.42 : 0.22);
    if (!pointer.down && pointer.displayPull < 0.6) pointer.displayPull = 0;
    const pull = pointer.displayPull;
    const hit = projectAimCollision(cue);
    const aimLength = hit ? Math.max(36, hit.t) : 430;

    ctx.save();

    ctx.globalAlpha = 0.92;
    ctx.setLineDash([9, 9]);
    ctx.lineWidth = 3;
    ctx.strokeStyle = LCD.dark;
    ctx.beginPath();
    ctx.moveTo(cue.x + nx * 20, cue.y + ny * 20);
    ctx.lineTo(cue.x + nx * aimLength, cue.y + ny * aimLength);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = LCD.dark;
    for (let i = 42; i <= Math.min(178, aimLength); i += 26) {
      ctx.fillRect(Math.round(cue.x + nx * i) - 2, Math.round(cue.y + ny * i) - 2, 4, 4);
    }

    if (hit) {
      // Ghost ball: exact cue-ball center at first contact.
      ctx.globalAlpha = 0.22;
      ctx.beginPath();
      ctx.arc(hit.ghostX, hit.ghostY, CONFIG.ballRadius, 0, Math.PI * 2);
      ctx.fillStyle = LCD.dark;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.setLineDash([5, 5]);
      ctx.lineWidth = 2;
      ctx.strokeStyle = LCD.dark;
      ctx.beginPath();
      ctx.arc(hit.ghostX, hit.ghostY, CONFIG.ballRadius + 2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Target-ball path, drawn on the line of centers and clipped inside
      // the playfield so it never appears as a stray bar on the table border.
      const targetStartX = hit.ball.x + hit.normalX * 18;
      const targetStartY = hit.ball.y + hit.normalY * 18;
      const targetEnd = clippedAimEnd(targetStartX, targetStartY, hit.normalX, hit.normalY, 128, 18);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(targetStartX, targetStartY);
      ctx.lineTo(targetEnd.x, targetEnd.y);
      ctx.stroke();

      for (let i = 44; i <= Math.min(116, targetEnd.length); i += 24) {
        ctx.fillRect(
          Math.round(hit.ball.x + hit.normalX * i) - 2,
          Math.round(hit.ball.y + hit.normalY * i) - 2,
          4,
          4
        );
      }

      // Cue-ball deflection is useful while aiming, but hiding it during the
      // power drag keeps the screen clean and removes the stray-bar feeling.
      if (!pointer.down && hit.cutStrength > 0.12) {
        const cueLine = clamp(38 + hit.cutStrength * 58, 36, 84);
        const cueStartX = hit.ghostX + hit.cueDefX * 14;
        const cueStartY = hit.ghostY + hit.cueDefY * 14;
        const cueEnd = clippedAimEnd(cueStartX, cueStartY, hit.cueDefX, hit.cueDefY, cueLine, 20);
        ctx.globalAlpha = 0.72;
        ctx.lineWidth = 2;
        ctx.setLineDash([7, 7]);
        ctx.beginPath();
        ctx.moveTo(cueStartX, cueStartY);
        ctx.lineTo(cueEnd.x, cueEnd.y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
      }

      ctx.beginPath();
      ctx.arc(hit.ball.x, hit.ball.y, CONFIG.ballRadius + 5, 0, Math.PI * 2);
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // The cue stays behind the white ball, on the opposite side of the shot direction.
    const cueTip = 22 + (pointer.down ? Math.sin(performance.now() / 95) * 0.7 : 0);
    const cueBack = 88 + pull * 0.74;
    ctx.lineCap = 'square';
    ctx.globalAlpha = 0.22;
    ctx.lineWidth = pointer.down ? 13 : 10;
    ctx.strokeStyle = LCD.dark;
    ctx.beginPath();
    ctx.moveTo(cue.x - nx * cueTip, cue.y - ny * cueTip);
    ctx.lineTo(cue.x - nx * cueBack, cue.y - ny * cueBack);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.lineWidth = pointer.down ? 8 : 6;
    ctx.beginPath();
    ctx.moveTo(cue.x - nx * cueTip, cue.y - ny * cueTip);
    ctx.lineTo(cue.x - nx * cueBack, cue.y - ny * cueBack);
    ctx.stroke();
    ctx.fillStyle = LCD.dark;
    ctx.fillRect(Math.round(cue.x - nx * cueTip - 3), Math.round(cue.y - ny * cueTip - 3), 6, 6);

    // No separate power meter: power is shown only by the cue pullback.
    // This keeps the LCD table clean and removes the stray black bar on the bottom rail.

    ctx.restore();
  }

  function drawPocketedPanel() {
    const startX = play.x + 10;
    const y = play.y + play.h + 21;
    const potted = balls
      .filter((ball) => !ball.cue && ball.potted && ball !== earlyEightBall)
      .map((ball) => ball.number)
      .sort((a, b) => a - b);

    drawPixelText('DOWN:', startX, y + 5, 9, 'left');

    let x = startX + 72;
    for (const number of potted.slice(0, 15)) {
      ctx.fillStyle = LCD.dark;
      ctx.beginPath();
      ctx.arc(x, y + 5, 8, 0, Math.PI * 2);
      ctx.fill();
      drawPixelText(String(number), x, y + 6, number >= 10 ? 5 : 7, 'center', LCD.bg);
      x += 24;
    }
  }

  function drawMessage() {
    const now = performance.now();
    if (now > messageUntil || !message) return;

    ctx.save();
    const boxW = Math.min(620, Math.max(250, message.length * 13));
    const boxH = 44;
    const boxX = WIDTH / 2 - boxW / 2;
    const boxY = play.y + 16;

    ctx.fillStyle = LCD.bg;
    ctx.fillRect(boxX, boxY, boxW, boxH);
    ctx.strokeStyle = LCD.dark;
    ctx.lineWidth = 4;
    ctx.strokeRect(boxX, boxY, boxW, boxH);
    drawPixelText(message, WIDTH / 2, boxY + boxH / 2 + 1, 11, 'center');
    ctx.restore();
  }

  function drawFloatingMessages() {
    const now = performance.now();
    ctx.save();
    for (const item of floatingMessages) {
      const age = now - item.start;
      const t = age / item.duration;
      ctx.globalAlpha = 1 - t;
      const y = item.y - t * 28;
      drawPixelText(item.text, item.x, y, 9, 'center', LCD.dark);
    }
    ctx.restore();
  }


  function drawAchievementToast() {
    if (!achievementToast) return;
    const now = performance.now();
    const age = now - achievementToast.start;
    if (age > achievementToast.duration) {
      achievementToast = null;
      return;
    }

    ctx.save();
    const t = age / achievementToast.duration;
    ctx.globalAlpha = Math.min(1, Math.max(0, 1 - Math.max(0, t - 0.75) / 0.25));
    const boxW = 360;
    const boxH = 58;
    const boxX = play.x + play.w - boxW - 18;
    const boxY = play.y + 18;
    ctx.fillStyle = LCD.bg;
    ctx.fillRect(boxX, boxY, boxW, boxH);
    ctx.strokeStyle = LCD.dark;
    ctx.lineWidth = 4;
    ctx.strokeRect(boxX, boxY, boxW, boxH);
    drawPixelText('ACHIEVEMENT', boxX + boxW / 2, boxY + 19, 9, 'center');
    drawPixelText(achievementToast.name, boxX + boxW / 2, boxY + 40, 10, 'center');
    ctx.restore();
  }

  function drawClearOverlay() {
    if (!levelCleared) return;

    ctx.save();
    ctx.fillStyle = 'rgba(18, 34, 20, 0.17)';
    ctx.fillRect(play.x, play.y, play.w, play.h);

    const boxW = 470;
    const boxH = 126;
    const boxX = WIDTH / 2 - boxW / 2;
    const boxY = HEIGHT / 2 - boxH / 2;

    ctx.fillStyle = LCD.bg;
    ctx.fillRect(boxX, boxY, boxW, boxH);
    ctx.strokeStyle = LCD.dark;
    ctx.lineWidth = 6;
    ctx.strokeRect(boxX, boxY, boxW, boxH);
    drawPixelText('RACK CLEAR', WIDTH / 2, boxY + 39, 18, 'center');
    drawPixelText(`NEXT LEVEL ${String(level + 1).padStart(2, '0')}`, WIDTH / 2, boxY + 78, 12, 'center');
    ctx.restore();
  }

  function render() {
    syncLCDColors();
    clearCanvas();
    drawTable();
    drawAimGuide();

    const orderedBalls = [...activeBalls()].sort((a, b) => a.y - b.y);
    for (const ball of orderedBalls) {
      drawBall(ball);
    }

    drawPocketedPanel();
    drawFloatingMessages();
    drawMessage();
    drawAchievementToast();
    drawClearOverlay();
  }

  function loop(now) {
    const dt = clamp((now - lastTime) / 16.6667, 0, 2.25);
    lastTime = now;
    updatePhysics(dt, now);
    render();
    requestAnimationFrame(loop);
  }

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);
  canvas.addEventListener('pointerleave', (event) => {
    if (pointer.down) onPointerUp(event);
  });

  ui.newGame.addEventListener('click', () => {
    playSound('button', 0.35, true);
    buildRack(true);
  });
  ui.cue.addEventListener('click', repositionCueNow);
  ui.theme.addEventListener('click', () => {
    playSound('button', 0.35, true);
    cycleTheme();
  });

  if (window.addEventListener) {
    window.addEventListener('beforeunload', () => {
      if (gameStarted) {
        touchPlayTime();
        saveStats();
      }
    });
  }

  if (ui.start) ui.start.addEventListener('click', startGame);
  if (ui.statsButton) ui.statsButton.addEventListener('click', showStatsScreen);
  if (ui.achievementsButton) ui.achievementsButton.addEventListener('click', showAchievementsScreen);
  if (ui.sound) ui.sound.addEventListener('click', toggleSound);
  if (ui.menuTheme) ui.menuTheme.addEventListener('click', () => {
    playSound('button', 0.35, true);
    cycleTheme();
  });
  if (ui.statsBack) ui.statsBack.addEventListener('click', () => {
    playSound('button', 0.35, true);
    showPanel('start');
  });
  if (ui.achievementsBack) ui.achievementsBack.addEventListener('click', () => {
    playSound('button', 0.35, true);
    showPanel('start');
  });

  setTheme(storageGet(STORAGE.theme, 'night') || 'night');
  updateSoundButton();
  buildRack(true);
  showStartScreen();
  requestAnimationFrame(loop);
})();
