"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import type { MiniGameProps } from "../types";
import { gameAudio } from "@/lib/audio/gameAudio";
import { CHARACTERS, PASSIVES, TAROTS, WEAPONS } from "./data";
import { NIGHTFALL_SPRITES } from "./assets";
import { ActiveSkillPanel } from "./ActiveSkillPanel";
import { ExperienceBar } from "./ExperienceBar";
import { HordeBanner } from "./HordeBanner";
import { MissionPanel } from "./MissionPanel";
import { playNightSound } from "./audio";
import { NightfallBgm } from "./bgm";
import { PauseOverlay } from "./PauseOverlay";
import { ComboHud } from "./ComboHud";
import { ElementComboHud } from "./ElementComboHud";
import { BountyBanner } from "./BountyBanner";
import { StageHud } from "./StageHud";
import { StoryDialog } from "./StoryDialog";
import { StageTransition } from "./StageTransition";
import { ClassUltimateHud, DragonUltimateHud } from "./ClassUltimateHud";
import { CHARACTER_COMBAT_STYLES, CHARACTER_PROFILES } from "./classPools";
import { CLASS_ULTIMATES } from "./classUltimates";
import { SurvivorEngine } from "./SurvivorEngine";
import { STAGE_BOSS_AT, STAGE_DURATION, STAGES, type StageTransitionInfo, type StoryScene } from "./stages";
import { ARENA_HEIGHT, ARENA_WIDTH, type ActiveSkillId, type CharacterId, type SurvivorHud, type SurvivorInput, type TarotId, type UpgradeOption } from "./types";
import styles from "./NightfallSurvivors.module.css";

const EMPTY_INPUT: SurvivorInput = { left: false, right: false, up: false, down: false };
const INITIAL_HUD: SurvivorHud = { hp: 100, maxHp: 100, level: 1, xp: 0, nextXp: 20, kills: 0, elapsed: 0, weapons: [], passives: [], tarots: [], shield: false, buffTime: 0, altarBuff: 0, altarActive: false, altarCharge: 0, bossHp: null, bossName: null, waveName: "第一幕 · 烬沙荒漠", missions: [], activeSkills: [], hordeRemaining: 0, nextHordeIn: 90, hordeIndex: 0, combo: 0, comboTime: 0, feverRemaining: 0, bountyRemaining: 0, bountyName: null, elementLast: null, elementNext: null, elementComboName: null, elementComboTime: 0, elementComboCooldown: 0, elementWindow: 0, stageIndex: 0, stageCount: STAGES.length, stageId: "desert", stageName: STAGES[0].name, stageSubtitle: STAGES[0].subtitle, stageElapsed: 0, stageDuration: STAGE_DURATION, stageBossAt: STAGE_BOSS_AT, stageBossSpawned: false, classUltimate: null, dragonUltimate: null };

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
  const rest = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${rest}`;
}

export function NightfallSurvivors({ bestScore, onScore }: MiniGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<SurvivorEngine | null>(null);
  const bgmRef = useRef<NightfallBgm | null>(null);
  const inputRef = useRef<SurvivorInput>({ ...EMPTY_INPUT });
  const [status, setStatus] = useState<"ready" | "playing" | "over" | "victory">("ready");
  const [character, setCharacter] = useState<CharacterId>("paladin");
  const [session, setSession] = useState(0);
  const [hud, setHud] = useState<SurvivorHud>(INITIAL_HUD);
  const [upgradeOptions, setUpgradeOptions] = useState<UpgradeOption[] | null>(null);
  const [tarotOptions, setTarotOptions] = useState<TarotId[] | null>(null);
  const [notice, setNotice] = useState<{ title: string; detail: string; id: number } | null>(null);
  const [finalScore, setFinalScore] = useState(0);
  const [manuallyPaused, setManuallyPaused] = useState(false);
  const [storyScene, setStoryScene] = useState<StoryScene | null>(null);
  const [stageTransition, setStageTransition] = useState<StageTransitionInfo | null>(null);

  const startGame = useCallback(() => {
    gameAudio.play("start");
    if (!bgmRef.current) bgmRef.current = new NightfallBgm();
    bgmRef.current.start(0);
    inputRef.current = { ...EMPTY_INPUT };
    setHud({ ...INITIAL_HUD, maxHp: 100 * CHARACTERS[character].hpMultiplier, hp: 100 * CHARACTERS[character].hpMultiplier });
    setUpgradeOptions(null); setTarotOptions(null); setNotice(null); setStoryScene(null); setStageTransition(null); setFinalScore(0);
    setManuallyPaused(false);
    setSession((value) => value + 1);
    setStatus("playing");
  }, [character]);

  const togglePause = useCallback(() => {
    if (status !== "playing" || upgradeOptions || tarotOptions || storyScene || stageTransition) return;
    setManuallyPaused((current) => {
      const next = !current;
      inputRef.current = { ...EMPTY_INPUT };
      engineRef.current?.setPaused(next);
      return next;
    });
  }, [stageTransition, status, storyScene, tarotOptions, upgradeOptions]);

  const triggerActiveSkill = useCallback((id: ActiveSkillId) => engineRef.current?.useActiveSkill(id), []);
  const triggerClassUltimate = useCallback(() => engineRef.current?.useClassUltimate(), []);
  const triggerAltarUltimate = useCallback(() => engineRef.current?.useAltarUltimate(), []);

  useEffect(() => {
    if (status !== "playing" || !canvasRef.current) return;
    const context = canvasRef.current.getContext("2d");
    if (!context) return;
    const engine = new SurvivorEngine(context, character, {
      onHud: setHud,
      onUpgrade: (options) => setUpgradeOptions(options.length > 0 ? options : null),
      onTarot: setTarotOptions,
      onNotice: (title, detail) => setNotice({ title, detail, id: Date.now() }),
      onDialogue: setStoryScene,
      onStageTransition: setStageTransition,
      onSound: playNightSound,
      onEnd: (score) => { bgmRef.current?.stop(); setFinalScore(score); setStoryScene(null); setManuallyPaused(false); onScore(score); setStatus("over"); },
      onVictory: (score) => { bgmRef.current?.stop(); setFinalScore(score); setStoryScene(null); setManuallyPaused(false); onScore(score); setStatus("victory"); },
    });
    engineRef.current = engine; engine.begin();
    let frame = 0; let previous = performance.now();
    const animate = (now: number) => {
      engine.update((now - previous) / 1000, inputRef.current);
      engine.draw();
      previous = now; frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => { cancelAnimationFrame(frame); engineRef.current = null; };
  }, [character, onScore, session, status]);

  useEffect(() => { if (status === "playing") bgmRef.current?.setStage(hud.stageIndex); }, [hud.stageIndex, status]);
  useEffect(() => {
    if (!stageTransition) return;
    const timer = window.setTimeout(() => {
      engineRef.current?.completeStageTransition();
      setStageTransition(null);
    }, 2200);
    return () => window.clearTimeout(timer);
  }, [stageTransition]);
  useEffect(() => { bgmRef.current?.setPaused(manuallyPaused); }, [manuallyPaused]);
  useEffect(() => () => bgmRef.current?.destroy(), []);

  useEffect(() => {
    const keys: Record<string, keyof SurvivorInput> = {
      a: "left", A: "left", ArrowLeft: "left", d: "right", D: "right", ArrowRight: "right",
      w: "up", W: "up", ArrowUp: "up", s: "down", S: "down", ArrowDown: "down",
    };
    const update = (event: KeyboardEvent, pressed: boolean) => {
      const action = keys[event.key]; if (!action) return; event.preventDefault(); inputRef.current[action] = pressed;
    };
    const down = (event: KeyboardEvent) => update(event, true); const up = (event: KeyboardEvent) => update(event, false);
    const reset = () => { inputRef.current = { ...EMPTY_INPUT }; };
    window.addEventListener("keydown", down); window.addEventListener("keyup", up); window.addEventListener("blur", reset);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); window.removeEventListener("blur", reset); };
  }, []);

  useEffect(() => {
    const toggleWithKeyboard = (event: KeyboardEvent) => {
      if (event.repeat) return;
      if (event.key.toLowerCase() === "p") { event.preventDefault(); togglePause(); return; }
      if (event.key.toLowerCase() === "q") { event.preventDefault(); triggerClassUltimate(); return; }
      if (event.key.toLowerCase() === "e" && character === "necromancer") { event.preventDefault(); triggerAltarUltimate(); return; }
      const index = Number(event.key) - 1; const skill = hud.activeSkills[index];
      if (index >= 0 && index < 6 && skill) { event.preventDefault(); triggerActiveSkill(skill.id); }
    };
    window.addEventListener("keydown", toggleWithKeyboard);
    return () => window.removeEventListener("keydown", toggleWithKeyboard);
  }, [character, hud.activeSkills, togglePause, triggerActiveSkill, triggerAltarUltimate, triggerClassUltimate]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice((current) => current?.id === notice.id ? null : current), 2600);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const chooseUpgrade = (option: UpgradeOption) => {
    setUpgradeOptions(null);
    engineRef.current?.chooseUpgrade(option.id);
  };
  const chooseTarot = (id: TarotId) => {
    setTarotOptions(null);
    engineRef.current?.chooseTarot(id);
  };
  const finishStory = () => { setStoryScene(null); engineRef.current?.resumeFromDialogue(); };
  const touch = (direction: keyof SurvivorInput, pressed: boolean) => { inputRef.current[direction] = pressed; };
  const selectedProfile = CHARACTER_PROFILES[character];
  const selectedUltimate = CLASS_ULTIMATES[character];

  return (
    <div className={styles.game}>
      <canvas ref={canvasRef} width={ARENA_WIDTH} height={ARENA_HEIGHT} className={styles.canvas} aria-label="永夜幸存者战场" />

      {status === "playing" && <>
        <header className={styles.hud}>
          <div className={styles.health}><span>HP</span><i><b style={{ width: `${(hud.hp / hud.maxHp) * 100}%` }} /></i><strong>{Math.ceil(hud.hp)}/{Math.ceil(hud.maxHp)}</strong>{hud.shield && <em>SHIELD</em>}</div>
          <div className={styles.timer}><strong>{formatTime(hud.stageElapsed)}</strong><span>LV.{hud.level} · {hud.kills} KILLS · TOTAL {formatTime(hud.elapsed)}</span></div>
          <div className={styles.build}>
            {hud.weapons.map((item) => <span key={item.id} className={item.evolved ? styles.evolved : ""} title={WEAPONS[item.id].name}>{WEAPONS[item.id].icon}<small>{item.evolved ? "E" : item.level}</small></span>)}
            {hud.passives.map((item) => <span key={item.id} title={PASSIVES[item.id].name}>{PASSIVES[item.id].icon}<small>{item.level}</small></span>)}
          </div>
        </header>
        <ExperienceBar level={hud.level} xp={hud.xp} nextXp={hud.nextXp} waveName={hud.waveName} />
        <StageHud index={hud.stageIndex} count={hud.stageCount} id={hud.stageId} name={hud.stageName} subtitle={hud.stageSubtitle} elapsed={hud.stageElapsed} duration={hud.stageDuration} bossAt={hud.stageBossAt} bossSpawned={hud.stageBossSpawned} />
        {hud.missions.length > 0 && <MissionPanel missions={hud.missions} />}
        {hud.activeSkills.length > 0 && <ActiveSkillPanel skills={hud.activeSkills} onUse={triggerActiveSkill} />}
        <HordeBanner remaining={hud.hordeRemaining} nextIn={hud.nextHordeIn} index={hud.hordeIndex} />
        <ComboHud combo={hud.combo} comboTime={hud.comboTime} feverRemaining={hud.feverRemaining} />
        <ElementComboHud last={hud.elementLast} next={hud.elementNext} comboName={hud.elementComboName} comboTime={hud.elementComboTime} cooldown={hud.elementComboCooldown} window={hud.elementWindow} />
        <BountyBanner name={hud.bountyName} remaining={hud.bountyRemaining} />
        {hud.classUltimate && <ClassUltimateHud ultimate={hud.classUltimate} onUse={triggerAltarUltimate} />}
        {hud.dragonUltimate && <DragonUltimateHud ultimate={hud.dragonUltimate} onUse={triggerClassUltimate} />}
        {hud.tarots.length > 0 && <div className={styles.tarotStack}>{hud.tarots.map((id) => <span key={id} title={TAROTS[id].name}>{TAROTS[id].numeral}</span>)}</div>}
        {(hud.buffTime > 0 || hud.altarBuff > 0) && <div className={styles.buff}>{hud.buffTime > 0 && `隐者祝福 ${hud.buffTime.toFixed(1)}s`}{hud.buffTime > 0 && hud.altarBuff > 0 && " · "}{hud.altarBuff > 0 && `祭坛祝福 ${hud.altarBuff.toFixed(1)}s`}</div>}
        {hud.bossHp !== null && <div className={styles.boss} style={{ top: "116px" }}><span>{hud.bossName ?? "NIGHT LORD"}</span><i><b style={{ width: `${hud.bossHp * 100}%` }} /></i></div>}
        <div className={styles.touchPad}>
          <button onPointerDown={() => touch("up", true)} onPointerUp={() => touch("up", false)} onPointerCancel={() => touch("up", false)}>▲</button>
          <button onPointerDown={() => touch("left", true)} onPointerUp={() => touch("left", false)} onPointerCancel={() => touch("left", false)}>◀</button>
          <button onPointerDown={() => touch("down", true)} onPointerUp={() => touch("down", false)} onPointerCancel={() => touch("down", false)}>▼</button>
          <button onPointerDown={() => touch("right", true)} onPointerUp={() => touch("right", false)} onPointerCancel={() => touch("right", false)}>▶</button>
        </div>
      </>}

      {notice && <div key={notice.id} className={styles.notice}><strong>{notice.title}</strong><span>{notice.detail}</span></div>}

      {status === "playing" && !upgradeOptions && !tarotOptions && !storyScene && !stageTransition && <PauseOverlay paused={manuallyPaused} onToggle={togglePause} />}

      {storyScene && <StoryDialog key={`${storyScene.eyebrow}-${storyScene.title}`} scene={storyScene} onComplete={finishStory} />}
      {stageTransition && <StageTransition transition={stageTransition} />}

      {status === "ready" && <div className={styles.intro}>
        <span className={styles.kicker}>ARCANA SURVIVAL · ORIGINAL NIGHT</span>
        <h3>永夜<span>幸存者</span></h3>
        <p>穿越六幕战场，击败五名魔王手下，在永夜王座迎战现世魔王。</p>
        <div className={styles.characters}>{(Object.keys(CHARACTERS) as CharacterId[]).map((id) => {
          const item = CHARACTERS[id];
          return <button key={id} className={character === id ? styles.selected : ""} onClick={() => setCharacter(id)}><i><Image src={NIGHTFALL_SPRITES[id]} alt="" width={38} height={38} style={{ objectFit: "contain", imageRendering: "pixelated" }} /></i><span><strong>{item.name}</strong><small>{item.title} · {CHARACTER_COMBAT_STYLES[id]}</small><em>初始 · {WEAPONS[item.weapon].name}</em><p>{item.description}</p></span></button>;
        })}</div>
        <section className={styles.classIntro}>
          <span>职业介绍</span>
          <div><strong>{CHARACTERS[character].name} · {selectedProfile.role}</strong><em>操作难度 · {selectedProfile.difficulty}</em></div>
          <p>{selectedProfile.introduction}</p>
          <small>{selectedProfile.strength}</small>
          <b>{character === "necromancer" ? `Q「骷髅巨龙」· 祭坛 E「${selectedUltimate.name}」· ${selectedUltimate.description}` : `大招「${selectedUltimate.name}」· ${selectedUltimate.description}`}</b>
        </section>
        <button className={styles.start} onClick={startGame}>踏入永夜</button>
        <small className={styles.hint}>WASD / 方向键移动 · P 暂停 · 1–6 主动技能 · 紫色祭坛停留 5 秒充能 · Q 职业技（死灵祭坛技为 E）</small>
      </div>}

      {upgradeOptions && <div className={styles.choiceOverlay}>
        <span>LEVEL UP</span><h3>选择一项强化</h3>
        <div className={styles.upgradeCards}>{upgradeOptions.map((option) => <button key={option.id} onClick={() => chooseUpgrade(option)}><i>{option.icon}</i><span><small>{option.kind === "weapon" ? "武器" : "被动道具"}</small><strong>{option.name}</strong><em>Lv.{option.currentLevel} → Lv.{option.nextLevel}</em><p>{option.description}</p></span></button>)}</div>
      </div>}

      {tarotOptions && <div className={`${styles.choiceOverlay} ${styles.tarotOverlay}`}>
        <span>ARCANA DRAW</span><h3>命运从未写定</h3>
        <div className={styles.tarotCards}>{tarotOptions.map((id) => { const card = TAROTS[id]; return <button key={id} onClick={() => chooseTarot(id)}><small>{card.numeral}</small><i>{card.icon}</i><strong>{card.name}</strong><p>{card.description}</p></button>; })}</div>
      </div>}

      {status === "over" && <div className={styles.result}>
        <span>THE NIGHT CLAIMS ANOTHER</span><h3>永夜尚未终结</h3><strong>{finalScore}</strong>
        <p>坚持 {formatTime(hud.elapsed)} · 等级 {hud.level} · 击杀 {hud.kills}<br />历史最高 {Math.max(bestScore, finalScore)}</p>
        <button onClick={startGame}>再次挑战</button>
      </div>}

      {status === "victory" && <div className={`${styles.result} ${styles.victory}`}>
        <span>THE CROWN ENDURES</span><h3>新的魔王已经诞生</h3><strong>{finalScore}</strong>
        <p>通关六幕 · 等级 {hud.level} · 击杀 {hud.kills}<br />世人迎来黎明，而你继承头冠，独自守住下一场永夜</p>
        <button onClick={startGame}>重启勇者轮回</button>
      </div>}
    </div>
  );
}
