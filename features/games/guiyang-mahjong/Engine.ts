import { chooseDiscard, shouldClaimPong } from "./ai";
import { createPlayers, SPECIAL_CHICKENS } from "./data";
import {
  analyzeWinWithTile,
  analyzeWinningHand,
  canClaimDiscardWin,
  countKey,
  createWall,
  findAddedKongs,
  findConcealedKongs,
  getReadyTileKeys,
  removeTilesByKey,
  scoreRound,
  seeded,
  sortTiles,
  tileFromKey,
  tileKey,
} from "./rules";
import type {
  ActionOption,
  BeanEvent,
  MahjongCallbacks,
  MahjongPhase,
  MahjongState,
  Meld,
  PlayerState,
  RoundSettlement,
  TableEffect,
  Tile,
  TileKey,
  WinAnalysis,
} from "./types";

const EMPTY_STATE: MahjongState = {
  phase: "idle",
  resumePhase: null,
  round: 0,
  dealer: 0,
  current: 0,
  players: createPlayers(),
  wall: [],
  lastDiscard: null,
  selectedTileId: null,
  drawnTileId: null,
  actions: [],
  beanEvents: [],
  charge: null,
  effect: null,
  message: "准备开桌",
  turnNumber: 0,
  settlement: null,
};

type PendingDiscard = { tile: Tile; seat: number };
type PendingAddedKong = { seat: number; key: TileKey };

export class GuiyangMahjongEngine {
  private state: MahjongState = EMPTY_STATE;
  private callbacks: MahjongCallbacks;
  private random = seeded(1);
  private timer: number | null = null;
  private scheduledTask: (() => void) | null = null;
  private effectId = 0;
  private pendingDiscard: PendingDiscard | null = null;
  private pendingAddedKong: PendingAddedKong | null = null;
  private submitted = false;

  constructor(callbacks: MahjongCallbacks) {
    this.callbacks = callbacks;
    this.publish();
  }

  start(seed = Date.now()) {
    this.clearTimer();
    this.random = seeded(seed);
    this.submitted = false;
    this.state = { ...EMPTY_STATE, players: createPlayers() };
    this.callbacks.onSound("start");
    this.startRound(1, Math.floor(this.random() * 4));
  }

  selectTile(id: number) {
    if (this.state.phase !== "player-turn" || this.state.current !== 0) return;
    if (!this.state.players[0].hand.some((tile) => tile.id === id)) return;
    this.state.selectedTileId = this.state.selectedTileId === id ? null : id;
    this.publish();
  }

  discardSelected() {
    if (this.state.phase !== "player-turn" || this.state.current !== 0) return;
    const hand = this.state.players[0].hand;
    const selected = hand.find((tile) => tile.id === this.state.selectedTileId) ?? hand.find((tile) => tile.id === this.state.drawnTileId);
    if (!selected || hand.length % 3 !== 2) return;
    this.performDiscard(0, selected);
  }

  act(kind: ActionOption["kind"], key?: TileKey) {
    if (this.state.phase === "response") {
      const pending = this.pendingDiscard;
      if (!pending) return;
      if (kind === "hu") {
        if (this.pendingAddedKong) {
          this.finishWin(0, pending.seat, pending.tile, {
            selfDraw: true,
            liabilityPayer: pending.seat,
            burnedSeat: pending.seat,
            claimTile: true,
          });
        } else {
          this.finishWin(0, pending.seat, pending.tile, { selfDraw: false });
        }
        return;
      }
      if (kind === "kong") {
        this.performOpenKong(0, pending.seat, pending.tile);
        return;
      }
      if (kind === "pong") {
        this.performPong(0, pending.seat, pending.tile);
        return;
      }
      if (kind === "pass") {
        this.callbacks.onSound("pass");
        this.state.actions = [];
        if (this.pendingAddedKong) {
          const added = this.pendingAddedKong;
          this.pendingAddedKong = null;
          this.commitAddedKong(added.seat, added.key);
        } else {
          this.processDiscardClaims(pending, true);
        }
      }
      return;
    }

    if (this.state.phase !== "player-turn" || this.state.current !== 0) return;
    if (kind === "hu") {
      const tile = this.state.players[0].hand.find((candidate) => candidate.id === this.state.drawnTileId) ?? this.state.players[0].hand.at(-1);
      if (tile) this.finishWin(0, null, tile, { selfDraw: true });
    }
    if (kind === "kong" && key) {
      if (findConcealedKongs(this.state.players[0].hand).includes(key)) this.performConcealedKong(0, key);
      else if (findAddedKongs(this.state.players[0].hand, this.state.players[0].melds).includes(key)) this.beginAddedKong(0, key);
    }
  }

  togglePause() {
    const active: MahjongPhase[] = ["dealing", "player-turn", "ai-turn", "response"];
    if (this.state.phase === "paused" && this.state.resumePhase) {
      this.state.phase = this.state.resumePhase;
      this.state.resumePhase = null;
      this.state.message = this.state.current === 0 ? "轮到你出牌" : `${this.state.players[this.state.current].name}正在思考`;
      this.publish();
      this.resumeFlow();
      return;
    }
    if (!active.includes(this.state.phase)) return;
    this.clearTimer(true);
    this.state.resumePhase = this.state.phase;
    this.state.phase = "paused";
    this.state.message = "牌局已暂停";
    this.publish();
  }

  advance() {
    if (this.state.phase === "round-end") {
      if (this.state.round >= 4) {
        this.state.phase = "match-end";
        this.state.message = "四局积分赛结束";
        this.publish();
        this.submitScore();
      } else {
        const winner = this.state.settlement?.winner;
        const dealer = winner === null || winner === undefined ? this.state.dealer : winner;
        this.startRound(this.state.round + 1, dealer);
      }
      return;
    }
    if (this.state.phase === "match-end") this.start();
  }

  destroy() {
    this.clearTimer();
  }

  private startRound(round: number, dealer: number) {
    const scores = this.state.players.map((player) => player.score);
    const players = createPlayers().map((player, seat) => ({ ...player, score: scores[seat] ?? 100 }));
    const wall = createWall(this.random);
    for (let draw = 0; draw < 13; draw += 1) {
      for (const player of players) player.hand.push(wall.pop() as Tile);
    }
    players[dealer].hand.push(wall.pop() as Tile);
    for (const player of players) player.hand = sortTiles(player.hand);
    this.state = {
      ...EMPTY_STATE,
      phase: "dealing",
      round,
      dealer,
      current: dealer,
      players,
      wall,
      effect: this.effect(dealer, "deal", "开牌"),
      message: `第 ${round} 局 · ${players[dealer].name}坐庄`,
    };
    this.publish();
    this.schedule(() => this.prepareTurn(dealer, true), 850);
  }

  private prepareTurn(seat: number, alreadyDrawn = false) {
    if (this.state.phase === "paused") return;
    this.state.current = seat;
    this.state.turnNumber += 1;
    this.state.actions = [];
    if (!alreadyDrawn) {
      if (this.state.wall.length === 0) {
        this.finishDraw();
        return;
      }
      const tile = this.state.wall.pop() as Tile;
      this.state.players[seat].hand = sortTiles([...this.state.players[seat].hand, tile]);
      this.state.drawnTileId = tile.id;
      this.state.effect = this.effect(seat, "draw", "摸牌");
      this.callbacks.onSound("draw");
    } else {
      this.state.drawnTileId = this.state.players[seat].hand.at(-1)?.id ?? null;
    }

    const player = this.state.players[seat];
    const win = analyzeWinningHand(player.hand, player.melds);
    if (seat === 0) {
      this.state.phase = "player-turn";
      this.state.message = win.valid ? `可以自摸：${win.pattern}` : "选择一张牌打出";
      this.state.actions = this.drawActions(player, win);
      this.publish();
      return;
    }

    this.state.phase = "ai-turn";
    this.state.message = `${player.name}正在思考`;
    this.publish();
    this.schedule(() => {
      if (win.valid) {
        const tile = player.hand.find((candidate) => candidate.id === this.state.drawnTileId) ?? player.hand.at(-1);
        if (tile) this.finishWin(seat, null, tile, { selfDraw: true });
        return;
      }
      const concealed = findConcealedKongs(player.hand);
      const added = findAddedKongs(player.hand, player.melds);
      if (concealed.length > 0 && this.random() < 0.7) {
        this.performConcealedKong(seat, concealed[0]);
        return;
      }
      if (added.length > 0 && this.random() < 0.75) {
        this.beginAddedKong(seat, added[0]);
        return;
      }
      this.performDiscard(seat, chooseDiscard(player.hand, player.melds));
    }, 620 + Math.floor(this.random() * 260));
  }

  private drawActions(player: PlayerState, win: WinAnalysis): ActionOption[] {
    const actions: ActionOption[] = [];
    if (win.valid) actions.push({ kind: "hu", label: `自摸 · ${win.pattern}` });
    for (const key of findConcealedKongs(player.hand)) actions.push({ kind: "kong", tile: key, label: `闷豆 · ${this.labelTile(key)}` });
    for (const key of findAddedKongs(player.hand, player.melds)) actions.push({ kind: "kong", tile: key, label: `爬坡豆 · ${this.labelTile(key)}` });
    return actions;
  }

  private performDiscard(seat: number, tile: Tile) {
    const player = this.state.players[seat];
    const index = player.hand.findIndex((candidate) => candidate.id === tile.id);
    if (index < 0) return;
    player.hand.splice(index, 1);
    player.hand = sortTiles(player.hand);
    player.discards.push(tile);
    player.ready = getReadyTileKeys(player.hand, player.melds).length > 0;
    this.state.selectedTileId = null;
    this.state.drawnTileId = null;
    this.state.actions = [];
    this.state.lastDiscard = { seat, tile };
    this.state.effect = this.effect(seat, "discard", this.labelTile(tileKey(tile)));
    this.state.message = `${player.name}打出 ${this.labelTile(tileKey(tile))}${player.ready ? " · 已听牌" : ""}`;
    if (!this.state.charge && SPECIAL_CHICKENS.includes(tileKey(tile))) this.state.charge = { tile: tileKey(tile), discarder: seat, claimant: null };
    this.callbacks.onSound("discard");
    this.publish();
    this.pendingDiscard = { tile, seat };
    this.schedule(() => this.processDiscardClaims({ tile, seat }, false), 360);
  }

  private processDiscardClaims(pending: PendingDiscard, excludeHuman: boolean) {
    if (!this.pendingDiscard || this.pendingDiscard.tile.id !== pending.tile.id) return;
    const seats = [1, 2, 3].map((offset) => (pending.seat + offset) % 4);
    const winners = seats.filter((seat) => {
      if (seat === 0 && excludeHuman) return false;
      const player = this.state.players[seat];
      return canClaimDiscardWin(player.hand, player.melds, pending.tile, player.beanCount > 0).allowed;
    });
    if (winners.includes(0) && !excludeHuman) {
      this.state.phase = "response";
      this.state.current = 0;
      this.state.actions = [{ kind: "hu", label: "胡" }, { kind: "pass", label: "过" }];
      this.state.message = `${this.labelTile(tileKey(pending.tile))} 可以胡牌`;
      this.publish();
      return;
    }
    if (winners.length > 0) {
      this.schedule(() => this.finishWin(winners[0], pending.seat, pending.tile, { selfDraw: false }), 420);
      return;
    }

    const human = this.state.players[0];
    if (!excludeHuman && pending.seat !== 0) {
      const key = tileKey(pending.tile);
      const actions: ActionOption[] = [];
      if (countKey(human.hand, key) >= 3) actions.push({ kind: "kong", tile: key, label: "点豆" });
      if (countKey(human.hand, key) >= 2) actions.push({ kind: "pong", tile: key, label: "碰" });
      if (actions.length > 0) {
        this.state.phase = "response";
        this.state.current = 0;
        this.state.actions = [...actions, { kind: "pass", label: "过" }];
        this.state.message = `是否要 ${actions.map((action) => action.label).join(" / ")}？`;
        this.publish();
        return;
      }
    }

    for (const seat of seats) {
      if (seat === 0) continue;
      const player = this.state.players[seat];
      const key = tileKey(pending.tile);
      if (countKey(player.hand, key) >= 3) {
        this.schedule(() => this.performOpenKong(seat, pending.seat, pending.tile), 430);
        return;
      }
      if (countKey(player.hand, key) >= 2 && shouldClaimPong(player.hand, player.melds, key)) {
        this.schedule(() => this.performPong(seat, pending.seat, pending.tile), 430);
        return;
      }
    }
    this.pendingDiscard = null;
    this.prepareTurn((pending.seat + 1) % 4);
  }

  private performPong(seat: number, fromSeat: number, tile: Tile) {
    const key = tileKey(tile);
    const player = this.state.players[seat];
    const removed = removeTilesByKey(player.hand, key, 2);
    if (!removed) return;
    player.hand = sortTiles(removed.kept);
    player.melds.push({ kind: "pong", tiles: [...removed.removed, tile], fromSeat });
    this.takeLastDiscard(fromSeat, tile.id);
    this.claimCharge(seat, key);
    this.pendingDiscard = null;
    this.state.current = seat;
    this.state.effect = this.effect(seat, "pong", "碰");
    this.state.message = `${player.name}碰了 ${this.labelTile(key)}`;
    this.callbacks.onSound("pong");
    if (seat === 0) {
      this.state.phase = "player-turn";
      this.state.actions = [];
      this.publish();
    } else {
      this.state.phase = "ai-turn";
      this.publish();
      this.schedule(() => this.performDiscard(seat, chooseDiscard(player.hand, player.melds)), 620);
    }
  }

  private performOpenKong(seat: number, fromSeat: number, tile: Tile) {
    const key = tileKey(tile);
    const player = this.state.players[seat];
    const removed = removeTilesByKey(player.hand, key, 3);
    if (!removed) return;
    player.hand = sortTiles(removed.kept);
    player.melds.push({ kind: "open-kong", tiles: [...removed.removed, tile], fromSeat });
    player.beanCount += 1;
    this.state.beanEvents.push({ kind: "point", owner: seat, payer: fromSeat, fan: 1, tile: key });
    this.takeLastDiscard(fromSeat, tile.id);
    this.claimCharge(seat, key);
    this.pendingDiscard = null;
    this.state.effect = this.effect(seat, "kong", "点豆");
    this.state.message = `${player.name}点豆 ${this.labelTile(key)}`;
    this.callbacks.onSound("kong");
    this.publish();
    this.schedule(() => this.prepareTurn(seat), 520);
  }

  private performConcealedKong(seat: number, key: TileKey) {
    const player = this.state.players[seat];
    const removed = removeTilesByKey(player.hand, key, 4);
    if (!removed) return;
    player.hand = sortTiles(removed.kept);
    player.melds.push({ kind: "concealed-kong", tiles: removed.removed, fromSeat: null });
    player.beanCount += 1;
    this.state.beanEvents.push({ kind: "concealed", owner: seat, payer: null, fan: 2, tile: key });
    this.state.effect = this.effect(seat, "kong", "闷豆");
    this.state.message = `${player.name}闷豆 ${this.labelTile(key)}`;
    this.callbacks.onSound("kong");
    this.publish();
    this.schedule(() => this.prepareTurn(seat), 520);
  }

  private beginAddedKong(seat: number, key: TileKey) {
    const tile = this.state.players[seat].hand.find((candidate) => tileKey(candidate) === key);
    if (!tile) return;
    const robbers = [1, 2, 3].map((offset) => (seat + offset) % 4).filter((candidate) => {
      const player = this.state.players[candidate];
      return analyzeWinWithTile(player.hand, player.melds, tile).valid;
    });
    if (robbers.includes(0)) {
      this.pendingAddedKong = { seat, key };
      this.pendingDiscard = { seat, tile };
      this.state.phase = "response";
      this.state.current = 0;
      this.state.actions = [{ kind: "hu", label: "抢杠胡" }, { kind: "pass", label: "过" }];
      this.state.message = `可以抢杠 ${this.labelTile(key)}`;
      this.publish();
      return;
    }
    if (robbers.length > 0) {
      this.finishWin(robbers[0], seat, tile, { selfDraw: true, liabilityPayer: seat, burnedSeat: seat, claimTile: true });
      return;
    }
    this.commitAddedKong(seat, key);
  }

  private commitAddedKong(seat: number, key: TileKey) {
    const player = this.state.players[seat];
    const removed = removeTilesByKey(player.hand, key, 1);
    const meld = player.melds.find((candidate) => candidate.kind === "pong" && tileKey(candidate.tiles[0]) === key);
    if (!removed || !meld) return;
    player.hand = sortTiles(removed.kept);
    meld.kind = "added-kong";
    meld.tiles.push(removed.removed[0]);
    player.beanCount += 1;
    this.state.beanEvents.push({ kind: "added", owner: seat, payer: null, fan: 3, tile: key });
    this.state.effect = this.effect(seat, "kong", "爬坡豆");
    this.state.message = `${player.name}爬坡豆 ${this.labelTile(key)}`;
    this.callbacks.onSound("kong");
    this.publish();
    this.schedule(() => this.prepareTurn(seat), 520);
  }

  private finishWin(
    winner: number,
    discarder: number | null,
    tile: Tile,
    options: { selfDraw: boolean; liabilityPayer?: number | null; burnedSeat?: number; claimTile?: boolean },
  ) {
    this.clearTimer();
    const player = this.state.players[winner];
    if (!options.selfDraw || options.claimTile) {
      player.hand = sortTiles([...player.hand, tile]);
      if (!options.claimTile && discarder !== null) this.takeLastDiscard(discarder, tile.id);
    }
    player.ready = true;
    this.pendingDiscard = null;
    this.pendingAddedKong = null;
    const analysis = analyzeWinningHand(player.hand, player.melds);
    const indicator = this.state.wall.pop() ?? tileFromKey("wan-1", 9999);
    this.state.phase = "chicken-reveal";
    this.state.current = winner;
    this.state.effect = this.effect(winner, "hu", "胡");
    this.state.message = `${player.name}${options.selfDraw ? "自摸" : "胡牌"} · ${analysis.pattern}`;
    this.callbacks.onSound("hu");
    this.publish();
    this.schedule(() => this.completeSettlement(winner, discarder, indicator, analysis, options), 1100);
  }

  private finishDraw() {
    const indicator = tileFromKey("wan-1", 9999);
    this.state.phase = "chicken-reveal";
    this.state.message = "牌墙摸尽，开始黄牌查叫";
    this.state.effect = this.effect(this.state.dealer, "chicken", "查叫");
    this.callbacks.onSound("chicken");
    this.publish();
    this.schedule(() => this.completeSettlement(null, null, indicator, null, { selfDraw: false }), 1050);
  }

  private completeSettlement(
    winner: number | null,
    discarder: number | null,
    indicator: Tile,
    winnerAnalysis: WinAnalysis | null,
    options: { selfDraw: boolean; liabilityPayer?: number | null; burnedSeat?: number; claimTile?: boolean },
  ) {
    const analyses = this.state.players.map((player, seat) => {
      if (seat === winner) return winnerAnalysis;
      const waits = getReadyTileKeys(player.hand, player.melds);
      let best: WinAnalysis | null = null;
      for (const key of waits) {
        const analysis = analyzeWinWithTile(player.hand, player.melds, tileFromKey(key));
        if (!best || analysis.fan > best.fan) best = analysis;
      }
      player.ready = waits.length > 0;
      return best;
    });
    const result = scoreRound({
      players: this.state.players.map((player, seat) => ({
        seat,
        ready: player.ready || seat === winner,
        tiles: [...player.hand, ...player.melds.flatMap((meld) => meld.tiles), ...player.discards],
        analysis: analyses[seat],
      })),
      winner,
      discarder,
      dealer: this.state.dealer,
      selfDraw: options.selfDraw,
      liabilityPayer: options.liabilityPayer,
      indicator,
      beanEvents: this.state.beanEvents,
      charge: this.state.charge,
      burnedSeats: options.burnedSeat === undefined ? [] : [options.burnedSeat],
    });
    this.state.players.forEach((player, seat) => { player.score += result.deltas[seat]; });
    const settlement: RoundSettlement = {
      winner,
      title: winner === null ? "黄牌查叫" : winner === 0 ? "贵阳拿下！" : `${this.state.players[winner].name}胡牌`,
      subtitle: winner === null ? "牌墙摸尽，按听牌、鸡和豆结算" : `${winnerAnalysis?.pattern ?? "胡牌"} ${winnerAnalysis?.fan ?? 1} 番 · ${options.selfDraw ? "自摸" : `点炮：${this.state.players[discarder ?? 0].name}`}`,
      indicator,
      chickenKey: result.chickenKey,
      deltas: result.deltas,
      lines: result.lines,
      patterns: analyses.flatMap((analysis, seat) => analysis ? [{ seat, pattern: analysis.pattern ?? "听牌", fan: analysis.fan }] : []),
    };
    this.state.settlement = settlement;
    this.state.phase = "round-end";
    this.state.effect = this.effect(winner ?? this.state.dealer, "chicken", "捉鸡");
    this.state.message = `翻出 ${this.labelTile(tileKey(indicator))}，鸡牌是 ${this.labelTile(result.chickenKey)}`;
    this.callbacks.onSound("chicken");
    if (winner !== 0) this.callbacks.onSound("lose");
    this.publish();
  }

  private resumeFlow() {
    if (this.scheduledTask) {
      const task = this.scheduledTask;
      this.schedule(task, 220);
      return;
    }
    if (this.state.phase === "dealing") this.schedule(() => this.prepareTurn(this.state.current, true), 300);
    if (this.state.phase === "ai-turn") {
      const player = this.state.players[this.state.current];
      this.schedule(() => this.performDiscard(player.seat, chooseDiscard(player.hand, player.melds)), 420);
    }
  }

  private submitScore() {
    if (this.submitted) return;
    this.submitted = true;
    const rank = [...this.state.players].sort((left, right) => right.score - left.score).findIndex((player) => player.seat === 0);
    this.callbacks.onScore(Math.max(0, this.state.players[0].score * 100 + (4 - rank) * 1000));
  }

  private claimCharge(seat: number, key: TileKey) {
    if (this.state.charge?.tile === key && this.state.charge.claimant === null) this.state.charge.claimant = seat;
  }

  private takeLastDiscard(seat: number, tileId: number) {
    const discards = this.state.players[seat].discards;
    const index = discards.findIndex((tile) => tile.id === tileId);
    if (index >= 0) discards.splice(index, 1);
  }

  private effect(seat: number, kind: TableEffect["kind"], label: string): TableEffect {
    return { id: this.effectId += 1, seat, kind, label };
  }

  private labelTile(key: TileKey) {
    const [suit, rank] = key.split("-");
    const suffix: Record<string, string> = { wan: "万", tiao: "条", tong: "筒" };
    return `${rank}${suffix[suit]}`;
  }

  private schedule(callback: () => void, delay: number) {
    this.clearTimer();
    this.scheduledTask = callback;
    this.timer = window.setTimeout(() => {
      this.timer = null;
      const task = this.scheduledTask;
      this.scheduledTask = null;
      task?.();
    }, delay);
  }

  private clearTimer(preserveTask = false) {
    if (this.timer !== null) window.clearTimeout(this.timer);
    this.timer = null;
    if (!preserveTask) this.scheduledTask = null;
  }

  private publish() {
    this.callbacks.onState({
      ...this.state,
      players: this.state.players.map((player) => ({
        ...player,
        hand: [...player.hand],
        melds: player.melds.map((meld): Meld => ({ ...meld, tiles: [...meld.tiles] })),
        discards: [...player.discards],
      })),
      wall: [...this.state.wall],
      actions: [...this.state.actions],
      beanEvents: [...this.state.beanEvents] as BeanEvent[],
      charge: this.state.charge ? { ...this.state.charge } : null,
      lastDiscard: this.state.lastDiscard ? { ...this.state.lastDiscard } : null,
      effect: this.state.effect ? { ...this.state.effect } : null,
      settlement: this.state.settlement ? { ...this.state.settlement, deltas: [...this.state.settlement.deltas], lines: [...this.state.settlement.lines] } : null,
    });
  }
}
