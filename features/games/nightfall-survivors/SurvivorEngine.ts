import { CHARACTERS, EVOLUTIONS, LEVEL_COOLDOWN, LEVEL_DAMAGE, LEVEL_SIZE, PASSIVES, TAROTS, WEAPONS, xpForLevel } from "./data";
import { NightfallAssets, type NightfallSprite } from "./assets";
import { BOSS_ORDER, BOSS_STATS, ENEMY_STATS } from "./enemies";
import { MISSION_IDS, MISSIONS } from "./missions";
import { ACTIVE_SKILL_IDS, ACTIVE_SKILLS } from "./activeSkills";
import { CHARACTER_WEAPON_POOLS } from "./classPools";
import { isSignatureSkill, SIGNATURE_SKILLS, type SignatureSkillId } from "./classSkills";
import { BONE_DRAGON, isNecromancerSummon, NECROMANCER_SUMMONS, SUMMON_SPRITES } from "./necromancerSummons";
import { ELEMENT_COMBOS, isElementComboKey } from "./elementCombos";
import { CLASS_ULTIMATES, ULTIMATE_CHARGE_SECONDS } from "./classUltimates";
import { STAGE_BOSS_AT, STAGE_DURATION, STAGES, stageAt, type StageTransitionInfo, type StoryScene } from "./stages";
import {
  ARENA_HEIGHT, ARENA_WIDTH,
  type ActiveSkillId, type BossVariant, type CharacterId, type DamageNumber, type Effect, type ElementComboKey, type ElementId, type Enemy, type EnemyKind, type Gem, type HostileProjectile,
  type ItemLevels, type MissionId, type Obstacle, type Particle, type PassiveId, type Player, type Projectile, type Summon, type Supply, type SupplyKind, type SurvivorHud, type SurvivorInput,
  type TarotId, type UpgradeId, type UpgradeOption, type WeaponId,
} from "./types";

type NightSound = "attack" | "frost" | "holy" | "gem" | "level" | "hurt" | "evolve" | "death";
type UltimateAltar = { id: number; x: number; y: number; consumed: boolean };
type Callbacks = {
  onHud: (hud: SurvivorHud) => void;
  onUpgrade: (options: UpgradeOption[]) => void;
  onTarot: (options: TarotId[]) => void;
  onNotice: (title: string, detail: string) => void;
  onDialogue: (scene: StoryScene) => void;
  onStageTransition: (transition: StageTransitionInfo) => void;
  onSound: (sound: NightSound) => void;
  onEnd: (score: number) => void;
  onVictory: (score: number) => void;
};

const WEAPON_IDS = Object.keys(WEAPONS) as WeaponId[];
const PASSIVE_IDS = Object.keys(PASSIVES) as PassiveId[];
const TAROT_IDS = Object.keys(TAROTS) as TarotId[];
const MAX_EFFECTS = 80;
const MAX_PARTICLES = 220;
const MAX_DAMAGE_NUMBERS = 60;
const MAX_GEMS = 120;
const MAX_PROJECTILES = 180;
const MAX_HOSTILE_PROJECTILES = 220;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const distance = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
const distanceSquared = (a: { x: number; y: number }, b: { x: number; y: number }) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
const gridCellKey = (x: number, y: number) => x * 1_000_003 + y;
const ENEMY_NAMES: Record<Exclude<EnemyKind, "boss">, string> = {
  shade: "余烬暗影", wolf: "夜行魔狼", spider: "猩红毒蛛", brute: "墓园巨怪", cultist: "深渊教徒",
  slime: "腐化黏液", wraith: "永夜怨灵", demon: "炼狱恶魔", knight: "失落骑士",
};
const SUPPLY_NAMES: Record<SupplyKind, string> = { heal: "生命圣泉", magnet: "灵魂磁石" };
const ELEMENT_GENERATION: Record<ElementId, ElementId> = { metal: "water", water: "wood", wood: "fire", fire: "earth", earth: "metal" };
const ELEMENT_NAMES: Record<ElementId, string> = { metal: "金", wood: "木", water: "水", fire: "火", earth: "土" };
const isElementWeapon = (id: WeaponId): id is ElementId => id === "metal" || id === "wood" || id === "water" || id === "fire" || id === "earth";

export class SurvivorEngine {
  private player: Player;
  private weapons: ItemLevels = {};
  private passives: ItemLevels = {};
  private evolved = new Set<WeaponId>();
  private tarots = new Set<TarotId>();
  private cooldowns: ItemLevels = {};
  private summonCooldownPending = new Set<WeaponId>();
  private enemies: Enemy[] = [];
  private pendingSpawns: Array<{ kind: EnemyKind; x: number; y: number }> = [];
  private projectiles: Projectile[] = [];
  private summons: Summon[] = [];
  private hostileProjectiles: HostileProjectile[] = [];
  private gems: Gem[] = [];
  private supplies: Supply[] = [];
  private obstacles: Obstacle[] = [];
  private effects: Effect[] = [];
  private particles: Particle[] = [];
  private particlePool: Particle[] = [];
  private damageNumbers: DamageNumber[] = [];
  private damageNumberPool: DamageNumber[] = [];
  private assets = new NightfallAssets();
  private floorPattern: CanvasPattern | null = null;
  private floorPatternStage = -1;
  private axeHitAt = new Map<number, number>();
  private enemyById = new Map<number, Enemy>();
  private enemyGrid = new Map<number, Enemy[]>();
  private enemyGridPool: Enemy[][] = [];
  private elapsed = 0;
  private level = 1;
  private xp = 0;
  private nextXp = xpForLevel(1);
  private kills = 0;
  private completedMissions = new Set<MissionId>();
  private activeSkillCharges: Partial<Record<ActiveSkillId, number>> = {};
  private spawnCooldown = 0.65;
  private nextMiniBossAt = 60;
  private miniBossCount = 0;
  private nextHordeAt = 90;
  private hordeRemaining = 0;
  private hordeIndex = 0;
  private hordeWarned = false;
  private tarotStage = 0;
  private pendingLevel = false;
  private paused = false;
  private ended = false;
  private id = 0;
  private hudCooldown = 0;
  private hermitBuff = 0;
  private foolMilestone = 100;
  private screenShake = 0;
  private paladinHealTimer = 0;
  private loversHealTimer = 0;
  private combo = 0;
  private comboTime = 0;
  private nextComboFever = 12;
  private feverRemaining = 0;
  private nextBountyAt = 30;
  private bountyCount = 0;
  private activeBountyId: number | null = null;
  private bountyRemaining = 0;
  private bountyName: string | null = null;
  private nextSupplyKill = 18;
  private screenFlash = 0;
  private screenFlashDuration = 0;
  private screenFlashColor = "#ffffff";
  private bulkDamage = false;
  private poisonTickCooldown = 0;
  private lastElement: ElementId | null = null;
  private lastElementTime = 0;
  private lastElementPoint = { x: 0, y: 0 };
  private elementComboName: string | null = null;
  private elementComboTime = 0;
  private elementComboCooldown = 0;
  private stageIndex = 0;
  private stageElapsed = 0;
  private stageBossSpawned = false;
  private storyStarted = false;
  private pendingVictory = false;
  private pendingStageAdvance = false;
  private ultimateCharge = 0;
  private ultimateActiveUntil = 0;
  private ultimateAltars: UltimateAltar[] = [];
  private dragonCooldown = 0;
  private stageDialogueShown = new Set<number>();
  private frameIndex = 0;
  private frameTimeAverage = 1 / 60;
  private lowFpsTime = 0;
  private adaptiveLowDetail = false;
  private hitFeedbackBudget = 0;
  private hitFlashBudget = 0;
  private deathFeedbackBudget = 0;
  private effectVfxBudget = Number.POSITIVE_INFINITY;
  private renderLowDetail = false;
  private densestCache: Enemy | null = null;
  private densestCacheUntil = 0;
  private densityCandidates: Enemy[] = [];
  private gemSoundCooldown = 0;
  private gemMagnetTime = 0;
  private altar: { x: number; y: number; charge: number } | null = null;
  private nextAltarAt = 42;
  private altarBuff = 0;
  private endlessBlessings = 0;
  private stageKills = 0;
  private stageUpgradeCount = 0;
  private stageStartLevel = 1;
  private stageMiniBossKills = 0;
  private stageHordesDefeated = 0;
  private unlockedActiveSkills = new Set<ActiveSkillId>();

  constructor(private context: CanvasRenderingContext2D, private characterId: CharacterId, private callbacks: Callbacks) {
    const character = CHARACTERS[characterId];
    const maxHp = 100 * character.hpMultiplier;
    this.player = { x: 0, y: 0, radius: 18, facingX: 1, facingY: 0, hp: maxHp, maxHp, baseSpeed: 175 * character.speedMultiplier, invulnerable: 1.5, shield: false, idleTime: 0 };
    this.weapons[character.weapon] = 1;
    this.cooldowns[character.weapon] = 0.15;
    this.createStageObstacles(0);
    this.createUltimateAltars(0);
    this.emitHud();
  }

  setPaused(paused: boolean) { this.paused = paused; }

  private createStageObstacles(stageIndex: number) {
    const layouts: Array<Array<[number, number, number, NightfallSprite, string, string]>> = [
      [
        [-330, -155, 34, "stone", "sepia(1) saturate(1.25) hue-rotate(340deg) brightness(.72) contrast(1.2)", "#d98e55"],
        [-125, -210, 30, "rubble", "sepia(1) saturate(1.1) hue-rotate(335deg) brightness(.65) contrast(1.2)", "#bd754b"],
        [160, -175, 38, "stone", "sepia(1) saturate(1.3) hue-rotate(340deg) brightness(.7) contrast(1.2)", "#e4a15a"],
        [325, -35, 32, "rubble", "sepia(1) saturate(1.25) hue-rotate(335deg) brightness(.65) contrast(1.2)", "#c8784b"],
        [-285, 70, 42, "stone", "sepia(1) saturate(1.25) hue-rotate(340deg) brightness(.7) contrast(1.2)", "#d98e55"],
        [220, 100, 34, "rubble", "sepia(1) saturate(1.15) hue-rotate(335deg) brightness(.65) contrast(1.2)", "#c8784b"],
        [-80, 220, 36, "stone", "sepia(1) saturate(1.3) hue-rotate(340deg) brightness(.7) contrast(1.2)", "#e4a15a"],
      ],
      [
        [-330, -145, 34, "stageTree", "sepia(.35) saturate(1.5) hue-rotate(75deg) brightness(.58) contrast(1.2)", "#4cd66d"],
        [-120, -205, 30, "stageTree", "sepia(.25) saturate(1.4) hue-rotate(75deg) brightness(.62) contrast(1.2)", "#6ee678"],
        [165, -170, 38, "stageTree", "sepia(.25) saturate(1.5) hue-rotate(80deg) brightness(.55) contrast(1.2)", "#41c968"],
        [320, -45, 30, "stageTree", "sepia(.3) saturate(1.5) hue-rotate(75deg) brightness(.58) contrast(1.2)", "#6ee678"],
        [-275, 95, 40, "stageTree", "sepia(.3) saturate(1.45) hue-rotate(78deg) brightness(.56) contrast(1.2)", "#4cd66d"],
        [225, 110, 34, "stageTree", "sepia(.25) saturate(1.5) hue-rotate(80deg) brightness(.58) contrast(1.2)", "#41c968"],
        [-70, 225, 36, "stageTree", "sepia(.25) saturate(1.45) hue-rotate(75deg) brightness(.58) contrast(1.2)", "#6ee678"],
      ],
      [
        [-330, -150, 36, "stone", "grayscale(.25) sepia(.8) saturate(2.1) hue-rotate(315deg) brightness(.42) contrast(1.35)", "#e34e37"],
        [-125, -215, 30, "rubble", "grayscale(.2) sepia(.8) saturate(2) hue-rotate(315deg) brightness(.38) contrast(1.35)", "#ff7844"],
        [165, -180, 40, "stone", "grayscale(.25) sepia(.8) saturate(2.1) hue-rotate(315deg) brightness(.42) contrast(1.35)", "#e34e37"],
        [325, -35, 32, "rubble", "grayscale(.2) sepia(.8) saturate(2) hue-rotate(315deg) brightness(.38) contrast(1.35)", "#ff7844"],
        [-275, 90, 42, "stone", "grayscale(.25) sepia(.8) saturate(2.1) hue-rotate(315deg) brightness(.42) contrast(1.35)", "#e34e37"],
        [225, 120, 34, "rubble", "grayscale(.2) sepia(.8) saturate(2) hue-rotate(315deg) brightness(.38) contrast(1.35)", "#ff7844"],
        [-75, 225, 36, "stone", "grayscale(.25) sepia(.8) saturate(2.1) hue-rotate(315deg) brightness(.42) contrast(1.35)", "#e34e37"],
      ],
      [
        [-330, -150, 40, "rune", "sepia(1) saturate(6) hue-rotate(140deg) brightness(.8) contrast(1.3)", "#74eaff"],
        [-125, -215, 32, "stone", "grayscale(.2) saturate(2) hue-rotate(145deg) brightness(.62) contrast(1.35)", "#b8f5ff"],
        [165, -180, 44, "rune", "sepia(1) saturate(6) hue-rotate(140deg) brightness(.8) contrast(1.3)", "#74eaff"],
        [325, -35, 34, "stone", "grayscale(.2) saturate(2) hue-rotate(145deg) brightness(.62) contrast(1.35)", "#b8f5ff"],
        [-275, 90, 46, "rune", "sepia(1) saturate(6) hue-rotate(140deg) brightness(.8) contrast(1.3)", "#74eaff"],
        [225, 120, 36, "stone", "grayscale(.2) saturate(2) hue-rotate(145deg) brightness(.62) contrast(1.35)", "#b8f5ff"],
        [-75, 225, 40, "rune", "sepia(1) saturate(6) hue-rotate(140deg) brightness(.8) contrast(1.3)", "#74eaff"],
      ],
      [
        [-330, -150, 38, "stageBuilding", "sepia(.35) saturate(1.1) hue-rotate(175deg) brightness(.55) contrast(1.2)", "#e3b56f"],
        [-125, -215, 30, "stageRoadCorner", "grayscale(.25) sepia(.3) saturate(1.2) hue-rotate(175deg) brightness(.58) contrast(1.2)", "#f0c878"],
        [165, -180, 42, "stageBuilding", "sepia(.35) saturate(1.1) hue-rotate(175deg) brightness(.55) contrast(1.2)", "#e3b56f"],
        [325, -35, 34, "rubble", "grayscale(.25) sepia(.3) saturate(1.2) hue-rotate(175deg) brightness(.5) contrast(1.2)", "#f0c878"],
        [-275, 90, 44, "stageBuilding", "sepia(.35) saturate(1.1) hue-rotate(175deg) brightness(.55) contrast(1.2)", "#e3b56f"],
        [225, 120, 36, "stageRoadCorner", "grayscale(.25) sepia(.3) saturate(1.2) hue-rotate(175deg) brightness(.58) contrast(1.2)", "#f0c878"],
        [-75, 225, 40, "rubble", "grayscale(.25) sepia(.3) saturate(1.2) hue-rotate(175deg) brightness(.5) contrast(1.2)", "#e3b56f"],
      ],
      [
        [-330, -150, 36, "stone", "sepia(.7) saturate(1.6) hue-rotate(265deg) brightness(.48) contrast(1.3)", "#e06cff"],
        [-125, -215, 30, "rune", "sepia(1) saturate(5) hue-rotate(270deg) brightness(.72) contrast(1.3)", "#bd76ff"],
        [165, -180, 42, "stone", "sepia(.7) saturate(1.6) hue-rotate(265deg) brightness(.48) contrast(1.3)", "#e06cff"],
        [325, -35, 34, "rune", "sepia(1) saturate(5) hue-rotate(270deg) brightness(.72) contrast(1.3)", "#bd76ff"],
        [-275, 90, 44, "stone", "sepia(.7) saturate(1.6) hue-rotate(265deg) brightness(.48) contrast(1.3)", "#e06cff"],
        [225, 120, 36, "rune", "sepia(1) saturate(5) hue-rotate(270deg) brightness(.72) contrast(1.3)", "#bd76ff"],
        [-75, 225, 40, "stone", "sepia(.7) saturate(1.6) hue-rotate(265deg) brightness(.48) contrast(1.3)", "#e06cff"],
      ],
    ];
    const layout = layouts[Math.max(0, Math.min(layouts.length - 1, stageIndex))];
    this.obstacles = layout.map(([x, y, radius, sprite, filter, accent], index) => ({ id: index, x, y, radius, sprite, filter, accent }));
  }

  private resolveObstacleCollision(entity: { x: number; y: number; radius: number }) {
    this.obstacles.forEach((obstacle) => {
      const dx = entity.x - obstacle.x; const dy = entity.y - obstacle.y; const minimum = entity.radius + obstacle.radius;
      const distanceSq = dx * dx + dy * dy;
      if (distanceSq >= minimum * minimum) return;
      const distanceValue = Math.sqrt(distanceSq) || 0.001; const push = (minimum - distanceValue) / distanceValue;
      entity.x += dx * push; entity.y += dy * push;
    });
  }

  private hitsObstacle(entity: { x: number; y: number; radius: number }) {
    return this.obstacles.some((obstacle) => distanceSquared(entity, obstacle) < (entity.radius + obstacle.radius) ** 2);
  }

  private drawObstacles() {
    const iceStage = stageAt(this.stageIndex).id === "ice";
    this.obstacles.forEach((obstacle) => {
      const p = this.toScreen(obstacle); if (p.x < -100 || p.x > ARENA_WIDTH + 100 || p.y < -100 || p.y > ARENA_HEIGHT + 100) return;
      const context = this.context; context.save(); context.globalAlpha = .32; context.fillStyle = "#071322"; context.shadowColor = "#071322"; context.shadowBlur = 12;
      context.beginPath(); context.ellipse(p.x, p.y + obstacle.radius * .5, obstacle.radius * 1.2, obstacle.radius * .52, 0, 0, Math.PI * 2); context.fill(); context.restore();
      context.save(); context.globalAlpha = .42; context.strokeStyle = "#071322"; context.lineWidth = 7; context.beginPath(); context.arc(p.x, p.y, obstacle.radius + 2, 0, Math.PI * 2); context.stroke(); context.restore();
      if (iceStage) {
        context.save(); context.fillStyle = "#285b79"; context.strokeStyle = "#a9f4ff"; context.shadowColor = "#5edfff"; context.shadowBlur = 16; context.lineWidth = 3;
        context.beginPath(); context.moveTo(p.x, p.y - obstacle.radius * 1.2); context.lineTo(p.x + obstacle.radius * .72, p.y - obstacle.radius * .28);
        context.lineTo(p.x + obstacle.radius * .55, p.y + obstacle.radius * .78); context.lineTo(p.x, p.y + obstacle.radius * 1.02);
        context.lineTo(p.x - obstacle.radius * .68, p.y + obstacle.radius * .48); context.lineTo(p.x - obstacle.radius * .55, p.y - obstacle.radius * .46); context.closePath(); context.fill(); context.stroke();
        context.globalAlpha = .58; context.fillStyle = "#d2fbff"; context.beginPath(); context.moveTo(p.x - obstacle.radius * .2, p.y - obstacle.radius * .92);
        context.lineTo(p.x + obstacle.radius * .2, p.y - obstacle.radius * .42); context.lineTo(p.x - obstacle.radius * .04, p.y + obstacle.radius * .56); context.lineTo(p.x - obstacle.radius * .34, p.y + obstacle.radius * .08); context.closePath(); context.fill(); context.restore();
        this.drawSprite(obstacle.sprite, p.x, p.y + obstacle.radius * .2, obstacle.radius * .72, false, obstacle.filter, .68);
      } else this.drawSprite(obstacle.sprite, p.x, p.y - obstacle.radius * .1, obstacle.radius * 2.35, false, obstacle.filter, .96);
      context.save(); context.globalAlpha = iceStage ? .3 : .42; context.strokeStyle = obstacle.accent; context.shadowColor = obstacle.accent; context.shadowBlur = 7; context.lineWidth = 2;
      context.beginPath(); context.arc(p.x, p.y, obstacle.radius + 5, 0, Math.PI * 2); context.stroke(); context.restore();
    });
  }

  begin() {
    if (this.storyStarted) return;
    this.storyStarted = true; this.paused = true;
    this.callbacks.onDialogue(stageAt(this.stageIndex).intro);
  }

  resumeFromDialogue() {
    if (this.pendingVictory) { this.finishVictory(); return; }
    if (this.pendingStageAdvance) {
      const from = stageAt(this.stageIndex); const to = stageAt(this.stageIndex + 1);
      this.callbacks.onStageTransition({
        from: { id: from.id, chapter: from.chapter, name: from.name, subtitle: from.subtitle, accent: from.palette.accent, base: from.palette.base },
        to: { id: to.id, chapter: to.chapter, name: to.name, subtitle: to.subtitle, accent: to.palette.accent, base: to.palette.base },
      });
      return;
    }
    this.paused = false; this.checkPendingLevel(); this.emitHud();
  }

  completeStageTransition() {
    if (!this.pendingStageAdvance || this.stageIndex >= STAGES.length - 1) return;
    this.pendingStageAdvance = false;
    this.stageIndex += 1; this.stageElapsed = 0; this.stageBossSpawned = false;
    this.createStageObstacles(this.stageIndex);
    this.createUltimateAltars(this.stageIndex);
    this.enemies = []; this.pendingSpawns = []; this.projectiles = []; this.summons = []; this.hostileProjectiles = []; this.effects = []; this.gems = []; this.supplies = [];
    this.axeHitAt.clear(); this.enemyById.clear(); this.enemyGrid.clear(); this.enemyGridPool = [];
    this.activeBountyId = null; this.bountyName = null; this.bountyRemaining = 0; this.nextBountyAt = this.elapsed + 30;
    this.hordeRemaining = 0; this.nextHordeAt = this.elapsed + 90; this.hordeWarned = false;
    this.nextMiniBossAt = 60; this.miniBossCount = 0;
    this.altar = null; this.nextAltarAt = 42; this.altarBuff = 0;
    this.gemMagnetTime = 0;
    this.stageDialogueShown.clear();
    this.completedMissions.clear(); this.stageKills = 0; this.stageUpgradeCount = 0; this.stageStartLevel = this.level; this.stageMiniBossKills = 0; this.stageHordesDefeated = 0;
    this.densestCache = null; this.densestCacheUntil = 0; this.densityCandidates.length = 0;
    this.player.x = 0; this.player.y = 0; this.player.invulnerable = 2; this.floorPattern = null;
    const next = stageAt(this.stageIndex);
    this.emitHud(); this.callbacks.onDialogue(next.intro);
  }

  useActiveSkill(id: ActiveSkillId) {
    const charges = this.activeSkillCharges[id] ?? 0;
    if (charges <= 0 || this.paused || this.ended) return;
    this.activeSkillCharges[id] = charges - 1;
    if (id === "starfall") {
      const targets = this.enemies.filter((enemy) => enemy.hp > 0)
        .sort((left, right) => distanceSquared(left, this.player) - distanceSquared(right, this.player)).slice(0, 40);
      this.bulkDamage = true;
      targets.forEach((enemy, index) => {
        this.hitEnemy(enemy, enemy.kind === "boss" ? enemy.maxHp * .1 : enemy.maxHp * .45, true);
        if (index < 18) this.effects.push({ kind: "meteor", x: enemy.x, y: enemy.y, age: -index * .02, duration: .7, radius: 58, color: "#ff8b55" });
      });
      this.bulkDamage = false;
    } else if (id === "time_stop") {
      this.enemies.forEach((enemy) => { enemy.frozen = Math.max(enemy.frozen, enemy.kind === "boss" ? 2.5 : 5); });
      this.effects.push({ kind: "frost", x: this.player.x, y: this.player.y, age: 0, duration: .9, radius: 480, color: "#24cfff" });
    } else if (id === "sanctuary") {
      this.heal(this.player.maxHp * .5); this.player.shield = true;
      this.effects.push({ kind: "heal", x: this.player.x, y: this.player.y, age: 0, duration: 1, radius: 90, color: "#fff2a0" });
    } else if (id === "magnet") {
      this.gemMagnetTime = Math.max(this.gemMagnetTime, 6);
      this.effects.push({ kind: "shockwave", x: this.player.x, y: this.player.y, age: 0, duration: .8, radius: 560, color: "#9deeff" });
    } else if (id === "holy_bomb") {
      this.releaseHolyBomb();
    } else {
      this.bulkDamage = true;
      this.enemies.forEach((enemy) => this.hitEnemy(enemy, enemy.kind === "boss" ? enemy.maxHp * .28 : enemy.maxHp, true));
      this.bulkDamage = false;
      this.effects.push({ kind: "holy", x: this.player.x, y: this.player.y, age: 0, duration: 1, radius: 520, color: "#ffcc32" });
    }
    this.callbacks.onSound("evolve"); this.callbacks.onNotice(ACTIVE_SKILLS[id].name, "一次性主动技能已释放"); this.emitHud();
  }

  useClassUltimate() {
    if (this.characterId !== "necromancer") { this.useAltarUltimate(); return; }
    if (this.dragonCooldown > 0 || this.paused || this.ended || this.summons.some((summon) => summon.kind === "boneDragon" && summon.ttl > 0)) return;
    this.releaseNecromancerDragon(); this.dragonCooldown = BONE_DRAGON.cooldown;
    this.spawnParticles(this.player.x, this.player.y, "#c790ff", 34); this.screenShake = 13; this.triggerFlash("#9a6fff", .46);
    this.callbacks.onSound("evolve"); this.callbacks.onNotice("终极召唤 · 骷髅巨龙", "骷髅巨龙降临 12 秒 · Q 技能冷却 75 秒"); this.emitHud();
  }

  useAltarUltimate() {
    if (this.ultimateCharge < 1 || this.paused || this.ended || this.isClassUltimateActive()) return;
    const ultimate = CLASS_ULTIMATES[this.characterId];
    this.ultimateCharge = 0;
    this.ultimateActiveUntil = this.elapsed + ultimate.duration;

    if (this.characterId === "paladin") this.releasePaladinUltimate();
    else if (this.characterId === "ranger") this.releaseRangerUltimate();
    else if (this.characterId === "necromancer") this.releaseDeathLegion();
    else if (this.characterId === "mage") this.releaseMageUltimate();
    else this.releaseElfUltimate();

    this.spawnParticles(this.player.x, this.player.y, ultimate.color, 34);
    this.screenShake = 13; this.triggerFlash(ultimate.color, .42);
    this.callbacks.onSound(this.characterId === "paladin" ? "holy" : this.characterId === "mage" ? "frost" : "evolve");
    this.callbacks.onNotice(ultimate.name, ultimate.description);
    this.emitHud();
  }

  private releasePaladinUltimate() {
    const ultimate = CLASS_ULTIMATES.paladin; const radius = 370;
    this.bulkDamage = true;
    this.enemies.forEach((enemy) => {
      const hitRadius = radius + enemy.radius;
      if (enemy.hp <= 0 || distanceSquared(enemy, this.player) > hitRadius * hitRadius) return;
      this.hitEnemy(enemy, enemy.kind === "boss" ? enemy.maxHp * .075 : enemy.maxHp * .58, true);
      if (enemy.kind !== "boss") {
        const dx = enemy.x - this.player.x; const dy = enemy.y - this.player.y; const length = Math.hypot(dx, dy) || 1;
        enemy.x += dx / length * 90; enemy.y += dy / length * 90;
      }
    });
    this.bulkDamage = false;
    this.heal(this.player.maxHp * .2); this.player.shield = true; this.player.invulnerable = Math.max(this.player.invulnerable, 5);
    this.effects.push({ kind: "signature", x: this.player.x, y: this.player.y, age: 0, duration: 1.45, radius: 285, color: ultimate.color, visual: ultimate.visual });
  }

  private releaseRangerUltimate() {
    const ultimate = CLASS_ULTIMATES.ranger; const count = 32; const damage = 58;
    for (let index = 0; index < count && this.projectiles.length < MAX_PROJECTILES; index += 1) {
      const angle = index / count * Math.PI * 2 + (index % 2) * .035;
      this.projectiles.push({
        id: this.id += 1, kind: "signature", weaponId: "volley", visual: ultimate.visual, color: ultimate.color,
        x: this.player.x + Math.cos(angle) * 24, y: this.player.y + Math.sin(angle) * 24,
        vx: Math.cos(angle) * 610, vy: Math.sin(angle) * 610, radius: 11, damage, ttl: 2.35, age: 0,
        pierce: 5, hitIds: new Set(), speed: 610,
      });
    }
    this.effects.push({ kind: "signature", x: this.player.x, y: this.player.y, age: 0, duration: .85, radius: 92, color: ultimate.color, visual: ultimate.visual });
  }

  private releaseNecromancerDragon() {
    this.summons = this.summons.filter((summon) => summon.kind !== "boneDragon");
    this.summons.push({
      id: this.id += 1, kind: "boneDragon", x: this.player.x - 80, y: this.player.y - 55, vx: 0, vy: 0,
      radius: 42, damage: 46 * CHARACTERS[this.characterId].damageMultiplier, speed: 230, range: 300,
      attackInterval: 1.2, attackCooldown: .2, ttl: BONE_DRAGON.duration, maxTtl: BONE_DRAGON.duration,
      hp: 9999, maxHp: 9999, invulnerable: 0, phase: 0, evolved: true,
    });
    this.effects.push({ kind: "signature", x: this.player.x, y: this.player.y - 18, age: 0, duration: 1.35, radius: 190, color: "#c790ff", visual: "ultimateNecromancer" });
  }

  private releaseDeathLegion() {
    const ultimate = CLASS_ULTIMATES.necromancer;
    this.summons = this.summons.filter((summon) => summon.kind !== "deathLegion");
    for (let index = 0; index < 6; index += 1) {
      const angle = index / 6 * Math.PI * 2; const hp = 135 + this.level * 5;
      this.summons.push({
        id: this.id += 1, kind: "deathLegion", x: this.player.x + Math.cos(angle) * 72, y: this.player.y + Math.sin(angle) * 58,
        vx: 0, vy: 0, radius: 17, damage: 24 * CHARACTERS.necromancer.damageMultiplier, speed: 168, range: 34,
        attackInterval: .7, attackCooldown: index * .08, hp, maxHp: hp, invulnerable: .55,
        ttl: 10, maxTtl: 10, phase: index * .05, evolved: true,
      });
      this.effects.push({ kind: "signature", x: this.player.x + Math.cos(angle) * 72, y: this.player.y + Math.sin(angle) * 58, age: -index * .06, duration: .75, radius: 48, color: ultimate.color, visual: "summonLegion" });
    }
    this.effects.push({ kind: "signature", x: this.player.x, y: this.player.y, age: 0, duration: 1.1, radius: 180, color: ultimate.color, visual: "ultimateNecromancer" });
  }

  private releaseMageUltimate() {
    const ultimate = CLASS_ULTIMATES.mage; const radius = 455;
    this.bulkDamage = true;
    this.enemies.forEach((enemy) => {
      const hitRadius = radius + enemy.radius;
      if (enemy.hp <= 0 || distanceSquared(enemy, this.player) > hitRadius * hitRadius) return;
      const dx = this.player.x - enemy.x; const dy = this.player.y - enemy.y; const length = Math.hypot(dx, dy) || 1;
      if (enemy.kind !== "boss") { enemy.x += dx / length * 110; enemy.y += dy / length * 110; }
      enemy.frozen = Math.max(enemy.frozen, enemy.kind === "boss" ? .75 : 2.6);
      enemy.burn = Math.max(enemy.burn, 4); enemy.burnTick = Math.min(enemy.burnTick, .35); enemy.armor = Math.max(0, enemy.armor - 5);
      this.hitEnemy(enemy, enemy.kind === "boss" ? enemy.maxHp * .1 : enemy.maxHp * .68, true);
    });
    this.bulkDamage = false;
    const colors = ["#d9f5ff", "#69ef83", "#42dfff", "#ff603f", "#f1a447"];
    colors.forEach((color, index) => {
      const angle = index / colors.length * Math.PI * 2 - Math.PI / 2;
      this.effects.push({ kind: "signature", x: this.player.x + Math.cos(angle) * 92, y: this.player.y + Math.sin(angle) * 92, age: -index * .08, duration: 1.55, radius: 72, color, visual: ultimate.visual });
    });
    this.effects.push({ kind: "signature", x: this.player.x, y: this.player.y, age: .05, duration: 1.9, radius: 245, color: ultimate.color, visual: ultimate.visual });
  }

  private releaseElfUltimate() {
    const ultimate = CLASS_ULTIMATES.elf;
    const targets = this.enemies.filter((enemy) => enemy.hp > 0 && distanceSquared(enemy, this.player) <= 530 ** 2)
      .sort((left, right) => distanceSquared(left, this.player) - distanceSquared(right, this.player)).slice(0, 20);
    this.bulkDamage = true;
    targets.forEach((enemy, index) => {
      enemy.frozen = Math.max(enemy.frozen, enemy.kind === "boss" ? .7 : 3.2);
      this.hitEnemy(enemy, enemy.kind === "boss" ? enemy.maxHp * .07 : enemy.maxHp * .6, true);
      this.effects.push({ kind: "signature", x: this.player.x, y: this.player.y, x2: enemy.x, y2: enemy.y, age: -index * .025, duration: .75, radius: 34, color: ultimate.color, visual: ultimate.visual });
    });
    this.bulkDamage = false;
    this.effects.push({ kind: "signature", x: this.player.x, y: this.player.y, age: 0, duration: 1.5, radius: 205, color: ultimate.color, visual: ultimate.visual });
  }

  private isClassUltimateActive() {
    if (this.characterId === "necromancer") return this.summons.some((summon) => summon.kind === "deathLegion" && summon.ttl > 0);
    return this.elapsed < this.ultimateActiveUntil;
  }

  private releaseHolyBomb() {
    const blastRadius = 250;
    this.bulkDamage = true;
    this.enemies.forEach((enemy) => {
      const hitRadius = blastRadius + enemy.radius;
      if (distanceSquared(enemy, this.player) > hitRadius * hitRadius) return;
      this.hitEnemy(enemy, enemy.kind === "boss" ? enemy.maxHp * .06 : enemy.maxHp * .35, true);
      if (enemy.kind !== "boss") {
        const dx = enemy.x - this.player.x; const dy = enemy.y - this.player.y; const length = Math.hypot(dx, dy) || 1;
        enemy.x += (dx / length) * 70; enemy.y += (dy / length) * 70;
      }
    });
    this.bulkDamage = false;
    this.effects.push({ kind: "pickup", x: this.player.x, y: this.player.y, age: 0, duration: .9, radius: blastRadius, color: "#ffd56d" });
    this.spawnParticles(this.player.x, this.player.y, "#ffd56d", 24);
    this.screenShake = 9; this.triggerFlash("#fff0a3", .3);
  }

  chooseUpgrade(id: UpgradeId) {
    const isWeapon = id in WEAPONS;
    const levels = isWeapon ? this.weapons : this.passives;
    const maxLevel = 5;
    const previous = levels[id] ?? 0;
    if (previous >= maxLevel) return;
    levels[id] = previous + 1;
    this.stageUpgradeCount += 1;
    if (isWeapon && !this.cooldowns[id]) this.cooldowns[id] = 0.1;
    if (isWeapon && isNecromancerSummon(id as WeaponId)) this.reinforceActiveSummons(id as WeaponId, previous, levels[id]);
    if (id === "vitality") {
      this.player.maxHp += 20;
      this.player.hp += 20;
    }
    this.heal(this.player.maxHp * .1);
    if (levels[id] === 5) {
      const color = isWeapon ? "#ffd76f" : "#c68cff";
      this.effects.push({ kind: "ascended", x: this.player.x, y: this.player.y, age: 0, duration: 1.15, radius: 115, color });
      this.spawnParticles(this.player.x, this.player.y, color, 28);
      this.triggerFlash(color, .42);
      this.screenShake = 8;
    }
    if (this.tarots.has("hermit")) this.hermitBuff = 8;
    this.pendingLevel = false;
    this.paused = false;
    this.callbacks.onSound("level");
    this.callbacks.onNotice(isWeapon ? WEAPONS[id as WeaponId].name : PASSIVES[id as PassiveId].name, `提升至 Lv.${levels[id]}`);
    this.checkPendingLevel();
  }

  chooseTarot(id: TarotId) {
    this.tarots.add(id);
    this.paused = false;
    this.callbacks.onSound("evolve");
    this.callbacks.onNotice(`${TAROTS[id].numeral} · ${TAROTS[id].name}`, TAROTS[id].description);
  }

  update(rawDelta: number, input: SurvivorInput) {
    if (this.ended || this.paused) return;
    const measuredFrame = Math.min(rawDelta, .1);
    this.frameTimeAverage = this.frameTimeAverage * .96 + measuredFrame * .04;
    this.lowFpsTime = this.frameTimeAverage > .022 ? Math.min(3, this.lowFpsTime + measuredFrame) : Math.max(0, this.lowFpsTime - measuredFrame * .6);
    if (this.lowFpsTime > 1.2) this.adaptiveLowDetail = true;
    else if (this.lowFpsTime === 0 && this.frameTimeAverage < .019) this.adaptiveLowDetail = false;
    this.frameIndex += 1;
    const feedbackUnderLoad = this.isUnderLoad();
    this.hitFeedbackBudget = feedbackUnderLoad ? 2 : 10;
    this.hitFlashBudget = feedbackUnderLoad ? 8 : 28;
    this.deathFeedbackBudget = feedbackUnderLoad ? 2 : 7;
    const delta = Math.min(rawDelta, 0.034);
    this.elapsed += delta;
    this.stageElapsed += delta;
    this.hermitBuff = Math.max(0, this.hermitBuff - delta);
    this.altarBuff = Math.max(0, this.altarBuff - delta);
    this.comboTime = Math.max(0, this.comboTime - delta);
    this.feverRemaining = Math.max(0, this.feverRemaining - delta);
    this.lastElementTime = Math.max(0, this.lastElementTime - delta);
    this.elementComboTime = Math.max(0, this.elementComboTime - delta);
    this.elementComboCooldown = Math.max(0, this.elementComboCooldown - delta);
    this.dragonCooldown = Math.max(0, this.dragonCooldown - delta);
    this.gemSoundCooldown = Math.max(0, this.gemSoundCooldown - delta);
    this.gemMagnetTime = Math.max(0, this.gemMagnetTime - delta);
    if (this.lastElementTime <= 0) this.lastElement = null;
    if (this.elementComboTime <= 0) this.elementComboName = null;
    this.screenFlash = Math.max(0, this.screenFlash - delta);
    this.player.invulnerable = Math.max(0, this.player.invulnerable - delta);
    this.updatePlayer(delta, input);
    if (this.updateStageFlow()) { this.emitHud(); return; }
    this.updateAltar(delta);
    this.updateUltimateAltars(delta);
    this.updateSpawning(delta);
    this.updateBounty(delta);
    this.updateWeapons(delta);
    this.updateSummons(delta);
    this.updateProjectiles(delta);
    this.updateEnemies(delta);
    this.updateHostileProjectiles(delta);
    this.updateGems(delta);
    this.updateSupplies(delta);
    this.updateEffects(delta);
    this.updateTarotTiming();
    this.checkMissions();
    this.screenShake = Math.max(0, this.screenShake - delta * 18);
    this.hudCooldown -= delta;
    if (this.hudCooldown <= 0) { this.emitHud(); this.hudCooldown = 0.1; }
  }

  private updateStageFlow() {
    if (this.stageBossSpawned || this.stageElapsed < STAGE_BOSS_AT) return false;
    const stage = stageAt(this.stageIndex);
    this.stageBossSpawned = true;
    const angle = Math.atan2(this.player.facingY, this.player.facingX);
    this.spawnEnemy("boss", this.player.x + Math.cos(angle) * 360, this.player.y + Math.sin(angle) * 360, stage.boss, true);
    this.paused = true; this.triggerFlash(stage.palette.accent, .45); this.screenShake = 12;
    this.callbacks.onSound("evolve"); this.callbacks.onDialogue(stage.bossScene);
    return true;
  }

  draw() {
    const context = this.context;
    context.clearRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);
    const shakeX = this.screenShake ? (Math.random() - 0.5) * this.screenShake : 0;
    const shakeY = this.screenShake ? (Math.random() - 0.5) * this.screenShake : 0;
    context.save();
    context.translate(shakeX, shakeY);
    this.drawBackground();
    this.drawObstacles();
    this.drawGems();
    this.drawSupplies();
    this.drawAltar();
    this.drawUltimateAltars();
    this.renderLowDetail = this.isUnderLoad();
    this.effectVfxBudget = this.renderLowDetail ? 28 : Number.POSITIVE_INFINITY;
    this.drawEffects();
    this.effectVfxBudget = Number.POSITIVE_INFINITY;
    this.drawEnemies();
    this.drawSummons();
    this.drawHostileProjectiles();
    this.drawProjectiles();
    this.drawAxes();
    this.drawPlayer();
    this.drawParticles();
    this.drawDamageNumbers();
    context.restore();
    this.drawScreenFlash();
  }

  private isUnderLoad() {
    return this.adaptiveLowDetail || this.enemies.length > 90 || this.projectiles.length > 85 || this.effects.length > 42 || this.damageNumbers.length > 36;
  }

  private updatePlayer(delta: number, input: SurvivorInput) {
    const x = Number(input.right) - Number(input.left);
    const y = Number(input.down) - Number(input.up);
    const length = Math.hypot(x, y);
    const moving = length > 0;
    const speedBonus = 1 + (this.passives.boots ?? 0) * 0.08 + (this.hermitBuff > 0 ? 0.3 : 0) + (this.altarBuff > 0 ? .12 : 0) + (this.feverRemaining > 0 ? .1 : 0);
    if (moving) {
      const nx = x / length; const ny = y / length;
      this.player.x += nx * this.player.baseSpeed * speedBonus * delta;
      this.player.y += ny * this.player.baseSpeed * speedBonus * delta;
      this.resolveObstacleCollision(this.player);
      this.player.facingX = nx; this.player.facingY = ny;
      this.player.idleTime = 0;
      if (this.tarots.has("lovers")) {
        this.loversHealTimer += delta;
        if (this.loversHealTimer >= 0.5) { this.heal(1); this.loversHealTimer -= 0.5; }
      }
    } else {
      this.player.idleTime += delta;
      this.loversHealTimer = 0;
    }
    if (this.tarots.has("emperor") && this.player.idleTime >= 1.5 && !this.player.shield) {
      this.player.shield = true;
      this.heal(this.player.maxHp * 0.3);
      this.effects.push({ kind: "heal", x: this.player.x, y: this.player.y, age: 0, duration: 0.7, radius: 52, color: "#ffd76f" });
    }
    if (this.characterId === "paladin") {
      this.paladinHealTimer += delta;
      if (this.paladinHealTimer >= 2) { this.heal(1); this.paladinHealTimer -= 2; }
    }
  }

  private updateAltar(delta: number) {
    if (!this.altar) {
      const bossAlive = this.enemies.some((enemy) => enemy.kind === "boss" && enemy.hp > 0);
      if (this.stageElapsed < this.nextAltarAt || this.stageBossSpawned || bossAlive) return;
      const angle = Math.random() * Math.PI * 2; const range = 190 + Math.random() * 75;
      this.altar = { x: this.player.x + Math.cos(angle) * range, y: this.player.y + Math.sin(angle) * range, charge: 0 };
      this.callbacks.onNotice("灵魂祭坛出现", "靠近祭坛并停留片刻，可获得短暂祝福");
      return;
    }
    const captureRadius = 62 + this.player.radius;
    if (distanceSquared(this.player, this.altar) <= captureRadius * captureRadius) this.altar.charge = Math.min(1.6, this.altar.charge + delta);
    else this.altar.charge = Math.max(0, this.altar.charge - delta * .55);
    if (this.altar.charge < 1.6) return;
    const altar = this.altar; this.altar = null; this.nextAltarAt = this.stageElapsed + 90; this.altarBuff = 14;
    this.heal(this.player.maxHp * .08); this.effects.push({ kind: "ascended", x: altar.x, y: altar.y, age: 0, duration: 1, radius: 92, color: "#79f2c4" });
    this.triggerFlash("#79f2c4", .22); this.callbacks.onSound("level");
    this.callbacks.onNotice("祭坛祝福", "14秒内伤害与移动速度 +12%，并恢复少量生命");
  }

  private createUltimateAltars(stageIndex: number) {
    this.ultimateAltars = [];
    for (let index = 0; index < 2; index += 1) {
      let angle = stageIndex * .71 + index * Math.PI + .52;
      let candidate = { x: 0, y: 0 };
      for (let attempt = 0; attempt < 12; attempt += 1) {
        const range = 215 + ((stageIndex * 37 + index * 29 + attempt * 17) % 58);
        candidate = { x: Math.cos(angle) * range, y: Math.sin(angle) * Math.min(range, 190) };
        const clearOfObstacles = this.obstacles.every((obstacle) => distanceSquared(candidate, obstacle) > (obstacle.radius + 78) ** 2);
        const clearOfAltars = this.ultimateAltars.every((altar) => distanceSquared(candidate, altar) > 170 ** 2);
        if (clearOfObstacles && clearOfAltars) break;
        angle += .47;
      }
      this.ultimateAltars.push({ id: this.id += 1, x: candidate.x, y: candidate.y, consumed: false });
    }
  }

  private updateUltimateAltars(delta: number) {
    if (this.ultimateCharge >= 1 || this.isClassUltimateActive()) return;
    const captureRadius = 60 + this.player.radius;
    const active = this.ultimateAltars.find((altar) => !altar.consumed && distanceSquared(this.player, altar) <= captureRadius * captureRadius);
    if (!active) return;
    this.ultimateCharge = Math.min(1, this.ultimateCharge + delta / ULTIMATE_CHARGE_SECONDS);
    if (this.ultimateCharge < 1) return;
    active.consumed = true;
    const ultimate = CLASS_ULTIMATES[this.characterId];
    this.effects.push({ kind: "signature", x: active.x, y: active.y, age: 0, duration: 1.15, radius: 105, color: ultimate.color, visual: "ultimateAltar" });
    this.spawnParticles(active.x, active.y, "#d598ff", 28); this.triggerFlash("#a757ff", .2);
    this.callbacks.onSound("level"); this.callbacks.onNotice(`${ultimate.name}充能完成`, "按 Q 或点击右下角大招按钮释放");
    this.emitHud();
  }

  private updateSpawning(delta: number) {
    if (!this.hordeWarned && this.hordeRemaining <= 0 && this.elapsed >= this.nextHordeAt - 5) {
      this.hordeWarned = true; this.callbacks.onNotice("怪物潮预警", "5秒后夜潮来袭，准备主动技能！");
    }
    if (this.hordeRemaining <= 0 && this.elapsed >= this.nextHordeAt) {
      this.hordeIndex += 1; this.hordeRemaining = 18; this.nextHordeAt += 90; this.hordeWarned = false;
      this.effects.push({ kind: "shockwave", x: this.player.x, y: this.player.y, age: 0, duration: .95, radius: 520, color: "#ff6b67" });
      this.triggerFlash("#ff3f67", .55); this.screenShake = 12;
      this.callbacks.onSound("evolve"); this.callbacks.onNotice(`第 ${this.hordeIndex} 波怪物潮`, "坚持18秒即可获得额外经验");
    }
    if (this.hordeRemaining > 0) {
      this.hordeRemaining = Math.max(0, this.hordeRemaining - delta);
      if (this.hordeRemaining === 0) {
        this.stageHordesDefeated += 1;
        const reward = 35 + this.hordeIndex * 15; this.xp += reward;
        this.effects.push({ kind: "ascended", x: this.player.x, y: this.player.y, age: 0, duration: 1.2, radius: 160, color: "#ffd76f" });
        this.triggerFlash("#ffd76f", .42);
        this.callbacks.onSound("level"); this.callbacks.onNotice("怪物潮击退", `获得 ${reward} EXP`); this.checkPendingLevel();
      }
    }
    if (this.stageElapsed >= this.nextMiniBossAt && !this.enemies.some((enemy) => enemy.stageBoss && enemy.hp > 0)) {
      const variant = BOSS_ORDER[this.miniBossCount % BOSS_ORDER.length]; this.miniBossCount += 1;
      this.spawnEnemy("boss", undefined, undefined, variant, false); this.nextMiniBossAt += 75;
      this.callbacks.onNotice("小 Boss 来袭", `${BOSS_STATS[variant].name}携带进化宝箱出现`);
    }
    this.spawnCooldown -= delta;
    const hordeActive = this.hordeRemaining > 0;
    const stageBossAlive = this.enemies.some((enemy) => enemy.stageBoss && enemy.hp > 0);
    const anyBossAlive = stageBossAlive || this.enemies.some((enemy) => enemy.kind === "boss" && enemy.hp > 0);
    const enemyLimit = stageBossAlive ? 90 : anyBossAlive ? 125 : hordeActive ? 260 : 220;
    if (this.spawnCooldown > 0 || this.enemies.length >= enemyLimit) return;
    const minutes = this.stageElapsed / 60;
    const stage = stageAt(this.stageIndex); const pool = this.stageElapsed < STAGE_DURATION * .55 ? stage.pool : stage.latePool;
    const normalCount = (1 + Math.min(2, this.stageIndex) + Math.floor(minutes / 2)) * (hordeActive ? 3 : 1);
    const bossSpawnScale = stageBossAlive ? .22 : anyBossAlive ? .42 : 1;
    const count = Math.max(1, Math.ceil(normalCount * bossSpawnScale));
    for (let index = 0; index < count; index += 1) {
      const kind = pool[Math.floor(Math.random() * pool.length)];
      this.spawnEnemy(kind);
    }
    const normalInterval = hordeActive ? .14 * (.8 + Math.random() * .35) : Math.max(0.2, 0.82 - this.stageIndex * .055 - minutes * .035) * (0.85 + Math.random() * 0.3);
    this.spawnCooldown = normalInterval * (stageBossAlive ? 4 : anyBossAlive ? 2.6 : 1);
  }

  private spawnEnemy(kind: EnemyKind, fixedX?: number, fixedY?: number, requestedBossVariant?: BossVariant, stageBoss = false) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 470 + Math.random() * 130;
    const minuteScale = 1 + this.stageIndex * .34 + Math.min(1, this.stageElapsed / STAGE_DURATION) * .18;
    const bossVariant = kind === "boss" ? requestedBossVariant ?? "infernal" : undefined;
    const stats = kind === "boss" ? BOSS_STATS[bossVariant!] : ENEMY_STATS[kind];
    const hp = stats.hp * minuteScale;
    const enemy: Enemy = {
      id: this.id += 1, x: fixedX ?? this.player.x + Math.cos(angle) * radius, y: fixedY ?? this.player.y + Math.sin(angle) * radius,
      vx: 0, vy: 0, radius: stats.radius, hp, maxHp: hp, armor: stats.armor, speed: stats.speed,
      damage: stats.damage, xp: stats.xp, kind, bossVariant, frozen: 0, slow: 0, burn: 0, burnTick: 0, hitFlash: 0, elite: kind === "boss", skillCooldown: kind === "boss" ? 2.2 : 0, stageBoss,
    };
    this.enemies.push(enemy);
    return enemy;
  }

  private updateBounty(delta: number) {
    if (this.activeBountyId !== null) {
      this.bountyRemaining = Math.max(0, this.bountyRemaining - delta);
      if (this.bountyRemaining === 0) {
        const target = this.enemies.find((enemy) => enemy.id === this.activeBountyId);
        if (target) {
          target.hp = -9999;
          this.effects.push({ kind: "burst", x: target.x, y: target.y, age: 0, duration: .65, radius: 72, color: "#8e799e" });
        }
        this.activeBountyId = null; this.bountyName = null;
        this.callbacks.onNotice("悬赏目标逃脱", "下一只悬赏精英会更快出现");
      }
      return;
    }
    if (this.elapsed < this.nextBountyAt) return;
    const stage = stageAt(this.stageIndex); const pool = this.stageElapsed < STAGE_DURATION * .55 ? stage.pool : stage.latePool;
    const kind = pool[Math.floor(Math.random() * pool.length)];
    const angle = Math.random() * Math.PI * 2;
    const enemy = this.spawnEnemy(kind, this.player.x + Math.cos(angle) * 370, this.player.y + Math.sin(angle) * 370);
    enemy.hp *= 3.2; enemy.maxHp = enemy.hp; enemy.radius *= 1.24; enemy.damage *= .85; enemy.speed *= .92;
    enemy.elite = true; enemy.bounty = true;
    this.bountyCount += 1; this.activeBountyId = enemy.id; this.bountyRemaining = 30;
    this.bountyName = `悬赏 · ${ENEMY_NAMES[kind]}`; this.nextBountyAt += 78;
    this.effects.push({ kind: "ascended", x: enemy.x, y: enemy.y, age: 0, duration: 1.2, radius: 94, color: "#ffd45f" });
    this.triggerFlash("#ffcf5c", .28);
    this.callbacks.onSound("evolve"); this.callbacks.onNotice(this.bountyName, "30秒内击败，奖励主动技能或大量经验");
  }

  private updateWeapons(delta: number) {
    WEAPON_IDS.forEach((id) => {
      const level = this.weapons[id] ?? 0;
      if (!level) return;
      if (id === "axes") { this.updateAxeDamage(level); return; }
      if (isNecromancerSummon(id)) {
        const active = this.summons.some((summon) => summon.weaponId === id && summon.hp > 0);
        if (active) return;
        const cooldownReduction = LEVEL_COOLDOWN[level] + (this.passives.cooldown ?? 0) * 0.1 + CHARACTERS[this.characterId].cooldownBonus;
        if (this.summonCooldownPending.delete(id)) this.cooldowns[id] = WEAPONS[id].cooldown * Math.max(.3, 1 - cooldownReduction);
        this.cooldowns[id] = (this.cooldowns[id] ?? 0) - delta;
        if (this.cooldowns[id] > 0) return;
        this.fireWeapon(id, level);
        if (this.summons.some((summon) => summon.weaponId === id && summon.hp > 0)) this.summonCooldownPending.add(id);
        this.cooldowns[id] = 0;
        return;
      }
      this.cooldowns[id] = (this.cooldowns[id] ?? 0) - delta;
      if (this.cooldowns[id] > 0) return;
      this.fireWeapon(id, level);
      const cooldownReduction = LEVEL_COOLDOWN[level] + (this.passives.cooldown ?? 0) * 0.1 + CHARACTERS[this.characterId].cooldownBonus;
      this.cooldowns[id] = WEAPONS[id].cooldown * Math.max(0.18, 1 - cooldownReduction);
    });
  }

  private fireWeapon(id: WeaponId, level: number) {
    const damage = WEAPONS[id].damage * LEVEL_DAMAGE[level];
    const size = LEVEL_SIZE[level];
    const evolved = this.evolved.has(id);
    if (isNecromancerSummon(id)) {
      this.summonNecromancerUnit(id, level, damage, evolved);
      this.callbacks.onSound("attack");
      return;
    }
    if (isSignatureSkill(id)) {
      this.fireSignatureSkill(id, level, damage, size, evolved);
      this.callbacks.onSound(id === "yin" || id === "starTrap" ? "frost" : id === "shield" || id === "consecrate" || id === "lance" ? "holy" : "attack");
      return;
    }
    if (id === "whip") {
      const range = 120 * size * (evolved ? 2 : 1);
      const target = this.player.idleTime > .15 ? this.nearestEnemy() : null;
      const facing = target ? Math.atan2(target.y - this.player.y, target.x - this.player.x) : Math.atan2(this.player.facingY, this.player.facingX);
      if (target) { this.player.facingX = Math.cos(facing); this.player.facingY = Math.sin(facing); }
      this.enemies.forEach((enemy) => {
        const dx = enemy.x - this.player.x; const dy = enemy.y - this.player.y;
        const angle = Math.atan2(dy, dx);
        const difference = Math.atan2(Math.sin(angle - facing), Math.cos(angle - facing));
        if (Math.hypot(dx, dy) <= range + enemy.radius && Math.abs(difference) <= Math.PI / 3) {
          this.hitEnemy(enemy, damage);
          if (level >= 5) { enemy.burn = 2; enemy.burnTick = 0; }
        }
      });
      this.effects.push({ kind: "whip", x: this.player.x, y: this.player.y, age: 0, duration: 0.24, radius: range, color: evolved ? "#ff4e45" : "#ff9b56" });
    }
    if (id === "boomerang") {
      const count = evolved ? 3 : 1;
      const target = this.nearestEnemy();
      const base = target ? Math.atan2(target.y - this.player.y, target.x - this.player.x) : Math.atan2(this.player.facingY, this.player.facingX);
      for (let index = 0; index < count; index += 1) {
        const angle = base + (index - (count - 1) / 2) * 0.25;
        const speed = level >= 5 ? 560 : 290 + level * 22;
        this.projectiles.push({ id: this.id += 1, kind: "boomerang", x: this.player.x, y: this.player.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, radius: 12 * size, damage, ttl: 1.8, age: 0, pierce: 1 + Math.floor(level / 2), hitIds: new Set() });
      }
    }
    if (id === "holy") {
      const target = this.densestEnemy();
      if (target) {
        const count = evolved ? 3 : 1;
        for (let index = 0; index < count; index += 1) {
          const x = target.x + (index - (count - 1) / 2) * 58;
          const y = target.y + Math.sin(index * 2.1) * 36;
          this.damageArea(x, y, 40 * size, damage, 0);
          this.effects.push({ kind: "holy", x, y, age: -index * 0.08, duration: 0.55, radius: 42 * size, color: "#ffcc32" });
        }
        if (level >= 5) { this.heal(5); this.effects.push({ kind: "heal", x: this.player.x, y: this.player.y, age: 0, duration: 0.7, radius: 48, color: "#fff2a0" }); }
      }
    }
    if (id === "frost") {
      const radius = 80 * size;
      this.enemies.forEach((enemy) => {
        if (distance(enemy, this.player) <= radius + enemy.radius) {
          this.hitEnemy(enemy, damage);
          enemy.frozen = level >= 5 ? (enemy.kind === "boss" ? 0.5 : 1.5) : 0.3 + level * 0.08;
        }
      });
      this.effects.push({ kind: "frost", x: this.player.x, y: this.player.y, age: 0, duration: 0.6, radius, color: "#24cfff" });
      if (evolved) this.effects.push({ kind: "mist", x: this.player.x, y: this.player.y, age: 0, duration: 3, radius: radius * 1.2, color: "#9deeff" });
    }
    if (id === "bats") {
      const count = evolved ? 8 : level >= 5 ? 6 : level >= 3 ? 5 : 4;
      const duration = (evolved ? 5 : 3) + (this.characterId === "necromancer" ? 1 : 0);
      const batDamage = damage * (evolved ? .58 : .68);
      const batPierce = evolved ? 8 : 2 + level;
      for (let index = 0; index < count; index += 1) {
        const angle = (index / count) * Math.PI * 2;
        this.projectiles.push({ id: this.id += 1, kind: "bat", x: this.player.x, y: this.player.y, vx: Math.cos(angle) * 120, vy: Math.sin(angle) * 120, radius: 9 * size, damage: batDamage, ttl: duration, age: 0, pierce: batPierce, hitIds: new Set() });
      }
    }
    if (id === "soul") {
      const count = evolved ? 5 : level >= 5 ? 3 : 1; const target = this.nearestEnemy();
      const base = target ? Math.atan2(target.y - this.player.y, target.x - this.player.x) : Math.atan2(this.player.facingY, this.player.facingX);
      for (let index = 0; index < count; index += 1) {
        const angle = base + (index - (count - 1) / 2) * .22;
        this.projectiles.push({ id: this.id += 1, kind: "soul", x: this.player.x, y: this.player.y, vx: Math.cos(angle) * 320, vy: Math.sin(angle) * 320, radius: 8 * size, damage, ttl: 3, age: 0, pierce: evolved ? 2 : level >= 5 ? 1 : 0, hitIds: new Set() });
      }
    }
    if (id === "meteor") {
      const target = this.densestEnemy();
      if (target) {
        const count = evolved ? 5 : level >= 5 ? 3 : 1;
        for (let index = 0; index < count; index += 1) {
          const angle = (index / count) * Math.PI * 2; const scatter = index === 0 ? 0 : 42 + index * 8;
          const x = target.x + Math.cos(angle) * scatter; const y = target.y + Math.sin(angle) * scatter;
          this.damageArea(x, y, 48 * size * (evolved ? 1.25 : 1), damage, 12);
          this.effects.push({ kind: "meteor", x, y, age: -index * .07, duration: .65, radius: 52 * size, color: "#ff8b55" });
        }
      }
    }
    if (id === "chain") {
      const hit = new Set<number>(); let current = this.nearestEnemy(); const jumps = evolved ? 10 : level >= 5 ? 6 : 2 + Math.floor(level / 2);
      for (let jump = 0; jump < jumps && current; jump += 1) {
        hit.add(current.id); this.hitEnemy(current, damage * Math.pow(.92, jump));
        const next = this.enemies.filter((enemy) => enemy.hp > 0 && !hit.has(enemy.id) && distance(enemy, current!) < 190 * size)
          .reduce<Enemy | null>((best, enemy) => !best || distance(enemy, current!) < distance(best, current!) ? enemy : best, null);
        this.effects.push({ kind: "chain", x: current.x, y: current.y, x2: next?.x ?? current.x, y2: next?.y ?? current.y, age: 0, duration: .22, radius: 24, color: "#86eaff" });
        current = next;
      }
    }
    if (id === "plague") {
      if (this.player.idleTime < .18) {
        const radius = 72 * size * (evolved ? 1.5 : 1);
        const power = (0.004 + level * 0.001) * (evolved ? 1.5 : 1);
        this.effects.push({ kind: "plague", x: this.player.x, y: this.player.y, age: 0, duration: 3, radius, color: "#62ef35", power });
      }
    }
    if (id === "metal") {
      const count = evolved ? 5 : level >= 5 ? 3 : level >= 3 ? 2 : 1;
      const targets = this.enemies.filter((enemy) => enemy.hp > 0)
        .sort((left, right) => distanceSquared(left, this.player) - distanceSquared(right, this.player)).slice(0, count);
      targets.forEach((enemy) => {
        this.hitEnemy(enemy, damage * (evolved ? 1.15 : 1));
        this.effects.push({ kind: "metal", x: this.player.x, y: this.player.y, x2: enemy.x, y2: enemy.y, age: 0, duration: .24, radius: 24, color: "#8fe7ff" });
      });
    }
    if (id === "wood") {
      const target = this.densestEnemy();
      if (target) {
        const radius = 58 * size * (evolved ? 1.55 : 1);
        this.damageArea(target.x, target.y, radius, damage, 0);
        const pullRadius = radius * (level >= 5 ? 2.75 : 2.2);
        this.enemies.forEach((enemy) => {
          if (distanceSquared(enemy, target) > (pullRadius + enemy.radius) ** 2) return;
          enemy.slow = Math.max(enemy.slow, evolved ? 3 : 1.5);
          const dx = target.x - enemy.x; const dy = target.y - enemy.y; const length = Math.hypot(dx, dy) || 1;
          const pull = (level >= 5 ? 84 : 52) * (enemy.kind === "boss" ? .25 : 1); enemy.x += (dx / length) * pull; enemy.y += (dy / length) * pull;
        });
        this.effects.push({ kind: "roots", x: target.x, y: target.y, age: 0, duration: evolved ? 1.4 : .9, radius, color: "#36df54" });
      }
    }
    if (id === "water") {
      const target = this.densestEnemy();
      if (target) {
        const count = evolved ? 3 : 1; const radius = 54 * size;
        for (let index = 0; index < count; index += 1) {
          const x = target.x + (index - (count - 1) / 2) * 62; const y = target.y;
          this.damageArea(x, y, radius, damage, 0);
          this.enemies.forEach((enemy) => { if (distanceSquared(enemy, { x, y }) <= (radius + enemy.radius) ** 2) enemy.frozen = Math.max(enemy.frozen, enemy.kind === "boss" ? .3 : evolved ? 1.4 : .7); });
          this.effects.push({ kind: "water", x, y, age: -index * .06, duration: .72, radius, color: "#20bfff" });
        }
      }
    }
    if (id === "fire") {
      const target = this.densestEnemy();
      if (target) {
        const count = evolved ? 5 : level >= 5 ? 3 : 1;
        for (let index = 0; index < count; index += 1) {
          const angle = (index / count) * Math.PI * 2; const scatter = index === 0 ? 0 : 48 + index * 7;
          const x = target.x + Math.cos(angle) * scatter; const y = target.y + Math.sin(angle) * scatter;
          const fireRadius = 52 * size * (evolved ? 1.25 : 1);
          this.damageArea(x, y, fireRadius, damage, 16);
          this.enemies.forEach((enemy) => { if (distanceSquared(enemy, { x, y }) <= (fireRadius + enemy.radius) ** 2) { enemy.burn = Math.max(enemy.burn, level >= 5 ? 4 : 2); enemy.burnTick = 0; } });
          this.effects.push({ kind: "elementFire", x, y, age: -index * .065, duration: .72, radius: 56 * size, color: "#ff4e2f" });
        }
      }
    }
    if (id === "earth") {
      const target = this.densestEnemy();
      if (target) {
        const radius = 68 * size * (evolved ? 1.75 : 1);
        this.damageArea(target.x, target.y, radius, damage, evolved ? 85 : 38);
        this.effects.push({ kind: "earth", x: target.x, y: target.y, age: 0, duration: .72, radius, color: "#e8792f" });
      }
    }
    if (isElementWeapon(id)) this.resolveElementCombo(id, level, damage, size, evolved);
    if (level >= 5 && Math.random() < .72) {
      const color = evolved ? "#ffd76f" : id === "frost" || id === "chain" ? "#74e9ff" : id === "plague" ? "#9aff79" : "#d69bff";
      this.effects.push({ kind: "ascended", x: this.player.x, y: this.player.y, age: 0, duration: .42, radius: 54 * size, color });
    }
    this.callbacks.onSound(id === "frost" || id === "water" ? "frost" : id === "holy" ? "holy" : "attack");
  }

  private resolveElementCombo(current: ElementId, level: number, damage: number, size: number, evolved: boolean) {
    const focus = this.densestEnemy();
    if (!focus) { this.lastElement = null; this.lastElementTime = 0; return; }
    const previous = this.lastElementTime > 0 ? this.lastElement : null;
    if (previous && ELEMENT_GENERATION[previous] === current && this.elementComboCooldown <= 0) {
      const key = `${previous}-${current}`;
      if (isElementComboKey(key)) {
        const combo = ELEMENT_COMBOS[key];
        const center = previous === "wood" && current === "fire" ? this.lastElementPoint : focus;
        const radius = 118 * size * (level >= 5 ? 1.25 : 1) * (evolved ? 1.18 : 1);
        const targets = this.enemies.filter((enemy) => enemy.hp > 0 && distanceSquared(enemy, center) <= (radius + enemy.radius) ** 2);
        const triggerScore = targets.reduce((score, enemy) => score + (enemy.kind === "boss" ? 4 : enemy.elite ? 2 : 1), 0);
        if (triggerScore < 4) {
          this.lastElement = current; this.lastElementTime = 3.2; this.lastElementPoint = { x: focus.x, y: focus.y };
          return;
        }
        this.bulkDamage = true;
        targets.forEach((enemy) => {
          this.hitEnemy(enemy, damage * combo.multiplier);
          if (key === "wood-fire") { enemy.burn = Math.max(enemy.burn, 5); enemy.burnTick = 0; }
          else if (key === "fire-earth") {
            enemy.burn = Math.max(enemy.burn, 2.5); enemy.burnTick = 0;
            if (enemy.kind !== "boss") { const dx = enemy.x - center.x; const dy = enemy.y - center.y; const length = Math.hypot(dx, dy) || 1; enemy.x += dx / length * 76; enemy.y += dy / length * 76; }
          } else if (key === "earth-metal") enemy.armor = Math.max(0, enemy.armor - (level >= 5 ? 4 : 2));
          else if (key === "metal-water") enemy.frozen = Math.max(enemy.frozen, enemy.kind === "boss" ? .65 : 2);
          else if (key === "water-wood") {
            enemy.slow = Math.max(enemy.slow, 3.5); const dx = center.x - enemy.x; const dy = center.y - enemy.y; const length = Math.hypot(dx, dy) || 1;
            const pull = enemy.kind === "boss" ? 24 : 96; enemy.x += dx / length * pull; enemy.y += dy / length * pull;
          }
        });
        this.bulkDamage = false;
        this.effects.push({ kind: "elementCombo", comboKey: key, x: center.x, y: center.y, age: 0, duration: 1.45, radius, color: combo.primary, color2: combo.secondary, visual: combo.visual, visual2: combo.visual2 });
        this.spawnParticles(center.x, center.y, combo.primary, 24); this.spawnParticles(center.x, center.y, combo.secondary, 26);
        this.elementComboName = combo.name; this.elementComboTime = 3.2; this.elementComboCooldown = 8; this.screenShake = 14; this.triggerFlash(combo.secondary, .52);
        this.callbacks.onSound("evolve"); this.callbacks.onNotice(combo.name, `${ELEMENT_NAMES[previous]} → ${ELEMENT_NAMES[current]} · 五行连携 ×${combo.multiplier.toFixed(1)} 伤害`);
      }
    }
    this.lastElement = current; this.lastElementTime = 3.2; this.lastElementPoint = { x: focus.x, y: focus.y };
  }

  private fireSignatureSkill(id: SignatureSkillId, level: number, damage: number, size: number, evolved: boolean) {
    const skill = SIGNATURE_SKILLS[id];
    const count = skill.count + (level >= 3 ? 1 : 0) + (level >= 5 ? 2 : 0) + (evolved ? 2 : 0);
    const radius = skill.radius * size * (evolved ? 1.28 : 1);
    const damageScale = skill.damageScale ?? 1;
    const addEffect = (x: number, y: number, index = 0, x2?: number, y2?: number) => {
      this.effects.push({ kind: "signature", x, y, x2, y2, age: -index * .045, duration: skill.pattern === "trap" ? 1.05 : .58, radius, color: skill.color, visual: skill.visual });
    };
    const applyControl = (enemy: Enemy, center: { x: number; y: number }) => {
      if (skill.slow) enemy.slow = Math.max(enemy.slow, skill.slow * (level >= 5 ? 1.35 : 1));
      if (skill.freeze) enemy.frozen = Math.max(enemy.frozen, enemy.kind === "boss" ? skill.freeze * .35 : skill.freeze * (level >= 5 ? 1.35 : 1));
      if (skill.knockback && enemy.kind !== "boss") {
        const dx = enemy.x - center.x; const dy = enemy.y - center.y; const length = Math.hypot(dx, dy) || 1;
        enemy.x += (dx / length) * skill.knockback; enemy.y += (dy / length) * skill.knockback;
      }
    };
    const damageAt = (x: number, y: number, hitRadius: number, scale = 1) => {
      this.enemies.forEach((enemy) => {
        const collisionRadius = hitRadius + enemy.radius;
        if (enemy.hp <= 0 || distanceSquared(enemy, { x, y }) > collisionRadius * collisionRadius) return;
        this.hitEnemy(enemy, damage * damageScale * scale); applyControl(enemy, { x, y });
      });
    };

    if (skill.pattern === "fan" || skill.pattern === "homing") {
      const target = this.nearestEnemy();
      const base = target ? Math.atan2(target.y - this.player.y, target.x - this.player.x) : Math.atan2(this.player.facingY, this.player.facingX);
      for (let index = 0; index < count; index += 1) {
        const spread = skill.pattern === "homing" ? .32 : .18;
        const angle = base + (index - (count - 1) / 2) * spread;
        this.projectiles.push({
          id: this.id += 1, kind: "signature", weaponId: id, visual: skill.visual, color: skill.color,
          x: this.player.x, y: this.player.y, vx: Math.cos(angle) * (skill.speed ?? 380), vy: Math.sin(angle) * (skill.speed ?? 380),
          radius: radius, damage: damage * damageScale, ttl: (skill.ttl ?? 2) + (evolved ? .8 : 0), age: 0,
          pierce: (skill.pierce ?? 0) + (level >= 5 ? 1 : 0) + (evolved ? 2 : 0), homing: skill.pattern === "homing", speed: skill.speed, hitIds: new Set(),
        });
      }
    } else if (skill.pattern === "nova") {
      damageAt(this.player.x, this.player.y, radius);
      addEffect(this.player.x, this.player.y);
    } else if (skill.pattern === "strike") {
      const targets = this.enemies.filter((enemy) => enemy.hp > 0)
        .sort((left, right) => distanceSquared(left, this.player) - distanceSquared(right, this.player)).slice(0, count);
      targets.forEach((enemy, index) => {
        this.hitEnemy(enemy, damage * damageScale * (1 - Math.min(.35, index * .045))); applyControl(enemy, this.player);
        addEffect(this.player.x, this.player.y, index, enemy.x, enemy.y);
      });
    } else {
      const target = this.densestEnemy();
      if (target) {
        for (let index = 0; index < count; index += 1) {
          const angle = (index / count) * Math.PI * 2; const scatter = index === 0 ? 0 : radius * (.55 + (index % 3) * .18);
          const x = target.x + Math.cos(angle) * scatter; const y = target.y + Math.sin(angle) * scatter;
          damageAt(x, y, radius, skill.pattern === "rain" ? .82 : 1); addEffect(x, y, index);
        }
      }
    }
    if (skill.heal) this.heal(skill.heal * (level >= 5 ? 2 : 1) * (evolved ? 1.5 : 1));
    if (level >= 5) {
      this.effects.push({ kind: "ascended", x: this.player.x, y: this.player.y, age: 0, duration: .55, radius: 70 * size, color: skill.color });
      if (Math.random() < .55) this.spawnParticles(this.player.x, this.player.y, skill.color, 10);
    }
  }

  private summonNecromancerUnit(id: WeaponId, level: number, damage: number, evolved: boolean) {
    const definition = NECROMANCER_SUMMONS[id];
    if (!definition) return;
    const existing = this.summons.filter((summon) => summon.kind === definition.kind).length;
    const legacyRequested = id === "bats" ? evolved ? 8 : level >= 5 ? 6 : level >= 3 ? 5 : 4 : definition.count + (level >= 3 ? 1 : 0) + (level >= 5 ? 1 : 0) + (evolved ? definition.count : 0);
    const requested = id === "bats" ? evolved ? 6 : 4 : definition.count;
    const maxCount = definition.maxCount;
    const count = Math.max(0, Math.min(requested, maxCount - existing));
    const squadPower = Math.min(3, Math.max(1, legacyRequested / Math.max(1, requested)));
    for (let index = 0; index < count; index += 1) {
      const angle = (index / Math.max(1, count)) * Math.PI * 2 + Math.random() * .45;
      const distanceFromPlayer = 34 + Math.random() * 34;
      const hp = definition.baseHp * (1 + (level - 1) * .22 + (this.passives.vitality ?? 0) * .12) * (this.characterId === "necromancer" ? 1.2 : 1) * (evolved ? 1.45 : 1) * squadPower;
      this.summons.push({
        id: this.id += 1, kind: definition.kind, weaponId: id,
        x: this.player.x + Math.cos(angle) * distanceFromPlayer, y: this.player.y + Math.sin(angle) * distanceFromPlayer,
        vx: 0, vy: 0, radius: definition.radius * (level >= 5 ? 1.12 : 1) * (evolved ? 1.18 : 1),
        damage: damage * definition.damageScale * (evolved ? 1.32 : 1) * squadPower, speed: definition.speed * (evolved ? 1.15 : 1),
        range: definition.range * (evolved ? 1.2 : 1), attackInterval: definition.attackInterval * (evolved ? .78 : 1),
        attackCooldown: .12 + index * .1, hp, maxHp: hp, invulnerable: .45, ttl: Number.POSITIVE_INFINITY, maxTtl: Number.POSITIVE_INFINITY, phase: Math.random() * 2, evolved,
      });
    }
    const color = definition.color;
    this.effects.push({ kind: "signature", x: this.player.x, y: this.player.y, age: 0, duration: .72, radius: 54 + count * 5, color, visual: "necromancerPortal" });
  }

  private reinforceActiveSummons(id: WeaponId, previousLevel: number, nextLevel: number) {
    const previousDamage = LEVEL_DAMAGE[Math.max(1, previousLevel)]; const nextDamage = LEVEL_DAMAGE[nextLevel];
    const damageRatio = nextDamage / Math.max(.01, previousDamage);
    const previousHpScale = 1 + Math.max(0, previousLevel - 1) * .22; const nextHpScale = 1 + Math.max(0, nextLevel - 1) * .22;
    const hpRatio = nextHpScale / previousHpScale;
    this.summons.forEach((summon) => {
      if (summon.weaponId !== id || summon.hp <= 0 || summon.kind === "boneDragon") return;
      const previousMaxHp = summon.maxHp; summon.maxHp *= hpRatio; summon.hp = Math.min(summon.maxHp, summon.hp + (summon.maxHp - previousMaxHp) + summon.maxHp * .18);
      summon.damage *= damageRatio;
      if (previousLevel < 5 && nextLevel >= 5) summon.radius *= 1.12;
    });
  }

  private evolveActiveSummons(id: WeaponId) {
    this.summons.forEach((summon) => {
      if (summon.weaponId !== id || summon.hp <= 0 || summon.kind === "boneDragon" || summon.evolved) return;
      const previousMaxHp = summon.maxHp; summon.maxHp *= 1.45; summon.hp = Math.min(summon.maxHp, summon.hp + (summon.maxHp - previousMaxHp) + summon.maxHp * .25);
      summon.damage *= 1.32; summon.speed *= 1.15; summon.range *= 1.2; summon.attackInterval *= .78; summon.radius *= 1.18; summon.evolved = true;
    });
  }

  private updateSummons(delta: number) {
    this.enemyById.clear();
    for (const enemy of this.enemies) if (enemy.hp > 0) this.enemyById.set(enemy.id, enemy);
    let livingCount = 0;
    for (const summon of this.summons) {
      summon.ttl -= delta; summon.attackCooldown -= delta; summon.invulnerable = Math.max(0, summon.invulnerable - delta); summon.phase += delta;
      if (summon.ttl <= 0 || summon.hp <= 0) {
        if (summon.kind !== "boneDragon") {
          this.effects.push({ kind: "burst", x: summon.x, y: summon.y, age: 0, duration: .48, radius: summon.radius + 24, color: "#a982d6" });
          this.spawnParticles(summon.x, summon.y, "#c4a7e8", summon.kind === "bat" ? 3 : 7);
        }
        continue;
      }
      if (summon.kind === "boneDragon") {
        this.updateBoneDragon(summon, delta);
        this.summons[livingCount++] = summon; continue;
      }
      let target = summon.targetId ? this.enemyById.get(summon.targetId) ?? null : null;
      if (target && target.hp <= 0) target = null;
      if (!target || summon.phase >= .35) {
        target = this.nearestEnemy(summon); summon.targetId = target?.id; summon.phase = 0;
      }
      if (!target) {
        const followAngle = (summon.id % 7) / 7 * Math.PI * 2;
        const follow = { x: this.player.x + Math.cos(followAngle) * 62, y: this.player.y + Math.sin(followAngle) * 62 };
        this.moveSummonToward(summon, follow, delta);
        this.summons[livingCount++] = summon; continue;
      }
      const definition = summon.weaponId ? NECROMANCER_SUMMONS[summon.weaponId] : null;
      const gap = distance(summon, target);
      const ranged = definition?.role === "ranged";
      if (gap > summon.range || (ranged && gap < summon.range * .45)) {
        const direction = ranged && gap < summon.range * .45 ? -1 : 1;
        this.moveSummonToward(summon, target, delta, direction);
      } else { summon.vx *= .82; summon.vy *= .82; }
      if (summon.attackCooldown <= 0 && gap <= summon.range + target.radius) {
        this.attackWithSummon(summon, target, definition?.role ?? "melee");
        summon.attackCooldown = summon.attackInterval;
      }
      this.summons[livingCount++] = summon;
    }
    this.summons.length = livingCount;
  }

  private moveSummonToward(summon: Summon, target: { x: number; y: number }, delta: number, direction = 1) {
    const angle = Math.atan2(target.y - summon.y, target.x - summon.x);
    summon.vx = Math.cos(angle) * summon.speed * direction; summon.vy = Math.sin(angle) * summon.speed * direction;
    summon.x += summon.vx * delta; summon.y += summon.vy * delta;
  }

  private attackWithSummon(summon: Summon, target: Enemy, role: "melee" | "ranged" | "spectral" | "tank") {
    if (role === "ranged") {
      const angle = Math.atan2(target.y - summon.y, target.x - summon.x);
      this.projectiles.push({
        id: this.id += 1, kind: "signature", weaponId: summon.weaponId, visual: summon.kind === "boneArcher" ? "vfxBones" : "vfxSoul",
        color: summon.kind === "boneArcher" ? "#d8eeaa" : "#b391ff", x: summon.x, y: summon.y,
        vx: Math.cos(angle) * 420, vy: Math.sin(angle) * 420, radius: summon.evolved ? 9 : 7, damage: summon.damage,
        ttl: 2.2, age: 0, pierce: summon.evolved ? 2 : 0, hitIds: new Set(), homing: summon.kind === "boneMage", speed: 420,
      });
      return;
    }
    if (role === "spectral") {
      this.damageArea(target.x, target.y, summon.radius * 2.3, summon.damage, 0);
      this.effects.push({ kind: "signature", x: target.x, y: target.y, age: 0, duration: .45, radius: summon.radius * 2.4, color: "#76e9ff", visual: "vfxSoul" });
      summon.x += summon.vx * .18; summon.y += summon.vy * .18;
      return;
    }
    this.hitEnemy(target, summon.damage);
    const heavy = role === "tank" || summon.kind === "deathKnight";
    if (heavy) {
      const radius = role === "tank" ? 78 : 54;
      this.damageArea(target.x, target.y, radius, summon.damage * (role === "tank" ? .58 : .4), role === "tank" ? 52 : 24);
    }
    this.effects.push({ kind: "signature", x: summon.x, y: summon.y, x2: target.x, y2: target.y, age: 0, duration: .34, radius: heavy ? 32 : 22, color: heavy ? "#ff789a" : "#efe3bd", visual: heavy ? "vfxWhip" : "vfxBones" });
  }

  private updateBoneDragon(dragon: Summon, delta: number) {
    const orbit = 105; const angle = this.elapsed * 1.35;
    const destination = { x: this.player.x + Math.cos(angle) * orbit, y: this.player.y - 68 + Math.sin(angle * 1.4) * 38 };
    this.moveSummonToward(dragon, destination, delta);
    if (distance(dragon, destination) < 16) { dragon.vx *= .5; dragon.vy *= .5; }
    if (dragon.attackCooldown <= 0) {
      const target = this.densestEnemy();
      if (target) {
        const base = Math.atan2(target.y - dragon.y, target.x - dragon.x);
        for (let index = -2; index <= 2; index += 1) {
          const shot = base + index * .12;
          this.projectiles.push({ id: this.id += 1, kind: "signature", visual: "vfxSoul", color: "#c797ff", x: dragon.x, y: dragon.y,
            vx: Math.cos(shot) * 480, vy: Math.sin(shot) * 480, radius: 11, damage: dragon.damage * .72, ttl: 2.4, age: 0, pierce: 3, hitIds: new Set(), homing: true, speed: 480 });
        }
      }
      dragon.attackCooldown = dragon.attackInterval;
    }
    const diveCycle = dragon.phase % 3;
    if (diveCycle < delta) {
      const target = this.densestEnemy();
      if (target) {
        const cappedDamage = Math.min(dragon.damage * 2.4, target.kind === "boss" ? target.maxHp * .045 : dragon.damage * 2.4);
        this.damageArea(target.x, target.y, 112, cappedDamage, 74);
        this.effects.push({ kind: "shockwave", x: target.x, y: target.y, age: 0, duration: .7, radius: 130, color: "#c99cff" });
        this.spawnParticles(target.x, target.y, "#d9c8ff", 18); this.screenShake = 8;
      }
    }
  }

  private updateAxeDamage(level: number) {
    const evolved = this.evolved.has("axes");
    const count = level >= 5 || evolved ? 3 : level >= 3 ? 2 : 1;
    const orbit = 62 * LEVEL_SIZE[level] * (evolved ? 1.45 : 1);
    const axeRadius = 15 * LEVEL_SIZE[level] * (evolved ? 1.55 : 1);
    for (let index = 0; index < count; index += 1) {
      const angle = this.elapsed * Math.PI * 2 + (index / count) * Math.PI * 2;
      const x = this.player.x + Math.cos(angle) * orbit; const y = this.player.y + Math.sin(angle) * orbit;
      this.enemies.forEach((enemy) => {
        const hitRadius = enemy.radius + axeRadius;
        if (distanceSquared(enemy, { x, y }) > hitRadius * hitRadius) return;
        const last = this.axeHitAt.get(enemy.id) ?? -10;
        if (this.elapsed - last < 0.42) return;
        this.axeHitAt.set(enemy.id, this.elapsed);
        this.hitEnemy(enemy, WEAPONS.axes.damage * LEVEL_DAMAGE[level]);
        if (evolved) {
          const dx = enemy.x - this.player.x; const dy = enemy.y - this.player.y; const length = Math.hypot(dx, dy) || 1;
          enemy.x += (dx / length) * 46; enemy.y += (dy / length) * 46;
        }
      });
    }
  }

  private updateProjectiles(delta: number) {
    if (this.projectiles.length === 0) {
      this.enemyById.clear();
      for (const cell of this.enemyGrid.values()) { cell.length = 0; this.enemyGridPool.push(cell); }
      this.enemyGrid.clear();
      return;
    }
    if (this.projectiles.length > MAX_PROJECTILES) this.projectiles.splice(0, this.projectiles.length - MAX_PROJECTILES);
    const cellSize = 96;
    this.enemyById.clear();
    for (const cell of this.enemyGrid.values()) { cell.length = 0; this.enemyGridPool.push(cell); }
    this.enemyGrid.clear();
    this.enemies.forEach((enemy) => {
      if (enemy.hp <= 0) return;
      this.enemyById.set(enemy.id, enemy);
      const key = gridCellKey(Math.floor(enemy.x / cellSize), Math.floor(enemy.y / cellSize));
      let cell = this.enemyGrid.get(key);
      if (!cell) { cell = this.enemyGridPool.pop() ?? []; this.enemyGrid.set(key, cell); }
      cell.push(enemy);
    });
    let remainingCount = 0;
    this.projectiles.forEach((projectile) => {
      projectile.age += delta; projectile.ttl -= delta;
      const homing = projectile.homing || projectile.kind === "bat" || projectile.kind === "mage" || projectile.kind === "soul" || (projectile.kind === "boomerang" && this.evolved.has("boomerang"));
      let target: Enemy | null = null;
      if (homing) {
        projectile.targetRefresh = (projectile.targetRefresh ?? 0) - delta;
        target = projectile.targetId ? this.enemyById.get(projectile.targetId) ?? null : null;
        if (!target || projectile.targetRefresh <= 0) {
          target = this.nearestEnemy(projectile); projectile.targetId = target?.id; projectile.targetRefresh = this.enemies.length > 140 ? .22 : .14;
        }
      }
      if (homing) {
        if (target) {
          const desired = Math.atan2(target.y - projectile.y, target.x - projectile.x);
          const current = Math.atan2(projectile.vy, projectile.vx);
          const diff = Math.atan2(Math.sin(desired - current), Math.cos(desired - current));
          const next = current + clamp(diff, -delta * 4.2, delta * 4.2);
          const speed = projectile.speed ?? (projectile.kind === "mage" ? 420 : projectile.kind === "soul" ? 320 : projectile.kind === "bat" ? 250 : 410);
          projectile.vx = Math.cos(next) * speed; projectile.vy = Math.sin(next) * speed;
        }
      }
      if (projectile.kind === "boomerang" && projectile.age > 0.8) {
        projectile.returning = true;
        const angle = Math.atan2(this.player.y - projectile.y, this.player.x - projectile.x);
        const speed = Math.hypot(projectile.vx, projectile.vy);
        projectile.vx = Math.cos(angle) * speed; projectile.vy = Math.sin(angle) * speed;
      }
      projectile.x += projectile.vx * delta; projectile.y += projectile.vy * delta;
      const cellX = Math.floor(projectile.x / cellSize); const cellY = Math.floor(projectile.y / cellSize);
      for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
        for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
          const candidates = this.enemyGrid.get(gridCellKey(cellX + offsetX, cellY + offsetY));
          if (!candidates) continue;
          candidates.forEach((enemy) => {
            const hitRadius = enemy.radius + projectile.radius;
            if (enemy.hp <= 0 || projectile.hitIds.has(enemy.id) || distanceSquared(enemy, projectile) > hitRadius * hitRadius) return;
            projectile.hitIds.add(enemy.id);
            const critical = projectile.kind === "boomerang" && ((this.weapons.boomerang ?? 0) >= 5 || (this.characterId === "ranger" && Math.random() < 0.1));
            const dealt = this.hitEnemy(enemy, projectile.damage * (critical ? 1.5 : 1), projectile.kind === "mage");
            if (projectile.visual === "ultimateRanger" && enemy.kind !== "boss") {
              const speed = Math.hypot(projectile.vx, projectile.vy) || 1;
              enemy.x += projectile.vx / speed * 24; enemy.y += projectile.vy / speed * 24;
            }
            if (projectile.kind === "bat" && (this.weapons.bats ?? 0) >= 5) this.heal(dealt * 0.2);
            projectile.pierce -= 1;
          });
        }
      }
      if (projectile.ttl > 0 && projectile.pierce >= 0 && !(projectile.returning && distance(projectile, this.player) < 22)) this.projectiles[remainingCount++] = projectile;
    });
    this.projectiles.length = remainingCount;
  }

  private updateEnemies(delta: number) {
    const mist = this.effects.find((effect) => effect.kind === "mist" && effect.age >= 0 && effect.age < effect.duration);
    const underLoad = this.isUnderLoad();
    let aliveCount = 0;
    this.enemies.forEach((enemy) => {
      if (enemy.hp <= 0) { this.axeHitAt.delete(enemy.id); return; }
      enemy.frozen = Math.max(0, enemy.frozen - delta); enemy.slow = Math.max(0, enemy.slow - delta); enemy.hitFlash = Math.max(0, enemy.hitFlash - delta);
      if (mist) { const mistRadius = mist.radius + enemy.radius; if (distanceSquared(enemy, mist) <= mistRadius * mistRadius) enemy.slow = 0.2; }
      if (enemy.burn > 0) {
        enemy.burn -= delta; enemy.burnTick -= delta;
        if (enemy.burnTick <= 0) { this.hitEnemy(enemy, this.evolved.has("whip") ? 10 : 5, true); enemy.burnTick = 1; }
      }
      if (enemy.hp <= 0) return;
      const summonTarget = enemy.stageBoss ? null : this.nearestSummonTarget(enemy, enemy.kind === "boss" ? 250 : 175);
      if (enemy.frozen <= 0) {
        if (enemy.kind === "boss") this.updateBossSkill(enemy, delta);
        const chaseTarget = summonTarget ?? this.player;
        const dx = chaseTarget.x - enemy.x; const dy = chaseTarget.y - enemy.y; const distanceToPlayerSq = dx * dx + dy * dy;
        const staggered = underLoad && enemy.kind !== "boss" && !enemy.bounty && distanceToPlayerSq > 260 * 260;
        if (!staggered || ((enemy.id + this.frameIndex) & 1) === 0) {
          const length = Math.sqrt(distanceToPlayerSq) || 1; const speed = enemy.speed * (enemy.slow > 0 ? 0.5 : 1); const step = staggered ? delta * 2 : delta;
          enemy.vx = (dx / length) * speed; enemy.vy = (dy / length) * speed;
          enemy.x += enemy.vx * step; enemy.y += enemy.vy * step;
        }
      }
      this.resolveObstacleCollision(enemy);
      if (summonTarget) {
        const collisionRadius = enemy.radius + summonTarget.radius;
        if (distanceSquared(enemy, summonTarget) < collisionRadius * collisionRadius) this.damageSummon(summonTarget, enemy.damage);
      } else {
        const collisionRadius = enemy.radius + this.player.radius;
        if (distanceSquared(enemy, this.player) < collisionRadius * collisionRadius) this.damagePlayer(enemy.damage);
      }
      this.enemies[aliveCount++] = enemy;
    });
    this.enemies.length = aliveCount;
    for (let index = 0; index < this.pendingSpawns.length; index += 1) {
      const spawn = this.pendingSpawns[index]; this.spawnEnemy(spawn.kind, spawn.x, spawn.y);
    }
    this.pendingSpawns.length = 0;
  }

  private updateBossSkill(enemy: Enemy, delta: number) {
    enemy.skillCooldown -= delta; if (enemy.skillCooldown > 0 || !enemy.bossVariant) return;
    const aimed = Math.atan2(this.player.y - enemy.y, this.player.x - enemy.x);
    const healthRatio = enemy.hp / enemy.maxHp;
    const addLimit = enemy.stageBoss ? 100 : 135;
    if (enemy.bossVariant === "sand") {
      const shots = healthRatio > .5 ? 12 : 18;
      for (let index = 0; index < shots; index += 1) this.spawnHostileProjectile("stone", enemy, (index / shots) * Math.PI * 2 + this.elapsed * .46, index % 2 ? 115 : 155, 8, 10);
      [-.34, -.17, 0, .17, .34].forEach((spread) => this.spawnHostileProjectile("stone", enemy, aimed + spread, 205, 10, 11)); enemy.skillCooldown = healthRatio > .5 ? 3.25 : 2.6;
    } else if (enemy.bossVariant === "forest") {
      [-.72, -.48, -.24, 0, .24, .48, .72].forEach((spread) => this.spawnHostileProjectile("web", enemy, aimed + spread, 130, 9, 12));
      for (let index = 0; index < (healthRatio > .45 ? 4 : 7) && this.enemies.length + this.pendingSpawns.length < addLimit; index += 1) { const angle = index / 7 * Math.PI * 2; this.pendingSpawns.push({ kind: healthRatio > .45 ? "spider" : "wraith", x: enemy.x + Math.cos(angle) * 82, y: enemy.y + Math.sin(angle) * 82 }); } enemy.skillCooldown = healthRatio > .45 ? 3.8 : 2.9;
    } else if (enemy.bossVariant === "volcano") {
      const shots = healthRatio > .55 ? 16 : 24;
      for (let index = 0; index < shots; index += 1) this.spawnHostileProjectile("fire", enemy, index / shots * Math.PI * 2 + this.elapsed * .55, index % 2 ? 135 : 195, 11, 10);
      [-.4, -.2, 0, .2, .4].forEach((spread) => this.spawnHostileProjectile("fire", enemy, aimed + spread, 225, 13, 12));
      enemy.skillCooldown = healthRatio > .55 ? 3 : 2.35;
    } else if (enemy.bossVariant === "ice") {
      const shots = healthRatio > .5 ? 14 : 20;
      for (let index = 0; index < shots; index += 1) this.spawnHostileProjectile("orb", enemy, index / shots * Math.PI * 2 + (index % 2 ? .1 : 0), index % 2 ? 104 : 145, 10, 11);
      [-.36, -.18, 0, .18, .36].forEach((spread) => this.spawnHostileProjectile("orb", enemy, aimed + spread, 180, 12, 12)); enemy.skillCooldown = healthRatio > .5 ? 3.8 : 2.75;
    } else if (enemy.bossVariant === "town") {
      [-.58, -.38, -.19, 0, .19, .38, .58].forEach((spread) => this.spawnHostileProjectile("stone", enemy, aimed + spread, 220, 13, 11));
      for (let index = 0; index < 10; index += 1) this.spawnHostileProjectile("orb", enemy, index / 10 * Math.PI * 2 + this.elapsed * .3, 112, 9, 9);
      enemy.x += Math.cos(aimed) * (healthRatio > .45 ? 88 : 128); enemy.y += Math.sin(aimed) * (healthRatio > .45 ? 88 : 128); enemy.skillCooldown = healthRatio > .45 ? 2.85 : 2.15;
    } else if (enemy.bossVariant === "demonKing") {
      const phase = enemy.hp / enemy.maxHp;
      const shots = phase > .55 ? 12 : 18;
      for (let index = 0; index < shots; index += 1) this.spawnHostileProjectile(index % 3 === 0 ? "orb" : "fire", enemy, index / shots * Math.PI * 2 + this.elapsed * .55, index % 2 ? 125 : 175, phase > .35 ? 11 : 14, 10);
      [-.28, 0, .28].forEach((spread) => this.spawnHostileProjectile("fire", enemy, aimed + spread, 210, 15, 12));
      if (phase < .5 && this.enemies.length + this.pendingSpawns.length < addLimit) for (let index = 0; index < 3; index += 1) { const angle = index / 3 * Math.PI * 2; this.pendingSpawns.push({ kind: "demon", x: enemy.x + Math.cos(angle) * 82, y: enemy.y + Math.sin(angle) * 82 }); }
      enemy.skillCooldown = phase > .55 ? 3.2 : 2.35;
    } else if (enemy.bossVariant === "infernal") {
      [-.24, 0, .24].forEach((spread) => this.spawnHostileProjectile("fire", enemy, aimed + spread, 155, 7, 8));
      enemy.skillCooldown = 2.8;
    } else if (enemy.bossVariant === "lich") {
      for (let index = 0; index < 10; index += 1) this.spawnHostileProjectile("orb", enemy, (index / 10) * Math.PI * 2, 112, 6, 8);
      enemy.skillCooldown = 4;
    } else if (enemy.bossVariant === "brood") {
      for (let index = 0; index < 4 && this.enemies.length + this.pendingSpawns.length < addLimit; index += 1) {
        const angle = (index / 4) * Math.PI * 2; this.pendingSpawns.push({ kind: "spider", x: enemy.x + Math.cos(angle) * 62, y: enemy.y + Math.sin(angle) * 62 });
      }
      [-.3, 0, .3].forEach((spread) => this.spawnHostileProjectile("web", enemy, aimed + spread, 105, 6, 11));
      enemy.skillCooldown = 5.2;
    } else {
      [-.16, 0, .16].forEach((spread) => this.spawnHostileProjectile("stone", enemy, aimed + spread, 92, 10, 14));
      enemy.skillCooldown = 3.5;
    }
  }

  private spawnHostileProjectile(kind: HostileProjectile["kind"], enemy: Enemy, angle: number, speed: number, damage: number, radius: number) {
    if (this.hostileProjectiles.length >= MAX_HOSTILE_PROJECTILES) return;
    this.hostileProjectiles.push({ id: this.id += 1, kind, x: enemy.x, y: enemy.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, radius, damage, ttl: 5 });
  }

  private updateHostileProjectiles(delta: number) {
    let remainingCount = 0;
    this.hostileProjectiles.forEach((projectile) => {
      projectile.x += projectile.vx * delta; projectile.y += projectile.vy * delta; projectile.ttl -= delta;
      if (this.hitsObstacle(projectile)) return;
      for (const summon of this.summons) {
        if (summon.kind === "boneDragon" || summon.hp <= 0) continue;
        const hitRadius = projectile.radius + summon.radius;
        if (distanceSquared(projectile, summon) <= hitRadius * hitRadius) { this.damageSummon(summon, projectile.damage); return; }
      }
      const playerHitRadius = projectile.radius + this.player.radius;
      if (distanceSquared(projectile, this.player) <= playerHitRadius * playerHitRadius) { this.damagePlayer(projectile.damage); return; }
      if (projectile.ttl > 0) this.hostileProjectiles[remainingCount++] = projectile;
    });
    this.hostileProjectiles.length = remainingCount;
  }

  private updateGems(delta: number) {
    const pickupRadius = 68 * (1 + (this.passives.greed ?? 0) * 0.3);
    const magnetActive = this.gemMagnetTime > 0;
    let remainingCount = 0;
    this.gems.forEach((gem) => {
      const attractionRadius = pickupRadius * 2.2; const distSq = distanceSquared(gem, this.player);
      if (magnetActive || distSq < attractionRadius * attractionRadius) {
        const dist = Math.sqrt(distSq);
        const speed = magnetActive ? 440 + Math.min(520, dist * .55) : 150 + Math.max(0, pickupRadius * 2.2 - dist) * 2.4;
        const angle = Math.atan2(this.player.y - gem.y, this.player.x - gem.x);
        gem.x += Math.cos(angle) * speed * delta; gem.y += Math.sin(angle) * speed * delta;
      }
      const collectRadius = this.player.radius + gem.radius + 5;
      if (distanceSquared(gem, this.player) < collectRadius * collectRadius) {
        this.xp += gem.value;
        if (this.tarots.has("mage")) this.launchMageMissile();
        if (this.gemSoundCooldown <= 0) { this.callbacks.onSound("gem"); this.gemSoundCooldown = .055; }
        this.checkPendingLevel();
      } else this.gems[remainingCount++] = gem;
    });
    this.gems.length = remainingCount;
  }

  private updateSupplies(delta: number) {
    let remainingCount = 0;
    this.supplies.forEach((supply) => {
      supply.ttl -= delta;
      const distSq = distanceSquared(supply, this.player);
      if (distSq < 190 * 190) {
        const dist = Math.sqrt(distSq);
        const angle = Math.atan2(this.player.y - supply.y, this.player.x - supply.x);
        const speed = 190 + Math.max(0, 190 - dist) * 2.2;
        supply.x += Math.cos(angle) * speed * delta; supply.y += Math.sin(angle) * speed * delta;
      }
      const collectRadius = this.player.radius + supply.radius + 7;
      if (distanceSquared(supply, this.player) < collectRadius * collectRadius) {
        this.collectSupply(supply);
      } else if (supply.ttl > 0) this.supplies[remainingCount++] = supply;
    });
    this.supplies.length = remainingCount;
  }

  private collectSupply(supply: Supply) {
    const color = supply.kind === "heal" ? "#87ff9c" : "#70eaff";
    if (supply.kind === "heal") {
      this.heal(this.player.maxHp * .24);
    } else {
      this.gemMagnetTime = Math.max(this.gemMagnetTime, 6);
    }
    this.effects.push({ kind: "pickup", x: this.player.x, y: this.player.y, age: 0, duration: .9, radius: 120, color });
    this.spawnParticles(this.player.x, this.player.y, color, 24);
    this.callbacks.onSound("evolve"); this.callbacks.onNotice(SUPPLY_NAMES[supply.kind], supply.kind === "heal" ? "恢复24%生命" : "全场经验钻石正在飞来");
  }

  private checkPendingLevel() {
    if (this.pendingLevel || this.paused || this.xp < this.nextXp) return;
    let blessingCount = 0;
    while (this.xp >= this.nextXp) {
      this.xp -= this.nextXp; this.level += 1; this.nextXp = xpForLevel(this.level);
      const options = this.createUpgradeOptions();
      if (options.length > 0) {
        this.pendingLevel = true; this.paused = true;
        this.callbacks.onUpgrade(options);
        return;
      }
      blessingCount += 1;
    }
    if (blessingCount <= 0) return;
    this.endlessBlessings += blessingCount;
    this.player.maxHp += blessingCount * 4;
    this.heal(this.player.maxHp * Math.min(.5, .2 + (blessingCount - 1) * .05));
    this.hermitBuff = Math.max(this.hermitBuff, 8);
    this.effects.push({ kind: "ascended", x: this.player.x, y: this.player.y, age: 0, duration: 1, radius: 105, color: "#ffd76f" });
    this.spawnParticles(this.player.x, this.player.y, "#ffd76f", 20);
    this.callbacks.onSound("level");
    this.callbacks.onNotice(blessingCount > 1 ? `永夜祝福 ×${blessingCount}` : "永夜祝福", `全伤害永久 +${(blessingCount * 2.5).toFixed(1)}% · 最大生命 +${blessingCount * 4} · 恢复生命`);
    this.emitHud();
  }

  private createUpgradeOptions() {
    const candidates: UpgradeOption[] = [];
    CHARACTER_WEAPON_POOLS[this.characterId].forEach((id) => {
      const current = this.weapons[id] ?? 0;
      if (current < 5) candidates.push({ id, kind: "weapon", name: WEAPONS[id].name, icon: WEAPONS[id].icon, currentLevel: current, nextLevel: current + 1, description: current === 4 ? `终极强化：解锁满级质变效果` : current ? `伤害、范围与冷却进一步强化` : WEAPONS[id].description });
    });
    PASSIVE_IDS.forEach((id) => {
      const current = this.passives[id] ?? 0;
      if (current < 5) candidates.push({ id, kind: "passive", name: PASSIVES[id].name, icon: PASSIVES[id].icon, currentLevel: current, nextLevel: current + 1, description: PASSIVES[id].description });
    });
    return candidates.sort(() => Math.random() - 0.5).slice(0, 3);
  }

  private updateEffects(delta: number) {
    let effectCount = 0;
    this.effects.forEach((effect) => {
      effect.age += delta; if (effect.kind === "mist") { effect.x = this.player.x; effect.y = this.player.y; }
      if (effect.age < effect.duration) this.effects[effectCount++] = effect;
    });
    this.effects.length = effectCount;
    this.poisonTickCooldown -= delta;
    if (this.poisonTickCooldown <= 0) {
      const poisonClouds = this.effects.filter((effect) => effect.kind === "plague" && effect.age >= 0);
      if (poisonClouds.length > 0) {
        this.poisonTickCooldown = .5; this.bulkDamage = true;
        this.enemies.forEach((enemy) => {
          let strongestPower = 0;
          for (const cloud of poisonClouds) {
            const hitRadius = cloud.radius + enemy.radius;
            if (distanceSquared(enemy, cloud) <= hitRadius * hitRadius) strongestPower = Math.max(strongestPower, cloud.power ?? .005);
          }
          if (strongestPower > 0) this.hitEnemy(enemy, enemy.maxHp * strongestPower * (enemy.kind === "boss" ? .35 : 1), true);
        });
        this.bulkDamage = false;
      }
    }
    let particleCount = 0;
    this.particles.forEach((particle) => {
      particle.x += particle.vx * delta; particle.y += particle.vy * delta; particle.life -= delta;
      if (particle.life > 0) this.particles[particleCount++] = particle;
      else if (this.particlePool.length < MAX_PARTICLES) this.particlePool.push(particle);
    });
    this.particles.length = particleCount;
    let numberCount = 0;
    this.damageNumbers.forEach((number) => {
      number.y -= delta * 24; number.life -= delta;
      if (number.life > 0) this.damageNumbers[numberCount++] = number;
      else if (this.damageNumberPool.length < MAX_DAMAGE_NUMBERS) this.damageNumberPool.push(number);
    });
    this.damageNumbers.length = numberCount;
    if (this.effects.length > MAX_EFFECTS) this.effects.splice(0, this.effects.length - MAX_EFFECTS);
    if (this.particles.length > MAX_PARTICLES) this.particles.splice(0, this.particles.length - MAX_PARTICLES);
    if (this.damageNumbers.length > MAX_DAMAGE_NUMBERS) this.damageNumbers.splice(0, this.damageNumbers.length - MAX_DAMAGE_NUMBERS);
  }

  private updateTarotTiming() {
    const thresholds = [11 * 60, 21 * 60];
    if (this.tarotStage >= thresholds.length || this.elapsed < thresholds[this.tarotStage]) return;
    this.tarotStage += 1; this.paused = true;
    const options = TAROT_IDS.filter((id) => !this.tarots.has(id)).sort(() => Math.random() - 0.5).slice(0, 3);
    this.callbacks.onTarot(options);
  }

  private hitEnemy(enemy: Enemy, baseDamage: number, trueDamage = false) {
    if (enemy.hp <= 0) return 0;
    const character = CHARACTERS[this.characterId];
    const bonus = 1 + (this.passives.might ?? 0) * 0.05 + this.endlessBlessings * .025 + (this.hermitBuff > 0 ? 0.3 : 0) + (this.altarBuff > 0 ? .12 : 0) + (this.feverRemaining > 0 ? .15 : 0);
    let damage = trueDamage ? baseDamage : baseDamage * character.damageMultiplier * bonus - enemy.armor;
    damage = Math.max(1, damage);
    const softCap = enemy.maxHp * 0.5;
    if (damage > softCap) damage = softCap + (damage - softCap) * 0.3;
    const previousRatio = enemy.hp / enemy.maxHp;
    enemy.hp -= damage;
    if (enemy.stageBoss && enemy.hp > 0) {
      const battleScenes = stageAt(this.stageIndex).battleScenes ?? [];
      const sceneIndex = battleScenes.findIndex((entry, index) => !this.stageDialogueShown.has(index) && previousRatio > entry.threshold && enemy.hp / enemy.maxHp <= entry.threshold);
      if (sceneIndex >= 0) {
        const entry = battleScenes[sceneIndex]; this.stageDialogueShown.add(sceneIndex);
        enemy.hp = Math.max(enemy.hp, enemy.maxHp * entry.threshold);
        this.paused = true; this.triggerFlash(stageAt(this.stageIndex).palette.accent, .34); this.screenShake = 8;
        this.callbacks.onDialogue(entry.scene);
      }
    }
    const visible = this.isVisible(enemy, 60);
    const importantHit = enemy.kind === "boss" || Boolean(enemy.bounty);
    if (visible && (importantHit || this.hitFlashBudget > 0)) {
      if (!importantHit) this.hitFlashBudget -= 1;
      enemy.hitFlash = 0.1;
    }
    const showHitFeedback = !this.bulkDamage && visible && this.hitFeedbackBudget > 0;
    if (showHitFeedback) {
      this.hitFeedbackBudget -= 1;
      this.spawnDamageNumber(enemy.x, enemy.y - enemy.radius - 5, damage, damage >= baseDamage * 1.45);
      this.spawnParticles(enemy.x, enemy.y, trueDamage ? "#ffffff" : "#ffcf72", 3);
      if (this.effects.length < MAX_EFFECTS && (damage >= baseDamage * 1.35 || Math.random() < .28)) {
        this.effects.push({ kind: "hit", x: enemy.x, y: enemy.y, age: 0, duration: .2, radius: enemy.radius + 14, color: trueDamage ? "#ffffff" : "#ffd272" });
      }
    }
    if (enemy.hp <= 0) this.killEnemy(enemy);
    return damage;
  }

  private killEnemy(enemy: Enemy) {
    if (enemy.hp > 0) return;
    enemy.hp = -9999; this.axeHitAt.delete(enemy.id); this.kills += 1; this.stageKills += 1;
    this.combo += 1; this.comboTime = 4;
    if (this.combo >= this.nextComboFever) {
      this.nextComboFever += 12;
      if (this.feverRemaining <= 0) {
        this.feverRemaining = 4;
        this.effects.push({ kind: "ascended", x: this.player.x, y: this.player.y, age: 0, duration: .75, radius: 88, color: "#ffce66" });
        this.triggerFlash("#ffb84f", .18);
        this.callbacks.onSound("evolve"); this.callbacks.onNotice(`${this.combo} 连杀 · 狂热爆发`, "4秒内伤害 +15%、移速 +10%");
      }
    }
    this.dropGem(enemy);
    const visible = this.isVisible(enemy, 70);
    const importantDeath = enemy.kind === "boss" || Boolean(enemy.bounty);
    const feedbackCandidate = !this.bulkDamage || importantDeath || this.kills % 12 === 0;
    const showDeathFeedback = visible && feedbackCandidate && (importantDeath || this.deathFeedbackBudget > 0);
    if (showDeathFeedback) {
      if (!importantDeath) this.deathFeedbackBudget -= 1;
      this.spawnParticles(enemy.x, enemy.y, enemy.kind === "boss" ? "#ffda6b" : "#a96cff", enemy.kind === "boss" ? 30 : this.bulkDamage ? 5 : 8);
      if (this.effects.length < MAX_EFFECTS) this.effects.push({ kind: "burst", x: enemy.x, y: enemy.y, age: 0, duration: enemy.kind === "boss" ? .75 : .34, radius: enemy.kind === "boss" ? 105 : enemy.radius + 20, color: enemy.bounty ? "#ffd35f" : enemy.kind === "boss" ? "#ff7e65" : "#b37aff" });
    }
    if (enemy.bounty) this.completeBounty(enemy);
    const guaranteedSupply = this.kills >= this.nextSupplyKill;
    if (guaranteedSupply) this.nextSupplyKill += 32 + this.stageIndex * 6;
    if (enemy.kind !== "boss" && this.supplies.length < 4 && (enemy.bounty || guaranteedSupply || Math.random() < .018)) this.spawnSupply(enemy.x, enemy.y);
    if (enemy.kind === "boss") {
      if (enemy.stageBoss) { this.completeStage(enemy); return; }
      this.stageMiniBossKills += 1;
      this.openBossChest(enemy.x, enemy.y);
    }
    if (this.tarots.has("fool") && this.kills >= this.foolMilestone) {
      this.foolMilestone += 100; this.grantMissingItem();
    }
  }

  private completeStage(enemy: Enemy) {
    const cleared = stageAt(this.stageIndex);
    const reward = 90 + this.stageIndex * 55;
    this.xp += reward; this.heal(this.player.maxHp * .35); this.player.shield = true;
    this.callbacks.onSound("evolve"); this.triggerFlash(cleared.palette.accent, .75); this.screenShake = 15;
    if (this.stageIndex >= STAGES.length - 1) {
      this.pendingVictory = true; this.paused = true;
      this.callbacks.onDialogue(cleared.clearScene);
      return;
    }
    const next = stageAt(this.stageIndex + 1);
    this.pendingStageAdvance = true; this.paused = true; this.callbacks.onDialogue(cleared.clearScene);
    this.callbacks.onNotice(`${cleared.name} 已解放`, `获得 ${reward} EXP · 下一关 ${next.name}`);
    void enemy;
  }

  private spawnSupply(x: number, y: number) {
    const healChance = [.42, .3, .21, .14, .08, .04][this.stageIndex] ?? .04;
    const kind: SupplyKind = Math.random() < healChance ? "heal" : "magnet";
    this.supplies.push({ id: this.id += 1, kind, x, y, radius: 14, ttl: 24 });
    this.effects.push({ kind: "pickup", x, y, age: 0, duration: .55, radius: 55, color: kind === "heal" ? "#87ff9c" : "#70eaff" });
  }

  private completeBounty(enemy: Enemy) {
    if (this.activeBountyId !== enemy.id) return;
    this.activeBountyId = null; this.bountyRemaining = 0; this.bountyName = null;
    const unlockedSkills = [...this.unlockedActiveSkills];
    if (unlockedSkills.length > 0 && Math.random() < .62) {
      const skill = unlockedSkills[Math.floor(Math.random() * unlockedSkills.length)];
      this.activeSkillCharges[skill] = (this.activeSkillCharges[skill] ?? 0) + 1;
      this.callbacks.onNotice("悬赏完成", `获得主动技能「${ACTIVE_SKILLS[skill].name}」×1`);
    } else {
      const reward = 35 + this.bountyCount * 15; this.xp += reward; this.checkPendingLevel();
      this.callbacks.onNotice("悬赏完成", `获得 ${reward} EXP`);
    }
    this.triggerFlash("#ffd35f", .48); this.screenShake = 10; this.callbacks.onSound("level");
  }

  private damagePlayer(rawDamage: number) {
    if (this.player.invulnerable > 0 || this.ended) return;
    if (this.player.shield) {
      this.player.shield = false; this.player.idleTime = 0; this.player.invulnerable = 0.75;
      this.effects.push({ kind: "shockwave", x: this.player.x, y: this.player.y, age: 0, duration: 0.45, radius: 70, color: "#ffd768" });
      return;
    }
    const damage = Math.max(1, rawDamage - (this.passives.armor ?? 0));
    this.player.hp -= damage; this.player.invulnerable = 0.8; this.screenShake = 9; this.callbacks.onSound("hurt");
    if (this.tarots.has("tower")) {
      const trueDamage = this.player.hp * 0.1;
      this.enemies.forEach((enemy) => this.hitEnemy(enemy, trueDamage, true));
      this.effects.push({ kind: "shockwave", x: this.player.x, y: this.player.y, age: 0, duration: 0.55, radius: 520, color: "#ff6d8d" });
    }
    if (this.player.hp <= 0) this.finish();
  }

  private nearestSummonTarget(from: { x: number; y: number }, maxDistance: number) {
    let nearest: Summon | null = null; let nearestDistance = maxDistance * maxDistance;
    for (const summon of this.summons) {
      if (summon.kind === "boneDragon" || summon.hp <= 0) continue;
      const candidateDistance = distanceSquared(from, summon);
      if (candidateDistance < nearestDistance) { nearest = summon; nearestDistance = candidateDistance; }
    }
    return nearest;
  }

  private damageSummon(summon: Summon, rawDamage: number) {
    if (summon.invulnerable > 0 || summon.hp <= 0) return;
    const armor = summon.kind === "graveGolem" ? 5 : summon.kind === "skeletonGuard" ? 3 : summon.kind === "deathKnight" ? 2 : 0;
    const damage = Math.max(1, rawDamage - armor); summon.hp -= damage; summon.invulnerable = .42;
    this.effects.push({ kind: "hit", x: summon.x, y: summon.y, age: 0, duration: .2, radius: summon.radius + 10, color: "#ff8299" });
    if (summon.hp <= 0) summon.hp = 0;
  }

  private heal(amount: number) { this.player.hp = Math.min(this.player.maxHp, this.player.hp + amount); }

  private damageArea(x: number, y: number, radius: number, damage: number, knockback: number) {
    this.enemies.forEach((enemy) => {
      const hitRadius = radius + enemy.radius; const dx = enemy.x - x; const dy = enemy.y - y; const distSq = dx * dx + dy * dy;
      if (distSq > hitRadius * hitRadius) return;
      this.hitEnemy(enemy, damage);
      if (knockback && enemy.kind !== "boss") { const dist = Math.sqrt(distSq) || 1; enemy.x += (dx / dist) * knockback; enemy.y += (dy / dist) * knockback; }
    });
  }

  private isVisible(entity: { x: number; y: number }, margin = 0) {
    return Math.abs(entity.x - this.player.x) <= ARENA_WIDTH / 2 + margin && Math.abs(entity.y - this.player.y) <= ARENA_HEIGHT / 2 + margin;
  }

  private dropGem(enemy: Enemy) {
    const radius = enemy.kind === "boss" ? 9 : 5;
    if (this.gems.length < MAX_GEMS) {
      this.gems.push({ x: enemy.x, y: enemy.y, value: enemy.xp, radius });
      return;
    }
    const target = this.gems[this.kills % this.gems.length];
    target.value += enemy.xp;
    target.radius = Math.min(10, Math.max(target.radius, radius) + .04);
  }

  private nearestEnemy(from: { x: number; y: number } = this.player) {
    let nearest: Enemy | null = null;
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (const enemy of this.enemies) {
      if (enemy.hp <= 0) continue;
      const candidateDistance = distanceSquared(enemy, from);
      if (candidateDistance < nearestDistance) { nearest = enemy; nearestDistance = candidateDistance; }
    }
    return nearest;
  }

  private densestEnemy() {
    if (this.densestCache && this.densestCache.hp > 0 && this.elapsed < this.densestCacheUntil) return this.densestCache;
    this.densityCandidates.length = 0;
    const limit = this.isUnderLoad() ? 48 : 72;
    for (const enemy of this.enemies) {
      if (enemy.hp > 0) this.densityCandidates.push(enemy);
      if (this.densityCandidates.length >= limit) break;
    }
    let best: Enemy | null = null;
    let bestDensity = -1;
    for (const enemy of this.densityCandidates) {
      let density = 0;
      for (const other of this.densityCandidates) if (distanceSquared(enemy, other) < 10000) density += 1;
      if (density > bestDensity) { best = enemy; bestDensity = density; }
    }
    this.densestCache = best; this.densestCacheUntil = this.elapsed + (this.isUnderLoad() ? .35 : .18);
    return best;
  }

  private launchMageMissile() {
    const levels = Object.entries(this.weapons).filter(([, level]) => level > 0) as Array<[WeaponId, number]>;
    const average = levels.reduce((sum, [id, level]) => sum + WEAPONS[id].damage * LEVEL_DAMAGE[level], 0) / Math.max(1, levels.length);
    this.projectiles.push({ id: this.id += 1, kind: "mage", x: this.player.x, y: this.player.y, vx: 0, vy: -360, radius: 7, damage: average, ttl: 2.2, age: 0, pierce: 0, hitIds: new Set() });
  }

  private openBossChest(x: number, y: number) {
    this.effects.push({ kind: "chest", x, y, age: 0, duration: 1.8, radius: 62, color: "#ffdd68" });
    const eligible = WEAPON_IDS.find((id) => (this.weapons[id] ?? 0) >= 5 && (this.passives[EVOLUTIONS[id].passive] ?? 0) >= 5 && !this.evolved.has(id));
    if (eligible) {
      this.evolved.add(eligible); const evolution = EVOLUTIONS[eligible];
      if (isNecromancerSummon(eligible)) this.evolveActiveSummons(eligible);
      this.callbacks.onSound("evolve"); this.callbacks.onNotice(`进化 · ${evolution.name}`, evolution.description);
    } else {
      this.heal(this.player.maxHp * 0.35); this.callbacks.onNotice("Boss宝箱", "暂无可进化组合，恢复35%生命");
    }
  }

  private grantMissingItem() {
    const missingWeapons = CHARACTER_WEAPON_POOLS[this.characterId].filter((id) => !this.weapons[id]);
    const missingPassives = PASSIVE_IDS.filter((id) => !this.passives[id]);
    const pool: UpgradeId[] = [...missingWeapons, ...missingPassives];
    if (!pool.length) return;
    const id = pool[Math.floor(Math.random() * pool.length)];
    if (id in WEAPONS) { this.weapons[id] = 1; this.cooldowns[id] = 0.1; }
    else this.passives[id] = 1;
    const name = id in WEAPONS ? WEAPONS[id as WeaponId].name : PASSIVES[id as PassiveId].name;
    this.callbacks.onNotice("愚者的馈赠", `获得 ${name}`);
  }

  private missionProgress(id: MissionId) {
    if (id === "first_hunt") return this.stageKills;
    if (id === "arsenal") return this.stageUpgradeCount;
    if (id === "survivor") return Math.floor(this.stageElapsed);
    if (id === "veteran") return Math.max(0, this.level - this.stageStartLevel);
    if (id === "boss_hunter") return this.stageMiniBossKills;
    return this.stageHordesDefeated;
  }

  private checkMissions() {
    const completed = MISSION_IDS.find((id) => !this.completedMissions.has(id) && this.missionProgress(id) >= MISSIONS[id].target);
    if (!completed) return;
    const mission = MISSIONS[completed]; this.completedMissions.add(completed); this.unlockedActiveSkills.add(mission.activeSkill); this.xp += mission.rewardXp;
    this.activeSkillCharges[mission.activeSkill] = (this.activeSkillCharges[mission.activeSkill] ?? 0) + 1;
    if (mission.rewardHeal) this.heal(mission.rewardHeal);
    this.callbacks.onSound("level");
    this.callbacks.onNotice(`任务完成 · ${mission.name}`, `获得主动技能「${ACTIVE_SKILLS[mission.activeSkill].name}」×1`);
    this.checkPendingLevel();
  }

  private spawnParticles(x: number, y: number, color: string, count: number) {
    const available = Math.max(0, MAX_PARTICLES - this.particles.length);
    for (let index = 0; index < Math.min(count, available); index += 1) {
      const angle = Math.random() * Math.PI * 2; const speed = 30 + Math.random() * 130;
      const particle = this.particlePool.pop() ?? { x, y, vx: 0, vy: 0, life: 0, size: 0, color };
      particle.x = x; particle.y = y; particle.vx = Math.cos(angle) * speed; particle.vy = Math.sin(angle) * speed;
      particle.life = 0.18 + Math.random() * 0.4; particle.size = 1.5 + Math.random() * 4; particle.color = color;
      this.particles.push(particle);
    }
  }

  private spawnDamageNumber(x: number, y: number, damage: number, critical: boolean) {
    if (this.damageNumbers.length >= MAX_DAMAGE_NUMBERS) return;
    const number = this.damageNumberPool.pop() ?? { x, y, value: 0, life: 0, critical: false };
    number.x = x; number.y = y; number.value = Math.round(damage); number.life = .7; number.critical = critical;
    this.damageNumbers.push(number);
  }

  private triggerFlash(color: string, duration: number) {
    this.screenFlashColor = color; this.screenFlash = duration; this.screenFlashDuration = duration;
  }

  private finish() {
    if (this.ended) return;
    this.ended = true; this.callbacks.onSound("death");
    this.callbacks.onEnd(this.kills * 10 + this.level * 100 + Math.floor(this.elapsed));
  }

  private finishVictory() {
    if (this.ended) return;
    this.ended = true; this.pendingVictory = false; this.callbacks.onSound("evolve");
    this.callbacks.onVictory(this.kills * 10 + this.level * 100 + Math.floor(this.elapsed) + 5000);
  }

  private emitHud() {
    const boss = this.enemies.find((enemy) => enemy.kind === "boss" && enemy.stageBoss && enemy.hp > 0)
      ?? this.enemies.find((enemy) => enemy.kind === "boss" && enemy.hp > 0);
    const stage = stageAt(this.stageIndex);
    this.callbacks.onHud({
      hp: Math.max(0, this.player.hp), maxHp: this.player.maxHp, level: this.level, xp: this.xp, nextXp: this.nextXp,
      kills: this.kills, elapsed: this.elapsed,
      weapons: WEAPON_IDS.filter((id) => this.weapons[id]).map((id) => ({ id, level: this.weapons[id], evolved: this.evolved.has(id) })),
      passives: PASSIVE_IDS.filter((id) => this.passives[id]).map((id) => ({ id, level: this.passives[id] })),
      tarots: [...this.tarots], shield: this.player.shield, buffTime: this.hermitBuff,
      altarBuff: this.altarBuff, altarActive: Boolean(this.altar), altarCharge: this.altar ? this.altar.charge / 1.6 : 0,
      bossHp: boss ? boss.hp / boss.maxHp : null, bossName: boss ? BOSS_STATS[boss.bossVariant ?? "infernal"].name : null, waveName: `${stage.chapter} · ${stage.name}`,
      missions: MISSION_IDS.map((id) => ({
        id, name: MISSIONS[id].name, description: MISSIONS[id].description, progress: Math.min(this.missionProgress(id), MISSIONS[id].target),
        target: MISSIONS[id].target, reward: `${ACTIVE_SKILLS[MISSIONS[id].activeSkill].name} ×1`, completed: this.completedMissions.has(id),
      })),
      activeSkills: ACTIVE_SKILL_IDS.map((id) => ({ id, ...ACTIVE_SKILLS[id], charges: this.activeSkillCharges[id] ?? 0 })),
      hordeRemaining: this.hordeRemaining, nextHordeIn: Math.max(0, this.nextHordeAt - this.elapsed), hordeIndex: this.hordeIndex,
      combo: this.combo, comboTime: this.comboTime, feverRemaining: this.feverRemaining,
      bountyRemaining: this.bountyRemaining, bountyName: this.bountyName,
      elementLast: this.characterId === "mage" ? this.lastElement : null,
      elementNext: this.characterId === "mage" && this.lastElement && this.lastElementTime > 0 ? ELEMENT_GENERATION[this.lastElement] : null,
      elementComboName: this.characterId === "mage" ? this.elementComboName : null,
      elementComboTime: this.characterId === "mage" ? this.elementComboTime : 0,
      elementComboCooldown: this.characterId === "mage" ? this.elementComboCooldown : 0,
      elementWindow: this.characterId === "mage" ? this.lastElementTime : 0,
      stageIndex: this.stageIndex, stageCount: STAGES.length, stageId: stage.id, stageName: stage.name, stageSubtitle: stage.subtitle,
      stageElapsed: this.stageElapsed, stageDuration: STAGE_DURATION, stageBossAt: STAGE_BOSS_AT, stageBossSpawned: this.stageBossSpawned,
      classUltimate: {
        ...CLASS_ULTIMATES[this.characterId], hotkey: this.characterId === "necromancer" ? "E" : "Q", charge: this.ultimateCharge,
        ready: this.ultimateCharge >= 1, active: this.isClassUltimateActive(),
      },
      dragonUltimate: this.characterId === "necromancer" ? {
        name: "骷髅巨龙", icon: "☠", description: "召唤骷髅巨龙战斗 12 秒", hotkey: "Q",
        cooldown: this.dragonCooldown, cooldownMax: BONE_DRAGON.cooldown,
        active: this.summons.some((summon) => summon.kind === "boneDragon" && summon.ttl > 0),
        visual: "summonDragon", color: "#c790ff",
      } : null,
    });
  }

  private toScreen(entity: { x: number; y: number }) { return { x: ARENA_WIDTH / 2 + entity.x - this.player.x, y: ARENA_HEIGHT / 2 + entity.y - this.player.y }; }

  private drawSprite(id: NightfallSprite, x: number, y: number, size: number, flip = false, filter = "none", alpha = 1) {
    const image = this.assets.get(id); if (!image) return false;
    const context = this.context; context.save(); context.translate(x, y); context.scale(flip ? -1 : 1, 1);
    context.globalAlpha = alpha; context.filter = filter; context.imageSmoothingEnabled = false;
    context.drawImage(image, -size / 2, -size / 2, size, size); context.restore(); return true;
  }

  private drawVfx(id: NightfallSprite, x: number, y: number, width: number, height: number, rotation: number, filter: string, alpha: number) {
    if (this.effectVfxBudget <= 0) return false;
    const image = this.assets.get(id); if (!image) return false;
    this.effectVfxBudget -= 1;
    const context = this.context; context.save(); context.translate(x, y); context.rotate(rotation);
    const vividFilter = filter === "none" ? "contrast(1.2) saturate(1.28)" : `${filter} contrast(1.16) saturate(1.24)`;
    context.globalAlpha = Math.min(1, alpha * 1.14); context.globalCompositeOperation = "source-over"; context.filter = this.renderLowDetail ? "none" : vividFilter; context.imageSmoothingEnabled = true;
    context.drawImage(image, -width / 2, -height / 2, width, height); context.restore(); return true;
  }

  private drawMaterial(id: NightfallSprite, x: number, y: number, width: number, height: number, rotation: number, alpha: number, glow: string) {
    const image = this.assets.get(id); if (!image) return false;
    const context = this.context; context.save(); context.translate(x, y); context.rotate(rotation);
    context.globalAlpha = clamp(alpha, 0, 1); context.filter = this.renderLowDetail ? "none" : `drop-shadow(0 0 5px ${glow})`; context.imageSmoothingEnabled = false;
    context.drawImage(image, -width / 2, -height / 2, width, height); context.restore(); return true;
  }

  private drawEffectMarker(effect: Effect, p: { x: number; y: number }, progress: number) {
    const areaEffect = effect.kind === "holy" || effect.kind === "frost" || effect.kind === "mist" || effect.kind === "shockwave"
      || effect.kind === "heal" || effect.kind === "meteor" || effect.kind === "plague" || effect.kind === "roots"
      || effect.kind === "water" || effect.kind === "elementFire" || effect.kind === "earth" || effect.kind === "elementCombo"
      || (effect.kind === "signature" && effect.x2 === undefined && effect.y2 === undefined);
    if (!areaEffect) return;
    const context = this.context; const pulse = Math.sin(progress * Math.PI) * .1;
    const radius = Math.max(18, effect.kind === "shockwave" ? effect.radius * Math.max(.12, progress) : effect.radius * (.82 + pulse));
    const alpha = 1 - progress;
    context.save(); context.globalCompositeOperation = "source-over";
    context.globalAlpha = alpha * .5; context.strokeStyle = "#120d24"; context.lineWidth = 9;
    context.beginPath(); context.arc(p.x, p.y, radius, 0, Math.PI * 2); context.stroke();
    context.globalAlpha = alpha * .96; context.strokeStyle = effect.color; context.shadowColor = effect.color; context.shadowBlur = 12; context.lineWidth = 3.5;
    context.beginPath(); context.arc(p.x, p.y, radius, 0, Math.PI * 2); context.stroke();
    if (effect.color2) {
      context.strokeStyle = effect.color2; context.shadowColor = effect.color2; context.lineWidth = 3;
      context.beginPath(); context.arc(p.x, p.y, Math.max(12, radius - 7), 0, Math.PI); context.stroke();
    }
    context.shadowBlur = 0; context.lineWidth = 3;
    for (let index = 0; index < 4; index += 1) {
      const angle = index * Math.PI / 2; const inner = radius - 7; const outer = radius + 7;
      context.beginPath(); context.moveTo(p.x + Math.cos(angle) * inner, p.y + Math.sin(angle) * inner); context.lineTo(p.x + Math.cos(angle) * outer, p.y + Math.sin(angle) * outer); context.stroke();
    }
    context.globalAlpha = alpha * .12; context.fillStyle = effect.color; context.beginPath(); context.arc(p.x, p.y, Math.max(10, radius * .36), 0, Math.PI * 2); context.fill();
    context.restore();
  }

  private drawBackground() {
    const context = this.context; const stage = stageAt(this.stageIndex);
    context.fillStyle = stage.palette.base; context.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);
    const floorId: NightfallSprite = stage.id === "forest" ? "stageGrassDetail" : stage.id === "town" ? "stageRoad" : stage.id === "throne" ? "floor" : "stageGrass";
    const floor = this.assets.get(floorId);
    if (floor && (!this.floorPattern || this.floorPatternStage !== this.stageIndex)) {
      const tile = document.createElement("canvas"); tile.width = 48; tile.height = 48;
      const tileContext = tile.getContext("2d");
      if (tileContext) {
        tileContext.imageSmoothingEnabled = false;
        tileContext.filter = stage.id === "desert" ? "sepia(1) saturate(.7) hue-rotate(345deg) brightness(1.15)" : stage.id === "volcano" ? "sepia(1) saturate(1.8) hue-rotate(305deg) brightness(.42)" : stage.id === "ice" ? "grayscale(.28) saturate(2.4) hue-rotate(145deg) brightness(.78) contrast(1.08)" : "none";
        tileContext.drawImage(floor, 0, 0, 48, 48); this.floorPattern = context.createPattern(tile, "repeat"); this.floorPatternStage = this.stageIndex;
      }
    }
    const grid = 48; const offsetX = ((-this.player.x % grid) + grid) % grid; const offsetY = ((-this.player.y % grid) + grid) % grid;
    if (this.floorPattern) {
      context.save(); context.translate(offsetX - grid, offsetY - grid); context.fillStyle = this.floorPattern;
      context.fillRect(0, 0, ARENA_WIDTH + grid * 2, ARENA_HEIGHT + grid * 2); context.restore();
    }
    const left = this.player.x - ARENA_WIDTH / 2; const top = this.player.y - ARENA_HEIGHT / 2;
    const startX = Math.floor(left / grid) - 1; const endX = Math.ceil((left + ARENA_WIDTH) / grid) + 1;
    const startY = Math.floor(top / grid) - 1; const endY = Math.ceil((top + ARENA_HEIGHT) / grid) + 1;
    // 地图装饰属于静态场景，不能随战斗负载开关，否则怪物/特效数量变化时会闪烁。
    // 动态特效仍由各自的负载预算控制，装饰只绘制视口内的确定性网格。
    for (let gx = startX; gx <= endX; gx += 1) {
      for (let gy = startY; gy <= endY; gy += 1) {
        const hash = Math.abs(Math.imul(gx, 73856093) ^ Math.imul(gy, 19349663));
        const x = gx * grid - left + grid / 2; const y = gy * grid - top + grid / 2;
        if (stage.id === "desert") {
          if (hash % 31 === 0) this.drawSprite("stone", x, y, 34, false, "sepia(1) saturate(1.4) hue-rotate(340deg) brightness(1.15)", .85);
          else if (hash % 79 === 0) this.drawSprite("rubble", x, y, 42, false, "sepia(1) saturate(1.2) hue-rotate(335deg)", .65);
        } else if (stage.id === "forest") {
          if (hash % 23 === 0) this.drawSprite("stageTree", x, y, 58, false, "none", .92);
          else if (hash % 43 === 0) this.drawSprite("stageFlowers", x, y, 46, false, "none", .82);
          else if (hash % 137 === 0) this.drawSprite(hash % 2 ? "stagePondLeft" : "stagePondRight", x, y, 48, false, "none", .85);
        } else if (stage.id === "volcano") {
          if (hash % 37 === 0) this.drawVfx("vfxFireScorch", x, y, 54, 54, hash, "sepia(1) saturate(8) hue-rotate(325deg)", .36);
          else if (hash % 61 === 0) this.drawSprite("stone", x, y, 32, false, "brightness(.55) sepia(1) saturate(2) hue-rotate(310deg)", .8);
          if (hash % 173 === 0) { context.strokeStyle = "#ff5b3577"; context.lineWidth = 4; context.beginPath(); context.moveTo(x - 22, y - 14); context.lineTo(x, y + 8); context.lineTo(x + 23, y - 5); context.stroke(); }
        } else if (stage.id === "ice") {
          if (hash % 47 === 0) { context.strokeStyle = "#9eefff55"; context.lineWidth = 2; context.beginPath(); context.moveTo(x - 18, y - 10); context.lineTo(x - 3, y + 2); context.lineTo(x - 10, y + 17); context.moveTo(x - 3, y + 2); context.lineTo(x + 17, y - 5); context.lineTo(x + 11, y + 12); context.stroke(); }
          else if (hash % 71 === 0) this.drawSprite("rune", x, y, 34, false, "sepia(1) saturate(5) hue-rotate(140deg) brightness(.95) contrast(1.15)", .62);
          else if (hash % 109 === 0) this.drawSprite("stone", x, y, 30, false, "grayscale(.45) saturate(1.6) hue-rotate(145deg) brightness(.72) contrast(1.2)", .78);
        } else if (stage.id === "town") {
          if (hash % 97 === 0) this.drawSprite("stageBuilding", x, y, 70, false, "sepia(.25) saturate(.8)", .88);
          else if (hash % 181 === 0) this.drawSprite("stageFountain", x, y, 62, false, "none", .9);
          else if (hash % 59 === 0) this.drawSprite("stageRoadCorner", x, y, 48, false, "none", .72);
        } else {
          if (hash % 29 === 0) this.drawSprite("rubble", x, y, grid);
          else if (hash % 71 === 0) this.drawSprite("rune", x, y, 36, false, "none", .62);
          else if (hash % 113 === 0) this.drawSprite("stone", x, y, 30);
        }
        if ((stage.id === "desert" || stage.id === "volcano" || stage.id === "throne") && hash % 181 === 0) {
          const glow = context.createRadialGradient(x, y, 4, x, y, 54); glow.addColorStop(0, "#ffad4f55"); glow.addColorStop(1, "#ff7a3000");
          context.fillStyle = glow; context.fillRect(x - 54, y - 54, 108, 108); this.drawSprite("torch", x, y, 38);
      }
      }
    }
    context.strokeStyle = stage.palette.grid; context.lineWidth = 1;
    for (let x = offsetX; x < ARENA_WIDTH; x += grid) { context.beginPath(); context.moveTo(x, 0); context.lineTo(x, ARENA_HEIGHT); context.stroke(); }
    for (let y = offsetY; y < ARENA_HEIGHT; y += grid) { context.beginPath(); context.moveTo(0, y); context.lineTo(ARENA_WIDTH, y); context.stroke(); }
    const vignette = context.createRadialGradient(ARENA_WIDTH / 2, ARENA_HEIGHT / 2, 80, ARENA_WIDTH / 2, ARENA_HEIGHT / 2, 650);
    vignette.addColorStop(0, `${stage.palette.accent}14`); vignette.addColorStop(.62, `${stage.palette.vignette}18`); vignette.addColorStop(1, `${stage.palette.vignette}cc`);
    context.fillStyle = vignette; context.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);
  }

  private drawEnemies() {
    const crowded = this.enemies.length > 100;
    const lowDetail = this.renderLowDetail;
    this.enemies.forEach((enemy) => {
      if (enemy.hp <= 0) return;
      const p = this.toScreen(enemy); if (p.x < -70 || p.x > ARENA_WIDTH + 70 || p.y < -70 || p.y > ARENA_HEIGHT + 70) return;
      const context = this.context; context.save(); context.translate(p.x, p.y);
      const color = enemy.kind === "boss" ? "#ff594e" : enemy.kind === "brute" ? "#df8e72" : enemy.kind === "wolf" ? "#aab4d5" : "#bba0e5";
      if (enemy.kind === "boss") { context.globalAlpha = .2; context.fillStyle = "#ff4f64"; context.beginPath(); context.arc(0, 0, enemy.radius + 18 + Math.sin(this.elapsed * 4) * 4, 0, Math.PI * 2); context.fill(); context.globalAlpha = 1; }
      if (enemy.bounty) {
        context.save();
        context.globalAlpha = .25 + Math.sin(this.elapsed * 8) * .07; context.fillStyle = "#ffd35f"; context.beginPath(); context.arc(0, 0, enemy.radius + 16 + Math.sin(this.elapsed * 5) * 3, 0, Math.PI * 2); context.fill();
        context.globalAlpha = 1; context.strokeStyle = "#ffe593"; context.lineWidth = 3; context.setLineDash([5, 4]); context.rotate(-this.elapsed * .8); context.strokeRect(-enemy.radius - 10, -enemy.radius - 10, enemy.radius * 2 + 20, enemy.radius * 2 + 20); context.setLineDash([]);
        context.restore();
      }
      context.shadowColor = enemy.frozen > 0 ? "#6de9ff" : color;
      context.shadowBlur = enemy.kind === "boss" || enemy.bounty ? 22 : crowded ? 0 : 10;
      const spriteId: NightfallSprite = enemy.kind === "boss" ? BOSS_STATS[enemy.bossVariant ?? "infernal"].sprite : ENEMY_STATS[enemy.kind].sprite;
      const sprite = this.assets.get(spriteId); const size = enemy.kind === "boss" ? enemy.radius * 2.25 : enemy.radius * 2.55;
      if (sprite) {
        context.imageSmoothingEnabled = false; context.scale(enemy.vx < 0 ? -1 : 1, 1);
        context.filter = lowDetail ? "none" : enemy.hitFlash > 0 ? "brightness(3) saturate(.2)" : enemy.frozen > 0 ? "sepia(1) saturate(4) hue-rotate(145deg) brightness(1.4)" : "none";
        const bob = Math.sin(this.elapsed * 7 + enemy.id) * 1.5; context.drawImage(sprite, -size / 2, -size / 2 + bob, size, size); context.filter = "none";
        if (lowDetail && enemy.hitFlash > 0) {
          context.globalAlpha = .28; context.fillStyle = "#fff4c7"; context.beginPath(); context.arc(0, 0, enemy.radius * .82, 0, Math.PI * 2); context.fill(); context.globalAlpha = 1;
        } else if (lowDetail && enemy.frozen > 0 && (enemy.kind === "boss" || enemy.bounty)) {
          context.globalAlpha = .65; context.strokeStyle = "#75e9ff"; context.lineWidth = 3; context.beginPath(); context.arc(0, 0, enemy.radius + 4, 0, Math.PI * 2); context.stroke(); context.globalAlpha = 1;
        }
      } else {
        context.fillStyle = color; context.beginPath(); context.arc(0, 0, enemy.radius, 0, Math.PI * 2); context.fill();
      }
      context.setTransform(1, 0, 0, 1, 0, 0); const barX = p.x - Math.max(14, enemy.radius); const barY = p.y - size / 2 - 8;
      if (enemy.kind === "boss") {
        const bossName = BOSS_STATS[enemy.bossVariant ?? "infernal"].name; const stageBoss = Boolean(enemy.stageBoss);
        context.shadowBlur = 0; context.font = `${stageBoss ? 800 : 700} ${stageBoss ? 13 : 11}px sans-serif`; context.textAlign = "center"; context.textBaseline = "middle";
        const labelWidth = Math.min(210, Math.max(stageBoss ? 118 : 86, context.measureText(bossName).width + 22));
        const labelX = clamp(p.x, labelWidth / 2 + 4, ARENA_WIDTH - labelWidth / 2 - 4); const labelY = barY - (stageBoss ? 18 : 15);
        context.fillStyle = stageBoss ? "#1d1012e8" : "#21131bdd"; context.fillRect(labelX - labelWidth / 2, labelY - 9, labelWidth, 18);
        context.strokeStyle = stageBoss ? "#ffc45c" : "#ff697a"; context.lineWidth = stageBoss ? 2 : 1.5; context.strokeRect(labelX - labelWidth / 2, labelY - 9, labelWidth, 18);
        context.fillStyle = stageBoss ? "#fff0b6" : "#ffd5dc"; context.fillText(bossName, labelX, labelY + .5);
      }
      if (enemy.hp < enemy.maxHp && (!crowded || enemy.kind === "boss" || enemy.bounty)) { context.fillStyle = "#190f1ccc"; context.fillRect(barX, barY, enemy.radius * 2, 4); context.fillStyle = enemy.kind === "boss" ? "#ff304f" : "#ff5368"; context.fillRect(barX, barY, enemy.radius * 2 * clamp(enemy.hp / enemy.maxHp, 0, 1), 4); }
      context.restore();
    });
  }

  private drawSummons() {
    const crowded = this.summons.length > 12;
    this.summons.forEach((summon) => {
      const p = this.toScreen(summon); if (p.x < -100 || p.x > ARENA_WIDTH + 100 || p.y < -100 || p.y > ARENA_HEIGHT + 100) return;
      const spriteId = SUMMON_SPRITES[summon.kind];
      const dragon = summon.kind === "boneDragon";
      const size = dragon ? 108 : summon.radius * (summon.kind === "graveGolem" ? 2.9 : 2.7);
      const pulse = Math.sin(this.elapsed * 6 + summon.id) * 3;
      if (!crowded || dragon) this.drawVfx(dragon ? "vfxBatAura" : "vfxSkeletons", p.x, p.y + size * .18, size * (dragon ? 1.45 : 1.05), size * .62, this.elapsed * .45, dragon ? "sepia(1) saturate(7) hue-rotate(220deg)" : "sepia(1) saturate(4) hue-rotate(205deg)", dragon ? .42 : .2);
      const context = this.context; context.save(); context.translate(p.x, p.y + pulse); context.scale(summon.vx < 0 ? -1 : 1, 1);
      context.globalAlpha = dragon ? .34 : .24; context.fillStyle = "#39e87b"; context.shadowColor = "#39e87b"; context.shadowBlur = dragon ? 30 : 16;
      context.beginPath(); context.arc(0, 0, size * .56, 0, Math.PI * 2); context.fill();
      context.globalAlpha = dragon ? .95 : .82; context.strokeStyle = "#6dff9c"; context.lineWidth = dragon ? 4 : 2.5; context.shadowBlur = dragon ? 22 : 11;
      context.beginPath(); context.arc(0, 0, size * .54, 0, Math.PI * 2); context.stroke();
      context.globalAlpha = 1;
      context.shadowColor = dragon ? "#b98cff" : summon.kind === "wraith" ? "#72e9ff" : "#d4c8ff"; context.shadowBlur = dragon ? 28 : crowded ? 4 : 13;
      const sprite = this.assets.get(spriteId);
      if (sprite) {
        context.imageSmoothingEnabled = false;
        context.filter = summon.kind === "wraith" ? "sepia(.4) saturate(2) hue-rotate(135deg) brightness(1.25)" : "none";
        context.drawImage(sprite, -size / 2, -size / 2, size, size); context.filter = "none";
      }
      context.restore();
      const healthRatio = clamp(summon.hp / summon.maxHp, 0, 1);
      if (!dragon && (summon.kind === "deathLegion" || summon.hp < summon.maxHp) && (!crowded || summon.kind === "deathLegion" || healthRatio < .35)) {
        const width = Math.max(22, summon.radius * 2.2); const ratio = healthRatio;
        context.save(); context.fillStyle = "#160f20dc"; context.fillRect(p.x - width / 2, p.y - size / 2 - 7, width, 4);
        context.fillStyle = ratio > .45 ? "#54e88b" : "#2fba69"; context.fillRect(p.x - width / 2, p.y - size / 2 - 7, width * ratio, 4); context.restore();
      }
    });
  }

  private drawPlayer() {
    const context = this.context; const x = ARENA_WIDTH / 2; const y = ARENA_HEIGHT / 2;
    if (this.altarBuff > 0) {
      const altarPulse = 66 + Math.sin(this.elapsed * 7) * 6;
      this.drawVfx("vfxRing", x, y, altarPulse, altarPulse, -this.elapsed * 1.4, "sepia(1) saturate(7) hue-rotate(105deg) brightness(1.3)", .34);
    }
    if (this.feverRemaining > 0) {
      const pulse = 72 + Math.sin(this.elapsed * 9) * 8;
      this.drawVfx("vfxTwirl", x, y, pulse * 2, pulse * 2, this.elapsed * 1.7, "sepia(1) saturate(8) hue-rotate(330deg) brightness(1.35)", .34);
      this.drawVfx("vfxFlare", x, y, pulse * 1.45, pulse * 1.45, -this.elapsed * .7, "sepia(1) saturate(8) hue-rotate(325deg) brightness(1.3)", .34);
    }
    if (this.tarots.has("lovers")) { context.globalAlpha = .16; context.fillStyle = "#ff71b8"; context.beginPath(); context.arc(x, y, 62, 0, Math.PI * 2); context.fill(); context.globalAlpha = 1; }
    if (this.player.shield) { context.strokeStyle = "#ffd76b"; context.lineWidth = 4; context.shadowColor = "#ffd76b"; context.shadowBlur = 14; context.beginPath(); context.arc(x, y, 29, 0, Math.PI * 2); context.stroke(); }
    context.save(); context.fillStyle = "#140f1e88"; context.beginPath(); context.ellipse(x, y + 20, 21, 8, 0, 0, Math.PI * 2); context.fill(); context.restore();
    const sprite = this.assets.get(this.characterId); const main = this.characterId === "paladin" ? "#ffd976" : this.characterId === "ranger" ? "#79e2a2" : this.characterId === "necromancer" ? "#c68cff" : this.characterId === "elf" ? "#9dff78" : "#72e8ff";
    context.save(); context.translate(x, y + Math.sin(this.elapsed * 8) * 1.2); context.scale(this.player.facingX < 0 ? -1 : 1, 1); context.shadowColor = main; context.shadowBlur = 14;
    if (sprite) { context.imageSmoothingEnabled = false; context.drawImage(sprite, -25, -29, 50, 50); }
    else { context.fillStyle = main; context.beginPath(); context.arc(0, 0, 18, 0, Math.PI * 2); context.fill(); }
    context.restore();
  }

  private drawGems() {
    this.gems.forEach((gem) => {
      const p = this.toScreen(gem); if (p.x < -20 || p.x > ARENA_WIDTH + 20 || p.y < -20 || p.y > ARENA_HEIGHT + 20) return;
      const color = gem.value > 10 ? "#ffd86d" : "#67e5ff";
      if (this.gemMagnetTime > 0) {
        const dx = gem.x - this.player.x; const dy = gem.y - this.player.y; const length = Math.hypot(dx, dy) || 1;
        this.context.save(); this.context.globalAlpha = .62; this.context.strokeStyle = color; this.context.shadowColor = color; this.context.shadowBlur = 8; this.context.lineWidth = gem.value > 10 ? 3 : 2;
        this.context.beginPath(); this.context.moveTo(p.x, p.y); this.context.lineTo(p.x + dx / length * 20, p.y + dy / length * 20); this.context.stroke(); this.context.restore();
      }
      this.context.save(); this.context.translate(p.x, p.y); this.context.rotate(this.elapsed * 1.5 + Math.PI / 4);
      this.context.fillStyle = color; this.context.shadowColor = color; this.context.shadowBlur = gem.value > 10 ? 14 : 8; this.context.fillRect(-gem.radius, -gem.radius, gem.radius * 2, gem.radius * 2); this.context.restore();
    });
  }

  private drawSupplies() {
    this.supplies.forEach((supply) => {
      const p = this.toScreen(supply); if (p.x < -45 || p.x > ARENA_WIDTH + 45 || p.y < -45 || p.y > ARENA_HEIGHT + 45) return;
      const color = supply.kind === "heal" ? "#87ff9c" : "#70eaff";
      const filter = supply.kind === "heal" ? "sepia(1) saturate(7) hue-rotate(70deg) brightness(1.25)" : "sepia(1) saturate(7) hue-rotate(145deg) brightness(1.25)";
      const pulse = 44 + Math.sin(this.elapsed * 6 + supply.id) * 5;
      this.drawVfx("vfxRing", p.x, p.y, pulse, pulse, this.elapsed, filter, .7);
      this.drawVfx("vfxFlare", p.x, p.y, pulse * .82, pulse * .82, -this.elapsed * 1.4, filter, .72);
      const context = this.context; context.save(); context.translate(p.x, p.y); context.shadowColor = color; context.shadowBlur = 13;
      context.fillStyle = "#151024e8"; context.strokeStyle = color; context.lineWidth = 2; context.beginPath(); context.arc(0, 0, 13, 0, Math.PI * 2); context.fill(); context.stroke();
      context.fillStyle = color; context.textAlign = "center"; context.textBaseline = "middle"; context.font = "bold 13px sans-serif";
      context.fillText(supply.kind === "heal" ? "+" : "◆", 0, 1); context.restore();
    });
  }

  private drawAltar() {
    if (!this.altar) return;
    const p = this.toScreen(this.altar); if (p.x < -80 || p.x > ARENA_WIDTH + 80 || p.y < -80 || p.y > ARENA_HEIGHT + 80) return;
    const context = this.context; const progress = clamp(this.altar.charge / 1.6, 0, 1); const pulse = 84 + Math.sin(this.elapsed * 4.5) * 8;
    this.drawVfx("vfxRing", p.x, p.y, pulse, pulse, this.elapsed * .65, "sepia(1) saturate(8) hue-rotate(95deg) brightness(1.25)", .62);
    this.drawVfx("vfxMagic", p.x, p.y, pulse * .68, pulse * .68, -this.elapsed * .9, "sepia(1) saturate(8) hue-rotate(105deg) brightness(1.35)", .58);
    this.drawSprite("rune", p.x, p.y, 36, false, "sepia(1) saturate(7) hue-rotate(100deg) brightness(1.45)");
    context.save(); context.strokeStyle = "#75f2c2"; context.lineWidth = 5; context.shadowColor = "#75f2c2"; context.shadowBlur = 12;
    context.beginPath(); context.arc(p.x, p.y, 49, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress); context.stroke();
    context.fillStyle = "#ddfff3"; context.textAlign = "center"; context.font = "bold 11px sans-serif"; context.fillText(progress > 0 ? `共鸣 ${Math.round(progress * 100)}%` : "灵魂祭坛", p.x, p.y + 66); context.restore();
  }

  private drawUltimateAltars() {
    const context = this.context; const ultimate = CLASS_ULTIMATES[this.characterId];
    this.ultimateAltars.forEach((altar) => {
      const p = this.toScreen(altar); if (p.x < -90 || p.x > ARENA_WIDTH + 90 || p.y < -90 || p.y > ARENA_HEIGHT + 90) return;
      const inside = !altar.consumed && distanceSquared(this.player, altar) <= (60 + this.player.radius) ** 2;
      const pulse = 96 + Math.sin(this.elapsed * 4.2 + altar.id) * 8;
      const alpha = altar.consumed ? .16 : inside ? .88 : .62;
      this.drawVfx("vfxRing", p.x, p.y, pulse, pulse, -this.elapsed * .55, "sepia(1) saturate(9) hue-rotate(230deg) brightness(1.25)", alpha);
      if (!altar.consumed) this.drawVfx("vfxMagic", p.x, p.y, pulse * .66, pulse * .66, this.elapsed * .9, "sepia(1) saturate(9) hue-rotate(225deg) brightness(1.4)", inside ? .76 : .48);
      this.drawSprite("ultimateAltar", p.x, p.y - 4, 72, false, altar.consumed ? "grayscale(1) brightness(.5)" : "sepia(1) saturate(8) hue-rotate(225deg) brightness(1.18)", altar.consumed ? .28 : 1);
      context.save(); context.strokeStyle = altar.consumed ? "#665571" : "#bd6cff"; context.lineWidth = inside ? 5 : 3; context.shadowColor = "#b85cff"; context.shadowBlur = altar.consumed ? 0 : 12;
      context.beginPath(); context.arc(p.x, p.y, 52, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (altar.consumed ? 1 : this.ultimateCharge)); context.stroke();
      context.fillStyle = altar.consumed ? "#887796" : inside ? "#f3d7ff" : "#d7a9ff"; context.textAlign = "center"; context.font = "bold 11px sans-serif";
      context.fillText(altar.consumed ? "祭坛已耗尽" : inside ? `${ultimate.name} ${Math.round(this.ultimateCharge * 100)}%` : "大招祭坛 · 停留充能", p.x, p.y + 69); context.restore();
    });
  }

  private drawHostileProjectiles() {
    this.hostileProjectiles.forEach((projectile) => {
      const p = this.toScreen(projectile); const angle = Math.atan2(projectile.vy, projectile.vx) + Math.PI / 2;
      if (projectile.kind === "stone") this.drawSprite("stone", p.x, p.y, projectile.radius * 2.3);
      else if (projectile.kind === "fire") this.drawVfx("vfxFlame", p.x, p.y, projectile.radius * 5, projectile.radius * 5, angle, "sepia(1) saturate(9) hue-rotate(330deg) brightness(1.2)", .9);
      else if (projectile.kind === "orb") this.drawVfx("vfxMagic", p.x, p.y, projectile.radius * 4.5, projectile.radius * 4.5, this.elapsed * 2, "sepia(1) saturate(7) hue-rotate(230deg) brightness(1.2)", .9);
      else this.drawVfx("vfxRing", p.x, p.y, projectile.radius * 3.4, projectile.radius * 3.4, this.elapsed, "sepia(1) saturate(2) hue-rotate(170deg)", .75);
    });
  }

  private drawProjectiles() {
    const crowdedProjectiles = this.projectiles.length > 36;
    this.projectiles.forEach((projectile) => {
      const p = this.toScreen(projectile); const spin = projectile.age * (projectile.kind === "boomerang" ? 10 : 5);
      if (projectile.kind === "boomerang") { this.drawMaterial("rangerThunderBoomerang", p.x, p.y, projectile.radius * 4.2, projectile.radius * 4.2, spin, .96, "#52dfff"); if (!crowdedProjectiles) this.drawVfx("vfxSpark", p.x, p.y, 42, 42, -spin * .7, "sepia(1) saturate(7) hue-rotate(135deg) brightness(1.3)", .36); }
      if (projectile.kind === "mage") this.drawVfx("vfxStar", p.x, p.y, 35, 35, spin, "sepia(1) saturate(7) hue-rotate(350deg) brightness(1.25)", .9);
      if (projectile.kind === "soul") { this.drawVfx("vfxSoul", p.x, p.y, projectile.radius * 5, projectile.radius * 5, spin, "sepia(1) saturate(8) hue-rotate(215deg) brightness(1.2)", .84); if (!crowdedProjectiles) this.drawVfx("vfxSoulStar", p.x, p.y, projectile.radius * 3, projectile.radius * 3, -spin, "sepia(1) saturate(7) hue-rotate(220deg)", .6); }
      if (projectile.kind === "signature" && projectile.visual) {
        const angle = Math.atan2(projectile.vy, projectile.vx) + Math.PI / 2;
        this.drawMaterial(projectile.visual, p.x, p.y, projectile.radius * 4.4, projectile.radius * 4.4, angle, .96, projectile.color ?? "#ffffff");
        if (!crowdedProjectiles) {
          const speed = Math.hypot(projectile.vx, projectile.vy) || 1; const trail = Math.min(34, projectile.radius * 2.7);
          this.context.save(); this.context.globalAlpha = .58; this.context.strokeStyle = "#100c20"; this.context.lineWidth = Math.max(6, projectile.radius * .5);
          this.context.beginPath(); this.context.moveTo(p.x, p.y); this.context.lineTo(p.x - projectile.vx / speed * trail, p.y - projectile.vy / speed * trail); this.context.stroke();
          this.context.globalAlpha = .82; this.context.strokeStyle = projectile.color ?? "#ffffff"; this.context.shadowColor = projectile.color ?? "#ffffff"; this.context.shadowBlur = 8; this.context.lineWidth = Math.max(2.5, projectile.radius * .3);
          this.context.beginPath(); this.context.moveTo(p.x, p.y); this.context.lineTo(p.x - projectile.vx / speed * trail, p.y - projectile.vy / speed * trail); this.context.stroke(); this.context.restore();
        }
      }
      if (projectile.kind === "bat") {
        this.drawVfx("vfxBatAura", p.x, p.y, projectile.radius * 3.4, projectile.radius * 3.4, -spin * .18, "sepia(1) saturate(7) hue-rotate(225deg) brightness(1.15)", .48);
        if (!crowdedProjectiles) this.drawVfx("vfxBatSmoke", p.x, p.y + 5, projectile.radius * 4, projectile.radius * 3, spin * .15, "sepia(1) saturate(5) hue-rotate(225deg)", .3);
      }
      const context = this.context; context.save(); context.translate(p.x, p.y); context.rotate(spin);
      context.shadowBlur = 12;
      if (projectile.kind === "bat") {
        const bat = this.assets.get("bat"); context.shadowColor = "#a86ce7";
        if (bat) { context.imageSmoothingEnabled = false; const batSize = projectile.radius * (3 + Math.sin(projectile.age * 13) * .18); context.drawImage(bat, -batSize / 2, -batSize / 2, batSize, batSize); }
        else { context.fillStyle = "#a86ce7"; context.beginPath(); context.moveTo(0, -5); context.lineTo(-13, -10); context.lineTo(-8, 5); context.lineTo(0, 1); context.lineTo(8, 5); context.lineTo(13, -10); context.closePath(); context.fill(); }
      }
      else if (projectile.kind === "mage" || projectile.kind === "soul") { context.fillStyle = projectile.kind === "mage" ? "#fff3a2" : "#d29cff"; context.shadowColor = context.fillStyle; context.beginPath(); context.arc(0, 0, projectile.radius, 0, Math.PI * 2); context.fill(); }
      else if (projectile.kind === "signature") { context.globalAlpha = 0; }
      else { context.strokeStyle = "#75eaff"; context.shadowColor = "#75eaff"; context.lineWidth = 5; context.beginPath(); context.arc(0, 0, projectile.radius, -1.1, 1.1); context.stroke(); }
      context.restore();
    });
  }

  private drawAxes() {
    const level = this.weapons.axes ?? 0; if (!level) return;
    const evolved = this.evolved.has("axes"); const count = level >= 5 || evolved ? 3 : level >= 3 ? 2 : 1; const orbit = 62 * LEVEL_SIZE[level] * (evolved ? 1.45 : 1);
    this.drawVfx("vfxTwirl", ARENA_WIDTH / 2, ARENA_HEIGHT / 2, orbit * 2.45, orbit * 2.45, this.elapsed * .8, "sepia(1) saturate(7) hue-rotate(350deg) brightness(1.18)", evolved ? .38 : .22);
    for (let index = 0; index < count; index += 1) {
      const angle = this.elapsed * Math.PI * 2 + (index / count) * Math.PI * 2; const x = ARENA_WIDTH / 2 + Math.cos(angle) * orbit; const y = ARENA_HEIGHT / 2 + Math.sin(angle) * orbit;
      this.context.save(); this.context.translate(x, y); this.context.rotate(angle + Math.PI / 2); this.context.shadowColor = "#ffcf68"; this.context.shadowBlur = 12;
      const axe = this.assets.get("axe");
      if (axe) { this.context.imageSmoothingEnabled = false; const size = evolved ? 54 : 42; this.context.drawImage(axe, -size / 2, -size / 2, size, size); }
      else { this.context.fillStyle = evolved ? "#ffcf68" : "#d5c7e8"; this.context.fillRect(-4, -18, 8, 28); }
      this.context.restore();
    }
  }

  private drawEffects() {
    const denseVfx = this.effects.length > 45;
    const lowDetail = this.isUnderLoad(); const detailStart = lowDetail ? Math.max(0, this.effects.length - 24) : 0;
    this.effects.forEach((effect, index) => {
      const essentialMaterial = effect.kind === "whip" || effect.kind === "holy" || effect.kind === "frost" || effect.kind === "chain" || effect.kind === "metal" || effect.kind === "roots" || effect.kind === "water" || effect.kind === "elementFire" || effect.kind === "earth" || effect.kind === "elementCombo" || effect.kind === "signature";
      if (index < detailStart && effect.kind !== "plague" && effect.kind !== "mist" && !essentialMaterial) return;
      if (effect.age < 0) return; const p = this.toScreen(effect); const progress = clamp(effect.age / effect.duration, 0, 1); const context = this.context; context.save(); context.globalAlpha = 1 - progress;
      context.strokeStyle = effect.color; context.fillStyle = effect.color; context.shadowColor = effect.color; context.shadowBlur = 18; context.lineWidth = 5;
      this.drawEffectMarker(effect, p, progress);
      if (effect.kind === "chest") { this.drawSprite("chest", p.x, p.y - Math.sin(progress * Math.PI) * 12, 54, false, "none", 1 - progress * .4); context.beginPath(); context.arc(p.x, p.y, effect.radius * progress, 0, Math.PI * 2); context.stroke(); }
      else if (effect.kind === "whip") {
        const facing = Math.atan2(this.player.facingY, this.player.facingX); const swing = facing - .72 + progress * 1.44;
        const swordDistance = effect.radius * .55; const swordX = p.x + Math.cos(swing) * swordDistance; const swordY = p.y + Math.sin(swing) * swordDistance;
        this.drawMaterial("paladinFlameSword", swordX, swordY, effect.radius * .72, effect.radius * 1.45, swing + Math.PI / 2, 1 - progress * .42, "#ff7a32");
        if (!denseVfx) this.drawVfx("vfxFlame", swordX, swordY, effect.radius * .7, effect.radius * .7, swing + Math.PI / 2, "sepia(1) saturate(9) hue-rotate(330deg) brightness(1.2)", (1 - progress) * .28);
      } else if (effect.kind === "holy") {
        const descent = p.y - 95 + progress * 82;
        this.drawMaterial("paladinHolyStaff", p.x, descent, effect.radius * .9, effect.radius * 2.25, 0, 1 - progress * .48, "#ffe56b");
        if (!denseVfx) this.drawVfx("vfxStar", p.x, p.y, effect.radius * 1.8, effect.radius * 1.8, progress * Math.PI, "sepia(1) saturate(7) hue-rotate(350deg) brightness(1.35)", (1 - progress) * .34);
      } else if (effect.kind === "frost") {
        const shieldDistance = effect.radius * (.45 + progress * .42);
        for (let shieldIndex = 0; shieldIndex < 4; shieldIndex += 1) {
          const angle = shieldIndex / 4 * Math.PI * 2 + effect.age * 1.4;
          this.drawMaterial("paladinFrostShield", p.x + Math.cos(angle) * shieldDistance, p.y + Math.sin(angle) * shieldDistance, effect.radius * .56, effect.radius * .56, angle + Math.PI / 2, 1 - progress * .58, "#5de5ff");
        }
      } else if (effect.kind === "mist") {
        this.drawVfx("vfxMist", p.x, p.y, effect.radius * 2.25, effect.radius * 2.25, effect.age * .25, "sepia(1) saturate(7) hue-rotate(140deg) contrast(1.15)", .3 + Math.sin(effect.age * 5) * .05);
      } else if (effect.kind === "shockwave") {
        this.drawVfx("vfxShock", p.x, p.y, effect.radius * 2 * progress, effect.radius * 2 * progress, progress * .8, "sepia(1) saturate(7) hue-rotate(250deg) brightness(1.2)", 1 - progress);
      } else if (effect.kind === "heal") {
        this.drawVfx("vfxHeal", p.x, p.y, effect.radius * (1.7 - progress * .35), effect.radius * (1.7 - progress * .35), progress * Math.PI, "sepia(1) saturate(7) hue-rotate(70deg) brightness(1.35)", 1 - progress);
      } else if (effect.kind === "meteor") {
        const fallY = p.y - (1 - progress) * 180;
        this.drawVfx("vfxMeteorFlame", p.x, fallY, effect.radius * 1.45, effect.radius * 1.45, Math.PI, "sepia(1) saturate(9) hue-rotate(330deg) brightness(1.25)", 1 - progress * .35);
        this.drawVfx("vfxMeteorScorch", p.x, p.y, effect.radius * 1.5, effect.radius * 1.5, progress * .6, "sepia(1) saturate(7) hue-rotate(335deg)", (1 - progress) * .6);
        this.drawVfx("vfxSpark", p.x, p.y, effect.radius * 2 * progress, effect.radius * 2 * progress, progress * 2, "sepia(1) saturate(9) hue-rotate(330deg) brightness(1.3)", 1 - progress);
      } else if (effect.kind === "chain") {
        const end = this.toScreen({ x: effect.x2 ?? effect.x, y: effect.y2 ?? effect.y }); const dx = end.x - p.x; const dy = end.y - p.y; const length = Math.hypot(dx, dy);
        context.globalCompositeOperation = "source-over"; context.globalAlpha = (1 - progress) * .65; context.strokeStyle = "#101b35"; context.lineWidth = 9;
        context.beginPath(); context.moveTo(p.x, p.y); context.lineTo(end.x, end.y); context.stroke();
        context.globalAlpha = (1 - progress) * .95; context.strokeStyle = "#38dfff"; context.shadowColor = "#38dfff"; context.shadowBlur = 12; context.lineWidth = 3.5;
        context.beginPath(); context.moveTo(p.x, p.y); context.lineTo(end.x, end.y); context.stroke();
        const travel = Math.min(1, progress * 1.6);
        this.drawMaterial("rangerChainArrow", p.x + dx * travel, p.y + dy * travel, 30, Math.max(48, Math.min(82, length * .52)), Math.atan2(dy, dx) + Math.PI / 2, 1 - progress * .35, "#38dfff");
        this.drawVfx("vfxThunderSpark", end.x, end.y, 46, 46, progress * 4, "sepia(1) saturate(8) hue-rotate(140deg) brightness(1.35)", 1 - progress);
      } else if (effect.kind === "plague") {
        this.drawVfx("vfxPlagueSmoke", p.x, p.y, effect.radius * 2.25, effect.radius * 2.25, effect.age * .28, "sepia(1) saturate(9) hue-rotate(65deg) brightness(1.08)", (1 - progress) * .44);
        this.drawVfx("vfxPlagueMagic", p.x, p.y, effect.radius * 1.75, effect.radius * 1.75, -effect.age * 1.2, "sepia(1) saturate(9) hue-rotate(72deg) brightness(1.16)", (1 - progress) * .78);
      } else if (effect.kind === "roots") {
        const growth = .68 + Math.sin(progress * Math.PI) * .42;
        this.drawMaterial("elementWoodRoots", p.x, p.y, effect.radius * 2.25 * growth, effect.radius * 2.25 * growth, -effect.age * .18, 1 - progress * .68, "#48ef70");
        if (!denseVfx) this.drawVfx("vfxWoodSmoke", p.x, p.y, effect.radius * 2.05, effect.radius * 2.05, effect.age * .2, "sepia(1) saturate(8) hue-rotate(52deg) brightness(1.08)", (1 - progress) * .18);
      } else if (effect.kind === "metal") {
        const end = this.toScreen({ x: effect.x2 ?? effect.x, y: effect.y2 ?? effect.y }); const dx = end.x - p.x; const dy = end.y - p.y;
        const travel = Math.min(1, progress * 1.38); const bladeX = p.x + dx * travel; const bladeY = p.y + dy * travel;
        this.drawMaterial("elementMetalBlade", bladeX, bladeY, effect.radius * 1.65, effect.radius * 3.35, Math.atan2(dy, dx) + Math.PI / 2, 1 - progress * .34, "#8fe7ff");
        if (!denseVfx) this.drawVfx("vfxMetalScratch", end.x, end.y, effect.radius * 2.35, effect.radius * 2.35, -progress * 2, "brightness(1.7)", (1 - progress) * .38);
      } else if (effect.kind === "water") {
        const surge = .7 + Math.sin(progress * Math.PI) * .5;
        this.drawMaterial("elementWaterCrest", p.x, p.y + 10 - progress * 16, effect.radius * 2.2 * surge, effect.radius * 2.2 * surge, Math.sin(effect.age * 8) * .035, 1 - progress * .62, "#39d8ff");
      } else if (effect.kind === "elementFire") {
        const fallY = p.y - (1 - progress) * 190;
        const impactScale = progress < .78 ? 1 : 1 + (progress - .78) * 1.8;
        this.drawMaterial("elementFireMeteor", p.x, fallY, effect.radius * 1.55 * impactScale, effect.radius * 1.85 * impactScale, progress * .18, 1 - progress * .45, "#ff5a2f");
        if (!denseVfx && progress > .58) this.drawVfx("vfxFireScorch", p.x, p.y, effect.radius * 1.7, effect.radius * 1.7, -progress, "sepia(1) saturate(8) hue-rotate(335deg)", (1 - progress) * .38);
      } else if (effect.kind === "earth") {
        const rise = .35 + Math.sin(Math.min(1, progress * 1.35) * Math.PI / 2) * .88;
        this.drawMaterial("elementEarthSpikes", p.x, p.y + effect.radius * .18, effect.radius * 2.15 * rise, effect.radius * 2.15 * rise, 0, 1 - progress * .7, "#f0a243");
        if (!denseVfx) this.drawVfx("vfxEarthDust", p.x, p.y, effect.radius * 2.15, effect.radius * 1.3, effect.age * .4, "sepia(1) saturate(4) hue-rotate(350deg) brightness(.95)", (1 - progress) * .28);
      } else if (effect.kind === "elementCombo" && effect.visual && effect.visual2) {
        const comboKey: ElementComboKey | undefined = effect.comboKey;
        const combo = comboKey ? ELEMENT_COMBOS[comboKey] : null;
        const secondary = effect.color2 ?? effect.color;
        const pulse = effect.radius * 2 * (.68 + Math.sin(progress * Math.PI) * .58);
        this.drawMaterial(effect.visual, p.x, p.y, pulse * 1.18, pulse * 1.18, Math.sin(effect.age * 7) * .025, 1 - progress * .48, effect.color);
        if (combo?.pattern === "inferno") {
          [-.62, .62].forEach((offset) => this.drawMaterial(effect.visual2!, p.x + offset * effect.radius, p.y - 62 + progress * 52, effect.radius * .72, effect.radius * .9, 0, (1 - progress) * .86, secondary));
        } else if (combo?.pattern === "magma") {
          this.drawMaterial(effect.visual2, p.x, p.y + effect.radius * .42, effect.radius * 1.45, effect.radius * 1.45, 0, (1 - progress) * .86, secondary);
        } else if (combo?.pattern === "blades") {
          for (let index = 0; index < 8; index += 1) {
            const angle = index / 8 * Math.PI * 2 + progress * .7; const bladeDistance = effect.radius * (.88 - progress * .45);
            this.drawMaterial(effect.visual2, p.x + Math.cos(angle) * bladeDistance, p.y + Math.sin(angle) * bladeDistance, effect.radius * .25, effect.radius * .54, angle + Math.PI / 2, 1 - progress, secondary);
          }
        } else if (combo?.pattern === "iceRain") {
          for (let index = -2; index <= 2; index += 1) {
            this.drawMaterial("elementMetalBlade", p.x + index * effect.radius * .3, p.y - 100 + progress * 112, effect.radius * .22, effect.radius * .5, Math.PI, (1 - progress) * (index === 0 ? 1 : .78), secondary);
          }
        } else if (combo?.pattern === "vortex") {
          this.drawMaterial(effect.visual2, p.x, p.y, pulse * .72, pulse * .72, -effect.age * .42, (1 - progress) * .84, secondary);
        }
        context.globalCompositeOperation = "source-over"; context.globalAlpha = (1 - progress) * .95; context.lineWidth = 9 - progress * 5;
        context.strokeStyle = effect.color; context.beginPath(); context.arc(p.x, p.y, effect.radius * (.28 + progress * .95), 0, Math.PI * 2); context.stroke();
        context.strokeStyle = secondary; context.lineWidth = 5 - progress * 2; context.beginPath(); context.arc(p.x, p.y, effect.radius * (1.12 - progress * .52), 0, Math.PI * 2); context.stroke();
      } else if (effect.kind === "signature" && effect.visual) {
        if (effect.x2 !== undefined && effect.y2 !== undefined) {
          const end = this.toScreen({ x: effect.x2, y: effect.y2 }); const dx = end.x - p.x; const dy = end.y - p.y;
          const travel = Math.min(1, progress * 1.45); const materialX = p.x + dx * travel; const materialY = p.y + dy * travel;
          this.drawMaterial(effect.visual, materialX, materialY, Math.max(34, effect.radius * 1.5), Math.max(50, effect.radius * 2.25), Math.atan2(dy, dx) + Math.PI / 2, 1 - progress * .42, effect.color);
          context.globalCompositeOperation = "source-over"; context.globalAlpha = (1 - progress) * .58; context.strokeStyle = "#120d22"; context.lineWidth = 8; context.beginPath(); context.moveTo(p.x, p.y); context.lineTo(end.x, end.y); context.stroke();
          context.globalAlpha = (1 - progress) * .96; context.strokeStyle = effect.color; context.shadowColor = effect.color; context.shadowBlur = 12; context.lineWidth = 3 + (1 - progress) * 2; context.beginPath(); context.moveTo(p.x, p.y); context.lineTo(end.x, end.y); context.stroke();
        } else {
          const size = effect.radius * 2 * (.52 + progress * .72);
          this.drawMaterial(effect.visual, p.x, p.y, size, size, effect.age * .34, 1 - progress * .5, effect.color);
          context.globalAlpha = (1 - progress) * .78; context.strokeStyle = effect.color; context.lineWidth = 3; context.beginPath(); context.arc(p.x, p.y, effect.radius * (.35 + progress * .72), 0, Math.PI * 2); context.stroke();
        }
      } else if (effect.kind === "hit") {
        const size = effect.radius * (1.35 + progress * .7);
        this.drawVfx("vfxSpark", p.x, p.y, size, size, effect.age * 9, "sepia(1) saturate(8) hue-rotate(350deg) brightness(1.45)", 1 - progress);
        this.drawVfx("vfxFlare", p.x, p.y, size * .7, size * .7, -effect.age * 5, "sepia(1) saturate(6) hue-rotate(345deg) brightness(1.5)", (1 - progress) * .8);
      } else if (effect.kind === "burst") {
        const size = effect.radius * 2 * (.45 + progress * .8);
        this.drawVfx("vfxScorch", p.x, p.y, effect.radius * 1.45, effect.radius * 1.45, effect.age * 1.8, "sepia(1) saturate(6) hue-rotate(250deg) brightness(1.2)", (1 - progress) * .52);
        this.drawVfx("vfxRing", p.x, p.y, size, size, -progress * 2, "sepia(1) saturate(8) hue-rotate(250deg) brightness(1.3)", 1 - progress);
        this.drawVfx("vfxSpark", p.x, p.y, size * .78, size * .78, progress * 4, "sepia(1) saturate(8) hue-rotate(265deg) brightness(1.35)", (1 - progress) * .82);
      } else if (effect.kind === "pickup") {
        const size = effect.radius * 2 * (.22 + progress * .9);
        this.drawVfx("vfxShock", p.x, p.y, size, size, progress, "sepia(1) saturate(7) hue-rotate(80deg) brightness(1.4)", 1 - progress);
        this.drawVfx("vfxFlare", p.x, p.y, Math.min(size, 180), Math.min(size, 180), -progress * 2.5, "sepia(1) saturate(7) hue-rotate(65deg) brightness(1.45)", (1 - progress) * .8);
      } else if (effect.kind === "ascended") {
        const pulse = effect.radius * (1.15 + progress * .75);
        this.drawVfx("vfxSymbol", p.x, p.y, pulse * 1.7, pulse * 1.7, -effect.age * 1.4, "sepia(1) saturate(8) hue-rotate(330deg) brightness(1.45)", (1 - progress) * .72);
        this.drawVfx("vfxTwirl", p.x, p.y, pulse * 2, pulse * 2, effect.age * 2.2, "sepia(1) saturate(8) hue-rotate(325deg) brightness(1.35)", (1 - progress) * .54);
        this.drawVfx("vfxFlare", p.x, p.y, pulse, pulse, progress * 3, "sepia(1) saturate(7) hue-rotate(350deg) brightness(1.5)", (1 - progress) * .8);
      }
      context.restore();
    });
  }

  private drawParticles() {
    const step = this.isUnderLoad() ? 2 : 1;
    for (let index = 0; index < this.particles.length; index += step) { const particle = this.particles[index]; const p = this.toScreen(particle); this.context.globalAlpha = clamp(particle.life * 3, 0, 1); this.context.fillStyle = particle.color; this.context.fillRect(p.x, p.y, particle.size, particle.size); }
    this.context.globalAlpha = 1;
  }

  private drawDamageNumbers() {
    const context = this.context; context.save(); context.textAlign = "center"; context.textBaseline = "middle"; context.font = "bold 15px Inter, sans-serif";
    const lowDetail = this.renderLowDetail; const start = lowDetail ? Math.max(0, this.damageNumbers.length - 10) : 0;
    for (let index = start; index < this.damageNumbers.length; index += 1) { const number = this.damageNumbers[index];
      const p = this.toScreen(number); context.globalAlpha = clamp(number.life * 2, 0, 1); context.fillStyle = number.critical ? "#ffe071" : "#ffffff";
      if (!lowDetail) { context.lineWidth = 3; context.strokeStyle = "#241221"; context.strokeText(String(number.value), p.x, p.y); }
      context.fillText(String(number.value), p.x, p.y);
    }
    context.restore();
  }

  private drawScreenFlash() {
    if (this.screenFlash <= 0 || this.screenFlashDuration <= 0) return;
    const context = this.context; const progress = this.screenFlash / this.screenFlashDuration;
    context.save(); context.globalCompositeOperation = "screen"; context.globalAlpha = Math.min(.36, progress * .36); context.fillStyle = this.screenFlashColor;
    context.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT); context.restore();
  }
}
