import { HRC, troopTiers, itemData, difficultyData, buildings } from './config.js';

export function initializeGame() {
    const canvas = document.getElementById("world");
    const ctx = canvas.getContext("2d");
    const hammerCursor = document.getElementById("hammerCursor");

    const state = {};
    const camera = { x: 0, y: 0, zoom: 1 };
    let running = false;
    let paused = false;
    let pauseStarted = 0;
    let dragging = false;
    let dragStart = null;
    let lastFrame = 0;
    let selectedDifficulty = "normal";
    let activeItem = null;
    let lastPointer = null;
    let quickSlotsSignature = "";
    let inventorySignature = "";
    let adminUnlocked = false;
    const ADMIN_KEY = "cowkim";
    const ADMIN_RECORD_NAME = "-!-!-ADMIN-!-!-";
    const RANKING_STORAGE_KEY = "yacheol_fortress_rankings_v1";
    const TRAINING_BATCH_MULTIPLIER = 13;
    const SOUND_FILES = {
      mine_click: "./public/sounds/mine_click.mp3",
      hrc_upgrade: "./public/sounds/hrc_upgrade.mp3",
      wall_hit: "./public/sounds/wall_hit.mp3",
      nuke_launch: "./public/sounds/nuke_launch.mp3",
      nuke_explosion: "./public/sounds/nuke_explosion.mp3",
      robot_work: "./public/sounds/robot_work.mp3",
      windy_active: "./public/sounds/windy_active.mp3",
      admin_cheat: "./public/sounds/admin_cheat.mp3",
      weapon_stone: "./public/sounds/weapon_stone.mp3",
      weapon_axe: "./public/sounds/weapon_axe.mp3",
      weapon_dagger: "./public/sounds/weapon_dagger.mp3",
      weapon_bullet: "./public/sounds/weapon_bullet.mp3",
      weapon_lightning: "./public/sounds/weapon_lightning.mp3",
      weapon_gravity: "./public/sounds/weapon_gravity.mp3",
      satellite_laser: "./public/sounds/satellite_laser.mp3"
    };
    const wallTexture = new Image();
    wallTexture.decoding = "async";
    wallTexture.src = "./public/image/defense_wall.png";
    const WALL_TEXTURE_SOURCE = { x: 675, y: 812, w: 365, h: 112 };

    class SoundManager {
      constructor(files, volume = 0.45) {
        this.files = files;
        this.volume = volume;
        this.enabled = true;
        this.unlocked = false;
        this.lastPlayed = new Map();
        this.cooldowns = {
          wall_hit: 220,
          mine_click: 80,
          robot_work: 10000,
          weapon_lightning: 300,
          weapon_bullet: 120,
          satellite_laser: 1500,
          windy_active: 4000
        };
        this.sounds = Object.fromEntries(Object.entries(files).map(([name, src]) => {
          const audio = new Audio(src);
          audio.preload = "auto";
          audio.volume = volume;
          return [name, audio];
        }));
        const unlock = () => this.unlock();
        addEventListener("pointerdown", unlock, { once: true, passive: true });
        addEventListener("keydown", unlock, { once: true });
        addEventListener("touchstart", unlock, { once: true, passive: true });
      }
      unlock() {
        this.unlocked = true;
        for (const audio of Object.values(this.sounds)) {
          audio.load();
        }
      }
      play(name, options = {}) {
        if (!this.enabled || !this.unlocked || !this.sounds[name]) return false;
        const now = performance.now();
        const cooldown = this.cooldowns[name] || 0;
        if (this.lastPlayed.has(name) && now - this.lastPlayed.get(name) < cooldown) return false;
        this.lastPlayed.set(name, now);
        const audio = this.sounds[name].cloneNode(true);
        audio.volume = Math.max(0, Math.min(1, options.volume ?? this.volume));
        audio.play().catch(() => {});
        return true;
      }
    }

    const sound = new SoundManager(SOUND_FILES);

    function ensureInventoryItems() {
      if (!state.inventory) return;
      Object.keys(itemData).forEach(type => {
        if (state.inventory[type] === undefined) state.inventory[type] = 0;
      });
    }
    function normalizeAdminKey(value) {
      return String(value || "").trim().replace(/^['"]|['"]$/g, "");
    }
    function isAdminNickname(value) {
      const normalized = String(value || "").replace(/\s+/g, "");
      return normalized === `IamAdmin(${ADMIN_KEY})` || normalized === `IamAdmin("${ADMIN_KEY}")` || normalized === `IamAdmin('${ADMIN_KEY}')`;
    }
    function finiteRecordNumber(value) {
      return Number.isFinite(value) ? Math.floor(value) : 0;
    }
    function escapeHtml(value) {
      return String(value).replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[ch]);
    }

    function updateItemCursor() {
      hammerCursor.textContent = activeItem ? itemData[activeItem].emoji : "🔨";
      if (lastPointer) {
        hammerCursor.style.left = `${lastPointer.x}px`;
        hammerCursor.style.top = `${lastPointer.y}px`;
      }
      hammerCursor.style.display = activeItem && lastPointer ? "block" : "none";
    }

    function resetGame(nickname, difficulty) {
      const adminByNickname = isAdminNickname(nickname);
      if (adminByNickname) adminUnlocked = true;
      const displayNickname = adminByNickname ? ADMIN_RECORD_NAME : nickname;
      const diff = difficultyData[difficulty] || difficultyData.normal;
      const fortHpMult = diff.fortHpMult || 1;
      const wallHpMult = diff.wallHpMult || fortHpMult;
      const castleMaxHp = Math.max(1, Math.round(3200 * fortHpMult));
      const wallMaxHp = Math.max(1, Math.round(360 * wallHpMult));
      Object.assign(state, {
        nickname: displayNickname, difficulty,
        startTime: Date.now(),
        wood: 120, stone: 120, ore: 60, gold: 120, troops: 25,
        hrc: 1, wave: 1, kills: 0, clicks: 0,
        castleHp: castleMaxHp, castleMaxHp,
        wallLevel: 1, mineLevel: 1, robotLevel: 0, merchantLevel: 0, autoLevel: diff.autoBonus || 0, autoBuildingIndex: 0, troopBoost: 1, troopTier: 0,
        weaponEvolution: null,
        repairItems: 0, repairMode: false,
        inventory: { repair: 0, mine: 0, missile: 0, nuke: 0, overtime: 0, laser: 0, thunderer: 0, windy: 0 },
        quickSlots: ["repair", "mine", "missile", "laser"],
        enemies: [], effects: [], shots: [], magicEffects: [], missiles: [], fragments: [], lightningBolts: [], gravityFields: [], clouds: [],
        robots: [], merchants: [], radiationZones: [],
        villages: [], mines: [],
        nukeBought: 0,
        laserUntil: 0, laserLastTick: 0, laserX: 0, laserY: 0, laserTargetIndex: 0,
        thunderUntil: 0, thunderLastTick: 0, windyUntil: 0, windyLastTick: 0, overtimeUntil: 0,
        spawnedThisWave: 0, waveTarget: 5, lastSpawn: 0, lastAuto: 0, lastTroopShot: 0, lastVillageSpawn: 0, nextVillageAt: performance.now() + villageSpawnDelay(difficulty),
        defenseDebuffUntil: 0, manualSpawnClicks: 0, adminInfinite: false,
        selected: "castle", ended: false,
        walls: Array.from({ length: 18 }, (_, i) => ({ index: i, hp: wallMaxHp, maxHp: wallMaxHp }))
      });
      ensureInventoryItems();
      camera.x = 0; camera.y = 0; camera.zoom = 1;
      document.getElementById("zoomText").textContent = "100%";
      activeItem = null;
      quickSlotsSignature = "";
      inventorySignature = "";
      canvas.classList.remove("repairing");
      updateItemCursor();
      paused = false;
      pauseStarted = 0;
      document.getElementById("pauseBtn").textContent = "⏸️ 일시정지";
      running = true;
      log(`👤 ${displayNickname} 님의 성채가 건설되었습니다. 난이도: ${diff.emoji} ${diff.name}`);
      if (adminUnlocked) applyAdminInfinite();
      for (let i = 0; i < 3; i++) spawnEnemy();
    }

    function fmt(v) {
      if (v === Infinity) return "∞";
      if (!Number.isFinite(v)) return "0";
      const n = Math.floor(Math.max(0, v));
      if (n < 1000) return String(n);
      const units = ["K", "M", "B", "T", "Qa"];
      let value = n;
      let idx = -1;
      while (value >= 1000 && idx < units.length - 1) { value /= 1000; idx++; }
      return value.toFixed(value >= 100 ? 0 : 1) + units[idx];
    }
    function hrcName() { return !Number.isFinite(state.hrc) ? "HRC ∞ 우르 (Uru)" : state.hrc >= 81 ? "HRC-MAX 우르 (Uru)" : `HRC ${state.hrc} ${HRC[state.hrc]}`; }
    function hrcMult() { return !Number.isFinite(state.hrc) || state.hrc >= 81 ? 8.5 : 1 + state.hrc * 0.075; }
    function itemHrc() { return Math.min(state.hrc >= 81 ? 70 : state.hrc, 70); }
    function hrcDamageLevel() { return !Number.isFinite(state.hrc) || state.hrc >= 81 ? 99 : state.hrc; }
    function laserTickDamageRate(target) { return target.hp / target.maxHp >= 0.5 ? 0.25 : 0.13; }
    function laserRadius() { return 24 * 3; }
    function missileRadius() { return 220; }
    function nukeRadius() { return missileRadius() * 7; }
    function nukeDamage(maxHp) { return 1_000_000_000 * hrcDamageLevel() + maxHp * 0.8; }
    function currentWeapon() { return troopTiers[state.troopTier] || troopTiers[0]; }
    function mapEdgeDistance() { return wallRadius() + 1050; }
    function missileDamage() {
      return itemCost("mine") + state.troopBoost * 50 * hrcMult();
    }
    function thunderDamage() { return (100 * hrcDamageLevel() + state.troops / 10) / 3; }
    function makeLightningBolt(fromX, fromY, toX, toY, options = {}) {
      const bolt = {
        fromX, fromY, toX, toY,
        born: options.born ?? performance.now(),
        life: options.life ?? 700,
        mode: options.mode || "chain",
        branches: 1 + Math.floor(Math.random() * 6),
        centerDistortion: 1 + Math.random() * 2,
        leftSpread: 5 + Math.random() * 3,
        rightSpread: 5 + Math.random() * 3,
        seed: Math.random() * 1000
      };
      if (bolt.mode === "chain") {
        bolt.nodes = createLightningNodes(fromX, fromY, toX, toY, 5 + Math.floor(Math.random() * 4), 34);
        bolt.sparks = createLightningSparks(bolt.nodes, 10 + Math.floor(Math.random() * 10));
      } else {
        bolt.nodes = createLightningNodes(fromX, fromY, toX, toY, 8, 26);
      }
      return bolt;
    }
    function createLightningNodes(fromX, fromY, toX, toY, count, jitter) {
      const normal = lineNormal(fromX, fromY, toX, toY);
      return Array.from({ length: count }, (_, i) => {
        const t = i / (count - 1 || 1);
        const taper = Math.sin(Math.PI * t);
        const wobble = (Math.random() * 2 - 1) * jitter * taper;
        return {
          x: fromX + (toX - fromX) * t + normal.x * wobble,
          y: fromY + (toY - fromY) * t + normal.y * wobble
        };
      });
    }
    function createLightningSparks(nodes, count) {
      return Array.from({ length: count }, () => {
        const base = nodes[Math.floor(Math.random() * nodes.length)];
        const angle = Math.random() * Math.PI * 2;
        const length = 8 + Math.random() * 20;
        return { x: base.x, y: base.y, dx: Math.cos(angle) * length, dy: Math.sin(angle) * length };
      });
    }
    function visibleWorldTop() { return (0 - canvas.height / 2 - camera.y) / viewScale(); }
    function visibleWorldBottom() { return (canvas.height - canvas.height / 2 - camera.y) / viewScale(); }
    function visibleWorldLeft() { return (0 - canvas.width / 2 - camera.x) / viewScale(); }
    function visibleWorldRight() { return (canvas.width - canvas.width / 2 - camera.x) / viewScale(); }
    function currentDifficulty() { return difficultyData[state.difficulty || "normal"] || difficultyData.normal; }
    function difficultyPower() { return currentDifficulty().power; }
    function difficultyScale(rate, level) { return Math.pow(Math.pow(rate, level), difficultyPower()); }
    function difficultyMult(key) { return currentDifficulty()[key] || 1; }
    function hasNewbieAura() { return !!currentDifficulty().newbieAura; }
    function newbieAuraRadius() { return wallRadius() * 1.7; }
    function maxVillageCount() { return Math.round(10 * difficultyMult("villageMult")); }
    function villageSpawnDelay(difficulty = state.difficulty) {
      return ((difficultyData[difficulty || "normal"] || difficultyData.normal).villageSpawnSeconds || 60) * 1000;
    }
    function villageHpMultiplier() { return currentDifficulty().villageHpMult || 1; }
    function miningMultiplier() { return 2.5 * (performance.now() < (state.overtimeUntil || 0) ? 2 : 1); }
    function healthRatio(hp, maxHp) {
      if (!Number.isFinite(hp) || !Number.isFinite(maxHp)) return 1;
      return Math.max(0, Math.min(1, hp / maxHp));
    }
    function villageEmergenceProgress(village, now = performance.now()) {
      return Math.max(0, Math.min(1, (now - (village.spawnedAt || now)) / 10000));
    }
    function villagePowerFactor(village, now = performance.now()) {
      return 0.2 + villageEmergenceProgress(village, now) * 0.8;
    }
    function syncVillageHp(village, now = performance.now()) {
      const baseMaxHp = village.baseMaxHp || village.maxHp || 1;
      village.baseMaxHp = baseMaxHp;
      village.maxHp = baseMaxHp * villagePowerFactor(village, now);
      village.hp = Math.max(0, village.maxHp - (village.damageTaken || 0));
      return village.hp;
    }
    function isBillionsMode() { return (state.difficulty || "normal") === "billions"; }
    function isBillionsSurgeWave() { return isBillionsMode() && state.wave > 0 && state.wave % 5 === 0; }
    function spawnCountMultiplier() { return difficultyMult("spawnMult") * (isBillionsSurgeWave() ? 8 : 1); }
    function upgradeDifficultyDivisor() {
      return ({ veryeasy: 25, easy: 15, normal: 6, hard: 3, extreme: 1, billions: 1 })[state.difficulty || "normal"] || 6;
    }
    function normalCostMultiplier() { return 6 / upgradeDifficultyDivisor(); }
    function countUpgradeCost(currentCount, maxCount, normalMaxCost) {
      const next = Math.min(maxCount, currentCount + 1);
      const n = Math.max(1, next);
      const maxN = Math.max(1, maxCount);
      const curve = (2 * n * Math.log1p(n)) / (2 * maxN * Math.log1p(maxN));
      return Math.floor(normalMaxCost * normalCostMultiplier() * curve);
    }
    function earlyDiscountCountUpgradeCost(currentCount, maxCount, normalMaxCost) {
      const cost = countUpgradeCost(currentCount, maxCount, normalMaxCost);
      return currentCount < 5 ? Math.max(1, Math.floor(cost / 50)) : cost;
    }
    function robotUpgradeCost() { return earlyDiscountCountUpgradeCost(state.robotLevel, 20, 10_000_000_000); }
    function merchantUpgradeCost() { return earlyDiscountCountUpgradeCost(state.merchantLevel || 0, 10, 5_000_000_000); }
    function weaponDisplayEmoji(tier = state.troopTier) {
      const weapon = troopTiers[tier] || troopTiers[0];
      if (weapon.kind === "bullet") return "🔫";
      if (weapon.kind === "lightning") return "⚡";
      return weapon.emoji || "⚔️";
    }
    function weaponEvolutionDuration(targetTier) {
      return 30000 * Math.pow(2, Math.max(0, targetTier - 1));
    }
    function weaponEvolutionProgress(now = performance.now()) {
      const evo = state.weaponEvolution;
      if (!evo) return 0;
      return Math.max(0, Math.min(1, (now - evo.startedAt) / Math.max(1, evo.endsAt - evo.startedAt)));
    }
    function weaponSoundName(kind) {
      return ({
        stone: "weapon_stone",
        axe: "weapon_axe",
        dagger: "weapon_dagger",
        bullet: "weapon_bullet",
        lightning: "weapon_lightning",
        gravity: "weapon_gravity"
      })[kind] || "weapon_stone";
    }
    function playWeaponSound(kind) {
      sound.play(weaponSoundName(kind));
    }
    function robotWorkVolume(now = performance.now()) {
      const firstRobot = state.robots?.[0];
      if (!firstRobot) return 0.1;
      const robot = robotPosition(firstRobot, now);
      const center = screenToWorld(canvas.width / 2, canvas.height / 2);
      const distance = Math.hypot(robot.x - center.x, robot.y - center.y);
      const proximity = 1 - Math.min(1, distance / 1200);
      return 0.1 + proximity * 0.6;
    }
    function robotTravelDuration() {
      return performance.now() < (state.overtimeUntil || 0) ? 2000 : 4000;
    }
    function twoNLogProgress(level, start, end) {
      const span = end - start;
      const n = Math.max(1, level - start);
      const maxN = Math.max(1, end - start);
      return Math.min(1, (2 * n * Math.log1p(n)) / (2 * maxN * Math.log1p(maxN)));
    }
    function logInterpolate(a, b, t) {
      return Math.exp(Math.log(a) + (Math.log(b) - Math.log(a)) * t);
    }
    function lateUpgradeCost(baseCost, level) {
      const divisor = upgradeDifficultyDivisor();
      const anchors = [
        { level: 40, cost: baseCost },
        { level: 80, cost: 1_000_000_000_000 / divisor },
        { level: 90, cost: 10_000_000_000_000 / divisor },
        { level: 99, cost: 99_000_000_000_000 / divisor }
      ];
      for (let i = 0; i < anchors.length - 1; i++) {
        const a = anchors[i], b = anchors[i + 1];
        if (level === b.level) return b.cost;
        if (level <= b.level) return logInterpolate(a.cost, b.cost, twoNLogProgress(level, a.level, b.level));
      }
      return anchors[anchors.length - 1].cost;
    }
    function upgradeCost(base, level, rate = 1.16) {
      const originalCost = targetLevel => {
        const tier = targetLevel < 20 ? 1 : targetLevel < 40 ? 2.6 : targetLevel < 60 ? 7 : targetLevel < 80 ? 18 : 45;
        return base * tier * Math.pow(rate, targetLevel) * Math.pow(1.035, Math.pow(Math.max(0, targetLevel - 1), 1.45));
      };
      if (level <= 40) return Math.floor(originalCost(level));
      return Math.floor(Math.max(originalCost(40), lateUpgradeCost(originalCost(40), level)));
    }
    function hrcCost() {
      if (state.hrc >= 81) return null;
      const next = state.hrc + 1;
      const tier = next <= 20 ? { mult: 1, rate: 1.10 } : next <= 40 ? { mult: 9, rate: 1.16 } : next <= 60 ? { mult: 70, rate: 1.23 } : next <= 77 ? { mult: 650, rate: 1.32 } : next <= 80 ? { mult: 9000, rate: 1.45 } : { mult: 75000, rate: 1.6 };
      const cubic = Math.pow(Math.max(1, next), 3);
      return {
        ore: Math.floor((14 + cubic * 0.22) * tier.mult * Math.pow(tier.rate, next / 2)),
        gold: Math.floor((10 + cubic * 0.17) * tier.mult * Math.pow(tier.rate, next / 2))
      };
    }
    function itemCost(type) {
      const h = itemHrc();
      if (type === "repair") return Math.min(3500, Math.floor(95 + h * 34 + Math.pow(h, 1.35) * 4));
      if (type === "mine") return Math.min(4500, Math.floor(135 + h * 24 + Math.pow(h, 1.25) * 5));
      if (type === "missile") return Math.min(4500, Math.floor((420 + h * 70 + Math.pow(h, 1.45) * 7) / 2));
      if (type === "nuke") return 1_000_000_000_000 * ((state.nukeBought || 0) + 1);
      if (type === "overtime") return itemCost("missile");
      if (type === "laser") return Math.min(9000, Math.floor((900 + h * 130 + Math.pow(h, 1.5) * 11) / 2));
      if (type === "thunderer") return itemCost("laser");
      if (type === "windy") return Math.floor(itemCost("laser") * 0.8);
      return 0;
    }
    function buildingPreview(id) {
      const gain = mineGain();
      if (id === "mine") return `+🪵${fmt(gain.wood)} +🪨${fmt(gain.stone)} +⛏️${fmt(gain.ore)} · 로봇 +${state.robotLevel || 0}/20`;
      if (id === "forge") {
        const price = hrcCost();
        return price ? `-⛏️${fmt(price.ore)} -💰${fmt(price.gold)} → 🔥HRC${state.hrc + 1}` : "⚡ HRC-MAX";
      }
      if (id === "barracks") {
        const wood = (18 + state.troopBoost * 4) * TRAINING_BATCH_MULTIPLIER;
        const stone = (10 + state.troopBoost * 3) * TRAINING_BATCH_MULTIPLIER;
        const gain = Math.floor((5 + state.troopBoost) * hrcMult() * troopTiers[state.troopTier].power * TRAINING_BATCH_MULTIPLIER);
        const evoText = state.weaponEvolution ? " · 무기 진화중" : "";
        return `현재 ${weaponDisplayEmoji()} ${troopTiers[state.troopTier].name}${evoText} · -🪵${fmt(wood)} -🪨${fmt(stone)} +🧑‍✈️${fmt(gain)}`;
      }
      if (id === "market") return `-🪵30 -🪨24 +💰${fmt(54 * 1.8 * hrcMult() * merchantRate())} · 상인 +${state.merchantLevel || 0}/10 (+${Math.round(((state.merchantLevel || 0) * 0.1) * 100)}%)`;
      return "";
    }
    function addMagicEffect(type, x, y) {
      const effect = { type, x, y, life: type === "earth" ? 3 : 1 };
      if (type === "earth") effect.cracks = createEarthCracks(24 * 1.4);
      state.magicEffects.push(effect);
    }
    function createEarthCracks(spread) {
      const count = 8 + Math.floor(Math.random() * 5);
      return Array.from({ length: count }, () => {
        const angle = Math.random() * Math.PI * 2;
        const length = spread * (0.75 + Math.random() * 0.5);
        const segments = 3 + Math.floor(Math.random() * 3);
        const startOffset = Math.random() * spread * 0.12;
        const points = [];
        for (let i = 0; i <= segments; i++) {
          const t = i / segments;
          const along = startOffset + length * t;
          const wobble = (Math.random() * 2 - 1) * 10 * Math.sin(Math.PI * t);
          points.push({
            x: Math.cos(angle) * along + Math.cos(angle + Math.PI / 2) * wobble,
            y: Math.sin(angle) * along + Math.sin(angle + Math.PI / 2) * wobble
          });
        }
        return { points, width: 0.8 + Math.random() * 1.7 };
      });
    }
    function worldScale() { return 0.7; }
    function viewScale() { return camera.zoom * worldScale(); }
    function screenToWorld(x, y) { return { x: (x - canvas.width / 2 - camera.x) / viewScale(), y: (y - canvas.height / 2 - camera.y) / viewScale() }; }
    function worldToScreen(x, y) { return { x: x * viewScale() + canvas.width / 2 + camera.x, y: y * viewScale() + canvas.height / 2 + camera.y }; }
    function wallRadius() { return 305; }
    function setZoom(nextZoom, anchorX = canvas.width / 2, anchorY = canvas.height / 2) {
      const before = screenToWorld(anchorX, anchorY);
      camera.zoom = Math.max(0.45, Math.min(2.4, nextZoom));
      const afterScreen = worldToScreen(before.x, before.y);
      camera.x += anchorX - afterScreen.x;
      camera.y += anchorY - afterScreen.y;
      document.getElementById("zoomText").textContent = `${Math.round(camera.zoom * 100)}%`;
    }
    function wallEmoji(wall) {
      if (wall.hp <= 0) return "💥";
      return healthRatio(wall.hp, wall.maxHp) > 0.5 ? "🧱" : "🪨";
    }
    function wallAtAngle(angle) {
      let normalized = angle;
      while (normalized < 0) normalized += Math.PI * 2;
      normalized %= Math.PI * 2;
      return Math.floor(normalized / (Math.PI * 2) * state.walls.length) % state.walls.length;
    }
    function getWallAtWorld(x, y) {
      const d = Math.hypot(x, y);
      if (Math.abs(d - wallRadius()) > 34) return null;
      return state.walls[wallAtAngle(Math.atan2(y, x))];
    }
    function log(text) {
      const box = document.getElementById("logPanel");
      const line = document.createElement("div");
      line.className = "log";
      line.textContent = text;
      box.prepend(line);
      while (box.children.length > 5) box.lastChild.remove();
    }
    function addEffect(x, y, text, color = "#ffe082", size = 22) {
      state.effects.push({ x, y, color, size, life: 1 });
    }
    function merchantRate() { return 1 + (state.merchantLevel || 0) * 0.1; }

    function mineGain(multiplier = 1) {
      const m = state.mineLevel * hrcMult() * difficultyMult("mineMult") * miningMultiplier() * multiplier;
      return { wood: Math.floor(8 * m), stone: Math.floor(6 * m), ore: Math.floor(3 * m) };
    }
    function addMineResources(gain) {
      state.wood += gain.wood; state.stone += gain.stone; state.ore += gain.ore;
    }
    function mine(x, y, auto = false) {
      const { wood, stone, ore } = mineGain();
      addMineResources({ wood, stone, ore });
      addEffect(x, y, `🪵+${fmt(wood)} 🪨+${fmt(stone)} ⛏️+${fmt(ore)}`, "#ffe082", 18);
      sound.play("mine_click");
      if (!auto) log("⛏️ 채굴 완료");
    }
    function forge(x, y, auto = false) {
      if (state.hrc >= 81) { addEffect(x, y, "⚡ HRC-MAX", "#e8edff", 24); return; }
      const price = hrcCost();
      const oreNeed = price.ore;
      const goldNeed = price.gold;
      if (state.ore < oreNeed || state.gold < goldNeed) { addEffect(x, y, "⚠️ 원석/금화 부족", "#ff806b", 18); return; }
      state.ore -= oreNeed; state.gold -= goldNeed; state.hrc += 1;
      state.castleMaxHp += 35 + state.hrc * 8; state.castleHp = Math.min(state.castleMaxHp, state.castleHp + 35 + state.hrc * 8);
      state.walls.forEach(w => { w.maxHp += 12 + state.hrc * 3; w.hp = Math.min(w.maxHp, w.hp + 12 + state.hrc * 3); });
      addEffect(x, y, state.hrc >= 81 ? "⚡ 우르 HRC-MAX!" : `🔥 HRC ${state.hrc}`, state.hrc >= 78 ? "#e8edff" : "#ffb347", 28);
      sound.play("hrc_upgrade");
      if (!auto) log(`⚒️ 제련 성공: ${hrcName()}`);
    }
    function train(x, y, auto = false) {
      const wood = (18 + state.troopBoost * 4) * TRAINING_BATCH_MULTIPLIER;
      const stone = (10 + state.troopBoost * 3) * TRAINING_BATCH_MULTIPLIER;
      if (state.wood < wood || state.stone < stone) { addEffect(x, y, "⚠️ 자원 부족", "#ff806b", 18); return; }
      state.wood -= wood; state.stone -= stone;
      const gain = Math.floor((5 + state.troopBoost) * hrcMult() * troopTiers[state.troopTier].power * TRAINING_BATCH_MULTIPLIER);
      state.troops += gain;
      addEffect(x, y, `${weaponDisplayEmoji()} +${fmt(gain)}`, "#cbe5ff", 22);
      if (!auto) log("⚔️ 병력 훈련 완료");
    }
    function market(x, y, auto = false) {
      const wood = Math.min(state.wood, 30), stone = Math.min(state.stone, 24);
      if (wood + stone < 12) { addEffect(x, y, "⚠️ 거래 자원 부족", "#ff806b", 18); return; }
      state.wood -= wood; state.stone -= stone;
      const gain = Math.floor((wood + stone) * 1.8 * hrcMult() * merchantRate());
      state.gold += gain;
      addEffect(x, y, `💰+${fmt(gain)}`, "#ffd76b", 24);
      if (!auto) log("💰 시장 거래 완료");
    }
    function clickBuilding(b, auto = false) {
      state.selected = b.id;
      if (b.id === "mine") mine(b.x, b.y, auto);
      if (b.id === "forge") forge(b.x, b.y, auto);
      if (b.id === "barracks") train(b.x, b.y, auto);
      if (b.id === "market") market(b.x, b.y, auto);
      if (!auto && ["mine", "forge", "market"].includes(b.id)) {
        state.manualSpawnClicks++;
        if (state.manualSpawnClicks >= 10) {
          state.manualSpawnClicks = 0;
          spawnEnemy();
        }
      }
    }

    function waveTarget() { return Math.ceil(5 * difficultyScale(1.32, state.wave - 1) * spawnCountMultiplier()); }
    function enemyStats() {
      return {
        hp: 85 * difficultyScale(1.22, state.wave - 1) * difficultyMult("hpMult"),
        atk: 14 * difficultyScale(1.18, state.wave - 1),
        speed: 0.45 * difficultyScale(1.045, state.wave - 1) * difficultyMult("speedMult"),
        def: 2 * difficultyScale(1.13, state.wave - 1)
      };
    }
    function spawnEnemy(origin = null, fullBorder = false) {
      const st = enemyStats();
      let type = state.hrc >= 78 && state.wave % 3 === 0 ? { emoji: "🤖", name: "강철 좀비" } : { emoji: ["🧟", "🏴‍☠️", "🐺", "👹"][Math.min(3, Math.floor((state.wave - 1) / 5))], name: "침입자" };
      const eliteRoll = Math.random();
      if (eliteRoll < Math.min(0.08 + state.wave * 0.006, 0.32)) {
        const elites = [
          { emoji: "💣", name: "자폭병", ability: "explode", mult: 0.8, auraColor: "67,255,122" },
          { emoji: "📣", name: "전투 북병", ability: "buff", mult: 1.1, auraColor: "255,224,68" },
          { emoji: "🦣", name: "거대화 오니", ability: "giant", mult: 2.8, auraColor: "75,165,255" },
          { emoji: "🧿", name: "저주 토템", ability: "debuff", mult: 1.35, auraColor: "67,255,122" }
        ];
        type = elites[Math.floor(Math.random() * elites.length)];
      }
      let x, y;
      if (origin) {
        x = origin.x + (Math.random() - 0.5) * 72;
        y = origin.y + (Math.random() - 0.5) * 72;
      } else if (fullBorder) {
        const edge = wallRadius() + 650 + Math.random() * 500;
        const side = Math.floor(Math.random() * 4);
        const along = (Math.random() * 2 - 1) * edge;
        x = side < 2 ? along : (side === 2 ? -edge : edge);
        y = side < 2 ? (side === 0 ? -edge : edge) : along;
      } else {
        const corner = Math.floor(Math.random() * 4);
        const sx = corner % 2 === 0 ? 1 : -1;
        const sy = corner < 2 ? 1 : -1;
        x = sx * (wallRadius() + 620 + Math.random() * 430);
        y = sy * (wallRadius() + 620 + Math.random() * 430);
      }
      const angle = Math.atan2(y, x);
      state.enemies.push({
        ...type, angle, x, y,
        hp: st.hp * (type.mult || 1), maxHp: st.hp * (type.mult || 1), atk: st.atk * (type.ability === "giant" ? 2.2 : 1), speed: st.speed * (type.ability === "giant" ? 0.72 : 1), def: st.def * (type.ability === "giant" ? 2 : 1), cd: 0, buffed: false, hitRadius: type.ability === "giant" ? 72 : 24, auraPhase: Math.random() * Math.PI * 2
      });
      state.spawnedThisWave++;
    }
    function troopDamage() {
      return (18 + Math.min(900, state.troops) * 0.08) * state.troopBoost * troopTiers[state.troopTier].power * hrcMult();
    }
    function isVillage(target) { return target?.type === "village"; }
    function damageVillage(village, dmg, text = "", color = "#ff7660") {
      village.damageTaken = (village.damageTaken || 0) + Math.max(1, dmg);
      syncVillageHp(village);
      if (text) addEffect(village.x, village.y - 60, text, color, 18);
      if (village.hp <= 0) {
        const idx = state.villages.indexOf(village);
        if (idx >= 0) state.villages.splice(idx, 1);
        addEffect(village.x, village.y, "🏚️ 부락 파괴", "#ff8268", 24);
        log("🏚️ 적 부락 파괴");
        return true;
      }
      return false;
    }
    function damageTarget(target, dmg, emoji, from = null, weapon = currentWeapon()) {
      if (weapon.kind === "gravity") { queueGravityShot(target, dmg, from, weapon); return; }
      if (weapon.kind === "lightning") {
        if (isVillage(target)) damageVillage(target, dmg);
        else target.hp -= Math.max(1, dmg - target.def);
        triggerMagic(target.x, target.y);
        playWeaponSound(weapon.kind);
        return;
      }
      if (isVillage(target)) {
        queueProjectileShot(target.x, target.y, dmg, from, weapon, emoji);
        return;
      }
      damageEnemy(target, dmg, emoji, from, weapon);
    }
    function damageEnemy(enemy, dmg, emoji, from = null, weapon = currentWeapon()) {
      if (weapon.kind === "gravity") { queueGravityShot(enemy, dmg, from, weapon); return; }
      if (weapon.kind === "lightning") {
        enemy.hp -= Math.max(1, dmg - enemy.def);
        triggerMagic(enemy.x, enemy.y);
        playWeaponSound(weapon.kind);
        return;
      }
      queueProjectileShot(enemy.x, enemy.y, dmg, from, weapon, emoji);
    }
    function queueProjectileShot(toX, toY, dmg, from = null, weapon = currentWeapon(), emoji = weapon.emoji) {
      const fromX = from ? from.x : 0, fromY = from ? from.y : 0;
      const distance = Math.hypot(toX - fromX, toY - fromY);
      const duration = Math.min(weapon.flight, Math.max(450, distance / mapEdgeDistance() * weapon.flight));
      state.shots.push({ fromX, fromY, toX, toY, emoji, weapon: weapon.kind, born: performance.now(), duration, hit: false, damage: dmg });
      playWeaponSound(weapon.kind);
    }
    function queueGravityShot(target, dmg, from = null, weapon = currentWeapon()) {
      queueProjectileShot(target.x, target.y, dmg, from, weapon, weapon.emoji);
    }
    function addImpactEffect(x, y, color = "#ffcf43", radius = 24) {
      state.magicEffects.push({ type: "impact", x, y, color, radius, life: 0.45 });
    }
    function shotCollisionRadius(shot) {
      return ({ bullet: 12, gravity: 30, axe: 22, dagger: 18, stone: 20 })[shot.weapon] || 18;
    }
    function targetCollisionRadius(target) {
      return isVillage(target) ? 44 : (target.hitRadius || 24);
    }
    function findShotCollision(shot, x, y) {
      const targets = [...state.enemies, ...state.villages].filter(t => (t.hp || 0) > 0);
      let hit = null, nearest = Infinity;
      for (const target of targets) {
        const dist = Math.hypot(target.x - x, target.y - y);
        if (dist <= shotCollisionRadius(shot) + targetCollisionRadius(target) && dist < nearest) {
          hit = target;
          nearest = dist;
        }
      }
      return hit;
    }
    function applyShotDamage(shot, target) {
      const damage = shot.damage || troopDamage();
      if (isVillage(target)) damageVillage(target, damage);
      else target.hp -= Math.max(1, damage - target.def);
    }
    function explodeAt(x, y, damage, radius, fullTarget = null) {
      for (const enemy of state.enemies) {
        const dist = Math.hypot(enemy.x - x, enemy.y - y);
        if (enemy === fullTarget) enemy.hp -= Math.max(1, enemy.maxHp - enemy.def);
        else if (dist <= radius) enemy.hp -= Math.max(1, damage * 0.5 - enemy.def);
      }
      for (const village of [...state.villages]) {
        if (Math.hypot(village.x - x, village.y - y) <= radius) damageVillage(village, damage * 0.5, `💥-${fmt(damage * 0.5)}`, "#ffde66");
      }
      state.magicEffects.push({ type: "explosion", x, y, radius, life: 0.8 });
      addEffect(x, y, `💥 ${Math.floor(damage)}`, "#ffde66", 28);
    }
    function triggerMagic(x, y) {
      const available = [];
      if (state.hrc >= 80 || state.hrc >= 81) available.push("fire");
      if (state.hrc >= 78 || state.hrc >= 81) available.push("mist");
      if (state.hrc >= 79 || state.hrc >= 81) available.push("earth");
      if (state.hrc >= 81) available.push("water", "lightning");
      const count = Math.min(available.length, Math.random() < 0.5 ? 1 : 2);
      for (let i = available.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [available[i], available[j]] = [available[j], available[i]];
      }
      available.slice(0, count).forEach(type => addMagicEffect(type, x, y));
    }
    function useItem(type) {
      ensureInventoryItems();
      if (!state.inventory[type]) return;
      if (type === "overtime") {
        const now = performance.now();
        state.overtimeUntil = Math.max(now, state.overtimeUntil) + 60000;
        closeGameplayModals();
        addEffect(0, 0, "🌝 야근 60s", "#fff1b7", 34);
        consumeItem(type);
        return;
      }
      if (type === "laser") {
        const now = performance.now();
        const wasActive = now < state.laserUntil;
        state.laserUntil = Math.max(now, state.laserUntil) + 20000;
        if (!wasActive) {
          state.laserLastTick = now;
          const firstTarget = [...state.enemies, ...state.villages][0];
          state.laserX = firstTarget ? firstTarget.x : 0;
          state.laserY = firstTarget ? firstTarget.y : 0;
          state.laserTargetIndex = 0;
        }
        closeGameplayModals();
        addEffect(0, 0, wasActive ? "🛰️ 위성 레이저 +20s" : "🛰️ 위성 레이저 20s", "#ff4444", 34);
        sound.play("satellite_laser");
        consumeItem(type);
        return;
      }
      if (type === "thunderer") {
        const now = performance.now();
        state.thunderUntil = Math.max(now, state.thunderUntil) + 20000;
        state.thunderLastTick = now;
        closeGameplayModals();
        addEffect(0, 0, "🌩️ 썬더러 20s", "#ffe66d", 34);
        consumeItem(type);
        return;
      }
      if (type === "windy") {
        const now = performance.now();
        state.windyUntil = Math.max(now, state.windyUntil) + 5000;
        state.windyLastTick = now;
        state.clouds = Array.from({ length: 18 }, () => ({
          x: visibleWorldRight() + Math.random() * 800,
          y: visibleWorldTop() - 220 - Math.random() * 650,
          size: 24 + Math.random() * 38,
          speed: 80 + Math.random() * 120
        }));
        closeGameplayModals();
        addEffect(0, 0, "🌬️ 윈디 5s", "#dff8ff", 34);
        sound.play("windy_active");
        consumeItem(type);
        return;
      }
      activeItem = type;
      state.repairMode = type === "repair";
      canvas.classList.toggle("repairing", !!activeItem);
      closeGameplayModals();
      updateItemCursor();
      log(`${itemData[type].emoji} ${itemData[type].name} 사용 대기`);
    }
    function consumeItem(type) {
      state.inventory[type]--;
      activeItem = null;
      state.repairMode = false;
      canvas.classList.remove("repairing");
      updateItemCursor();
      renderInventory();
    }
    function closeModals() {
      document.getElementById("startModal").classList.add("hidden");
      document.getElementById("shopModal").classList.add("hidden");
      document.getElementById("inventoryModal").classList.add("hidden");
      document.getElementById("settingsModal").classList.add("hidden");
    }
    function closeGameplayModals() {
      document.getElementById("shopModal").classList.add("hidden");
      document.getElementById("inventoryModal").classList.add("hidden");
      document.getElementById("settingsModal").classList.add("hidden");
    }
    function togglePause() {
      if (!running || state.ended) return;
      paused = !paused;
      if (paused) {
        pauseStarted = performance.now();
      } else if (pauseStarted) {
        const delta = performance.now() - pauseStarted;
        state.lastSpawn += delta;
        state.lastAuto += delta;
        state.lastTroopShot += delta;
        state.lastVillageSpawn += delta;
        state.nextVillageAt += delta;
        state.laserUntil += delta;
        state.laserLastTick += delta;
        state.defenseDebuffUntil += delta;
        state.thunderUntil += delta;
        state.thunderLastTick += delta;
        state.windyUntil += delta;
        state.windyLastTick += delta;
        state.overtimeUntil += delta;
        if (state.weaponEvolution) {
          state.weaponEvolution.startedAt += delta;
          state.weaponEvolution.endsAt += delta;
        }
        for (const village of state.villages) {
          village.lastSpawn += delta;
          village.spawnedAt += delta;
        }
        for (const missile of state.missiles) {
          missile.launchedAt += delta;
          missile.impactAt += delta;
        }
        pauseStarted = 0;
      }
      document.getElementById("pauseBtn").textContent = paused ? "▶️ 계속하기" : "⏸️ 일시정지";
      log(paused ? "⏸️ 게임 일시정지" : "▶️ 게임 재개");
    }
    function updateWeaponEvolution(now) {
      const evo = state.weaponEvolution;
      if (!evo || now < evo.endsAt) return;
      state.troopTier = evo.targetTier;
      state.weaponEvolution = null;
      sound.play("hrc_upgrade");
      log(`${weaponDisplayEmoji()} ${troopTiers[state.troopTier].name} 무기 진화 완료`);
    }
    function updateEnemies(dt) {
      for (let i = state.enemies.length - 1; i >= 0; i--) {
        const e = state.enemies[i];
        if (e.hp <= 0) {
          state.kills++; state.gold += Math.floor((12 + state.wave * 3) * hrcMult());
          addEffect(e.x, e.y, "☠️💰", "#ffd76b", 20);
          state.enemies.splice(i, 1);
          continue;
        }
        const d = Math.hypot(e.x, e.y);
        for (const g of state.gravityFields) {
          if (performance.now() > g.until || Math.hypot(e.x - g.x, e.y - g.y) > g.radius) continue;
          const dx = g.x - e.x, dy = g.y - e.y, gd = Math.hypot(dx, dy) || 1;
          e.x += (dx / gd) * dt * 0.035 + (-dy / gd) * dt * 0.018;
          e.y += (dy / gd) * dt * 0.035 + (dx / gd) * dt * 0.018;
        }
        for (let mi = state.mines.length - 1; mi >= 0; mi--) {
          const m = state.mines[mi];
          if (Math.hypot(e.x - m.x, e.y - m.y) < 75) {
            const radius = (e.hitRadius || 24) * 10;
            explodeAt(m.x, m.y, e.maxHp, radius, e);
            state.mines.splice(mi, 1);
            break;
          }
        }
        const seg = state.walls[wallAtAngle(Math.atan2(e.y, e.x))];
        const targetRadius = seg.hp > 0 ? wallRadius() + 8 : 70;
        if (e.ability === "buff" && !e.buffed) {
          for (const ally of state.enemies) {
            if (ally !== e && Math.hypot(ally.x - e.x, ally.y - e.y) < 150) {
              ally.atk *= 1.18; ally.def *= 1.18; ally.speed *= 1.08;
            }
          }
          e.buffed = true;
          addEffect(e.x, e.y - 28, "📣 버프!", "#f7d66b", 20);
        }
        if (d > targetRadius) {
          const slow = performance.now() < state.windyUntil ? 0.9 : 1;
          e.x -= (e.x / d) * e.speed * slow * dt * 0.08;
          e.y -= (e.y / d) * e.speed * slow * dt * 0.08;
        } else {
          e.cd -= dt;
          if (e.cd <= 0) {
            if (e.ability === "debuff") {
              state.defenseDebuffUntil = performance.now() + 8000;
              addEffect(e.x, e.y - 28, "🧙 방어력 감소", "#b980ff", 18);
            }
            const debuff = performance.now() < state.defenseDebuffUntil ? 0.45 : 1;
            const dmg = Math.max(1, Math.floor(e.atk - state.wallLevel * 1.6 * debuff - state.hrc * 0.35 * debuff));
            const boom = e.ability === "explode" ? 3.2 : 1;
            if (seg.hp > 0) {
              seg.hp = Math.max(0, seg.hp - Math.floor(dmg * boom));
              addEffect(e.x, e.y, `${e.ability === "explode" ? "💥" : "🧱"}-${Math.floor(dmg * boom)}`, "#ffb36c", 17);
              sound.play("wall_hit");
              if (seg.hp === 0) log(`💥 ${seg.index + 1}번 성벽 파괴! 적이 내부로 진입합니다.`);
            } else {
              const castleDmg = Math.max(1, Math.floor((e.atk - state.hrc * 0.25) * boom));
              state.castleHp = Math.max(0, state.castleHp - castleDmg);
              addEffect(0, -85, `🏰-${castleDmg}`, "#ff5a45", 22);
            }
            if (e.ability === "explode") e.hp = 0;
            e.cd = 780;
          }
        }
        if (hasNewbieAura() && Math.hypot(e.x, e.y) <= newbieAuraRadius()) e.hp -= e.maxHp * 0.02 * (dt / 1000);
      }
    }
    function updateCombat(now) {
      const weapon = currentWeapon();
      if (now - state.lastTroopShot < Math.max(120, (1050 - state.troopBoost * 45 - state.hrc * 7) / weapon.speed)) return;
      const combatTargets = [...state.enemies, ...state.villages].filter(t => (t.hp || 0) > 0);
      if (!combatTargets.length) return;
      state.lastTroopShot = now;
      let target = combatTargets[0], best = Infinity;
      for (const t of combatTargets) {
        const d = Math.hypot(t.x, t.y);
        if (d < best) { best = d; target = t; }
      }
      const a = Math.atan2(target.y, target.x);
      const from = { x: Math.cos(a) * wallRadius(), y: Math.sin(a) * wallRadius() };
      if (weapon.kind === "lightning") {
        damageTarget(target, troopDamage(), "", from, weapon);
        const radius = 48;
        for (const e of state.enemies) {
          if (e !== target && Math.hypot(e.x - target.x, e.y - target.y) <= radius) e.hp -= troopDamage() * 0.3;
        }
        for (const v of [...state.villages]) {
          if (v !== target && Math.hypot(v.x - target.x, v.y - target.y) <= radius) damageVillage(v, troopDamage() * 0.3);
        }
        state.lightningBolts.push(makeLightningBolt(from.x, from.y, target.x, target.y, { born: now, life: 1500, mode: "chain" }));
        return;
      }
      damageTarget(target, troopDamage(), weapon.emoji, from, weapon);
    }
    function updateLaser(now) {
      if (now > state.laserUntil) return;
      const targets = [...state.enemies.filter(e => e.hp > 0), ...state.villages.filter(v => (v.hp || 1) > 0)];
      if (!targets.length) return;
      const target = targets[state.laserTargetIndex % targets.length];
      state.laserX += (target.x - state.laserX) * 0.025;
      state.laserY += (target.y - state.laserY) * 0.025;
      if (now - state.laserLastTick >= 100) {
        state.laserLastTick = now;
        const radius = laserRadius();
        for (const enemy of state.enemies) {
          if (enemy.hp > 0 && Math.hypot(enemy.x - state.laserX, enemy.y - state.laserY) <= radius) enemy.hp -= enemy.maxHp * laserTickDamageRate(enemy);
        }
        for (let i = state.villages.length - 1; i >= 0; i--) {
          const v = state.villages[i];
          if (Math.hypot(v.x - state.laserX, v.y - state.laserY) > radius) continue;
          const villageMaxHp = v.maxHp || 1;
          const rate = (v.hp || villageMaxHp) / villageMaxHp >= 0.5 ? 0.25 : 0.13;
          damageVillage(v, villageMaxHp * rate, `🛰️-${fmt(villageMaxHp * rate)}`, "#ff4444");
        }
        if (target.hp <= 0) state.laserTargetIndex = state.laserTargetIndex % Math.max(1, targets.length - 1);
      }
    }
    function updateThunderer(now) {
      if (now > state.thunderUntil || now - state.thunderLastTick < 600) return;
      state.thunderLastTick = now;
      const targets = [...state.enemies, ...state.villages].sort((a, b) => Math.hypot(a.x, a.y) - Math.hypot(b.x, b.y)).slice(0, 5);
      for (const target of targets) {
        if (isVillage(target)) damageVillage(target, thunderDamage());
        else target.hp -= thunderDamage();
        state.lightningBolts.push(makeLightningBolt(target.x, visibleWorldTop(), target.x, target.y, { born: now, life: 400, mode: "strike" }));
      }
    }
    function updateWindy(now) {
      if (now > state.windyUntil) return;
      if (now - state.windyLastTick >= 100) {
        state.windyLastTick = now;
        for (const e of state.enemies) e.hp -= 10;
        for (const v of [...state.villages]) damageVillage(v, 10);
      }
      for (const c of state.clouds) {
        c.x -= c.speed * 0.016;
        c.y += c.speed * 0.012;
        if (c.x < visibleWorldLeft() - 260 || c.y > visibleWorldBottom() + 260) {
          c.x = visibleWorldRight() + Math.random() * 700;
          c.y = visibleWorldTop() - 220 - Math.random() * 650;
        }
      }
    }
    function launchMissile(x, y) {
      const now = performance.now();
      state.missiles.push({ x, y, startY: visibleWorldTop(), radius: missileRadius(), launchedAt: now, impactAt: now + 4000 });
      addEffect(x, y, "❌ 좌표 지정", "#ff6b45", 22);
    }
    function launchNuke(x, y) {
      const now = performance.now();
      state.missiles.push({ type: "nuke", x, y, startY: visibleWorldTop(), radius: nukeRadius(), launchedAt: now, impactAt: now + 5000 });
      addEffect(x, y, "", "#ff6b45", 32);
      sound.play("nuke_launch");
    }
    function updateMissiles(now) {
      for (let i = state.missiles.length - 1; i >= 0; i--) {
        const missile = state.missiles[i];
        if (now < missile.impactAt) continue;
        if (missile.type === "nuke") impactNuke(missile);
        else impactMissile(missile);
        state.missiles.splice(i, 1);
      }
    }
    function impactMissile(missile) {
      const damage = missileDamage();
      for (const enemy of state.enemies) {
        if (Math.hypot(enemy.x - missile.x, enemy.y - missile.y) <= missile.radius) enemy.hp -= damage;
      }
      for (const v of [...state.villages]) {
        if (Math.hypot(v.x - missile.x, v.y - missile.y) > missile.radius) continue;
        damageVillage(v, damage, `🚀-${fmt(damage)}`, "#ffde66");
      }
      state.magicEffects.push({ type: "explosion", x: missile.x, y: missile.y, radius: missile.radius, life: 0.9 });
      addEffect(missile.x, missile.y, "", "#ffde66", 28);
    }
    function impactNuke(nuke) {
      for (const enemy of state.enemies) {
        if (Math.hypot(enemy.x - nuke.x, enemy.y - nuke.y) <= nuke.radius) enemy.hp -= nukeDamage(enemy.maxHp);
      }
      for (const v of [...state.villages]) {
        if (Math.hypot(v.x - nuke.x, v.y - nuke.y) <= nuke.radius) damageVillage(v, nukeDamage(v.maxHp || 1));
      }
      state.magicEffects.push({ type: "nuke", x: nuke.x, y: nuke.y, radius: nuke.radius, life: 2.2 });
      state.radiationZones.push({ x: nuke.x, y: nuke.y, radius: nuke.radius, born: performance.now(), until: performance.now() + 60000 });
      addEffect(nuke.x, nuke.y, "", "#ff5a22", 42);
      sound.play("nuke_explosion");
    }
    function updateWave(now) {
      state.waveTarget = waveTarget();
      const surge = isBillionsSurgeWave();
      const delay = surge ? Math.max(45, 420 / Math.pow(1.06, state.wave - 1)) : Math.max(120, 1400 / Math.pow(1.06, state.wave - 1));
      if (state.spawnedThisWave < state.waveTarget && now - state.lastSpawn > delay) {
        const burst = Math.min(state.waveTarget - state.spawnedThisWave, surge ? Math.max(18, Math.ceil(state.waveTarget / 5)) : Math.ceil(Math.pow(1.08, state.wave)));
        for (let i = 0; i < burst; i++) spawnEnemy(null, surge);
        state.lastSpawn = now;
      }
      updateVillages(now);
      updateLaser(now);
      if (state.spawnedThisWave >= state.waveTarget && state.enemies.length === 0) {
        state.wave++; state.spawnedThisWave = 0;
        state.gold += 70 + state.wave * 28; state.wood += 60 + state.wave * 18; state.stone += 50 + state.wave * 16;
        log(`🌊 웨이브 ${state.wave} 시작 · 적 ${waveTarget()}명 예상`);
      }
    }
    function updateAuto(now) {
      if (state.autoLevel <= 0) return;
      const delay = autoDelay();
      if (now - state.lastAuto < delay) return;
      state.lastAuto = now;
      const autoBuildings = [buildings.find(b => b.id === "mine"), buildings.find(b => b.id === "market")].filter(Boolean);
      clickBuilding(autoBuildings[state.autoBuildingIndex % autoBuildings.length], true);
      state.autoBuildingIndex++;
    }
    function autoDelay() {
      if (state.autoLevel <= 0) return Infinity;
      if (state.autoLevel >= 10) return 500;
      return Math.round(10000 - (state.autoLevel - 1) * (9500 / 9));
    }

    function workerHomePoint() {
      return { x: -42, y: -12 };
    }
    function ensureWorkers(now = performance.now()) {
      while (state.robots.length < state.robotLevel) {
        state.robots.push({ startedAt: now + state.robots.length * 600, cargo: null });
      }
      if (state.robots.length > state.robotLevel) state.robots.length = state.robotLevel;
      while (state.merchants.length < state.merchantLevel) {
        state.merchants.push({ nextAt: now + 2000 + Math.random() * 1000, angle: Math.random() * Math.PI * 2 });
      }
      if (state.merchants.length > state.merchantLevel) state.merchants.length = state.merchantLevel;
    }
    function makeRobotCargo() {
      const icons = ["🪵", "🪨", "⛏️"];
      return Array.from({ length: 4 + Math.floor(Math.random() * 4) }, () => icons[Math.floor(Math.random() * icons.length)]);
    }
    function robotPosition(robot, now) {
      const mine = buildings.find(b => b.id === "mine");
      const home = workerHomePoint();
      const travel = robotTravelDuration();
      const mineTime = 2000;
      const cycle = travel * 2 + mineTime;
      const t = ((now - robot.startedAt) % cycle + cycle) % cycle;
      if (t < travel) {
        const p = t / travel;
        return { x: home.x + (mine.x - home.x) * p, y: home.y + (mine.y - home.y) * p, phase: "toMine" };
      }
      if (t < travel + mineTime) return { x: mine.x, y: mine.y, phase: "mining" };
      const p = (t - travel - mineTime) / travel;
      return { x: mine.x + (home.x - mine.x) * p, y: mine.y + (home.y - mine.y) * p, phase: "toHome" };
    }
    function updateWorkers(now) {
      ensureWorkers(now);
      for (const robot of state.robots) {
        const pos = robotPosition(robot, now);
        if ((pos.phase === "mining" || pos.phase === "toHome") && !robot.cargo) robot.cargo = makeRobotCargo();
        if (pos.phase === "toMine" && robot.cargo) {
          const gain = mineGain(4);
          addMineResources(gain);
          addEffect(pos.x, pos.y, "", "#ffe082", 24);
          robot.cargo = null;
        }
      }
      const marketBuilding = buildings.find(b => b.id === "market");
      for (const merchant of state.merchants) {
        if (now < merchant.nextAt) continue;
        const gain = Math.floor(54 * 1.8 * hrcMult() * merchantRate());
        state.gold += gain;
        addEffect(marketBuilding.x, marketBuilding.y, "", "#ffd76b", 24);
        merchant.nextAt = now + 2000 + Math.random() * 1000;
      }
    }

    function updateVillages(now) {
      if (state.villages.length < maxVillageCount() && now > state.nextVillageAt) {
        spawnVillage();
        state.nextVillageAt = now + villageSpawnDelay();
      }
      for (let i = state.villages.length - 1; i >= 0; i--) {
        const v = state.villages[i];
        syncVillageHp(v, now);
        if (v.hp <= 0) {
          state.villages.splice(i, 1);
          addEffect(v.x, v.y, "🏚️ 부락 파괴", "#ff8268", 24);
          log("🏚️ 적 부락 파괴");
          continue;
        }
        const progress = villageEmergenceProgress(v, now);
        if (!v.matured && progress >= 1) {
          v.matured = true;
          v.lastSpawn = now;
          const raid = Math.ceil(12 * difficultyScale(1.1, state.wave - 1) * spawnCountMultiplier());
          for (let n = 0; n < raid; n++) spawnEnemy(v);
        }
        if (!v.matured) continue;
        if (now - v.lastSpawn > Math.max(380, 1800 / Math.pow(1.04, state.wave))) {
          const count = Math.ceil(3 * difficultyScale(1.08, state.wave - 1) * spawnCountMultiplier());
          for (let i = 0; i < count; i++) spawnEnemy(v);
          v.lastSpawn = now;
          addEffect(v.x, v.y - 32, `🏚️ +${count} 침입`, "#ff8268", 18);
        }
      }
    }

    function spawnVillage() {
      const angle = Math.random() * Math.PI * 2;
      const dist = wallRadius() + 780 + Math.random() * 620;
      const maxHp = 2600 * difficultyScale(1.08, state.wave - 1) * villageHpMultiplier();
      const now = performance.now();
      const village = {
        type: "village",
        x: Math.cos(angle) * dist,
        y: Math.sin(angle) * dist,
        baseMaxHp: maxHp,
        hp: maxHp * 0.2,
        maxHp: maxHp * 0.2,
        damageTaken: 0,
        spawnedAt: now,
        matured: false,
        lastSpawn: now,
        seed: Math.random() * 10000
      };
      state.villages.push(village);
      log("🏚️ 외곽에 적 부락이 잠복 중입니다. 완성 전에 파괴할 수 있습니다!");
    }

    function resize() { canvas.width = innerWidth; canvas.height = innerHeight; }
    function drawBackground() {
      const g = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      g.addColorStop(0, "#82a750"); g.addColorStop(.55, "#b39155"); g.addColorStop(1, "#54773d");
      ctx.fillStyle = g; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.save(); ctx.translate(canvas.width / 2 + camera.x, canvas.height / 2 + camera.y); ctx.scale(viewScale(), viewScale());
      ctx.globalAlpha = .22; ctx.font = "24px Arial";
      const deco = ["🌲", "🌳", "🪨", "🌾", "🍄", "🌲"];
      for (let i = 0; i < 450; i++) ctx.fillText(deco[i % deco.length], ((i * 193) % 5400) - 2700, ((i * 97) % 3600) - 1800);
      ctx.globalAlpha = 1; ctx.restore();
    }
    function drawWorld() {
      ctx.save(); ctx.translate(canvas.width / 2 + camera.x, canvas.height / 2 + camera.y); ctx.scale(viewScale(), viewScale());
      ctx.strokeStyle = "rgba(90,48,22,.38)"; ctx.lineWidth = 14; ctx.lineCap = "round";
      for (const b of buildings) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(b.x, b.y); ctx.stroke(); }
      drawNewbieAura();
      drawCastle();
      drawWalls();
      drawBuildings();
      drawVillages();
      drawMines();
      drawWorkers();
      drawEnemies();
      drawMissiles();
      drawShots();
      drawLaser();
      drawCombatEffects();
      drawRadiationZones();
      drawMagicEffects();
      drawEffects();
      ctx.restore();
    }
    function drawNewbieAura() {
      if (!hasNewbieAura()) return;
      const pulse = (Math.sin(performance.now() / 2000 * Math.PI) + 1) / 2;
      const alpha = 0.05 + pulse * 0.15;
      ctx.save();
      const g = ctx.createRadialGradient(0, 0, wallRadius() * 0.85, 0, 0, newbieAuraRadius());
      g.addColorStop(0, `rgba(255,232,54,${alpha * 0.35})`);
      g.addColorStop(0.62, `rgba(255,219,44,${alpha})`);
      g.addColorStop(1, "rgba(255,219,44,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, newbieAuraRadius(), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    function drawCastle() {
      ctx.save(); ctx.shadowColor = state.hrc >= 78 ? "#dfffff" : "rgba(0,0,0,.45)"; ctx.shadowBlur = state.hrc >= 78 ? 24 : 10;
      roundRect(-70, -58, 140, 116, 16, "#8f4f2b", "#ffe0a1");
      ctx.restore();
      ctx.font = "68px Arial"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("🏰", 0, -5);
      ctx.font = "13px Arial"; ctx.fillStyle = "#fff1c7"; ctx.fillText(`성 HP ${fmt(state.castleHp)}/${fmt(state.castleMaxHp)}`, 0, 66);
    }
    function drawBuildings() {
      for (const b of buildings) {
        ctx.save(); ctx.shadowColor = state.selected === b.id ? "#fff06a" : "rgba(0,0,0,.35)"; ctx.shadowBlur = state.selected === b.id ? 18 : 5;
        ctx.font = "42px Arial"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(b.emoji, b.x, b.y - 10);
        ctx.font = b.id === "barracks" ? "30px Arial" : "22px Arial";
        ctx.fillText(b.id === "barracks" ? weaponDisplayEmoji() : b.sub, b.x, b.y + 22);
        ctx.restore();
        ctx.font = "bold 13px Arial"; ctx.textAlign = "center"; ctx.fillStyle = "#fff4c7"; ctx.fillText(b.name, b.x, b.y + 50);
        ctx.font = "11px Arial"; ctx.fillStyle = "#ffe7a5"; ctx.fillText(buildingPreview(b.id), b.x, b.y + 67);
        if (b.id === "barracks" && state.weaponEvolution) {
          const progress = weaponEvolutionProgress();
          ctx.fillStyle = "#7ef7ff";
          ctx.font = "bold 13px Arial";
          ctx.fillText(`무기 진화중 ${Math.floor(progress * 100)}%`, b.x, b.y - 72);
        }
      }
    }
    function drawWalls() {
      const r = wallRadius();
      for (const w of state.walls) {
        const a1 = (w.index / state.walls.length) * Math.PI * 2;
        const a2 = ((w.index + .86) / state.walls.length) * Math.PI * 2;
        if (wallTexture.complete && wallTexture.naturalWidth > 0) drawWallTextureSegment(w, r, a1, a2);
        else drawFallbackWallSegment(w, r, a1, a2);
      }
    }
    function drawFallbackWallSegment(w, r, a1, a2) {
      ctx.strokeStyle = w.hp <= 0 ? "rgba(84,35,29,.35)" : healthRatio(w.hp, w.maxHp) > .5 ? "#3f7d32" : "#c9822e";
      ctx.lineWidth = 24; ctx.beginPath(); ctx.arc(0, 0, r, a1, a2); ctx.stroke();
    }
    function drawWallTextureSegment(w, r, a1, a2) {
      const mid = (a1 + a2) / 2;
      const arcLength = r * (a2 - a1);
      const ratio = healthRatio(w.hp, w.maxHp);
      const width = arcLength * 1.08;
      const height = 64;
      ctx.save();
      ctx.translate(Math.cos(mid) * r, Math.sin(mid) * r);
      ctx.rotate(mid + Math.PI / 2);
      ctx.shadowColor = "rgba(0,0,0,.38)";
      ctx.shadowBlur = 8;
      ctx.shadowOffsetY = 5;
      ctx.globalAlpha = w.hp <= 0 ? 0.28 : 1;
      ctx.drawImage(
        wallTexture,
        WALL_TEXTURE_SOURCE.x,
        WALL_TEXTURE_SOURCE.y,
        WALL_TEXTURE_SOURCE.w,
        WALL_TEXTURE_SOURCE.h,
        -width / 2,
        -height / 2,
        width,
        height
      );
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
      if (w.hp <= 0) {
        ctx.fillStyle = "rgba(42,16,15,.48)";
        ctx.fillRect(-width / 2, -height / 2, width, height);
      } else if (ratio < 0.52) {
        ctx.fillStyle = "rgba(196,83,34,.28)";
        ctx.fillRect(-width / 2, -height / 2, width, height);
        ctx.strokeStyle = "rgba(255,214,148,.55)";
        ctx.lineWidth = 2;
        for (let i = 0; i < 3; i++) {
          const x = -width * 0.32 + ((w.index * 29 + i * 31) % Math.max(1, Math.floor(width * 0.64)));
          const y = -height * 0.28 + ((w.index * 17 + i * 23) % Math.max(1, Math.floor(height * 0.56)));
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + 8, y + 9);
          ctx.lineTo(x + 3, y + 18);
          ctx.stroke();
        }
      }
      ctx.restore();
    }
    function drawEnemies() {
      const now = performance.now();
      for (const e of state.enemies) {
        const ratio = Math.max(0, e.hp / e.maxHp);
        const r = e.hitRadius || 24;
        if (e.auraColor) {
          const wave = (Math.sin(now / 360 + e.auraPhase) + 1) / 2;
          const alpha = 0.2 + wave * 0.2;
          const scale = 1.1 + wave * 0.3;
          ctx.save();
          ctx.fillStyle = `rgba(${e.auraColor}, ${alpha})`;
          ctx.beginPath();
          ctx.arc(e.x, e.y, r * scale, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = `rgba(${e.auraColor}, ${Math.min(0.55, alpha + 0.12)})`;
          ctx.lineWidth = Math.max(3, r * 0.12);
          ctx.stroke();
          ctx.restore();
        }
        ctx.font = `${Math.max(26, r * 1.25)}px Arial`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(e.emoji, e.x, e.y);
        const barW = Math.max(48, r * 2), barY = e.y - r * 1.35;
        ctx.fillStyle = "#3a120f"; ctx.fillRect(e.x - barW / 2, barY, barW, 5);
        ctx.fillStyle = "#e64134"; ctx.fillRect(e.x - barW / 2, barY, barW * ratio, 5);
      }
    }
    function drawVillages() {
      const now = performance.now();
      for (const v of state.villages) {
        syncVillageHp(v, now);
        const progress = villageEmergenceProgress(v, now);
        const baseMaxHp = v.baseMaxHp || v.maxHp || 1;
        const capacityRatio = healthRatio(v.maxHp, baseMaxHp);
        const hpRatio = healthRatio(v.hp, baseMaxHp);
        drawSunkenColonyEffect(v, progress);
        ctx.save();
        ctx.globalAlpha = progress;
        ctx.font = "84px Arial"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText("🏚️", v.x, v.y);
        ctx.restore();
        const barW = 124, barY = v.y - 72;
        ctx.fillStyle = "#3a120f"; ctx.fillRect(v.x - barW / 2, barY, barW, 8);
        ctx.fillStyle = "rgba(83, 34, 118, .82)"; ctx.fillRect(v.x - barW / 2, barY, barW * capacityRatio, 8);
        ctx.fillStyle = "#e64134"; ctx.fillRect(v.x - barW / 2, barY, barW * hpRatio, 8);
        ctx.strokeStyle = "#ffe8ad"; ctx.lineWidth = 2; ctx.strokeRect(v.x - barW / 2, barY, barW, 8);
        const progW = 116, progY = v.y + 58;
        ctx.fillStyle = "rgba(15, 2, 25, .78)"; ctx.fillRect(v.x - progW / 2, progY, progW, 7);
        ctx.fillStyle = "#b347ff"; ctx.fillRect(v.x - progW / 2, progY, progW * progress, 7);
        ctx.strokeStyle = "rgba(235, 199, 255, .82)"; ctx.lineWidth = 1.5; ctx.strokeRect(v.x - progW / 2, progY, progW, 7);
        ctx.font = "12px Arial"; ctx.fillStyle = "#ffe8ad"; ctx.fillText(`부락 ${fmt(v.hp)}/${fmt(v.maxHp)}`, v.x, v.y + 78);
      }
    }
    function seededUnit(seed, offset) {
      const x = Math.sin(seed + offset * 78.233) * 43758.5453;
      return x - Math.floor(x);
    }
    function drawSunkenColonyEffect(v, progress) {
      const seed = v.seed || 1;
      const pulse = (Math.sin(performance.now() / 900 + seed) + 1) / 2;
      ctx.save();
      ctx.globalAlpha = 0.6;
      ctx.translate(v.x, v.y + 16);
      ctx.fillStyle = "rgba(7, 1, 12, .64)";
      ctx.beginPath(); ctx.ellipse(0, 12, 72, 34, 0, 0, Math.PI * 2); ctx.fill();
      for (let i = 0; i < 8; i++) {
        const a = i / 8 * Math.PI * 2 + seededUnit(seed, i) * 0.38;
        const rx = 18 + seededUnit(seed, i + 10) * 42;
        const ry = 7 + seededUnit(seed, i + 20) * 20;
        ctx.fillStyle = i % 2 ? "rgba(62, 18, 92, .62)" : "rgba(38, 10, 63, .72)";
        ctx.beginPath();
        ctx.ellipse(Math.cos(a) * rx * 0.42, Math.sin(a) * ry * 0.55 + 12, 34 + seededUnit(seed, i + 30) * 22, 12 + seededUnit(seed, i + 40) * 12, a * 0.35, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      for (let i = 0; i < 12; i++) {
        const a = i / 12 * Math.PI * 2 + seededUnit(seed, i + 50) * 0.5;
        const len = 42 + seededUnit(seed, i + 60) * 54 + progress * 18;
        const sx = Math.cos(a) * 18, sy = Math.sin(a) * 7 + 12;
        const ex = Math.cos(a) * len, ey = Math.sin(a) * len * 0.42 + 12;
        const mx = Math.cos(a + 0.8) * len * 0.42, my = Math.sin(a + 0.8) * len * 0.22 + 12;
        ctx.strokeStyle = i % 2 ? "rgba(92, 28, 132, .78)" : "rgba(35, 8, 62, .9)";
        ctx.lineWidth = 5 + seededUnit(seed, i + 70) * 4;
        ctx.beginPath(); ctx.moveTo(sx, sy); ctx.quadraticCurveTo(mx, my, ex, ey); ctx.stroke();
        ctx.strokeStyle = "rgba(196, 116, 236, .5)";
        ctx.lineWidth = 1.1;
        ctx.beginPath(); ctx.moveTo(sx, sy - 1); ctx.quadraticCurveTo(mx, my - 1, ex, ey - 1); ctx.stroke();
        for (let k = 1; k <= 2; k++) {
          const t = (k + seededUnit(seed, i * 3 + k)) / 3.4;
          const px = sx + (ex - sx) * t;
          const py = sy + (ey - sy) * t;
          const thorn = 5 + seededUnit(seed, i * 5 + k) * 7;
          ctx.strokeStyle = "rgba(188, 112, 226, .58)";
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(px + Math.cos(a + Math.PI / 2) * thorn, py + Math.sin(a + Math.PI / 2) * thorn * 0.6);
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 0.25 + pulse * 0.12;
      ctx.fillStyle = "rgba(180, 96, 230, .55)";
      ctx.beginPath(); ctx.ellipse(0, 10, 42 + pulse * 10, 16 + pulse * 4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    function drawMines() {
      for (const m of state.mines) {
        ctx.font = "24px Arial"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText("💣", m.x, m.y);
      }
    }
    function drawWorkers() {
      const now = performance.now();
      ensureWorkers(now);
      for (const robot of state.robots) {
        const pos = robotPosition(robot, now);
        ctx.save();
        ctx.font = "24px Arial"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText("🤖", pos.x, pos.y);
        if (robot.cargo) {
          ctx.font = "7px Arial";
          robot.cargo.forEach((icon, idx) => {
            const col = idx % 3, row = Math.floor(idx / 3);
            ctx.fillText(icon, pos.x - 8 + col * 8, pos.y - 28 - row * 8);
          });
        }
        ctx.restore();
      }
      const marketBuilding = buildings.find(b => b.id === "market");
      for (const merchant of state.merchants) {
        const r = 46;
        const wobble = Math.sin(now / 700 + merchant.angle) * 10;
        ctx.save();
        ctx.font = "24px Arial"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText("🧙", marketBuilding.x + Math.cos(merchant.angle) * r, marketBuilding.y + Math.sin(merchant.angle) * (r * 0.45) + wobble);
        ctx.restore();
      }
    }
    function drawShots() {
      const now = performance.now();
      for (let i = state.shots.length - 1; i >= 0; i--) {
        const s = state.shots[i];
        const t = Math.min(1, (now - s.born) / s.duration), x = s.fromX + (s.toX - s.fromX) * t, y = s.fromY + (s.toY - s.fromY) * t;
        ctx.save();
        if (s.weapon === "bullet") {
          ctx.fillStyle = "#ffdc3b"; ctx.strokeStyle = "#ff9224"; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.ellipse(x, y, 7, 3, Math.atan2(s.toY - s.fromY, s.toX - s.fromX), 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        } else if (s.weapon === "gravity") {
          ctx.font = "16px Arial"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("🌑", x, y);
          for (let k = 0; k < 6; k++) {
            const tailT = Math.max(0, t - k * 0.035);
            const tx = s.fromX + (s.toX - s.fromX) * tailT, ty = s.fromY + (s.toY - s.fromY) * tailT;
            ctx.fillStyle = `rgba(0,0,0,${0.12 - k * 0.012})`; ctx.beginPath(); ctx.arc(tx, ty, 24 * (5 - k * 0.5), 0, Math.PI * 2); ctx.fill();
          }
        } else {
          if (s.weapon === "axe") ctx.rotate(0);
          ctx.translate(x, y);
          if (s.weapon === "axe") ctx.rotate(-Math.PI * 2 * ((now - s.born) % 700) / 700);
          if (s.weapon === "dagger") ctx.rotate(Math.PI * 2 * ((now - s.born) % 500) / 500);
          ctx.font = "22px Arial"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(s.emoji, 0, 0);
        }
        ctx.restore();
        const hit = findShotCollision(s, x, y);
        if (hit) {
          handleShotImpact(s, x, y, hit);
          state.shots.splice(i, 1);
          continue;
        }
        if (t >= 1) {
          handleShotImpact(s, s.toX, s.toY, null);
          state.shots.splice(i, 1);
        }
      }
    }
    function handleShotImpact(s, x = s.toX, y = s.toY, target = null) {
      if (s.weapon === "stone") {
        const count = 6 + Math.floor(Math.random() * 4);
        for (let i = 0; i < count; i++) {
          const a = Math.random() * Math.PI * 2, speed = 25 + Math.random() * 55;
          state.fragments.push({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, size: 5 + Math.random() * 15, life: 0.55 });
        }
      }
      if (s.weapon !== "gravity" && target) {
        applyShotDamage(s, target);
        triggerMagic(x, y);
      }
      if (s.weapon === "bullet") addImpactEffect(x, y, "#ffcf43", 28);
      if (s.weapon === "axe" || s.weapon === "dagger") addImpactEffect(x, y, "#ff7660", 22);
      if (s.weapon === "gravity") {
        const radius = 24 * 3;
        const damage = s.damage || troopDamage();
        state.gravityFields.push({ x, y, radius, born: performance.now(), until: performance.now() + 10000 });
        for (const enemy of state.enemies) {
          if (enemy.hp > 0 && Math.hypot(enemy.x - x, enemy.y - y) <= radius) {
            const applied = Math.max(1, damage - enemy.def);
            enemy.hp -= applied;
          }
        }
        for (const village of [...state.villages]) {
          if (Math.hypot(village.x - x, village.y - y) <= radius) damageVillage(village, damage);
        }
        addImpactEffect(x, y, "#9f8cff", radius);
        triggerMagic(x, y);
      }
    }
    function drawCombatEffects() {
      const now = performance.now();
      if (now < state.windyUntil) {
        ctx.save(); ctx.strokeStyle = "#72b8ff"; ctx.lineWidth = 3;
        for (let i = 0; i < 16; i++) {
          const y = visibleWorldTop() + i * 95 + ((now / 25) % 95);
          ctx.globalAlpha = 0.05 + ((Math.sin(now / 900 * Math.PI * 2 + i * 1.618) + 1) / 2) * 0.9;
          ctx.beginPath(); ctx.moveTo(visibleWorldRight() - 80, y); ctx.lineTo(visibleWorldLeft() + 80, y + 160); ctx.stroke();
        }
        ctx.globalAlpha = 0.72; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        for (const c of state.clouds) { ctx.font = `${c.size}px Arial`; ctx.fillText("☁️", c.x, c.y); }
        ctx.restore();
      }
      for (let i = state.fragments.length - 1; i >= 0; i--) {
        const f = state.fragments[i]; f.life -= 0.025; f.x += f.vx * 0.016; f.y += f.vy * 0.016;
        ctx.save(); ctx.globalAlpha = Math.max(0, f.life); ctx.font = `${f.size}px Arial`; ctx.fillText("🪨", f.x, f.y); ctx.restore();
        if (f.life <= 0) state.fragments.splice(i, 1);
      }
      for (let i = state.gravityFields.length - 1; i >= 0; i--) {
        const g = state.gravityFields[i], age = now - g.born;
        if (now > g.until) { state.gravityFields.splice(i, 1); continue; }
        ctx.save(); ctx.globalAlpha = age < 1600 ? 0.55 : Math.max(0.08, 0.35 * (1 - (age - 1600) / 8400));
        ctx.fillStyle = "#000"; ctx.beginPath(); ctx.arc(g.x, g.y, g.radius, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      }
      for (let i = state.lightningBolts.length - 1; i >= 0; i--) {
        const b = state.lightningBolts[i], age = now - b.born;
        if (age > b.life + 1000) { state.lightningBolts.splice(i, 1); continue; }
        const alpha = age < 100 ? 1 : age < 500 ? 1 : Math.max(0, 1 - (age - 500) / 1000);
        ctx.save(); ctx.globalAlpha = alpha; ctx.lineCap = "round"; ctx.lineJoin = "round";
        if (b.mode === "strike") drawVerticalLightningStrike(b, alpha);
        else drawChainLightning(b);
        ctx.restore();
      }
    }
    function drawPolyline(points) {
      if (!points?.length) return;
      ctx.beginPath();
      points.forEach((p, idx) => idx ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
      ctx.stroke();
    }
    function drawChainLightning(b) {
      const points = b.nodes || [linePoint(b.fromX, b.fromY, b.toX, b.toY, 0), linePoint(b.fromX, b.fromY, b.toX, b.toY, 1)];
      ctx.shadowColor = "#9d4dff";
      ctx.shadowBlur = 24;
      ctx.strokeStyle = "#7b2dff";
      ctx.lineWidth = 10;
      drawPolyline(points);
      ctx.shadowColor = "#34f5ff";
      ctx.shadowBlur = 18;
      ctx.strokeStyle = "#31f7ff";
      ctx.lineWidth = 5;
      drawPolyline(points);
      ctx.shadowBlur = 0;
      ctx.strokeStyle = "#f4fbff";
      ctx.lineWidth = 1.8;
      drawPolyline(points);
      for (let k = 0; k < b.branches; k++) {
        const start = points[1 + Math.floor(Math.random() * Math.max(1, points.length - 2))] || points[0];
        const side = k % 2 === 0 ? -1 : 1;
        const len = (26 + Math.random() * 44) * side;
        const end = { x: start.x + len, y: start.y + (Math.random() * 2 - 1) * 34 };
        const branch = createLightningNodes(start.x, start.y, end.x, end.y, 4, 18);
        ctx.strokeStyle = k % 2 ? "#31f7ff" : "#9d4dff";
        ctx.lineWidth = 2.2;
        drawPolyline(branch);
      }
      for (const spark of b.sparks || []) {
        ctx.strokeStyle = Math.random() > 0.5 ? "#31f7ff" : "#b878ff";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(spark.x, spark.y);
        ctx.lineTo(spark.x + spark.dx, spark.y + spark.dy);
        ctx.stroke();
      }
    }
    function drawVerticalLightningStrike(b, alpha) {
      const points = b.nodes || createLightningNodes(b.fromX, b.fromY, b.toX, b.toY, 8, 26);
      ctx.shadowColor = "#a64dff";
      ctx.shadowBlur = 34;
      ctx.strokeStyle = "#8a2dff";
      ctx.lineWidth = 16;
      drawPolyline(points);
      ctx.shadowColor = "#ffffff";
      ctx.shadowBlur = 22;
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 5;
      drawPolyline(points);
      ctx.shadowBlur = 0;
      const glow = ctx.createRadialGradient(b.toX, b.toY, 0, b.toX, b.toY, 95);
      glow.addColorStop(0, `rgba(255,255,255,${0.9 * alpha})`);
      glow.addColorStop(0.35, `rgba(188,93,255,${0.55 * alpha})`);
      glow.addColorStop(1, "rgba(188,93,255,0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(b.toX, b.toY, 95, 0, Math.PI * 2);
      ctx.fill();
    }
    function linePoint(x1, y1, x2, y2, t) {
      return { x: x1 + (x2 - x1) * t, y: y1 + (y2 - y1) * t };
    }
    function lineNormal(x1, y1, x2, y2) {
      const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1;
      return { x: -dy / len, y: dx / len };
    }
    function drawLightningStroke(b, x1, y1, x2, y2, distortion, offset, width, color, seed) {
      const n = lineNormal(b.fromX, b.fromY, b.toX, b.toY);
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      drawJaggedLine(x1 + n.x * offset, y1 + n.y * offset, x2 + n.x * offset, y2 + n.y * offset, 7, seed, distortion);
    }
    function drawLightningBranch(b, startT, endT, offset, width, color, seed) {
      const n = lineNormal(b.fromX, b.fromY, b.toX, b.toY);
      const start = linePoint(b.fromX, b.fromY, b.toX, b.toY, startT);
      const end = linePoint(b.fromX, b.fromY, b.toX, b.toY, endT);
      drawLightningStroke(b, start.x, start.y, end.x + n.x * offset, end.y + n.y * offset, 4, 0, width, color, seed);
    }
    function drawJaggedLine(x1, y1, x2, y2, segments, seed, distortion = 1) {
      ctx.beginPath(); ctx.moveTo(x1, y1);
      for (let i = 1; i < segments; i++) {
        const t = i / segments, wobble = Math.sin(seed + i * 12.989) * 24 * distortion;
        ctx.lineTo(x1 + (x2 - x1) * t + wobble, y1 + (y2 - y1) * t);
      }
      ctx.lineTo(x2, y2); ctx.stroke();
    }
    function drawMissiles() {
      for (const missile of state.missiles) {
        const flight = missile.type === "nuke" ? 5000 : 4000;
        const progress = Math.max(0, Math.min(1, (performance.now() - missile.launchedAt) / flight));
        const y = missile.startY + (missile.y - missile.startY) * progress;
        ctx.save();
        ctx.globalAlpha = missile.type === "nuke" ? .16 : .25;
        ctx.fillStyle = missile.type === "nuke" ? "rgba(255,65,20,.45)" : "rgba(255,255,255,.28)";
        ctx.beginPath(); ctx.arc(missile.x, missile.y, missile.radius, 0, Math.PI * 2); ctx.strokeStyle = missile.type === "nuke" ? "#ff4a1a" : "#ffffff"; ctx.lineWidth = missile.type === "nuke" ? 6 : 3; ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.translate(missile.x, y);
        ctx.rotate(130 * Math.PI / 180);
        ctx.font = missile.type === "nuke" ? "54px Arial" : "42px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(missile.type === "nuke" ? "☢️" : "🚀", 0, 0);
        ctx.restore();
      }
    }
    function drawLaser() {
      if (performance.now() > state.laserUntil) return;
      ctx.save();
      const pulse = Math.sin(performance.now() / 80) * 4;
      const radius = laserRadius() + pulse;
      ctx.fillStyle = "rgba(255, 55, 25, .50)";
      ctx.beginPath();
      ctx.arc(state.laserX, state.laserY, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(255, 170, 0, .70)";
      ctx.lineWidth = 12;
      ctx.beginPath();
      ctx.moveTo(state.laserX, visibleWorldTop());
      ctx.lineTo(state.laserX, state.laserY);
      ctx.stroke();
      ctx.strokeStyle = "rgba(185, 0, 0, .96)";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(state.laserX, visibleWorldTop());
      ctx.lineTo(state.laserX, state.laserY);
      ctx.stroke();
      ctx.restore();
    }
    function drawRadiationZones() {
      const now = performance.now();
      for (let i = state.radiationZones.length - 1; i >= 0; i--) {
        const z = state.radiationZones[i];
        if (now > z.until) { state.radiationZones.splice(i, 1); continue; }
        const pulse = (Math.sin(now / 700) + 1) / 2;
        ctx.save();
        ctx.globalAlpha = 0.4;
        const g = ctx.createRadialGradient(z.x, z.y, z.radius * 0.08, z.x, z.y, z.radius);
        g.addColorStop(0, `rgba(255,95,20,${0.24 + pulse * 0.08})`);
        g.addColorStop(0.45, `rgba(115,255,84,${0.13 + pulse * 0.07})`);
        g.addColorStop(1, "rgba(75,255,50,0)");
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(z.x, z.y, z.radius, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "rgba(160,255,80,.45)";
        ctx.lineWidth = 8;
        ctx.beginPath(); ctx.arc(z.x, z.y, z.radius * (0.62 + pulse * 0.1), 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
      }
    }
    function drawMagicEffects() {
      for (let i = state.magicEffects.length - 1; i >= 0; i--) {
        const m = state.magicEffects[i];
        m.life -= 0.018;
        const alpha = Math.max(0, Math.min(1, m.life));
        ctx.save();
        ctx.globalAlpha = alpha;
        if (m.type === "explosion") {
          const r = (1 - alpha) * m.radius;
          ctx.strokeStyle = "#ff7b22"; ctx.lineWidth = 5;
          ctx.beginPath(); ctx.arc(m.x, m.y, r, 0, Math.PI * 2); ctx.stroke();
        }
        if (m.type === "nuke") {
          const t = 1 - alpha;
          const fireR = m.radius * Math.min(0.42, t * 0.72);
          const stemH = m.radius * Math.min(0.38, t * 0.52);
          const cloudR = m.radius * (0.08 + t * 0.16);
          const plumeY = m.y - stemH;
          const g = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, Math.max(1, fireR));
          g.addColorStop(0, "rgba(255,255,210,.95)");
          g.addColorStop(0.28, "rgba(255,130,30,.86)");
          g.addColorStop(0.68, "rgba(170,38,20,.56)");
          g.addColorStop(1, "rgba(40,40,40,0)");
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(m.x, m.y, fireR, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = `rgba(92,83,76,${0.55 * alpha})`;
          ctx.beginPath(); ctx.ellipse(m.x, m.y - stemH * 0.45, cloudR * 0.45, stemH, 0, 0, Math.PI * 2); ctx.fill();
          for (let k = 0; k < 9; k++) {
            const a = k / 9 * Math.PI * 2;
            const rr = cloudR * (0.75 + (k % 3) * 0.18);
            ctx.fillStyle = k % 2 ? `rgba(255,94,28,${0.45 * alpha})` : `rgba(100,96,92,${0.62 * alpha})`;
            ctx.beginPath(); ctx.arc(m.x + Math.cos(a) * cloudR * 0.82, plumeY + Math.sin(a) * cloudR * 0.35, rr, 0, Math.PI * 2); ctx.fill();
          }
        }
        if (m.type === "impact") {
          const r = (1 - alpha) * m.radius;
          ctx.strokeStyle = m.color || "#ffcf43";
          ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(m.x, m.y, r, 0, Math.PI * 2); ctx.stroke();
          ctx.globalAlpha = alpha * 0.35;
          ctx.fillStyle = m.color || "#ffcf43";
          ctx.beginPath(); ctx.arc(m.x, m.y, Math.max(4, r * 0.35), 0, Math.PI * 2); ctx.fill();
          ctx.globalAlpha = alpha;
        }
        if (m.type === "fire") {
          ctx.fillStyle = "rgba(255,80,20,.35)";
          ctx.beginPath(); ctx.arc(m.x, m.y, 65 * (1.2 - alpha), 0, Math.PI * 2); ctx.fill();
        }
        if (m.type === "water") {
          ctx.strokeStyle = "#78d5ff";
          ctx.lineWidth = 3;
          for (let r = 18; r <= 54; r += 18) {
            ctx.beginPath(); ctx.arc(m.x, m.y, r * (1.25 - alpha * 0.25), 0, Math.PI * 2); ctx.stroke();
          }
        }
        if (m.type === "lightning") {
          ctx.strokeStyle = Math.random() > .5 ? "#41a8ff" : "#54ff94"; ctx.lineWidth = 4;
          ctx.beginPath(); ctx.moveTo(m.x - 45, m.y - 35); ctx.lineTo(m.x, m.y); ctx.lineTo(m.x + 38, m.y - 20); ctx.stroke();
        }
        if (m.type === "mist") {
          ctx.fillStyle = "rgba(225,245,255,.45)";
          ctx.beginPath(); ctx.arc(m.x, m.y, 80 * (1.1 - alpha), 0, Math.PI * 2); ctx.fill();
        }
        if (m.type === "earth") {
          ctx.strokeStyle = "#3b220f";
          ctx.lineCap = "round";
          ctx.lineJoin = "round";
          for (const crack of m.cracks || []) {
            ctx.lineWidth = crack.width;
            ctx.beginPath();
            crack.points.forEach((p, idx) => {
              const x = m.x + p.x * (1.05 - alpha * 0.05);
              const y = m.y + p.y * (1.05 - alpha * 0.05);
              if (idx === 0) ctx.moveTo(x, y);
              else ctx.lineTo(x, y);
            });
            ctx.stroke();
          }
        }
        ctx.restore();
        if (m.life <= 0) state.magicEffects.splice(i, 1);
      }
    }
    function drawEffects() {
      for (let i = state.effects.length - 1; i >= 0; i--) {
        const e = state.effects[i]; e.life -= .022;
        const alpha = Math.max(0, e.life);
        const radius = Math.max(8, e.size || 18) * (1.25 - alpha * 0.25);
        ctx.save();
        ctx.globalAlpha = alpha * 0.65;
        ctx.strokeStyle = e.color;
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(e.x, e.y, radius, 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = alpha * 0.28;
        ctx.fillStyle = e.color;
        ctx.beginPath(); ctx.arc(e.x, e.y, radius * 0.45, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        if (e.life <= 0) state.effects.splice(i, 1);
      }
    }
    function roundRect(x, y, w, h, r, fill, stroke) {
      ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h); ctx.lineTo(x + r, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - r); ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
      ctx.fillStyle = fill; ctx.fill(); ctx.strokeStyle = stroke; ctx.lineWidth = 3; ctx.stroke();
    }
    function render() { drawBackground(); if (running) drawWorld(); }

    function updateLaserStatus() {
      const status = document.getElementById("laserStatus");
      const now = performance.now();
      const rows = [];
      const laserRemaining = Math.max(0, state.laserUntil - now);
      const thunderRemaining = Math.max(0, state.thunderUntil - now);
      const windyRemaining = Math.max(0, state.windyUntil - now);
      const overtimeRemaining = Math.max(0, state.overtimeUntil - now);
      if (hasNewbieAura()) rows.push({ icon: "🙈", text: "∞" });
      if (overtimeRemaining > 0) rows.push({ icon: "🌝", text: timeText(overtimeRemaining) });
      if (laserRemaining > 0) rows.push({ icon: "🛰️", text: timeText(laserRemaining) });
      if (thunderRemaining > 0) rows.push({ icon: "🌩️", text: timeText(thunderRemaining) });
      if (windyRemaining > 0) rows.push({ icon: "🌬️", text: timeText(windyRemaining) });
      status.classList.toggle("hidden", !running || state.ended || rows.length === 0);
      status.innerHTML = rows.map(row => `<div class="statusRow"><div class="statusIcon">${row.icon}</div><div class="statusTimer">${row.text}</div></div>`).join("");
    }
    function timeText(ms) { return Number.isFinite(ms) ? `${(ms / 1000).toFixed(1)}s` : "∞"; }
    function updateBillionsWarning() {
      document.getElementById("billionsWarning").classList.toggle("active", running && !state.ended && isBillionsSurgeWave());
    }
    function weaponEvolutionCostHtml(next, cost) {
      if (!next) return "최종 무기";
      const current = troopTiers[state.troopTier];
      if (state.weaponEvolution) {
        const progress = weaponEvolutionProgress();
        const remaining = Math.max(0, state.weaponEvolution.endsAt - performance.now());
        return `${weaponDisplayEmoji(state.weaponEvolution.targetTier)} ${troopTiers[state.weaponEvolution.targetTier].name} 진화중 · ${timeText(remaining)}<div class="shopProgress"><div class="shopProgressFill" style="width:${Math.floor(progress * 100)}%"></div></div>`;
      }
      return `${weaponDisplayEmoji()} ${current.name} → ${weaponDisplayEmoji(state.troopTier + 1)} ${next.name} · 무기Lv ${next.req}+ · ${fmt(cost)}💰 · ${timeText(weaponEvolutionDuration(state.troopTier + 1))}`;
    }

    function updateUI() {
      updateLaserStatus();
      updateBillionsWarning();
      if (!running) return;
      ensureInventoryItems();
      document.getElementById("nickText").textContent = state.nickname;
      document.getElementById("waveText").textContent = state.wave;
      document.getElementById("killText").textContent = fmt(state.kills);
      document.getElementById("woodText").textContent = fmt(state.wood);
      document.getElementById("stoneText").textContent = fmt(state.stone);
      document.getElementById("oreText").textContent = fmt(state.ore);
      document.getElementById("goldText").textContent = fmt(state.gold);
      document.getElementById("troopText").textContent = fmt(state.troops);
      document.getElementById("hrcText").textContent = !Number.isFinite(state.hrc) ? "∞" : state.hrc >= 81 ? "HRC-MAX 우르" : `HRC ${state.hrc}`;
      document.getElementById("castleText").textContent = `${fmt(state.castleHp)}/${fmt(state.castleMaxHp)}`;
      document.getElementById("clickText").textContent = fmt(state.clicks);
      document.getElementById("selectedHrc").textContent = `🔥 ${hrcName()} · 전체 보정 x${hrcMult().toFixed(2)}`;
      const selected = buildings.find(b => b.id === state.selected);
      document.getElementById("selectedTitle").textContent = selected ? `${selected.emoji} ${selected.name}` : "🏰 중앙 성";
      document.getElementById("selectedDesc").textContent = selected ? `${selected.desc} · ${buildingPreview(selected.id)}` : "세그먼트 성벽이 파괴된 방향으로 적이 침입합니다.";
      document.getElementById("wallList").innerHTML = state.walls.map(w => {
        const pct = !Number.isFinite(w.hp) || !Number.isFinite(w.maxHp) ? "∞" : `${Math.max(0, Math.min(100, Math.round((w.hp / w.maxHp) * 100)))}%`;
        return `<div class="wallMini" title="${w.index + 1}번 ${fmt(w.hp)}/${fmt(w.maxHp)}">${wallEmoji(w)} ${w.index + 1}<br>${pct}</div>`;
      }).join("");

      const auto = upgradeCost(90, state.autoLevel, 1.25), mineC = upgradeCost(65, state.mineLevel, 1.18), robot = robotUpgradeCost(), merchant = merchantUpgradeCost();
      const troop = upgradeCost(120, state.troopBoost, 1.19), wall = upgradeCost(150, state.wallLevel, 1.19), repair = itemCost("repair");
      const next = troopTiers[state.troopTier + 1];
      const tier = (next && next.kind === "gravity" ? 5 : 1) * 350 * Math.pow(3, state.troopTier);
      document.getElementById("autoCost").textContent = state.autoLevel >= 10 ? `MAX · ${autoDelay()}ms` : `Lv.${state.autoLevel}/10 · ${fmt(auto)}💰 · 다음 ${state.autoLevel ? fmt(autoDelay()) + "ms" : "10s"}`;
      document.getElementById("mineCost").textContent = state.mineLevel >= 99 ? "MAX" : `Lv.${state.mineLevel}/99 · ${fmt(mineC)}💰 ${fmt(mineC/2)}🪨`;
      document.getElementById("robotCost").textContent = state.robotLevel >= 20 ? "MAX" : `+${state.robotLevel}/20 · ${fmt(robot)}💰 ${fmt(robot/2)}⛏️ · 왕복 채굴 x4`;
      document.getElementById("merchantCost").textContent = (state.merchantLevel || 0) >= 10 ? "MAX" : `+${state.merchantLevel || 0}/10 · ${fmt(merchant)}💰 · 시장 획득률 +${Math.round(((state.merchantLevel || 0) + 1) * 10)}%`;
      document.getElementById("troopCost").textContent = state.troopBoost >= 99 ? "MAX" : `무기Lv.${state.troopBoost}/99 · ${fmt(troop)}💰 ${fmt(troop/3)}🪵`;
      document.getElementById("wallCost").textContent = state.wallLevel >= 99 ? "MAX" : `Lv.${state.wallLevel}/99 · ${fmt(wall)}🪨 ${fmt(wall/2)}💰`;
      document.getElementById("repairBuyCost").textContent = `보유 ${fmt(state.inventory.repair)}개 · ${fmt(repair)}💰`;
      document.getElementById("mineItemCost").textContent = `보유 ${fmt(state.inventory.mine)}개 · ${fmt(itemCost("mine"))}💰`;
      document.getElementById("missileCost").textContent = `보유 ${fmt(state.inventory.missile)}개 · ${fmt(itemCost("missile"))}💰 · 피해 ${fmt(missileDamage())}`;
      document.getElementById("nukeCost").textContent = `보유 ${fmt(state.inventory.nuke)}개/2 · ${fmt(itemCost("nuke"))}💰 · 범위 x7`;
      document.getElementById("overtimeCost").textContent = `보유 ${fmt(state.inventory.overtime)}개 · ${fmt(itemCost("overtime"))}💰 · 60s 채굴 x2`;
      document.getElementById("laserCost").textContent = `보유 ${fmt(state.inventory.laser)}개 · ${fmt(itemCost("laser"))}💰 · HP 50%↑ 25% / 50%↓ 13%`;
      document.getElementById("thundererCost").textContent = `보유 ${fmt(state.inventory.thunderer)}개 · ${fmt(itemCost("thunderer"))}💰 · 5기/0.6s`;
      document.getElementById("windyCost").textContent = `보유 ${fmt(state.inventory.windy)}개 · ${fmt(itemCost("windy"))}💰 · 전체 5s`;
      document.getElementById("tierCost").innerHTML = weaponEvolutionCostHtml(next, tier);
      document.getElementById("autoBtn").disabled = state.autoLevel >= 10 || state.gold < auto;
      document.getElementById("mineBtn").disabled = state.mineLevel >= 99 || state.gold < mineC || state.stone < mineC / 2;
      document.getElementById("robotBtn").disabled = state.robotLevel >= 20 || state.gold < robot || state.ore < robot / 2;
      document.getElementById("merchantBtn").disabled = (state.merchantLevel || 0) >= 10 || state.gold < merchant;
      document.getElementById("troopBtn").disabled = state.troopBoost >= 99 || state.gold < troop || state.wood < troop / 3;
      document.getElementById("wallBtn").disabled = state.wallLevel >= 99 || state.stone < wall || state.gold < wall / 2;
      document.getElementById("repairBuyBtn").disabled = state.gold < repair;
      document.getElementById("mineItemBuyBtn").disabled = state.gold < itemCost("mine");
      document.getElementById("missileBuyBtn").disabled = state.gold < itemCost("missile");
      document.getElementById("nukeBuyBtn").disabled = (state.inventory.nuke || 0) >= 2 || state.gold < itemCost("nuke");
      document.getElementById("overtimeBuyBtn").disabled = state.gold < itemCost("overtime");
      document.getElementById("laserBuyBtn").disabled = state.gold < itemCost("laser");
      document.getElementById("thundererBuyBtn").disabled = state.gold < itemCost("thunderer");
      document.getElementById("windyBuyBtn").disabled = state.gold < itemCost("windy");
      document.getElementById("tierBtn").disabled = !!state.weaponEvolution || !next || state.troopBoost < next.req || state.gold < tier;
      renderQuickSlots();
      renderInventory();
    }

    function renderQuickSlots() {
      const box = document.getElementById("quickSlots");
      if (!running) return;
      ensureInventoryItems();
      const signature = JSON.stringify({ slots: state.quickSlots, inventory: state.inventory });
      if (signature === quickSlotsSignature) return;
      quickSlotsSignature = signature;
      box.innerHTML = state.quickSlots.map((type, idx) => {
        const item = itemData[type];
        return `<button class="quickSlot" data-slot="${idx}" ${item && !state.inventory[type] ? "disabled" : ""}>${item ? `${item.emoji}<br>${item.name} x${fmt(state.inventory[type] || 0)}` : `슬롯 ${idx + 1}<br>비어있음`}</button>`;
      }).join("");
    }
    function renderInventory() {
      const box = document.getElementById("inventoryList");
      if (!running || !box) return;
      if (document.getElementById("inventoryModal").classList.contains("hidden")) return;
      ensureInventoryItems();
      const signature = JSON.stringify({ inventory: state.inventory, slots: state.quickSlots });
      if (signature === inventorySignature) return;
      inventorySignature = signature;
      box.innerHTML = Object.entries(itemData).map(([type, item]) => `
        <div class="inventoryItem">
          <h3>${item.emoji} ${item.name} x${fmt(state.inventory[type] || 0)}</h3>
          <div>${item.desc}</div>
          <button data-use="${type}">사용</button>
          ${[0,1,2,3].map(i => `<button data-fav="${type}:${i}">슬롯${i + 1}</button>`).join("")}
        </div>
      `).join("");
    }
    function sortRankingRows(rows) {
      return rows.sort((a, b) =>
        (Number(b.wave) || 0) - (Number(a.wave) || 0) ||
        (Number(b.kills) || 0) - (Number(a.kills) || 0) ||
        (Number(b.clicks) || 0) - (Number(a.clicks) || 0) ||
        (Number(b.duration_seconds) || 0) - (Number(a.duration_seconds) || 0)
      );
    }
    function loadLocalRankings() {
      const raw = localStorage.getItem(RANKING_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) throw new Error("local ranking data is not an array");
      return sortRankingRows(parsed.filter(row => row && typeof row === "object"));
    }
    function saveLocalRanking(payload) {
      const row = { ...payload, finished_at: new Date().toISOString() };
      const rows = sortRankingRows([...loadLocalRankings(), row]).slice(0, 100);
      localStorage.setItem(RANKING_STORAGE_KEY, JSON.stringify(rows));
      return row;
    }
    function renderRankingTable(rows) {
      return `<table><thead><tr><th>#</th><th>닉네임</th><th>Wave</th><th>Kill</th><th>HRC</th><th>클릭</th></tr></thead><tbody>${rows.map((r, i) => `<tr><td>${i + 1}</td><td>${escapeHtml(r.nickname)}</td><td>${escapeHtml(r.wave)}</td><td>${escapeHtml(r.kills)}</td><td>${escapeHtml(r.hrc)}</td><td>${escapeHtml(r.clicks)}</td></tr>`).join("") || "<tr><td colspan='6'>기록 없음</td></tr>"}</tbody></table>`;
    }
    function buyAuto() { const p = upgradeCost(90, state.autoLevel, 1.25); if (state.autoLevel < 10 && state.gold >= p) { state.gold -= p; state.autoLevel++; log(`🤖 자동 클릭 Lv.${state.autoLevel} · ${autoDelay()}ms`); } }
    function buyMine() { const p = upgradeCost(65, state.mineLevel, 1.18); if (state.mineLevel < 99 && state.gold >= p && state.stone >= p/2) { state.gold -= p; state.stone -= p/2; state.mineLevel++; log(`⛏️ 채굴 강화 Lv.${state.mineLevel}`); } }
    function buyRobot() {
      const p = robotUpgradeCost();
      if (state.robotLevel < 20 && state.gold >= p && state.ore >= p/2) {
        state.gold -= p; state.ore -= p/2; state.robotLevel++; ensureWorkers(); sound.play("robot_work"); log(`🦾 채굴 로봇 +${state.robotLevel}`);
      }
    }
    function buyMerchant() {
      const p = merchantUpgradeCost();
      if ((state.merchantLevel || 0) < 10 && state.gold >= p) {
        state.gold -= p; state.merchantLevel = (state.merchantLevel || 0) + 1; ensureWorkers(); log(`🧙 업그레이드 상인 +${state.merchantLevel}`);
      }
    }
    function buyTroop() { const p = upgradeCost(120, state.troopBoost, 1.19); if (state.troopBoost < 99 && state.gold >= p && state.wood >= p/3) { state.gold -= p; state.wood -= p/3; state.troopBoost++; log(`⚔️ 무기 강화 Lv.${state.troopBoost}`); } }
    function buyTier() {
      if (state.weaponEvolution) return;
      const next = troopTiers[state.troopTier + 1];
      const p = (next && next.kind === "gravity" ? 5 : 1) * 350 * Math.pow(3, state.troopTier);
      if (next && state.troopBoost >= next.req && state.gold >= p) {
        const targetTier = state.troopTier + 1;
        const now = performance.now();
        state.gold -= p;
        state.weaponEvolution = { targetTier, startedAt: now, endsAt: now + weaponEvolutionDuration(targetTier) };
        log(`${weaponDisplayEmoji(targetTier)} ${next.name} 무기 진화 시작 · ${timeText(weaponEvolutionDuration(targetTier))}`);
      } else if (next) {
        log(`⚠️ ${next.name} 진화 조건: 무기 강화 Lv.${next.req}`);
      }
    }
    function buyWall() { const p = upgradeCost(150, state.wallLevel, 1.19); if (state.wallLevel < 99 && state.stone >= p && state.gold >= p/2) { state.stone -= p; state.gold -= p/2; state.wallLevel++; state.walls.forEach(w => { w.maxHp += 160 + state.hrc * 18; w.hp = w.maxHp; }); log(`🧱 모든 성벽 강화 Lv.${state.wallLevel}`); } }
    function buyItem(type) {
      ensureInventoryItems();
      const p = itemCost(type);
      if (type === "nuke" && (state.inventory.nuke || 0) >= 2) return;
      if (state.gold >= p) {
        state.gold -= p;
        state.inventory[type] = (state.inventory[type] || 0) + 1;
        if (type === "nuke") state.nukeBought = (state.nukeBought || 0) + 1;
        quickSlotsSignature = "";
        inventorySignature = "";
        log(`${itemData[type].emoji} ${itemData[type].name} 구매`);
      }
    }
    function applyAdminInfinite() {
      if (!state.inventory || !state.walls) return;
      state.adminInfinite = true;
      state.wood = Infinity; state.stone = Infinity; state.ore = Infinity; state.gold = Infinity; state.troops = Infinity; state.hrc = Infinity;
      state.castleHp = Infinity; state.castleMaxHp = Infinity;
      Object.keys(state.inventory).forEach(type => { state.inventory[type] = Infinity; });
      state.walls.forEach(w => { w.hp = Infinity; w.maxHp = Infinity; });
      quickSlotsSignature = "";
      inventorySignature = "";
      log("∞ 관리자 모드: 자원과 체력이 무한입니다.");
      sound.play("admin_cheat");
    }
    window.IamAdmin = key => {
      if (normalizeAdminKey(key) !== ADMIN_KEY) return false;
      adminUnlocked = true;
      applyAdminInfinite();
      return true;
    };
    window.cowkim = ADMIN_KEY;

    function manualAttackFrom(point) {
      const weapon = currentWeapon();
      const angle = Math.atan2(point.y, point.x);
      const from = { x: Math.cos(angle) * wallRadius(), y: Math.sin(angle) * wallRadius() };
      const critical = Math.random() < 0.14;
      const damage = troopDamage() * (critical ? 3.5 : 1);
      if (weapon.kind === "lightning") {
        const radius = 64;
        state.lightningBolts.push(makeLightningBolt(from.x, from.y, point.x, point.y, { born: performance.now(), life: 1500, mode: "chain" }));
        for (const enemy of state.enemies) {
          if (enemy.hp > 0 && Math.hypot(enemy.x - point.x, enemy.y - point.y) <= radius) enemy.hp -= Math.max(1, damage - enemy.def);
        }
        for (const village of [...state.villages]) {
          if (Math.hypot(village.x - point.x, village.y - point.y) <= radius) damageVillage(village, damage);
        }
        triggerMagic(point.x, point.y);
        playWeaponSound(weapon.kind);
        return;
      }
      queueProjectileShot(point.x, point.y, damage, from, weapon, critical ? "💥" : weapon.emoji);
    }

    function handleCanvasClick(e) {
      if (!running || paused || state.ended || dragging) return;
      state.clicks++;
      const w = screenToWorld(e.clientX, e.clientY);
      if (activeItem) {
        if (activeItem === "missile") {
          launchMissile(w.x, w.y);
          consumeItem("missile");
          return;
        }
        if (activeItem === "nuke") {
          launchNuke(w.x, w.y);
          consumeItem("nuke");
          return;
        }
        if (activeItem === "mine") {
          state.mines.push({ x: w.x, y: w.y });
          addEffect(w.x, w.y, "💣 설치", "#ffde66", 22);
          consumeItem("mine");
          return;
        }
        const wall = getWallAtWorld(w.x, w.y);
        if (activeItem === "repair" && wall && state.inventory.repair > 0) {
          wall.hp = Math.min(wall.maxHp, wall.hp + Math.floor(wall.maxHp * .5));
          consumeItem("repair");
          addEffect(Math.cos((wall.index + .5) / state.walls.length * Math.PI * 2) * wallRadius(), Math.sin((wall.index + .5) / state.walls.length * Math.PI * 2) * wallRadius(), "🔨 +50%", "#9dff7e", 24);
          log(`🔨 ${wall.index + 1}번 성벽 50% 수리`);
        }
        return;
      }
      for (const b of buildings) {
        if (Math.hypot(b.x - w.x, b.y - w.y) < b.r + 18) { clickBuilding(b); return; }
      }
      if (Math.hypot(w.x, w.y) < 82) {
        state.selected = "castle";
        const heal = 15 * hrcMult() * state.wallLevel;
        state.castleHp = Math.min(state.castleMaxHp, state.castleHp + heal);
        addEffect(0, -80, `🏰+${fmt(heal)}`, "#9dff7e", 20);
        return;
      }
      manualAttackFrom(w);
    }

    async function finishGame() {
      if (state.ended) return;
      state.ended = true; running = false; paused = false; pauseStarted = 0;
      closeModals();
      const payload = {
        nickname: state.adminInfinite ? ADMIN_RECORD_NAME : state.nickname, started_at: new Date(state.startTime).toISOString(),
        duration_seconds: Math.floor((Date.now() - state.startTime) / 1000),
        wood: finiteRecordNumber(state.wood), stone: finiteRecordNumber(state.stone), ore: finiteRecordNumber(state.ore), gold: finiteRecordNumber(state.gold),
        troops: finiteRecordNumber(state.troops), kills: state.kills, clicks: state.clicks, hrc: state.adminInfinite ? "∞" : state.hrc >= 81 ? "HRC-MAX" : String(state.hrc), wave: state.wave
      };
      let rankingSaveError = "";
      try {
        saveLocalRanking(payload);
      } catch (error) {
        rankingSaveError = error instanceof Error ? error.message : String(error);
        console.error("랭킹 저장 실패:", error);
      }
      document.getElementById("endStats").innerHTML = Object.entries({
        "👤 닉네임": payload.nickname, "⏱️ 생존": `${payload.duration_seconds}s`, "🌊 웨이브": payload.wave, "☠️ 처치": payload.kills,
        "🖱️ 클릭": payload.clicks, "🔥 HRC": payload.hrc, "💰 금화": fmt(payload.gold), "🧑‍✈️ 병력": fmt(payload.troops),
        "🪵 나무": fmt(payload.wood), "🪨 돌": fmt(payload.stone), "⛏️ 원석": fmt(payload.ore)
      }).map(([k, v]) => `<div class="endStat"><strong>${k}</strong><br>${v}</div>`).join("") +
        (rankingSaveError ? `<div class="endStat"><strong>🏆 랭킹 저장 실패</strong><br>${escapeHtml(rankingSaveError)}</div>` : "");
      document.getElementById("destroyScreen").classList.remove("hidden");
    }

    async function showRanking() {
      document.getElementById("rankScreen").classList.remove("hidden");
      const box = document.getElementById("rankContent");
      try {
        const rows = loadLocalRankings().slice(0, 20);
        box.innerHTML = renderRankingTable(rows);
      } catch (error) {
        console.error("랭킹 조회 실패:", error);
        box.textContent = `랭킹을 불러오지 못했습니다: ${error instanceof Error ? error.message : String(error)}`;
      }
    }

    function loop(now) {
      const dt = Math.min(45, now - lastFrame || 16); lastFrame = now;
      if (running && !paused && !state.ended) {
        updateWeaponEvolution(now); updateWave(now); updateMissiles(now); updateThunderer(now); updateWindy(now); updateWorkers(now); updateEnemies(dt); updateCombat(now); updateAuto(now);
        if (state.castleHp <= 0) finishGame();
      }
      render(); updateUI();
      requestAnimationFrame(loop);
    }

    canvas.addEventListener("pointerdown", e => { dragging = false; dragStart = { x: e.clientX, y: e.clientY, cx: camera.x, cy: camera.y }; canvas.classList.add("dragging"); });
    canvas.addEventListener("pointermove", e => {
      lastPointer = { x: e.clientX, y: e.clientY };
      updateItemCursor();
      if (!dragStart) return;
      const dx = e.clientX - dragStart.x, dy = e.clientY - dragStart.y;
      if (Math.hypot(dx, dy) > 4) dragging = true;
      camera.x = dragStart.cx + dx; camera.y = dragStart.cy + dy;
    });
    canvas.addEventListener("pointerup", e => { canvas.classList.remove("dragging"); const wasDragging = dragging; dragStart = null; setTimeout(() => { dragging = false; }, 0); if (!wasDragging) handleCanvasClick(e); });
    canvas.addEventListener("pointerleave", () => { lastPointer = null; updateItemCursor(); dragStart = null; canvas.classList.remove("dragging"); });
    canvas.addEventListener("wheel", e => {
      e.preventDefault();
      const factor = e.deltaY > 0 ? 0.9 : 1.1;
      setZoom(camera.zoom * factor, e.clientX, e.clientY);
    }, { passive: false });
    addEventListener("resize", resize);

    document.getElementById("startBtn").onclick = () => document.getElementById("startModal").classList.remove("hidden");
    document.getElementById("startCloseBtn").onclick = () => document.getElementById("startModal").classList.add("hidden");
    document.querySelectorAll("[data-difficulty]").forEach(btn => btn.onclick = () => {
      selectedDifficulty = btn.dataset.difficulty;
      document.querySelectorAll("[data-difficulty]").forEach(b => b.classList.toggle("selected", b === btn));
    });
    document.getElementById("confirmStartBtn").onclick = () => {
      const nick = document.getElementById("nickname").value.trim();
      if (!nick) { alert("닉네임을 입력해주세요."); return; }
      document.getElementById("introScreen").classList.add("hidden");
      document.getElementById("startModal").classList.add("hidden");
      resetGame(nick, selectedDifficulty);
    };
    document.getElementById("rankBtn").onclick = showRanking;
    document.getElementById("rankCloseBtn").onclick = () => document.getElementById("rankScreen").classList.add("hidden");
    document.getElementById("endBtn").onclick = () => {
      document.getElementById("destroyScreen").classList.add("hidden");
      closeModals();
      document.getElementById("introScreen").classList.remove("hidden");
    };
    document.getElementById("autoBtn").onclick = buyAuto;
    document.getElementById("mineBtn").onclick = buyMine;
    document.getElementById("robotBtn").onclick = buyRobot;
    document.getElementById("merchantBtn").onclick = buyMerchant;
    document.getElementById("troopBtn").onclick = buyTroop;
    document.getElementById("tierBtn").onclick = buyTier;
    document.getElementById("wallBtn").onclick = buyWall;
    document.getElementById("openShopBtn").onclick = () => document.getElementById("shopModal").classList.remove("hidden");
    document.getElementById("openInventoryBtn").onclick = () => { document.getElementById("inventoryModal").classList.remove("hidden"); renderInventory(); };
    document.getElementById("quickSlots").addEventListener("pointerdown", e => {
      const btn = e.target.closest(".quickSlot");
      if (!btn || btn.disabled) return;
      e.preventDefault();
      const type = state.quickSlots[Number(btn.dataset.slot)];
      if (type) useItem(type);
    });
    addEventListener("keydown", e => {
      if (e.key === "Escape") {
        const shopModal = document.getElementById("shopModal");
        const inventoryModal = document.getElementById("inventoryModal");
        const shouldClose = !shopModal.classList.contains("hidden") || !inventoryModal.classList.contains("hidden");
        if (shouldClose) {
          shopModal.classList.add("hidden");
          inventoryModal.classList.add("hidden");
          e.preventDefault();
          return;
        }
      }
      if (!running || state.ended || e.repeat) return;
      if (!["1", "2", "3", "4"].includes(e.key)) return;
      if (["INPUT", "TEXTAREA", "BUTTON"].includes(document.activeElement?.tagName)) return;
      const type = state.quickSlots[Number(e.key) - 1];
      if (type && state.inventory[type] > 0) useItem(type);
    });
    document.getElementById("inventoryList").addEventListener("pointerdown", e => {
      const useBtn = e.target.closest("[data-use]");
      if (useBtn) {
        e.preventDefault();
        useItem(useBtn.dataset.use);
        return;
      }
      const favBtn = e.target.closest("[data-fav]");
      if (favBtn) {
        e.preventDefault();
        const [type, idx] = favBtn.dataset.fav.split(":");
        state.quickSlots[Number(idx)] = type;
        quickSlotsSignature = "";
        inventorySignature = "";
        renderQuickSlots();
        renderInventory();
        log(`${itemData[type].emoji} ${itemData[type].name} 슬롯 ${Number(idx) + 1} 지정`);
      }
    });
    document.getElementById("zoomOutBtn").onclick = () => setZoom(camera.zoom * 0.9);
    document.getElementById("zoomInBtn").onclick = () => setZoom(camera.zoom * 1.1);
    document.getElementById("settingsBtn").onclick = () => {
      if (running && !state.ended) document.getElementById("settingsModal").classList.remove("hidden");
    };
    document.getElementById("settingsCloseBtn").onclick = () => document.getElementById("settingsModal").classList.add("hidden");
    document.getElementById("pauseBtn").onclick = togglePause;
    document.getElementById("quitBtn").onclick = () => {
      if (running && !state.ended) finishGame();
    };
    document.getElementById("shopCloseBtn").onclick = () => document.getElementById("shopModal").classList.add("hidden");
    document.getElementById("inventoryCloseBtn").onclick = () => document.getElementById("inventoryModal").classList.add("hidden");
    document.getElementById("repairBuyBtn").onclick = () => buyItem("repair");
    document.getElementById("mineItemBuyBtn").onclick = () => buyItem("mine");
    document.getElementById("missileBuyBtn").onclick = () => buyItem("missile");
    document.getElementById("nukeBuyBtn").onclick = () => buyItem("nuke");
    document.getElementById("overtimeBuyBtn").onclick = () => buyItem("overtime");
    document.getElementById("laserBuyBtn").onclick = () => buyItem("laser");
    document.getElementById("thundererBuyBtn").onclick = () => buyItem("thunderer");
    document.getElementById("windyBuyBtn").onclick = () => buyItem("windy");

    Object.assign(window, {
      state,
      gameState: state,
      camera,
      workerHomePoint,
      robotPosition,
      ensureWorkers,
      manualAttackFrom,
      buildingPreview,
      buyRobot,
      buyMerchant,
      buyTier,
      robotUpgradeCost,
      merchantUpgradeCost,
      weaponEvolutionDuration,
      robotWorkVolume,
      wallTextureReady: () => wallTexture.complete && wallTexture.naturalWidth > 0,
      sound,
      buyItem,
      useItem
    });

    resize();
    requestAnimationFrame(loop);
}
