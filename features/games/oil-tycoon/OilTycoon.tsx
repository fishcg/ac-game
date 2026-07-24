"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { gameAudio } from "@/lib/audio/gameAudio";
import type { MiniGameProps } from "../types";
import styles from "./OilTycoon.module.css";
import { OilToolIcon } from "./OilToolIcon";
import { CampaignOverlay } from "./CampaignOverlay";
import { OIL_CHARACTERS, createAiTargets, createAuctionBids, createInitialRivals } from "./campaignData";
import type { AuctionBid, CampaignStatus, OilCharacter, RivalState } from "./campaignData";
import {
  INITIAL_UPGRADES,
  MARKET_BASE,
  ROUND_SECONDS,
  STARTING_CASH,
  createPlots,
  plotCost,
  pumpRate,
  truckCapacity,
} from "./gameData";
import type { OilPlot, UpgradeState } from "./types";

type Company = "left" | "right";
type DiscoveryTool = "dowser" | "mole" | "scanner";
type PlaceableTool = DiscoveryTool | "rig" | "silo" | "wagon";
type PipePoint = { x: number; y: number };
type PipeSegment = { id: number; from: PipePoint; to: PipePoint; depositId: string | null; depositKind: "oil" | "gas" | "magma" | null; marketTarget: Company | null; progress: number; upgraded: boolean };
type RigState = { id: number; x: number; ready: boolean };
type DowserPhase = "walking" | "probing" | "found";
type DowserProbe = { id: number; depositId: string | null; x: number; targetY: number; found: boolean; direction: 1 | -1; phase: DowserPhase };
type MoleProbe = { id: number; depositId: string | null; x: number; y: number; targetY: number; done: boolean; blockedByRock: boolean };
type ScannerScan = { x: number; y: number; radius: number; elapsedMs: number };
type DepositRevealArea = { x: number; y: number; radiusX: number; radiusY: number };
type WagonPhase = "parked" | "toRig" | "loading" | "toDestination" | "unloading" | "returning";
type RigStocks = Record<number, number>;
type DepositReserves = Record<string, number>;
type WagonSourceKind = "rig" | "silo";
type WagonSource = { kind: "rig"; rig: RigState } | { kind: "silo"; index: number; x: number };
type WagonState = { id: number; homeX: number; sourceKind: WagonSourceKind | null; sourceRigId: number | null; sourceSiloIndex: number | null; sourceX: number; legStartX: number; destinationX: number; destinationKind: "market" | "silo"; salePrice: number; progress: number; cargo: number; phase: WagonPhase };

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const pipeNodeKey = (point: PipePoint) => `${point.x.toFixed(2)}:${point.y.toFixed(2)}`;
const MARKET_PIPE_POINTS: Record<Company, PipePoint> = { left: { x: 5.5, y: 35.8 }, right: { x: 94.5, y: 35.8 } };
const pipeCrossesRock = (from: PipePoint, to: PipePoint, rock: { x: number; y: number; radius: number }) => {
  const radiusX = Math.max(.01, rock.radius * 1.3);
  const radiusY = Math.max(.01, rock.radius * .7);
  const start = { x: (from.x - rock.x) / radiusX, y: (from.y - rock.y) / radiusY };
  const end = { x: (to.x - rock.x) / radiusX, y: (to.y - rock.y) / radiusY };
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  const projection = lengthSquared <= .0001 ? 0 : clamp(-(start.x * dx + start.y * dy) / lengthSquared, 0, 1);
  const closestX = start.x + dx * projection;
  const closestY = start.y + dy * projection;
  return closestX * closestX + closestY * closestY <= 1;
};
const pipeDepositEntry = (from: PipePoint, to: PipePoint, deposit: OilPlot["deposits"][number]): PipePoint | null => {
  const radiusX = Math.max(.5, deposit.radius + .7);
  const radiusY = Math.max(.5, deposit.radius * .775 + .7);
  const startX = (from.x - deposit.x) / radiusX;
  const startY = (from.y - deposit.y) / radiusY;
  const deltaX = (to.x - from.x) / radiusX;
  const deltaY = (to.y - from.y) / radiusY;
  const a = deltaX * deltaX + deltaY * deltaY;
  const b = 2 * (startX * deltaX + startY * deltaY);
  const c = startX * startX + startY * startY - 1;
  if (c <= 0) return from;
  if (a <= .000001) return null;
  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return null;
  const roots = [(-b - Math.sqrt(discriminant)) / (2 * a), (-b + Math.sqrt(discriminant)) / (2 * a)]
    .filter((value) => value >= 0 && value <= 1)
    .sort((left, right) => left - right);
  const entry = roots[0];
  return entry === undefined ? null : { x: from.x + (to.x - from.x) * entry, y: from.y + (to.y - from.y) * entry };
};
const allocateDepositReserves = (plot: OilPlot): DepositReserves => {
  const oilDeposits = plot.deposits.filter((deposit) => deposit.kind === "oil");
  const totalWeight = oilDeposits.reduce((total, deposit) => total + deposit.radius * deposit.radius, 0);
  return Object.fromEntries(oilDeposits.map((deposit) => [deposit.id, totalWeight > 0 ? plot.reserve * deposit.radius * deposit.radius / totalWeight : 0]));
};
const traceResourceFlow = (segments: PipeSegment[], activeSegmentIds: Set<number>, kind: NonNullable<PipeSegment["depositKind"]>, allowedDepositIds?: Set<string>) => {
  const flow = new Set(segments.filter((segment) => activeSegmentIds.has(segment.id) && segment.depositKind === kind && (!allowedDepositIds || Boolean(segment.depositId && allowedDepositIds.has(segment.depositId)))).map((segment) => segment.id));
  const upstreamNodes = new Set(segments.filter((segment) => flow.has(segment.id)).map((segment) => pipeNodeKey(segment.from)));
  let changed = true;
  while (changed) {
    changed = false;
    segments.forEach((segment) => {
      if (!activeSegmentIds.has(segment.id) || flow.has(segment.id) || !upstreamNodes.has(pipeNodeKey(segment.to))) return;
      flow.add(segment.id);
      upstreamNodes.add(pipeNodeKey(segment.from));
      changed = true;
    });
  }
  return flow;
};

export function OilTycoon({ bestScore, onScore }: MiniGameProps) {
  const [status, setStatus] = useState<CampaignStatus>("intro");
  const [plots, setPlots] = useState<OilPlot[]>(createPlots);
  const [selectedPlotId, setSelectedPlotId] = useState<number | null>(null);
  const [leasedPlotId, setLeasedPlotId] = useState<number | null>(null);
  const [cash, setCash] = useState(STARTING_CASH);
  const [time, setTime] = useState(ROUND_SECONDS);
  const [markets, setMarkets] = useState<Record<Company, number>>({ left: MARKET_BASE, right: MARKET_BASE - 8 });
  const [marketTrends, setMarketTrends] = useState<Record<Company, "up" | "down">>({ left: "up", right: "down" });
  const [sellTarget, setSellTarget] = useState<Company | null>("left");
  const [discoveryTool, setDiscoveryTool] = useState<DiscoveryTool | null>(null);
  const [revealedDepositIds, setRevealedDepositIds] = useState<string[]>([]);
  const [depositRevealAreas, setDepositRevealAreas] = useState<Record<string, DepositRevealArea[]>>({});
  const [flaggedDepositIds, setFlaggedDepositIds] = useState<string[]>([]);
  const [dowserProbes, setDowserProbes] = useState<DowserProbe[]>([]);
  const [moleProbes, setMoleProbes] = useState<MoleProbe[]>([]);
  const [scannerScan, setScannerScan] = useState<ScannerScan | null>(null);
  const [scannerBurst, setScannerBurst] = useState<(ScannerScan & { key: number }) | null>(null);
  const [placingTool, setPlacingTool] = useState<PlaceableTool | null>(null);
  const [toolDragPreview, setToolDragPreview] = useState<{ tool: PlaceableTool; x: number; y: number } | null>(null);
  const [storage, setStorage] = useState(0);
  const [rigStocks, setRigStocks] = useState<RigStocks>({});
  const [sold, setSold] = useState(0);
  const [sellOil, setSellOil] = useState(true);
  const [gasPressure, setGasPressure] = useState(1);
  const [pipeTool, setPipeTool] = useState(false);
  const [pipeSegments, setPipeSegments] = useState<PipeSegment[]>([]);
  const [selectedPipeSegmentId, setSelectedPipeSegmentId] = useState<number | null>(null);
  const [activePipeNode, setActivePipeNode] = useState<PipePoint | null>(null);
  const [closedPipeNodeKeys, setClosedPipeNodeKeys] = useState<string[]>([]);
  const [pipePreview, setPipePreview] = useState<PipePoint | null>(null);
  const [drillInProgress, setDrillInProgress] = useState(false);
  const [drillDepth, setDrillDepth] = useState(0);
  const [gasConnected, setGasConnected] = useState(false);
  const [magmaConnected, setMagmaConnected] = useState(false);
  const [siloBuilt, setSiloBuilt] = useState(false);
  const [rigX, setRigX] = useState<number | null>(null);
  const [siloX, setSiloX] = useState(42);
  const [rigs, setRigs] = useState<RigState[]>([]);
  const [siloXs, setSiloXs] = useState<number[]>([]);
  const [siloLevels, setSiloLevels] = useState<number[]>([]);
  const [selectedSiloIndex, setSelectedSiloIndex] = useState<number | null>(null);
  const [drillingRigId, setDrillingRigId] = useState<number | null>(null);
  const [wagons, setWagons] = useState(0);
  const [wagonFleet, setWagonFleet] = useState<WagonState[]>([]);
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);
  const [campaignRound, setCampaignRound] = useState(1);
  const [rivals, setRivals] = useState<RivalState[]>(createInitialRivals);
  const [auctionBids, setAuctionBids] = useState<Record<number, AuctionBid>>({});
  const [aiTargets, setAiTargets] = useState<Record<string, number>>({});
  const [auctionSeconds, setAuctionSeconds] = useState(16);
  const [depositReserves, setDepositReserves] = useState<DepositReserves>({});
  const [initialDepositReserves, setInitialDepositReserves] = useState<DepositReserves>({});
  const [upgrades, setUpgrades] = useState<UpgradeState>(INITIAL_UPGRADES);
  const [notice, setNotice] = useState("");
  const cashRef = useRef(STARTING_CASH);
  const soldRef = useRef(0);
  const storageRef = useRef(0);
  const rigStocksRef = useRef<RigStocks>({});
  const wagonFleetRef = useRef<WagonState[]>([]);
  const wagonIdRef = useRef(0);
  const plotsRef = useRef(plots);
  const depositReservesRef = useRef<DepositReserves>({});
  const activePipeNodeRef = useRef<PipePoint | null>(null);
  const pipeSegmentIdRef = useRef(0);
  const processedPipeSegmentIdsRef = useRef<Set<number>>(new Set());
  const rigIdRef = useRef(0);
  const fieldRef = useRef<HTMLElement>(null);
  const discoveryTimerRefs = useRef<Map<number, number>>(new Map());
  const dowserMotionRefs = useRef<Map<number, { x: number; direction: 1 | -1; destinationX: number; remainingTicks: number; phase: Exclude<DowserPhase, "found">; probeTicks: number }>>(new Map());
  const moleMotionRefs = useRef<Map<number, number>>(new Map());
  const probeIdRef = useRef(0);
  const scannerTimerRef = useRef<number | null>(null);
  const scannerScanRef = useRef<ScannerScan | null>(null);
  const scannerBurstIdRef = useRef(0);
  const pipeDraggingRef = useRef(false);
  const toolDraggingRef = useRef<PlaceableTool | null>(null);
  const suppressToolClickRef = useRef(false);
  const suppressPipeClickRef = useRef(false);

  const leasedPlot = useMemo(() => plots.find((plot) => plot.id === leasedPlotId) ?? null, [leasedPlotId, plots]);
  const selectedPlot = useMemo(() => plots.find((plot) => plot.id === selectedPlotId) ?? leasedPlot, [leasedPlot, plots, selectedPlotId]);
  const selectedCharacter = useMemo(() => OIL_CHARACTERS.find((character) => character.id === selectedCharacterId) ?? null, [selectedCharacterId]);
  const capitalRanking = useMemo(() => [
    { id: "player", name: selectedCharacter?.name ?? "玩家", portrait: selectedCharacter?.portrait ?? "⛽", capital: cash, player: true },
    ...rivals.map((rival) => ({ id: rival.id, name: rival.name, portrait: rival.portrait, capital: rival.capital, player: false })),
  ].sort((left, right) => right.capital - left.capital), [cash, rivals, selectedCharacter]);
  const siloCapacityForLevel = (level: number) => 28 + level * 14;
  const capacity = siloBuilt ? siloLevels.reduce((total, level) => total + siloCapacityForLevel(level), 0) : 6;
  const costs = selectedPlot ? plotCost(selectedPlot, upgrades) : null;
  const elapsed = ROUND_SECONDS - time;
  const secondsPerMonth = ROUND_SECONDS / 6;
  const seasonMonth = Math.min(6, 1 + Math.floor(elapsed / secondsPerMonth));
  const seasonDay = Math.min(30, 1 + Math.floor(elapsed % secondsPerMonth / secondsPerMonth * 30));
  const monthNames = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN"];
  const seasonKey = (["spring", "summer", "autumn", "winter"] as const)[Math.min(3, Math.floor(elapsed / (ROUND_SECONDS / 4)))];
  const seasonClass = seasonKey === "spring" ? styles.seasonSpring : seasonKey === "summer" ? styles.seasonSummer : seasonKey === "autumn" ? styles.seasonAutumn : styles.seasonWinter;
  const seasonLabel = seasonKey === "spring" ? "SPRING" : seasonKey === "summer" ? "SUMMER" : seasonKey === "autumn" ? "AUTUMN" : "WINTER";
  const closedPipeNodes = useMemo(() => new Set(closedPipeNodeKeys), [closedPipeNodeKeys]);
  const activePipeSegmentIdsByRig = useMemo(() => {
    const byRig = new Map<number, Set<number>>();
    rigs.filter((rig) => rig.ready).forEach((rig) => {
      const rootKey = pipeNodeKey({ x: rig.x, y: 34.8 });
      const reachable = new Set<string>();
      const active = new Set<number>();
      if (!closedPipeNodes.has(rootKey)) reachable.add(rootKey);
      let changed = true;
      while (changed) {
        changed = false;
        pipeSegments.forEach((segment) => {
          const fromKey = pipeNodeKey(segment.from);
          const toKey = pipeNodeKey(segment.to);
          if (segment.progress < 1 || active.has(segment.id) || !reachable.has(fromKey) || closedPipeNodes.has(fromKey) || closedPipeNodes.has(toKey)) return;
          active.add(segment.id);
          reachable.add(toKey);
          changed = true;
        });
      }
      byRig.set(rig.id, active);
    });
    return byRig;
  }, [closedPipeNodes, pipeSegments, rigs]);
  const activePipeSegmentIds = useMemo(() => {
    const active = new Set<number>();
    activePipeSegmentIdsByRig.forEach((segments) => segments.forEach((id) => active.add(id)));
    return active;
  }, [activePipeSegmentIdsByRig]);
  const gasNetwork = useMemo(() => {
    const targets = new Set<Company>();
    const flow = new Set<number>();
    const available = pipeSegments.filter((segment) => segment.progress >= 1 && !closedPipeNodes.has(pipeNodeKey(segment.from)) && !closedPipeNodes.has(pipeNodeKey(segment.to)));
    const visited = new Set<number>();
    available.forEach((seed) => {
      if (visited.has(seed.id)) return;
      const networkSegments: PipeSegment[] = [];
      const nodes = new Set([pipeNodeKey(seed.from), pipeNodeKey(seed.to)]);
      let changed = true;
      while (changed) {
        changed = false;
        available.forEach((segment) => {
          if (visited.has(segment.id) || (!nodes.has(pipeNodeKey(segment.from)) && !nodes.has(pipeNodeKey(segment.to)))) return;
          visited.add(segment.id);
          networkSegments.push(segment);
          nodes.add(pipeNodeKey(segment.from));
          nodes.add(pipeNodeKey(segment.to));
          changed = true;
        });
      }
      if (!networkSegments.some((segment) => segment.depositKind === "gas")) return;
      const networkTargets = networkSegments.flatMap((segment) => segment.marketTarget ? [segment.marketTarget] : []);
      networkTargets.forEach((target) => targets.add(target));
      if (networkTargets.length > 0) networkSegments.forEach((segment) => flow.add(segment.id));
    });
    return { targets, flow };
  }, [closedPipeNodes, pipeSegments]);
  const gasPipeCount = pipeSegments.filter((segment) => gasNetwork.flow.has(segment.id) && segment.depositKind === "gas").length;
  const magmaPipeCount = pipeSegments.filter((segment) => activePipeSegmentIds.has(segment.id) && segment.depositKind === "magma").length;
  const gasBoost = gasNetwork.targets.size > 0;
  const gasBonus = gasBoost && gasConnected && gasPipeCount > 0 && leasedPlot?.hasGas ? Math.round((24 + upgrades.gas * 8) * gasPressure * gasPipeCount) : 0;
  const effectivePrice = sellTarget ? markets[sellTarget] + (gasNetwork.targets.has(sellTarget) ? gasBonus : 0) : 0;
  const oilPipeCount = pipeSegments.filter((segment) => activePipeSegmentIds.has(segment.id) && segment.depositKind === "oil").length;
  const rigOilPipeCounts = useMemo(() => {
    const counts = new Map<number, number>();
    activePipeSegmentIdsByRig.forEach((segments, rigId) => {
      counts.set(rigId, pipeSegments.filter((segment) => segments.has(segment.id) && segment.depositKind === "oil").length);
    });
    return counts;
  }, [activePipeSegmentIdsByRig, pipeSegments]);
  const rigOilDepositThroughputs = useMemo(() => {
    const throughputs = new Map<number, Map<string, number>>();
    activePipeSegmentIdsByRig.forEach((segments, rigId) => {
      const byDeposit = new Map<string, number>();
      const terminals = pipeSegments.filter((segment) => segments.has(segment.id) && segment.depositKind === "oil" && segment.depositId);
      terminals.forEach((terminal) => {
        let current: PipeSegment | undefined = terminal;
        let upgraded = false;
        const visited = new Set<number>();
        while (current && !visited.has(current.id)) {
          visited.add(current.id);
          upgraded ||= current.upgraded;
          const parentKey = pipeNodeKey(current.from);
          current = pipeSegments.find((segment) => segments.has(segment.id) && pipeNodeKey(segment.to) === parentKey && !visited.has(segment.id));
        }
        const depositId = terminal.depositId!;
        byDeposit.set(depositId, (byDeposit.get(depositId) ?? 0) + (upgraded ? 2 : 1));
      });
      throughputs.set(rigId, byDeposit);
    });
    return throughputs;
  }, [activePipeSegmentIdsByRig, pipeSegments]);
  const availableOilDepositIds = useMemo(() => new Set(Object.entries(depositReserves).filter(([, reserve]) => reserve > .001).map(([depositId]) => depositId)), [depositReserves]);
  const oilFlowSegmentIds = useMemo(() => traceResourceFlow(pipeSegments, activePipeSegmentIds, "oil", availableOilDepositIds), [activePipeSegmentIds, availableOilDepositIds, pipeSegments]);
  const gasFlowSegmentIds = gasNetwork.flow;
  const magmaFlowSegmentIds = useMemo(() => traceResourceFlow(pipeSegments, activePipeSegmentIds, "magma"), [activePipeSegmentIds, pipeSegments]);
  const pumpingOilSegmentIds = useMemo(() => {
    const pumping = new Set<number>();
    if (!selectedPlot) return pumping;
    rigs.filter((rig) => rig.ready).forEach((rig) => {
      const connectedPipes = rigOilPipeCounts.get(rig.id) ?? 0;
      const wellCapacity = 12 + upgrades.pipe * 4 + upgrades.branch * 3 + Math.max(0, connectedPipes - 1) * 6;
      const connectedDeposits = rigOilDepositThroughputs.get(rig.id);
      const hasOil = connectedDeposits && [...connectedDeposits.keys()].some((depositId) => (depositReserves[depositId] ?? 0) > .001);
      if (connectedPipes <= 0 || !hasOil || (rigStocks[rig.id] ?? 0) >= wellCapacity - .05) return;
      const rigSegments = activePipeSegmentIdsByRig.get(rig.id);
      if (!rigSegments) return;
      traceResourceFlow(pipeSegments, rigSegments, "oil", availableOilDepositIds).forEach((id) => pumping.add(id));
    });
    return pumping;
  }, [activePipeSegmentIdsByRig, availableOilDepositIds, depositReserves, pipeSegments, rigOilDepositThroughputs, rigOilPipeCounts, rigStocks, rigs, selectedPlot, upgrades]);
  const branchNodes = useMemo(() => {
    const nodes = new Map<string, PipePoint>();
    pipeSegments.filter((segment) => segment.progress >= 1).forEach((segment) => {
      [segment.from, segment.to].forEach((point) => nodes.set(`${point.x.toFixed(2)}:${point.y.toFixed(2)}`, point));
    });
    return [...nodes.values()];
  }, [pipeSegments]);
  const selectedPipeSegment = useMemo(() => pipeSegments.find((segment) => segment.id === selectedPipeSegmentId) ?? null, [pipeSegments, selectedPipeSegmentId]);
  const oilLevelForDeposit = (depositId: string) => {
    const initial = initialDepositReserves[depositId] ?? depositReserves[depositId] ?? 1;
    const remaining = depositReserves[depositId] ?? initial;
    return clamp(remaining / Math.max(.001, initial) * 100, 0, 100);
  };
  const depositRevealStyle = (deposit: OilPlot["deposits"][number]): CSSProperties => {
    if (status === "ranking") return { maskImage: "none", WebkitMaskImage: "none" };
    const areas = depositRevealAreas[deposit.id] ?? [];
    if (areas.length === 0) return { maskImage: "linear-gradient(transparent,transparent)", WebkitMaskImage: "linear-gradient(transparent,transparent)" };
    const maskImage = areas.map((area) => {
      const centerX = 50 + (area.x - deposit.x) / Math.max(.01, deposit.radius * 2) * 100;
      const centerY = 50 + (area.y - deposit.y) / Math.max(.01, deposit.radius * 1.55) * 100;
      const radiusX = clamp(area.radiusX / Math.max(.01, deposit.radius * 2) * 100, 2, 220);
      const radiusY = clamp(area.radiusY / Math.max(.01, deposit.radius * 1.55) * 100, 2, 220);
      return `radial-gradient(ellipse ${radiusX}% ${radiusY}% at ${centerX}% ${centerY}%, #000 0 88%, #000c 94%, transparent 100%)`;
    }).join(",");
    return { maskImage, WebkitMaskImage: maskImage };
  };
  useEffect(() => { plotsRef.current = plots; }, [plots]);

  const flash = useCallback((message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 1700);
  }, []);

  const revealDepositArea = useCallback((depositId: string, area: DepositRevealArea) => {
    setDepositRevealAreas((current) => {
      const existing = current[depositId] ?? [];
      const alreadyCovered = existing.some((item) => {
        const normalizedDistance = Math.hypot((item.x - area.x) / Math.max(.01, item.radiusX), (item.y - area.y) / Math.max(.01, item.radiusY));
        return normalizedDistance < .35 && item.radiusX >= area.radiusX * .9 && item.radiusY >= area.radiusY * .9;
      });
      if (alreadyCovered) return current;
      return { ...current, [depositId]: [...existing.slice(-11), area] };
    });
  }, []);

  const changeCash = useCallback((delta: number) => {
    cashRef.current += delta;
    setCash(cashRef.current);
  }, []);

  const startRound = useCallback(() => {
    discoveryTimerRefs.current.forEach((timer) => window.clearInterval(timer));
    discoveryTimerRefs.current.clear();
    dowserMotionRefs.current.clear();
    moleMotionRefs.current.clear();
    if (scannerTimerRef.current) window.clearInterval(scannerTimerRef.current);
    scannerScanRef.current = null;
    cashRef.current = STARTING_CASH;
    soldRef.current = 0;
    setCash(STARTING_CASH);
    setSold(0);
    setTime(ROUND_SECONDS);
    setMarkets({ left: MARKET_BASE, right: MARKET_BASE - 8 });
    setMarketTrends({ left: "up", right: "down" });
    setSellTarget("left");
    setDiscoveryTool(null);
    setRevealedDepositIds([]);
    setDepositRevealAreas({});
    setFlaggedDepositIds([]);
    setDowserProbes([]);
    setMoleProbes([]);
    setScannerScan(null);
    setScannerBurst(null);
    setPlacingTool(null);
    setStorage(0);
    storageRef.current = 0;
    setRigStocks({});
    rigStocksRef.current = {};
    setSellOil(true);
    setGasPressure(1);
    setPipeTool(false);
    setPipeSegments([]);
    setSelectedPipeSegmentId(null);
    setActivePipeNode(null);
    setClosedPipeNodeKeys([]);
    activePipeNodeRef.current = null;
    pipeSegmentIdRef.current = 0;
    processedPipeSegmentIdsRef.current.clear();
    setPipePreview(null);
    setDrillInProgress(false);
    setDrillDepth(0);
    setGasConnected(false);
    setMagmaConnected(false);
    setSiloBuilt(false);
    setRigX(null);
    setSiloX(42);
    setRigs([]);
    setSiloXs([]);
    setSiloLevels([]);
    setSelectedSiloIndex(null);
    setDrillingRigId(null);
    rigIdRef.current = 0;
    setWagons(0);
    setWagonFleet([]);
    wagonFleetRef.current = [];
    wagonIdRef.current = 0;
    setDepositReserves({});
    setInitialDepositReserves({});
    depositReservesRef.current = {};
    setUpgrades({ ...INITIAL_UPGRADES });
    setPlots(createPlots());
    setSelectedPlotId(null);
    setLeasedPlotId(null);
    setSelectedCharacterId(null);
    setCampaignRound(1);
    setRivals(createInitialRivals());
    setAuctionBids({});
    setAiTargets({});
    setAuctionSeconds(16);
    setNotice("");
    setStatus("character");
    gameAudio.play("start");
  }, []);

  const beginAuction = (nextPlots: OilPlot[] = plots, currentRivals: RivalState[] = rivals) => {
    setPlots(nextPlots);
    plotsRef.current = nextPlots;
    setSelectedPlotId(null);
    setLeasedPlotId(null);
    setAuctionBids(createAuctionBids(nextPlots));
    setAiTargets(createAiTargets(nextPlots, currentRivals));
    setAuctionSeconds(16);
    setStatus("auction");
    gameAudio.play("start");
  };

  const chooseCharacter = (character: OilCharacter) => {
    setSelectedCharacterId(character.id);
    flash(`${character.name} 加入石油小镇，第一场土地拍卖即将开始`);
    beginAuction(plots, rivals);
  };

  const placeAuctionBid = () => {
    if (selectedPlotId === null) return flash("先从地图上选择一块土地");
    const existingPlayerLead = Object.entries(auctionBids).find(([plotId, bid]) => bid.bidderId === "player" && Number(plotId) !== selectedPlotId);
    if (existingPlayerLead) return flash("你已经在另一块土地上领先，每年只能租下一块土地");
    const current = auctionBids[selectedPlotId];
    const nextAmount = (current?.amount ?? 50) + 25;
    if (cashRef.current < nextAmount) return flash(`竞价需要 $${nextAmount}，当前资本不足`);
    if (auctionSeconds <= 0) setAuctionSeconds(8);
    setAuctionBids((bids) => ({ ...bids, [selectedPlotId]: { bidderId: "player", amount: nextAmount } }));
    flash(`你对 ${plots.find((plot) => plot.id === selectedPlotId)?.name ?? "土地"} 出价 $${nextAmount}`);
    gameAudio.play("drop");
  };

  useEffect(() => {
    if (status !== "auction") return;
    const timer = window.setInterval(() => {
      setAuctionSeconds((seconds) => {
        if (seconds <= 1) return 0;
        setAuctionBids((current) => {
          const next = { ...current };
          rivals.forEach((rival) => {
            const plotId = aiTargets[rival.id];
            const plot = plots.find((item) => item.id === plotId);
            const bid = next[plotId];
            if (!plot || !bid || bid.bidderId === rival.id || Math.random() > .7) return;
            const nextAmount = bid.amount + 25;
            const maximum = Math.min(rival.capital * .42, 90 + plot.reserve * 3.6 + campaignRound * 18);
            if (nextAmount <= maximum) next[plotId] = { bidderId: rival.id, amount: nextAmount };
          });
          return next;
        });
        return seconds - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [aiTargets, campaignRound, plots, rivals, status]);

  const leasePlot = () => {
    if (selectedPlotId === null) return flash("先从地图上挑一块地");
    const plot = plots.find((item) => item.id === selectedPlotId);
    if (!plot) return;
    const winningBid = auctionBids[plot.id];
    if (!winningBid || winningBid.bidderId !== "player") return flash("你还没有领先这块土地，请继续竞价");
    if (cashRef.current < winningBid.amount) return flash("现金不够，换一块更便宜的地");
    changeCash(-winningBid.amount);
    setRivals((current) => current.map((rival) => {
      const rivalWinningBid = Object.values(auctionBids).find((bid) => bid.bidderId === rival.id);
      return rivalWinningBid ? { ...rival, capital: Math.max(0, rival.capital - rivalWinningBid.amount) } : rival;
    }));
    discoveryTimerRefs.current.forEach((timer) => window.clearInterval(timer));
    discoveryTimerRefs.current.clear();
    dowserMotionRefs.current.clear();
    moleMotionRefs.current.clear();
    if (scannerTimerRef.current) window.clearInterval(scannerTimerRef.current);
    scannerScanRef.current = null;
    setLeasedPlotId(plot.id);
    setPipeSegments([]);
    setSelectedPipeSegmentId(null);
    setActivePipeNode(null);
    setClosedPipeNodeKeys([]);
    activePipeNodeRef.current = null;
    pipeSegmentIdRef.current = 0;
    processedPipeSegmentIdsRef.current.clear();
    setDiscoveryTool(null);
    setRevealedDepositIds([]);
    setDepositRevealAreas({});
    setFlaggedDepositIds([]);
    setDowserProbes([]);
    setMoleProbes([]);
    setScannerScan(null);
    setPlacingTool(null);
    setPipeTool(false);
    setDrillInProgress(false);
    setDrillDepth(0);
    setGasConnected(false);
    setGasPressure(1);
    setMagmaConnected(false);
    setSiloBuilt(false);
    setRigX(null);
    setSiloX(42);
    setRigs([]);
    setSiloXs([]);
    setSiloLevels([]);
    setSelectedSiloIndex(null);
    setDrillingRigId(null);
    rigIdRef.current = 0;
    setWagons(0);
    setWagonFleet([]);
    wagonFleetRef.current = [];
    wagonIdRef.current = 0;
    storageRef.current = 0;
    rigStocksRef.current = {};
    setStorage(0);
    setRigStocks({});
    const allocatedReserves = allocateDepositReserves(plot);
    setDepositReserves(allocatedReserves);
    setInitialDepositReserves(allocatedReserves);
    depositReservesRef.current = allocatedReserves;
    setStatus("running");
    flash(`${plot.name} 以 $${winningBid.amount} 成交，开始找油！`);
    gameAudio.play("score");
  };

  const selectPlot = (plot: OilPlot) => {
    if (status === "auction") {
      setSelectedPlotId(plot.id);
      gameAudio.play("tap");
      return;
    }
    if (plot.id === leasedPlotId || plot.status !== "hidden") {
      setSelectedPlotId(plot.id);
      gameAudio.play("tap");
    }
  };

  const spendFor = (cost: number, message: string) => {
    if (cashRef.current < cost) {
      flash("现金不足，先把手里的油卖掉");
      return false;
    }
    changeCash(-cost);
    flash(message);
    gameAudio.play("drop");
    return true;
  };

  const markSurveyed = useCallback((plotId: number) => {
    setPlots((current) => current.map((plot) => plot.id === plotId && plot.status === "hidden" ? { ...plot, status: "surveyed" } : plot));
  }, []);

  const discover = (tool: Exclude<DiscoveryTool, "scanner">, placementX: number) => {
    if (!selectedPlot || selectedPlot.id !== leasedPlotId || !costs) return flash("先选择已租下的地块");
    if (!spendFor(costs[tool], tool === "dowser" ? "探矿员正在用雷达向地下探测" : "鼹鼠钻入土层，正在向油藏边缘前进")) return;
    setPlacingTool(null);
    const probeId = ++probeIdRef.current;

    if (tool === "dowser") {
      const choosePatrolPoint = (x: number) => {
        const distance = 4 + Math.random() * 4;
        const preferredDirection: 1 | -1 = Math.random() > .5 ? 1 : -1;
        let destination = x + preferredDirection * distance;
        if (destination < 9 || destination > 91) destination = x - preferredDirection * distance;
        return clamp(destination, 9, 91);
      };
      const initialDestination = choosePatrolPoint(placementX);
      const initialDirection: 1 | -1 = initialDestination >= placementX ? 1 : -1;
      dowserMotionRefs.current.set(probeId, { x: placementX, direction: initialDirection, destinationX: initialDestination, remainingTicks: 50, phase: "walking", probeTicks: 0 });
      let finished = false;
      const findOilAt = (x: number) => selectedPlot.deposits
        .filter((deposit) => deposit.kind === "oil" && !flaggedDepositIds.includes(deposit.id) && Math.abs(deposit.x - x) <= deposit.radius + 1)
        .sort((a, b) => Math.abs(a.x - x) - Math.abs(b.x - x))[0];
      setDowserProbes((current) => [...current, { id: probeId, depositId: null, x: placementX, targetY: 92, found: false, direction: initialDirection, phase: "walking" }]);
      const patrolTimer = window.setInterval(() => {
        if (finished) return;
        const motion = dowserMotionRefs.current.get(probeId);
        if (!motion) return;
        motion.remainingTicks -= 1;
        if (motion.remainingTicks <= 0) {
          finished = true;
          window.clearInterval(patrolTimer);
          discoveryTimerRefs.current.delete(probeId);
          dowserMotionRefs.current.delete(probeId);
          setDowserProbes((current) => current.filter((probe) => probe.id !== probeId));
          flash("探矿员巡查了 15 秒仍未发现油田，已经离场");
          gameAudio.play("drop");
          return;
        }

        if (motion.phase === "walking") {
          const distance = motion.destinationX - motion.x;
          if (Math.abs(distance) <= .96) {
            motion.x = motion.destinationX;
            motion.phase = "probing";
            motion.probeTicks = 0;
            setDowserProbes((current) => current.map((probe) => probe.id === probeId ? { ...probe, x: motion.x, targetY: 92, direction: motion.direction, phase: "probing" } : probe));
            gameAudio.play("tap");
            return;
          }
          motion.direction = distance > 0 ? 1 : -1;
          motion.x += motion.direction * Math.min(.96, Math.abs(distance));
          setDowserProbes((current) => current.map((probe) => probe.id === probeId ? { ...probe, x: motion.x, direction: motion.direction, phase: "walking" } : probe));
          return;
        }

        motion.probeTicks += 1;
        if (motion.probeTicks < 8) return;
        const target = findOilAt(motion.x);
        if (target) {
          finished = true;
          window.clearInterval(patrolTimer);
          discoveryTimerRefs.current.delete(probeId);
          dowserMotionRefs.current.delete(probeId);
          setDowserProbes((current) => current.map((probe) => probe.id === probeId ? { ...probe, depositId: target.id, x: motion.x, targetY: target.y - target.radius * .7, found: true, direction: motion.direction, phase: "found" } : probe));
          setFlaggedDepositIds((current) => current.includes(target.id) ? current : [...current, target.id]);
          markSurveyed(selectedPlot.id);
          flash("光波雷达收到强烈回波！探矿员举手并插下定位旗");
          gameAudio.play("great");
          window.setTimeout(() => setDowserProbes((current) => current.filter((probe) => probe.id !== probeId)), 900);
          return;
        }
        motion.phase = "walking";
        motion.probeTicks = 0;
        motion.destinationX = choosePatrolPoint(motion.x);
        motion.direction = motion.destinationX >= motion.x ? 1 : -1;
        setDowserProbes((current) => current.map((probe) => probe.id === probeId ? { ...probe, direction: motion.direction, phase: "walking" } : probe));
        flash("这个位置没有回波，探矿员正随机前往下一处探测");
      }, 300);
      discoveryTimerRefs.current.set(probeId, patrolTimer);
      return;
    }

    const target = selectedPlot.deposits
      .filter((deposit) => deposit.kind === "oil" && Math.abs(deposit.x - placementX) <= deposit.radius + 2 && !revealedDepositIds.includes(deposit.id))
      .sort((a, b) => (a.y - a.radius) - (b.y - b.radius))[0];
    const intendedTargetY = target ? target.y - target.radius * .72 : 92;
    const blockingRock = selectedPlot.rocks.map((rock) => {
      const horizontalRatio = Math.abs(placementX - rock.x) / Math.max(.01, rock.radius * 1.3);
      if (horizontalRatio > 1) return null;
      const verticalRadius = rock.radius * .7 * Math.sqrt(Math.max(0, 1 - horizontalRatio * horizontalRatio));
      return { rock, top: rock.y - verticalRadius };
    }).filter((hit): hit is { rock: OilPlot["rocks"][number]; top: number } => Boolean(hit && hit.top > 35 && hit.top < intendedTargetY)).sort((a, b) => a.top - b.top)[0];
    const reachedDeposit = blockingRock ? null : target;
    const targetY = blockingRock ? Math.max(36, blockingRock.top - .45) : intendedTargetY;
    moleMotionRefs.current.set(probeId, 35);
    setMoleProbes((current) => [...current, { id: probeId, depositId: reachedDeposit?.id ?? null, x: placementX, y: 35, targetY, done: false, blockedByRock: Boolean(blockingRock) }]);
    const moleTimer = window.setInterval(() => {
      const moleY = Math.min(targetY, (moleMotionRefs.current.get(probeId) ?? 35) + .22);
      moleMotionRefs.current.set(probeId, moleY);
      setMoleProbes((current) => current.map((probe) => probe.id === probeId ? { ...probe, y: moleY, done: moleY >= targetY } : probe));
      if (moleY < targetY) return;
      window.clearInterval(moleTimer);
      discoveryTimerRefs.current.delete(probeId);
      moleMotionRefs.current.delete(probeId);
      if (reachedDeposit) {
        setRevealedDepositIds((ids) => ids.includes(reachedDeposit.id) ? ids : [...ids, reachedDeposit.id]);
        const rect = fieldRef.current?.getBoundingClientRect();
        revealDepositArea(reachedDeposit.id, { x: placementX, y: targetY, radiusX: 1.8, radiusY: rect ? 1.8 * rect.width / rect.height : 4 });
      }
      if (reachedDeposit) {
        markSurveyed(selectedPlot.id);
        flash("鼹鼠碰到油田边缘，已经停下并发出信号");
        gameAudio.play("match");
      } else if (blockingRock) {
        flash("鼹鼠撞到坚硬岩层，无法继续穿过石头，请换个位置探测");
        gameAudio.play("drop");
      } else {
        flash("鼹鼠钻到底也没有碰到油田，换个位置再放一只");
        gameAudio.play("drop");
      }
      window.setTimeout(() => setMoleProbes((current) => current.filter((probe) => probe.id !== probeId)), 750);
    }, 140);
    discoveryTimerRefs.current.set(probeId, moleTimer);
  };

  const finishScanner = (settledScan?: ScannerScan) => {
    const scan = settledScan ?? scannerScanRef.current;
    if (!scan || !selectedPlot || selectedPlot.id !== leasedPlotId) return;
    if (scannerTimerRef.current) window.clearInterval(scannerTimerRef.current);
    const scanCost = Math.max(100, Math.ceil(Math.max(1, scan.elapsedMs) / 1000) * 100);
    changeCash(-scanCost);
    const rect = fieldRef.current?.getBoundingClientRect();
    const found = selectedPlot.deposits.filter((deposit) => {
      if (!rect) return Math.hypot(deposit.x - scan.x, deposit.y - scan.y) <= scan.radius + deposit.radius;
      const dx = (deposit.x - scan.x) * rect.width / 100;
      const dy = (deposit.y - scan.y) * rect.height / 100;
      return Math.hypot(dx, dy) <= (scan.radius + deposit.radius) * rect.width / 100;
    });
    setRevealedDepositIds((current) => [...new Set([...current, ...found.map((deposit) => deposit.id)])]);
    const revealRadiusY = rect ? scan.radius * rect.width / rect.height : scan.radius * 2;
    found.forEach((deposit) => revealDepositArea(deposit.id, { x: scan.x, y: scan.y, radiusX: scan.radius, radiusY: revealRadiusY }));
    setScannerBurst({ ...scan, key: ++scannerBurstIdRef.current });
    setScannerScan(null);
    scannerScanRef.current = null;
    setDiscoveryTool(null);
    markSurveyed(selectedPlot.id);
    flash(found.length ? `扫描结束，扣除 $${scanCost}，揭示了范围内 ${found.length} 处资源` : `扫描结束，扣除 $${scanCost}，范围内没有资源`);
    gameAudio.play(found.length ? "perfect" : "drop");
    window.setTimeout(() => setScannerBurst(null), 700);
  };

  const startScannerAt = (x: number, y: number) => {
    if (scannerScanRef.current) return flash("扫描仪正在工作，请先点击扫描圆圈停止并结算");
    if (pipeDraggingRef.current) return flash("正在拖动输油管，请先完成本次铺管操作");
    if (cashRef.current < 100) return flash(`扫描仪每秒 $100，当前现金 $${Math.floor(cashRef.current)}`);
    if (pipeTool) {
      setPipeTool(false);
      setActivePipeNode(null);
      activePipeNodeRef.current = null;
      setPipePreview(null);
    }
    const scan = { x: clamp(x, 5, 95), y: clamp(y, 40, 93), radius: 3, elapsedMs: 0 };
    setDiscoveryTool("scanner");
    setPlacingTool(null);
    setToolDragPreview(null);
    scannerScanRef.current = scan;
    setScannerScan(scan);
    scannerTimerRef.current = window.setInterval(() => {
      const current = scannerScanRef.current;
      if (!current) {
        if (scannerTimerRef.current) window.clearInterval(scannerTimerRef.current);
        return;
      }
      const elapsedMs = current.elapsedMs + 100;
      const nextCost = Math.max(100, Math.ceil(Math.max(1, elapsedMs) / 1000) * 100);
      if (cashRef.current < nextCost) {
        const affordableSeconds = Math.max(1, Math.floor(cashRef.current / 100));
        finishScanner({ ...current, elapsedMs: affordableSeconds * 1000 });
        flash(`现金只够扫描 ${affordableSeconds} 秒，雷达已自动停止`);
        return;
      }
      const next = { ...current, elapsedMs, radius: Math.min(22, current.radius + .8) };
      scannerScanRef.current = next;
      setScannerScan(next);
    }, 100);
    gameAudio.play("tap");
  };

  const drill = (placementX: number) => {
    if (!selectedPlot || selectedPlot.id !== leasedPlotId || !["surveyed", "drilled", "connected"].includes(selectedPlot.status) || !costs) return flash("需要先完成地质探测");
    if (drillInProgress) return flash("先等当前井架完成下钻");
    if ([...rigs.map((rig) => rig.x), ...siloXs].some((x) => Math.abs(x - placementX) < 7)) return flash("这里已有井架或油罐占地，换一个位置放井架");
    if (!spendFor(costs.drill, "井架就位，钻头正在穿过地层")) return;
    const rigId = ++rigIdRef.current;
    setRigs((current) => [...current, { id: rigId, x: placementX, ready: false }]);
    setDrillingRigId(rigId);
    setRigX(placementX);
    setPlacingTool(null);
    const rootNode = { x: placementX, y: 34.8 };
    setActivePipeNode(rootNode);
    activePipeNodeRef.current = rootNode;
    setPipeTool(false);
    setDrillDepth(0);
    setDrillInProgress(true);
    setPlots((current) => current.map((plot) => plot.id === selectedPlot.id && plot.status !== "connected" ? { ...plot, status: "drilled" } : plot));
  };

  const extendPipeTo = (point: PipePoint, marketTarget: Company | null = null) => {
    if (drillInProgress || !selectedPlot || selectedPlot.id !== leasedPlotId || (selectedPlot.status !== "drilled" && selectedPlot.status !== "connected")) return;
    const last = activePipeNodeRef.current ?? { x: rigX ?? selectedPlot.x, y: 34.8 };
    const originMarketTarget = (Object.entries(MARKET_PIPE_POINTS) as Array<[Company, PipePoint]>).find(([, marketPoint]) => pipeNodeKey(marketPoint) === pipeNodeKey(last))?.[0] ?? null;
    const firstDepositHit = marketTarget ? null : selectedPlot.deposits
      .map((deposit) => ({ deposit, entry: pipeDepositEntry(last, point, deposit) }))
      .filter((hit): hit is { deposit: OilPlot["deposits"][number]; entry: PipePoint } => hit.entry !== null)
      .sort((left, right) => Math.hypot(left.entry.x - last.x, left.entry.y - last.y) - Math.hypot(right.entry.x - last.x, right.entry.y - last.y))[0] ?? null;
    const destination = firstDepositHit?.entry ?? point;
    const segmentLength = Math.hypot(destination.x - last.x, destination.y - last.y);
    if (segmentLength < 3) return;
    const rockHit = selectedPlot.rocks.find((rock) => pipeCrossesRock(last, destination, rock));
    if (rockHit) return flash("管道无法穿过坚硬岩层，请从节点改变方向绕开石头");
    const segmentCost = Math.max(8, Math.round(segmentLength * (1.25 - upgrades.pipe * .12 - upgrades.branch * .05)));
    if (!spendFor(segmentCost, `管道铺设 ${segmentCost} 美元`)) return;
    const reachedDeposit = firstDepositHit?.deposit ?? null;
    const segment: PipeSegment = { id: ++pipeSegmentIdRef.current, from: last, to: destination, depositId: reachedDeposit?.id ?? null, depositKind: reachedDeposit?.kind ?? null, marketTarget: marketTarget ?? originMarketTarget, progress: 0, upgraded: false };
    setPipeSegments((current) => [...current, segment]);
    setActivePipeNode(null);
    activePipeNodeRef.current = null;
    setPipeTool(false);
    flash("钻头开始沿半透明路线下探，抵达节点后才能继续分支");
    gameAudio.play("tap");
  };

  const pointFromClient = (clientX: number, clientY: number): PipePoint | null => {
    const rect = fieldRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return { x: clamp((clientX - rect.left) / rect.width * 100, 3, 97), y: clamp((clientY - rect.top) / rect.height * 100, 34.5, 94) };
  };

  const marketAtPipePoint = (point: PipePoint): Company | null => {
    const match = (Object.entries(MARKET_PIPE_POINTS) as Array<[Company, PipePoint]>).find(([, target]) => Math.hypot(point.x - target.x, (point.y - target.y) * 1.8) <= 5);
    return match?.[0] ?? null;
  };

  const handlePipeDragStart = (event: React.PointerEvent<HTMLButtonElement>, origin?: PipePoint) => {
    event.stopPropagation();
    if (drillInProgress) return flash("钻头还在下探");
    if (!origin) return flash("请从已完成的管道节点开始拓展");
    const originKey = pipeNodeKey(origin);
    if (pipeSegments.some((segment) => segment.progress < 1 && (pipeNodeKey(segment.from) === originKey || pipeNodeKey(segment.to) === originKey))) {
      return flash("这个节点的钻头还在下探，请换一个已完成的节点继续拓展");
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    activePipeNodeRef.current = origin;
    setActivePipeNode(origin);
    pipeDraggingRef.current = true;
    setPipeTool(true);
    setPlacingTool(null);
    const rawPoint = pointFromClient(event.clientX, event.clientY);
    const marketTarget = rawPoint ? marketAtPipePoint(rawPoint) : null;
    const point = marketTarget ? MARKET_PIPE_POINTS[marketTarget] : rawPoint;
    if (point) setPipePreview(point);
    gameAudio.play("tap");
  };

  const handlePipeDragMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!pipeDraggingRef.current) return;
    const rawPoint = pointFromClient(event.clientX, event.clientY);
    const marketTarget = rawPoint ? marketAtPipePoint(rawPoint) : null;
    const point = marketTarget ? MARKET_PIPE_POINTS[marketTarget] : rawPoint;
    if (point) setPipePreview(point);
  };

  const handlePipeDragEnd = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!pipeDraggingRef.current) return;
    event.stopPropagation();
    pipeDraggingRef.current = false;
    const rawPoint = pointFromClient(event.clientX, event.clientY);
    const marketTarget = rawPoint ? marketAtPipePoint(rawPoint) : null;
    const point = marketTarget ? MARKET_PIPE_POINTS[marketTarget] : rawPoint;
    const origin = activePipeNodeRef.current;
    const dragged = Boolean(point && origin && Math.hypot(point.x - origin.x, point.y - origin.y) >= 3);
    if (dragged) {
      suppressPipeClickRef.current = true;
      window.setTimeout(() => { suppressPipeClickRef.current = false; }, 250);
    } else {
      setPipeTool(false);
      setActivePipeNode(null);
      activePipeNodeRef.current = null;
    }
    setPipePreview(null);
    if (dragged && point && (point.y >= 39 || marketTarget)) extendPipeTo(point, marketTarget);
  };

  useEffect(() => {
    const movePipe = (event: PointerEvent | MouseEvent) => {
      if (!pipeDraggingRef.current) return;
      const rawPoint = pointFromClient(event.clientX, event.clientY);
      const marketTarget = rawPoint ? marketAtPipePoint(rawPoint) : null;
      const point = marketTarget ? MARKET_PIPE_POINTS[marketTarget] : rawPoint;
      if (point) setPipePreview(point);
    };

    const finishPipe = (event: PointerEvent | MouseEvent) => {
      if (!pipeDraggingRef.current) return;
      pipeDraggingRef.current = false;
      const rawPoint = pointFromClient(event.clientX, event.clientY);
      const marketTarget = rawPoint ? marketAtPipePoint(rawPoint) : null;
      const point = marketTarget ? MARKET_PIPE_POINTS[marketTarget] : rawPoint;
      const origin = activePipeNodeRef.current;
      const dragged = Boolean(point && origin && Math.hypot(point.x - origin.x, point.y - origin.y) >= 3);
      if (dragged) {
        suppressPipeClickRef.current = true;
        window.setTimeout(() => { suppressPipeClickRef.current = false; }, 250);
      } else {
        setPipeTool(false);
        setActivePipeNode(null);
        activePipeNodeRef.current = null;
      }
      setPipePreview(null);
      if (dragged && point && (point.y >= 39 || marketTarget)) extendPipeTo(point, marketTarget);
    };

    window.addEventListener("pointermove", movePipe, true);
    window.addEventListener("mousemove", movePipe, true);
    window.addEventListener("pointerup", finishPipe, true);
    window.addEventListener("mouseup", finishPipe, true);
    return () => {
      window.removeEventListener("pointermove", movePipe, true);
      window.removeEventListener("mousemove", movePipe, true);
      window.removeEventListener("pointerup", finishPipe, true);
      window.removeEventListener("mouseup", finishPipe, true);
    };
  });

  const togglePipeNode = (point: PipePoint) => {
    if (suppressPipeClickRef.current) return;
    const key = pipeNodeKey(point);
    setClosedPipeNodeKeys((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key]);
    flash(closedPipeNodes.has(key) ? "管道节点阀门已打开，恢复输送" : "管道节点阀门已关闭，下游停止输送");
    gameAudio.play("tap");
  };

  const selectPipeSegment = (segmentId: number) => {
    if (pipeTool || pipeDraggingRef.current) return;
    setSelectedPipeSegmentId(segmentId);
    gameAudio.play("tap");
  };

  const upgradePipeSegment = () => {
    if (!selectedPipeSegment) return;
    if (selectedPipeSegment.progress < 1) return flash("这段管道还在钻探，完成后才能升级");
    if (selectedPipeSegment.upgraded) return flash("这段管道已经加粗，输送速度已提升一倍");
    if (!spendFor(120, "管道升级完成：管径加粗，输送速度 ×2")) return;
    setPipeSegments((current) => current.map((segment) => segment.id === selectedPipeSegment.id ? { ...segment, upgraded: true } : segment));
    gameAudio.play("great");
  };

  const handleFieldClick = (event: React.MouseEvent<HTMLElement>) => {
    const rect = fieldRef.current?.getBoundingClientRect();
    if (!rect) return;
    if (scannerScanRef.current) return;
    if (placingTool) {
      placeToolAt(placingTool, (event.clientX - rect.left) / rect.width * 100, (event.clientY - rect.top) / rect.height * 100);
      return;
    }
    if (!pipeTool) {
      setSelectedPipeSegmentId(null);
      setSelectedSiloIndex(null);
      return;
    }
    const point = pointFromClient(event.clientX, event.clientY);
    if (point) extendPipeTo(point);
  };

  const buildSilo = (placementX: number) => {
    if ([...rigs.map((rig) => rig.x), ...siloXs].some((x) => Math.abs(x - placementX) < 8)) return flash("这里已有井架或油罐占地，换一个位置放储油罐");
    if (!spendFor(250, "储油罐建成，可储存更多原油")) return;
    setSiloX(placementX);
    setSiloXs((current) => [...current, placementX]);
    setSiloLevels((current) => [...current, 0]);
    setPlacingTool(null);
    setSiloBuilt(true);
    gameAudio.play("stack");
  };

  const upgradeSilo = (index: number) => {
    const level = siloLevels[index] ?? 0;
    if (level >= 3) return flash("这座储油罐已经达到最高 3 级");
    const cost = 180 + level * 120;
    if (!spendFor(cost, `储油罐升级至 ${level + 1} 级，高度和容量提升`)) return;
    setSiloLevels((current) => current.map((value, currentIndex) => currentIndex === index ? value + 1 : value));
    gameAudio.play("great");
  };

  const buyWagon = (placementX: number) => {
    if (wagons >= 12) return flash("运油货车数量已经达到上限");
    if (!spendFor(150, "新运油货车加入车队，运输速度提高")) return;
    const wagon: WagonState = { id: ++wagonIdRef.current, homeX: placementX, sourceKind: null, sourceRigId: null, sourceSiloIndex: null, sourceX: placementX, legStartX: placementX, destinationX: sellOil ? (sellTarget === "right" ? 92 : 8) : siloX, destinationKind: sellOil ? "market" : "silo", salePrice: effectivePrice, progress: 0, cargo: 0, phase: "parked" };
    const nextFleet = [...wagonFleetRef.current, wagon];
    wagonFleetRef.current = nextFleet;
    setWagonFleet(nextFleet);
    setWagons(nextFleet.length);
    setPlacingTool(null);
    gameAudio.play("move");
  };

  const placeToolAt = (tool: PlaceableTool, rawX: number, rawY: number) => {
    const x = clamp(rawX, 9, 91);
    if (tool === "dowser" || tool === "mole") return discover(tool, x);
    if (tool === "scanner") return startScannerAt(rawX, rawY);
    if (tool === "rig") return drill(x);
    if (tool === "silo") return buildSilo(x);
    return buyWagon(x);
  };

  const handleToolPointerDown = (event: React.PointerEvent<HTMLButtonElement>, tool: PlaceableTool) => {
    if (tool === "scanner") return;
    event.currentTarget.setPointerCapture(event.pointerId);
    toolDraggingRef.current = tool;
    setPlacingTool(tool);
    setToolDragPreview({ tool, x: event.clientX, y: event.clientY });
  };

  const handleToolPointerUp = (event: React.PointerEvent<HTMLButtonElement>) => {
    const tool = toolDraggingRef.current;
    toolDraggingRef.current = null;
    setToolDragPreview(null);
    const rect = fieldRef.current?.getBoundingClientRect();
    if (!tool || !rect) return;
    const inside = event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
    if (!inside) {
      setPlacingTool(null);
      return;
    }
    suppressToolClickRef.current = true;
    placeToolAt(tool, (event.clientX - rect.left) / rect.width * 100, (event.clientY - rect.top) / rect.height * 100);
    window.setTimeout(() => { suppressToolClickRef.current = false; }, 300);
  };

  const handleToolClick = (tool: PlaceableTool) => {
    if (suppressToolClickRef.current) return;
    if (tool === "scanner") {
      setPipeTool(false);
      setActivePipeNode(null);
      activePipeNodeRef.current = null;
      setPipePreview(null);
      setSelectedPipeSegmentId(null);
      setPlacingTool("scanner");
      flash("扫描仪已拿起：移动到地下点击，圆圈会逐渐扩大；点击圆圈停止并结算费用");
      gameAudio.play("tap");
      return;
    }
    setPlacingTool(null);
    flash(`按住${tool === "dowser" ? "探矿员" : tool === "mole" ? "鼹鼠" : tool === "rig" ? "井架" : tool === "silo" ? "油罐" : "运油货车"}，从工具栏拖到场景中放置`);
  };

  const handleFieldPointerMove = (event: React.PointerEvent<HTMLElement>) => {
    if (placingTool === "scanner" && !scannerScan) setToolDragPreview({ tool: "scanner", x: event.clientX, y: event.clientY });
  };

  useEffect(() => {
    const moveCapturedToolDrag = (event: PointerEvent | MouseEvent) => {
      const tool = toolDraggingRef.current;
      if (tool) setToolDragPreview({ tool, x: event.clientX, y: event.clientY });
    };
    const finishCapturedToolDrag = (event: PointerEvent | MouseEvent) => {
      const tool = toolDraggingRef.current;
      if (!tool) return;
      toolDraggingRef.current = null;
      setToolDragPreview(null);
      const rect = fieldRef.current?.getBoundingClientRect();
      if (!rect) return;
      const inside = event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
      if (!inside) {
        setPlacingTool(null);
        return;
      }
      suppressToolClickRef.current = true;
      placeToolAt(tool, (event.clientX - rect.left) / rect.width * 100, (event.clientY - rect.top) / rect.height * 100);
      window.setTimeout(() => { suppressToolClickRef.current = false; }, 300);
    };
    window.addEventListener("pointermove", moveCapturedToolDrag, true);
    window.addEventListener("mousemove", moveCapturedToolDrag, true);
    window.addEventListener("pointerup", finishCapturedToolDrag, true);
    window.addEventListener("mouseup", finishCapturedToolDrag, true);
    return () => {
      window.removeEventListener("pointermove", moveCapturedToolDrag, true);
      window.removeEventListener("mousemove", moveCapturedToolDrag, true);
      window.removeEventListener("pointerup", finishCapturedToolDrag, true);
      window.removeEventListener("mouseup", finishCapturedToolDrag, true);
    };
  });

  const finish = useCallback(() => {
    setRivals((current) => current.map((rival) => {
      const winningPlotEntry = Object.entries(auctionBids).find(([, bid]) => bid.bidderId === rival.id);
      const winningPlot = winningPlotEntry ? plotsRef.current.find((plot) => plot.id === Number(winningPlotEntry[0])) : null;
      const operatingProfit = winningPlot ? Math.round(280 + winningPlot.reserve * (5.2 + Math.random() * 2.4) + campaignRound * 45) : Math.round(120 + Math.random() * 180);
      return { ...rival, capital: rival.capital + operatingProfit };
    }));
    setStatus("ranking");
    onScore(Math.max(0, cashRef.current));
    gameAudio.play(cashRef.current > bestScore ? "win" : "score");
  }, [auctionBids, bestScore, campaignRound, onScore]);

  useEffect(() => {
    if (!drillInProgress || status !== "running") return;
    const drillTimer = window.setInterval(() => {
      setDrillDepth((value) => {
        const next = Math.min(1, value + .027 + upgrades.drill * .0048);
        if (next >= 1) {
          setDrillInProgress(false);
          if (drillingRigId !== null) setRigs((current) => current.map((rig) => rig.id === drillingRigId ? { ...rig, ready: true } : rig));
          setDrillingRigId(null);
          flash("钻头到达工作深度，可以开始铺管");
          gameAudio.play("match");
        }
        return next;
      });
    }, 90);
    return () => window.clearInterval(drillTimer);
  }, [drillInProgress, drillingRigId, flash, status, upgrades.drill]);

  useEffect(() => {
    if (status !== "running") return;
    const pipeTimer = window.setInterval(() => {
      setPipeSegments((current) => {
        let changed = false;
        const next = current.map((segment) => {
          if (segment.progress >= 1) return segment;
          changed = true;
          return { ...segment, progress: Math.min(1, segment.progress + .0083) };
        });
        return changed ? next : current;
      });
    }, 70);
    return () => window.clearInterval(pipeTimer);
  }, [status]);

  useEffect(() => {
    pipeSegments.filter((segment) => segment.progress >= 1 && !processedPipeSegmentIdsRef.current.has(segment.id)).forEach((segment) => {
      processedPipeSegmentIdsRef.current.add(segment.id);
      setActivePipeNode(segment.to);
      activePipeNodeRef.current = segment.to;
      if (segment.depositId) {
        setRevealedDepositIds((current) => current.includes(segment.depositId!) ? current : [...current, segment.depositId!]);
        const rect = fieldRef.current?.getBoundingClientRect();
        revealDepositArea(segment.depositId, { x: segment.to.x, y: segment.to.y, radiusX: 2.1, radiusY: rect ? 2.1 * rect.width / rect.height : 4.5 });
      }
      if (segment.marketTarget) {
        if (segment.depositKind === "gas") {
          setGasConnected(true);
          flash(`${segment.marketTarget === "left" ? "左岸" : "右岸"}商店管道钻入天然气层，油价开始获得加成`);
        } else {
          flash(`${segment.marketTarget === "left" ? "左岸" : "右岸"}商店接口已接通；同一管网连到天然气层后即可抬价`);
        }
        gameAudio.play("great");
      } else if (segment.depositKind === "gas") {
        setGasConnected(true);
        flash("管道钻入天然气层；通过节点阀门控制流向，再导向单侧公司抬价");
        gameAudio.play("great");
      } else if (segment.depositKind === "magma") {
        setMagmaConnected(true);
        flash("管道钻入岩浆层，热量开始沿开启的管网传导");
        gameAudio.play("perfect");
      } else if (segment.depositKind === "oil" && selectedPlot) {
        setPlots((current) => current.map((plot) => plot.id === selectedPlot.id ? { ...plot, status: "connected" } : plot));
        flash("输油管抵达油藏！该通道开始抽油，多通道速度可叠加");
        gameAudio.play("match");
      } else {
        flash("管道节点钻探完成，可从节点“+”继续延伸或分支");
        gameAudio.play("tap");
      }
    });
  }, [flash, pipeSegments, revealDepositArea, selectedPlot]);

  useEffect(() => {
    if (status !== "running") return;
    const timer = window.setInterval(() => {
      setTime((value) => {
        if (value <= 1) {
          finish();
          return 0;
        }
        return value - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [finish, status]);

  useEffect(() => {
    if (status !== "running") return;
    const marketTimer = window.setInterval(() => {
      setMarkets((current) => {
        const next = { ...current };
        (Object.keys(next) as Company[]).forEach((company) => {
          const value = current[company];
          const changed = clamp(value + (Math.random() > .48 ? 4 : -4) + Math.round((Math.random() - .5) * 5), 38, 126);
          next[company] = changed;
          setMarketTrends((trends) => ({ ...trends, [company]: changed >= value ? "up" : "down" }));
        });
        return next;
      });
    }, 2200);
    return () => window.clearInterval(marketTimer);
  }, [status]);

  useEffect(() => {
    if (status !== "running") return;
    const pumpTimer = window.setInterval(() => {
      const active = plotsRef.current.find((plot) => plot.id === leasedPlotId && plot.status === "connected");
      if (!active || oilPipeCount <= 0) return;
      const nextStocks = { ...rigStocksRef.current };
      const nextDepositReserves = { ...depositReservesRef.current };
      let totalProduced = 0;
      rigs.filter((rig) => rig.ready).forEach((rig) => {
        const connectedPipes = rigOilPipeCounts.get(rig.id) ?? 0;
        const connectedDeposits = rigOilDepositThroughputs.get(rig.id);
        if (connectedPipes <= 0 || !connectedDeposits) return;
        const wellCapacity = 12 + upgrades.pipe * 4 + upgrades.branch * 3 + Math.max(0, connectedPipes - 1) * 6;
        const currentStock = nextStocks[rig.id] ?? 0;
        let room = Math.max(0, wellCapacity - currentStock);
        let rigProduced = 0;
        connectedDeposits.forEach((throughput, depositId) => {
          const remaining = nextDepositReserves[depositId] ?? 0;
          if (remaining <= 0 || room <= 0) return;
          const produced = Math.min(remaining, room, pumpRate(active, upgrades) * throughput * .2);
          if (produced <= 0) return;
          nextDepositReserves[depositId] = Math.max(0, remaining - produced);
          rigProduced += produced;
          room -= produced;
        });
        if (rigProduced <= 0) return;
        nextStocks[rig.id] = currentStock + rigProduced;
        totalProduced += rigProduced;
      });
      if (totalProduced <= 0) return;
      rigStocksRef.current = nextStocks;
      depositReservesRef.current = nextDepositReserves;
      setRigStocks(nextStocks);
      setDepositReserves(nextDepositReserves);
      const totalRemaining = Object.values(nextDepositReserves).reduce((total, reserve) => total + reserve, 0);
      const nextPlots = plotsRef.current.map((plot) => plot.id === active.id ? { ...plot, reserve: totalRemaining } : plot);
      plotsRef.current = nextPlots;
      setPlots(nextPlots);
    }, 200);
    return () => window.clearInterval(pumpTimer);
  }, [leasedPlotId, oilPipeCount, rigOilDepositThroughputs, rigOilPipeCounts, rigs, status, upgrades]);

  useEffect(() => {
    if (status !== "running") return;
    const heatTimer = window.setInterval(() => {
      setGasPressure((current) => {
        if (gasPipeCount > 0 && magmaPipeCount > 0 && closedPipeNodeKeys.length > 0) return Math.min(3.2, current + .012 * magmaPipeCount);
        if (gasBoost) return Math.max(.55, current - .008 * Math.max(1, gasPipeCount));
        return current;
      });
    }, 250);
    return () => window.clearInterval(heatTimer);
  }, [closedPipeNodeKeys.length, gasBoost, gasPipeCount, magmaPipeCount, status]);

  useEffect(() => {
    if (status !== "running" || !rigs.some((rig) => rig.ready) || selectedPlot?.status !== "connected") return;
    const fleetTimer = window.setInterval(() => {
      const truckLimit = truckCapacity(upgrades);
      const selectedDestinationX = sellOil ? (sellTarget === "right" ? 92 : 8) : siloX;
      const stocks = { ...rigStocksRef.current };
      let stored = storageRef.current;
      let revenue = 0;
      let soldAmount = 0;
      const undergroundReserves = depositReservesRef.current;
      const assignedWagons = new Map(rigs.filter((rig) => rig.ready).map((rig) => [rig.id, 0]));
      wagonFleetRef.current.forEach((wagon) => {
        if (wagon.phase === "parked" || wagon.sourceKind !== "rig" || wagon.sourceRigId === null) return;
        assignedWagons.set(wagon.sourceRigId, (assignedWagons.get(wagon.sourceRigId) ?? 0) + 1);
      });
      const rigHasUndergroundOil = (rigId: number) => {
        const connectedDeposits = rigOilDepositThroughputs.get(rigId);
        return Boolean(connectedDeposits && [...connectedDeposits.keys()].some((depositId) => (undergroundReserves[depositId] ?? 0) > .001));
      };
      const rigHasOil = (rig: RigState) => (stocks[rig.id] ?? 0) > .04 || rigHasUndergroundOil(rig.id);
      const chooseRigSource = (fromX: number): WagonSource | null => {
        const candidates = rigs.filter((rig) => rig.ready && rigHasOil(rig)).sort((a, b) => {
          const assignmentDifference = (assignedWagons.get(a.id) ?? 0) - (assignedWagons.get(b.id) ?? 0);
          if (assignmentDifference !== 0) return assignmentDifference;
          const stockDifference = (stocks[b.id] ?? 0) - (stocks[a.id] ?? 0);
          if (Math.abs(stockDifference) > .2) return stockDifference;
          return Math.abs(a.x - fromX) - Math.abs(b.x - fromX);
        });
        return candidates[0] ? { kind: "rig", rig: candidates[0] } : null;
      };
      const siloStock = (index: number) => {
        const previousCapacity = siloLevels.slice(0, index).reduce((total, level) => total + siloCapacityForLevel(level), 0);
        return clamp(stored - previousCapacity, 0, siloCapacityForLevel(siloLevels[index] ?? 0));
      };
      const chooseSiloSource = (fromX: number): WagonSource | null => siloXs
        .map((x, index) => ({ kind: "silo" as const, index, x, stock: siloStock(index) }))
        .filter((silo) => silo.stock > .04)
        .sort((a, b) => b.stock - a.stock || Math.abs(a.x - fromX) - Math.abs(b.x - fromX))[0] ?? null;
      const releaseSource = (wagon: WagonState) => {
        if (wagon.sourceKind !== "rig" || wagon.sourceRigId === null) return;
        assignedWagons.set(wagon.sourceRigId, Math.max(0, (assignedWagons.get(wagon.sourceRigId) ?? 1) - 1));
      };
      const assignSource = (wagon: WagonState, source: WagonSource, legStartX: number) => {
        wagon.sourceKind = source.kind;
        wagon.sourceRigId = source.kind === "rig" ? source.rig.id : null;
        wagon.sourceSiloIndex = source.kind === "silo" ? source.index : null;
        wagon.sourceX = source.kind === "rig" ? source.rig.x : source.x;
        wagon.legStartX = legStartX;
        if (source.kind === "rig") assignedWagons.set(source.rig.id, (assignedWagons.get(source.rig.id) ?? 0) + 1);
      };
      const nextFleet = wagonFleetRef.current.map((wagon) => {
        const next = { ...wagon };
        // 按地图上的实际横向距离推进，避免“每段路线固定用时”造成长路飞快、建筑附近短路变慢。
        const baseTravelDistance = .95 + upgrades.wagon * .14;
        const cargoRatio = clamp(next.cargo / Math.max(.01, truckLimit), 0, 1);
        const emptyTravelDistance = baseTravelDistance;
        const loadedTravelDistance = baseTravelDistance * (1 - cargoRatio * .5);
        const advance = (fromX: number, toX: number, distance: number) => Math.min(1, next.progress + distance / Math.max(.01, Math.abs(toX - fromX)));
        if (next.phase === "parked") {
          const source = sellOil && stored > .04 ? chooseSiloSource(next.homeX) : chooseRigSource(next.homeX);
          if (!source) return next;
          assignSource(next, source, next.homeX);
          next.phase = "toRig";
          next.progress = 0;
        }
        if (next.phase === "toRig") {
          next.progress = advance(next.legStartX, next.sourceX, emptyTravelDistance);
          if (next.progress >= 1) next.phase = "loading";
        } else if (next.phase === "loading") {
          const loadRoom = Math.min(.34, truckLimit - next.cargo);
          const sourceStock = next.sourceKind === "silo" && next.sourceSiloIndex !== null
            ? siloStock(next.sourceSiloIndex)
            : next.sourceRigId === null ? 0 : stocks[next.sourceRigId] ?? 0;
          const fromWell = Math.min(loadRoom, sourceStock);
          next.cargo += fromWell;
          if (next.sourceKind === "silo") stored = Math.max(0, stored - fromWell);
          else if (next.sourceRigId !== null) stocks[next.sourceRigId] = Math.max(0, sourceStock - fromWell);
          const remainingSourceStock = next.sourceKind === "silo" && next.sourceSiloIndex !== null
            ? siloStock(next.sourceSiloIndex)
            : next.sourceRigId === null ? 0 : stocks[next.sourceRigId] ?? 0;
          const sourceWillRefill = next.sourceKind === "rig" && next.sourceRigId !== null && rigHasUndergroundOil(next.sourceRigId);
          const sourceDepleted = remainingSourceStock < .05;
          if (next.cargo < .5 && fromWell <= .01) {
            const previousX = next.sourceX;
            const previousSourceKind = next.sourceKind;
            const previousRigId = next.sourceRigId;
            releaseSource(next);
            const alternate = sellOil && stored > .04 ? chooseSiloSource(previousX) : chooseRigSource(previousX);
            if (alternate && !(alternate.kind === previousSourceKind && alternate.kind === "rig" && alternate.rig.id === previousRigId)) {
              assignSource(next, alternate, previousX);
              next.phase = "toRig";
              next.progress = 0;
              return next;
            }
            if (next.cargo <= .01 && !sourceWillRefill) {
              next.sourceKind = null;
              next.sourceRigId = null;
              next.sourceSiloIndex = null;
              next.destinationX = previousX;
              next.legStartX = previousX;
              next.sourceX = next.homeX;
              next.phase = "returning";
              next.progress = 0;
              return next;
            }
            if (previousSourceKind === "rig" && previousRigId !== null) assignedWagons.set(previousRigId, (assignedWagons.get(previousRigId) ?? 0) + 1);
          }
          if (next.cargo >= truckLimit - .01 || (next.cargo > .01 && sourceDepleted && !sourceWillRefill)) {
            if (sellOil || siloBuilt) {
              next.legStartX = next.sourceX;
              next.destinationX = selectedDestinationX;
              next.destinationKind = sellOil ? "market" : "silo";
              next.salePrice = effectivePrice;
              next.phase = "toDestination";
              next.progress = 0;
            }
          }
        } else if (next.phase === "toDestination") {
          if (sellOil && next.destinationKind === "silo") {
            const currentX = next.legStartX + (next.destinationX - next.legStartX) * next.progress;
            next.legStartX = currentX;
            next.destinationX = sellTarget === "right" ? 92 : 8;
            next.destinationKind = "market";
            next.salePrice = effectivePrice;
            next.progress = 0;
          }
          next.progress = advance(next.legStartX, next.destinationX, loadedTravelDistance);
          if (next.progress >= 1) next.phase = "unloading";
        } else if (next.phase === "unloading") {
          if (sellOil && next.destinationKind === "silo") {
            next.legStartX = next.destinationX;
            next.destinationX = sellTarget === "right" ? 92 : 8;
            next.destinationKind = "market";
            next.salePrice = effectivePrice;
            next.progress = 0;
            next.phase = "toDestination";
            return next;
          }
          let unloaded = Math.min(.42, next.cargo);
          if (next.destinationKind === "silo") unloaded = Math.min(unloaded, Math.max(0, capacity - stored));
          if (unloaded > 0) {
            next.cargo -= unloaded;
            if (next.destinationKind === "market") {
              soldAmount += unloaded;
              revenue += unloaded * next.salePrice;
            } else stored += unloaded;
          }
          if (next.cargo <= .01) {
            next.cargo = 0;
            releaseSource(next);
            const source = sellOil && stored > .04 ? chooseSiloSource(next.destinationX) : chooseRigSource(next.destinationX);
            if (source) {
              assignSource(next, source, next.destinationX);
            } else {
              next.sourceKind = null;
              next.sourceRigId = null;
              next.sourceSiloIndex = null;
              next.sourceX = next.homeX;
            }
            next.phase = "returning";
            next.progress = 0;
          }
        } else if (next.phase === "returning") {
          next.progress = advance(next.destinationX, next.sourceX, emptyTravelDistance);
          if (next.progress >= 1) {
            next.phase = next.sourceKind ? "loading" : "parked";
            next.progress = next.sourceKind ? 1 : 0;
          }
        }
        return next;
      });
      rigStocksRef.current = stocks;
      storageRef.current = stored;
      wagonFleetRef.current = nextFleet;
      setRigStocks(stocks);
      setStorage(stored);
      setWagonFleet(nextFleet);
      if (revenue > 0) {
        changeCash(revenue);
        soldRef.current += soldAmount;
        setSold(soldRef.current);
      }
    }, 120);
    return () => window.clearInterval(fleetTimer);
  }, [capacity, changeCash, effectivePrice, leasedPlotId, rigOilDepositThroughputs, rigOilPipeCounts, rigs, selectedPlot?.status, sellOil, sellTarget, siloBuilt, siloLevels, siloXs, siloX, status, upgrades]);

  const togglePause = () => {
    if (status === "running") setStatus("paused");
    else if (status === "paused") setStatus("running");
  };

  const chooseMarket = (company: Company) => {
    const destinationX = company === "right" ? 92 : 8;
    const salePrice = markets[company] + (gasNetwork.targets.has(company) ? gasBonus : 0);
    const reroutedFleet = wagonFleetRef.current.map((wagon) => {
      if (wagon.cargo <= .01) return wagon;
      const currentX = wagon.phase === "parked" ? wagon.homeX
        : wagon.phase === "toRig" ? wagon.legStartX + (wagon.sourceX - wagon.legStartX) * wagon.progress
          : wagon.phase === "loading" ? wagon.sourceX
            : wagon.phase === "toDestination" || wagon.phase === "unloading"
              ? wagon.legStartX + (wagon.destinationX - wagon.legStartX) * wagon.progress
              : wagon.destinationX + (wagon.sourceX - wagon.destinationX) * wagon.progress;
      return {
        ...wagon,
        legStartX: currentX,
        destinationX,
        destinationKind: "market" as const,
        salePrice,
        phase: "toDestination" as const,
        progress: 0,
      };
    });
    wagonFleetRef.current = reroutedFleet;
    setWagonFleet(reroutedFleet);
    setSellTarget(company);
    setSellOil(true);
    flash(`运油货车立即改向${company === "left" ? "左岸" : "右岸"}公司出售`);
    gameAudio.play("tap");
  };

  const startNextCampaignRound = () => {
    const preservedCash = cashRef.current;
    const preservedRivals = rivals;
    const preservedCharacterId = selectedCharacterId;
    const nextPlots = createPlots();
    startRound();
    cashRef.current = preservedCash;
    setCash(preservedCash);
    setRivals(preservedRivals);
    setSelectedCharacterId(preservedCharacterId);
    setCampaignRound(campaignRound + 1);
    beginAuction(nextPlots, preservedRivals);
  };

  const livePipeQuote = pipePreview && activePipeNode && selectedPlot ? (() => {
    const marketTarget = marketAtPipePoint(pipePreview);
    const firstDepositHit = marketTarget ? null : selectedPlot.deposits
      .map((deposit) => ({ deposit, entry: pipeDepositEntry(activePipeNode, pipePreview, deposit) }))
      .filter((hit): hit is { deposit: OilPlot["deposits"][number]; entry: PipePoint } => hit.entry !== null)
      .sort((left, right) => Math.hypot(left.entry.x - activePipeNode.x, left.entry.y - activePipeNode.y) - Math.hypot(right.entry.x - activePipeNode.x, right.entry.y - activePipeNode.y))[0] ?? null;
    const destination = firstDepositHit?.entry ?? pipePreview;
    const length = Math.hypot(destination.x - activePipeNode.x, destination.y - activePipeNode.y);
    const blocked = selectedPlot.rocks.some((rock) => pipeCrossesRock(activePipeNode, destination, rock));
    return { cost: Math.max(8, Math.round(length * (1.25 - upgrades.pipe * .12 - upgrades.branch * .05))), blocked };
  })() : null;

  return <div className={`${styles.game} ${seasonClass}`}>
    <div className={styles.sky} /><div className={styles.ridge} /><div className={styles.seasonDecor} aria-hidden="true" />
    <header className={styles.toolDock}>
      <button className={styles.roundButton} onClick={togglePause} aria-label="暂停或继续">Ⅱ</button>
      <div className={styles.dateCard}><small>YEAR {1898 + campaignRound} · {seasonLabel}</small><strong>{monthNames[seasonMonth - 1]} {seasonDay}</strong></div>
      <div className={styles.toolGroup}>
        <button className={`${styles.toolButton} ${placingTool === "dowser" || dowserProbes.length > 0 ? styles.toolActive : ""}`} onPointerDown={(event) => handleToolPointerDown(event, "dowser")} onPointerUp={handleToolPointerUp} onClick={() => handleToolClick("dowser")} disabled={!costs}><b><OilToolIcon type="dowser" /></b><span>探矿员 {dowserProbes.length}</span><small>${costs?.dowser ?? 100}</small></button>
        <button className={`${styles.toolButton} ${placingTool === "mole" || moleProbes.length > 0 ? styles.toolActive : ""}`} onPointerDown={(event) => handleToolPointerDown(event, "mole")} onPointerUp={handleToolPointerUp} onClick={() => handleToolClick("mole")} disabled={!costs}><b><OilToolIcon type="mole" /></b><span>鼹鼠 {moleProbes.length}</span><small>${costs?.mole ?? 100}</small></button>
        <button className={`${styles.toolButton} ${placingTool === "scanner" || discoveryTool === "scanner" ? styles.toolActive : ""}`} onPointerDown={(event) => handleToolPointerDown(event, "scanner")} onPointerUp={handleToolPointerUp} onClick={() => handleToolClick("scanner")} disabled={!costs || scannerScan !== null}><b><OilToolIcon type="scanner" /></b><span>扫描</span><small>$100/秒</small></button>
      </div>
      <div className={styles.cashBox}><small>现金</small><strong>${Math.floor(cash)}</strong></div>
      <div className={styles.toolGroup}>
        <button className={`${styles.toolButton} ${placingTool === "rig" ? styles.toolActive : ""}`} onPointerDown={(event) => handleToolPointerDown(event, "rig")} onPointerUp={handleToolPointerUp} onClick={() => handleToolClick("rig")} disabled={!costs || !selectedPlot || !["surveyed", "drilled", "connected"].includes(selectedPlot.status) || drillInProgress}><b><OilToolIcon type="rig" /></b><span>{drillInProgress ? "下钻中" : `井架 ${rigs.length}`}</span><small>${costs?.drill ?? 350}</small></button>
        <button className={`${styles.toolButton} ${siloBuilt ? styles.toolDone : ""} ${placingTool === "silo" ? styles.toolActive : ""}`} onPointerDown={(event) => handleToolPointerDown(event, "silo")} onPointerUp={handleToolPointerUp} onClick={() => handleToolClick("silo")}><b><OilToolIcon type="silo" /></b><span>油罐 {siloXs.length}</span><small>{siloBuilt ? `${Math.floor(storage)}/${capacity}` : "$250"}</small></button>
        <button className={`${styles.toolButton} ${placingTool === "wagon" ? styles.toolActive : ""}`} onPointerDown={(event) => handleToolPointerDown(event, "wagon")} onPointerUp={handleToolPointerUp} onClick={() => handleToolClick("wagon")}><b><OilToolIcon type="wagon" /></b><span>运油货车 {wagons}</span><small>$150</small></button>
      </div>
      <button className={styles.speedButton} aria-label="剩余时间">{time}s</button>
    </header>

    <section ref={fieldRef} className={`${styles.field} ${status === "ranking" ? styles.fieldExcavated : ""} ${pipeTool ? styles.fieldPiping : ""} ${placingTool ? styles.fieldPlacing : ""} ${placingTool === "scanner" || scannerScan ? styles.fieldScanning : ""}`} aria-label="油田地图" onClick={handleFieldClick} onPointerMove={handleFieldPointerMove}>
      <div className={styles.farMountains} />
      <div className={styles.fieldHills} />
      <div className={styles.fieldGrid} />
      <button className={`${styles.marketTower} ${styles.marketLeft} ${sellTarget === "left" && sellOil ? styles.marketSelected : ""}`} onClick={(event) => { event.stopPropagation(); chooseMarket("left"); }}><i style={{ height: `${clamp((markets.left - 38) / 88 * 100, 8, 100)}%` }} /><span>LEFT<br />INC</span><b>${((markets.left + (gasNetwork.targets.has("left") ? gasBonus : 0)) / 100).toFixed(2)}</b><small>{gasNetwork.targets.has("left") ? `GAS ×${gasPressure.toFixed(1)}` : marketTrends.left === "up" ? "▲" : "▼"}</small></button>
      <button className={`${styles.marketTower} ${styles.marketRight} ${sellTarget === "right" && sellOil ? styles.marketSelected : ""}`} onClick={(event) => { event.stopPropagation(); chooseMarket("right"); }}><i style={{ height: `${clamp((markets.right - 38) / 88 * 100, 8, 100)}%` }} /><span>RIGHT<br />INC</span><b>${((markets.right + (gasNetwork.targets.has("right") ? gasBonus : 0)) / 100).toFixed(2)}</b><small>{gasNetwork.targets.has("right") ? `GAS ×${gasPressure.toFixed(1)}` : marketTrends.right === "up" ? "▲" : "▼"}</small></button>
      {(Object.entries(MARKET_PIPE_POINTS) as Array<[Company, PipePoint]>).map(([company, point]) => <button key={`market-pipe-${company}`} type="button" aria-label={`${company === "left" ? "左岸" : "右岸"}商店天然气管道接口`} className={`${styles.marketPipeConnector} ${gasNetwork.targets.has(company) ? styles.marketPipeConnected : ""}`} style={{ left: `${point.x}%`, top: `${point.y}%` }} onPointerDown={(event) => handlePipeDragStart(event, point)} onPointerMove={handlePipeDragMove} onPointerUp={handlePipeDragEnd} onClick={(event) => { event.stopPropagation(); if (suppressPipeClickRef.current) return; flash("按住这个 GAS 接口向地下拖动，或从天然气管网节点拖到接口，即可给商店冲高油价"); gameAudio.play("tap"); }}>{gasNetwork.targets.has(company) ? "GAS" : "+"}</button>)}
      {leasedPlot && <>
        <div className={styles.surfaceLabel}>{leasedPlot.name} · {leasedPlot.geology}地层{discoveryTool ? ` · ${discoveryTool === "dowser" ? "探矿员定位" : discoveryTool === "mole" ? "鼹鼠探测" : "扫描仪成像"}` : ""}</div>
        {(leasedPlot.status !== "hidden" || status === "ranking") && <>
          {leasedPlot.deposits.filter((deposit) => status === "ranking" || revealedDepositIds.includes(deposit.id)).map((deposit) => deposit.kind === "gas" ? <button
            type="button"
            key={deposit.id}
            aria-label={gasConnected ? "天然气阀门" : "探测到的天然气层"}
            className={`${styles.depositShell} ${styles[`depositShape${deposit.shape}`]} ${styles.gasDeposit} ${gasConnected ? styles.resourceConnected : ""} ${gasBoost ? styles.gasBoosted : ""}`}
            style={{ left: `${deposit.x}%`, top: `${deposit.y}%`, width: `${deposit.radius * 2 * gasPressure}%`, height: `${deposit.radius * 1.55 * gasPressure}%`, ...depositRevealStyle(deposit) }}
            onClick={(event) => { event.stopPropagation(); flash(gasConnected ? "天然气已接入管网；继续从节点拉管到左右商店下方的 GAS 接口" : "先把管道钻入天然气层，再从节点接到商店下方接口"); gameAudio.play("tap"); }}
          ><i /><span className={styles.gasRoute}>{gasNetwork.targets.size > 0 ? `${[...gasNetwork.targets].map((target) => target === "left" ? "LEFT" : "RIGHT").join("+")} ×${gasPressure.toFixed(1)}` : `压力 ${gasPressure.toFixed(1)}`}</span></button> : <div
            key={deposit.id}
            className={`${styles.depositShell} ${styles[`depositShape${deposit.shape}`]} ${deposit.kind === "oil" ? styles.oilDeposit : styles.magmaDeposit} ${deposit.kind === "magma" && magmaConnected ? styles.resourceConnected : ""}`}
            style={{ left: `${deposit.x}%`, top: `${deposit.y}%`, width: `${deposit.radius * 2}%`, height: `${deposit.radius * 1.55}%`, ...depositRevealStyle(deposit) }}
          ><i style={deposit.kind === "oil" ? { "--oil-level": `${oilLevelForDeposit(deposit.id)}%` } as CSSProperties : undefined} /></div>)}
          {leasedPlot.rocks.map((rock, index) => <i key={index} className={styles.rockMass} style={{ left: `${rock.x}%`, top: `${rock.y}%`, width: `${rock.radius * 2.6}%`, height: `${rock.radius * 1.4}%` }} />)}
        </>}
        {flaggedDepositIds.map((depositId) => {
          const deposit = leasedPlot.deposits.find((item) => item.id === depositId);
          return deposit ? <div key={depositId} className={styles.surveyFlag} style={{ left: `${deposit.x}%` }}><i /><b /></div> : null;
        })}
        {dowserProbes.map((probe) => <div key={probe.id} className={`${styles.dowserWorker} ${probe.phase === "walking" ? styles.dowserWalking : probe.phase === "probing" ? styles.dowserProbing : styles.dowserFound}`} style={{ left: `${probe.x}%` }}><b /><i style={{ height: `${Math.max(5, (probe.targetY - 34) / 76 * 100)}%` }} /><span /></div>)}
        {moleProbes.map((probe) => <Fragment key={probe.id}><div className={styles.moleTrail} style={{ left: `${probe.x}%`, height: `${Math.max(1, probe.y - 34)}%` }} /><div className={`${styles.moleScout} ${probe.done ? styles.moleStopped : ""}`} style={{ left: `${probe.x}%`, top: `${probe.y}%` }}><i /></div></Fragment>)}
        {leasedPlot.status === "hidden" && <div className={styles.dowserHint}><span>♧</span>从顶部选择探矿工具</div>}
        {(leasedPlot.status === "drilled" || leasedPlot.status === "connected") && rigs.map((rig) => { const root = { x: rig.x, y: 34.8 }; const closed = closedPipeNodes.has(pipeNodeKey(root)); return <div key={rig.id} className={styles.rig} style={{ left: `${rig.x}%` }}><i /><i /><i /><b /><span className={styles.rigWheel}>✣</span>{rig.ready && <button className={`${styles.rigConnector} ${pipeTool ? styles.rigConnectorActive : ""} ${closed ? styles.pipeNodeClosed : ""}`} onPointerDown={(event) => handlePipeDragStart(event, root)} onPointerMove={handlePipeDragMove} onPointerUp={handlePipeDragEnd} onClick={(event) => { event.stopPropagation(); togglePipeNode(root); }} aria-label="拖动井架接口铺设输油管或点击开关阀门">{closed ? "×" : "+"}</button>}</div>; })}
        {drillInProgress && rigX !== null && <div className={styles.drillShaft} style={{ left: `${rigX}%`, height: `${drillDepth * 43}%` }}><i /></div>}
      </>}
      {(pipeSegments.length > 0 || pipePreview) && <svg className={styles.pipeSvg} viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="手动铺设的输油管">{pipeSegments.map((segment) => {
        const end = { x: segment.from.x + (segment.to.x - segment.from.x) * segment.progress, y: segment.from.y + (segment.to.y - segment.from.y) * segment.progress };
        const drillAngle = Math.atan2(segment.to.y - segment.from.y, segment.to.x - segment.from.x) * 180 / Math.PI - 90;
        const closed = closedPipeNodes.has(pipeNodeKey(segment.from)) || closedPipeNodes.has(pipeNodeKey(segment.to));
        const resourceKind = !closed && segment.progress >= 1
          ? selectedPlot && selectedPlot.reserve > 0 && oilFlowSegmentIds.has(segment.id) ? "oil"
            : gasBoost && gasFlowSegmentIds.has(segment.id) ? "gas"
              : magmaConnected && magmaFlowSegmentIds.has(segment.id) ? "magma"
                : null
          : null;
        const resourceClass = resourceKind === "oil" ? styles.oilPipeFlow : resourceKind === "gas" ? styles.gasPipeFlow : styles.magmaPipeFlow;
        const pulseClass = resourceKind === "oil" ? styles.oilPipePulse : resourceKind === "gas" ? styles.gasPipePulse : styles.magmaPipePulse;
        return <g key={segment.id}>
          <polyline className={`${segment.progress < 1 ? styles.pipeBoring : closed ? styles.pipeClosed : styles.pipeEmpty} ${segment.upgraded ? styles.pipeUpgraded : ""}`} points={`${segment.from.x},${segment.from.y} ${end.x},${end.y}`} />
          {resourceKind && <><polyline className={`${styles.pipeResourceFlow} ${resourceClass}`} points={`${segment.from.x},${segment.from.y} ${end.x},${end.y}`} />{(resourceKind !== "oil" || pumpingOilSegmentIds.has(segment.id)) && <polyline className={`${styles.pipeFlowPulse} ${pulseClass}`} points={`${segment.from.x},${segment.from.y} ${end.x},${end.y}`} />}</>}
          <polyline className={styles.pipeHitArea} points={`${segment.from.x},${segment.from.y} ${end.x},${end.y}`} onClick={(event) => { event.stopPropagation(); selectPipeSegment(segment.id); }} aria-label={`输油管第 ${segment.id} 段${segment.upgraded ? "（已加粗）" : ""}`} />
          {segment.progress < 1 && <g transform={`translate(${end.x} ${end.y}) rotate(${drillAngle})`}><g className={styles.pipeDrillBit}><ellipse cx="0" cy="-1" rx="1.15" ry=".42" /><polygon points="-1.15,-1 1.15,-1 .72,.35 0,1.8 -.72,.35" /><path d="M-.88,-.48 C-.28,-.12 .34,-.08 .78,.28 M-.58,.28 C-.18,.55 .18,.68 .4,.88" /></g></g>}
        </g>;
      })}{pipePreview && activePipeNode && <polyline className={styles.pipePreview} points={`${activePipeNode.x},${activePipeNode.y} ${pipePreview.x},${pipePreview.y}`} />}{branchNodes.map((node, index) => <circle key={index} cx={node.x} cy={node.y} r="0.85" />)}</svg>}
      {pipePreview && livePipeQuote && <div className={`${styles.pipeLiveCost} ${livePipeQuote.blocked || cash < livePipeQuote.cost ? styles.pipeLiveCostWarning : ""}`} style={{ left: `${pipePreview.x}%`, top: `${pipePreview.y}%` }}>{livePipeQuote.blocked ? "岩石阻挡" : `$${livePipeQuote.cost}`}</div>}
      {selectedPipeSegment && (() => {
        const end = { x: selectedPipeSegment.from.x + (selectedPipeSegment.to.x - selectedPipeSegment.from.x) * selectedPipeSegment.progress, y: selectedPipeSegment.from.y + (selectedPipeSegment.to.y - selectedPipeSegment.from.y) * selectedPipeSegment.progress };
        const panelX = (selectedPipeSegment.from.x + end.x) / 2;
        const panelY = clamp((selectedPipeSegment.from.y + end.y) / 2 - 8, 42, 88);
        return <div className={styles.pipeUpgradePanel} style={{ left: `${panelX}%`, top: `${panelY}%` }} onClick={(event) => event.stopPropagation()}>
          <button type="button" className={styles.pipeUpgradeClose} aria-label="关闭管道升级弹窗" onClick={() => setSelectedPipeSegmentId(null)}>×</button>
          <strong>管道第 {selectedPipeSegment.id} 段</strong>
          <small>{selectedPipeSegment.upgraded ? "已加粗 · 输送速度 ×2" : "默认管径 · 点击升级加粗"}</small>
          <button type="button" onClick={upgradePipeSegment} disabled={selectedPipeSegment.upgraded}>{selectedPipeSegment.upgraded ? "已升级" : "加粗管道 · $120"}</button>
        </div>;
      })()}
      {branchNodes.filter((node) => !rigs.some((rig) => Math.hypot(node.x - rig.x, node.y - 34.8) <= 1)).map((node, index) => { const closed = closedPipeNodes.has(pipeNodeKey(node)); return <button key={`${node.x}-${node.y}-${index}`} className={`${styles.pipeEndpoint} ${closed ? styles.pipeNodeClosed : ""}`} style={{ left: `${node.x}%`, top: `${node.y}%` }} onPointerDown={(event) => handlePipeDragStart(event, node)} onPointerMove={handlePipeDragMove} onPointerUp={handlePipeDragEnd} onClick={(event) => { event.stopPropagation(); togglePipeNode(node); }} aria-label="从管道节点拖出新支管或点击开关阀门">{closed ? "×" : "+"}</button>; })}
      {selectedPlot?.status === "connected" && rigs.filter((rig) => rig.ready).map((rig) => {
        const connectedPipes = rigOilPipeCounts.get(rig.id) ?? 0;
        const stock = rigStocks[rig.id] ?? 0;
        const wellCapacity = 12 + upgrades.pipe * 4 + upgrades.branch * 3 + Math.max(0, connectedPipes - 1) * 6;
        return <div key={`buffer-${rig.id}`} className={styles.wellBuffer} style={{ left: `${rig.x}%` }}><i style={{ height: `${Math.min(100, stock / wellCapacity * 100)}%` }} /><span>{Math.floor(stock)} · {connectedPipes}管</span></div>;
      })}
      {siloXs.map((x, index) => {
        const level = siloLevels[index] ?? 0;
        const tankCapacity = siloCapacityForLevel(level);
        const previousCapacity = siloLevels.slice(0, index).reduce((total, currentLevel) => total + siloCapacityForLevel(currentLevel), 0);
        const tankStorage = clamp(storage - previousCapacity, 0, tankCapacity);
        const upgradeCost = 180 + level * 120;
        return <Fragment key={`${x}-${index}`}>
          <button type="button" aria-label={`把运油货车目的地设为储油罐 ${index + 1}`} className={`${styles.tank} ${!sellOil && siloX === x ? styles.tankSelected : ""}`} style={{ left: `${x}%`, height: `${58 + level * 12}px` }} onClick={(event) => { event.stopPropagation(); setSiloX(x); setSellOil(false); setSelectedSiloIndex(index); flash(`运油货车目的地：储油罐 ${index + 1} · 点击升级按钮可加高油罐`); }}><i style={{ height: `${Math.min(100, tankStorage / tankCapacity * 100)}%` }} /><b /><span>{Math.floor(tankStorage)}/{tankCapacity}</span></button>
          {selectedSiloIndex === index && <div className={styles.siloUpgradePanel} style={{ left: `${x}%` }} onClick={(event) => event.stopPropagation()}><button type="button" className={styles.siloUpgradeClose} aria-label="关闭储油罐升级弹窗" onClick={() => setSelectedSiloIndex(null)}>×</button><strong>储油罐 Lv.{level}</strong><small>容量 {tankCapacity}</small><button type="button" onClick={() => upgradeSilo(index)} disabled={level >= 3}>{level >= 3 ? "已满级" : `加高 +14 · $${upgradeCost}`}</button></div>}
        </Fragment>;
      })}
      {wagonFleet.map((wagon) => {
        const destinationX = wagon.destinationX;
        const x = wagon.phase === "parked" ? wagon.homeX
          : wagon.phase === "toRig" ? wagon.legStartX + (wagon.sourceX - wagon.legStartX) * wagon.progress
          : wagon.phase === "loading" ? wagon.sourceX
          : wagon.phase === "toDestination" || wagon.phase === "unloading" ? wagon.legStartX + (destinationX - wagon.legStartX) * wagon.progress
          : destinationX + (wagon.sourceX - destinationX) * wagon.progress;
        const facingRight = wagon.phase === "toRig" ? wagon.sourceX > wagon.legStartX
          : wagon.phase === "toDestination" || wagon.phase === "unloading" ? destinationX > wagon.legStartX
          : wagon.phase === "returning" ? wagon.sourceX > destinationX
          : destinationX > wagon.sourceX;
        const moving = wagon.phase === "toRig" || wagon.phase === "toDestination" || wagon.phase === "returning";
        return <div key={wagon.id} className={`${styles.parkedWagon} ${wagon.phase !== "parked" ? styles.activeWagon : ""} ${moving ? styles.wagonMoving : ""} ${facingRight ? styles.wagonFacingRight : ""}`} style={{ left: `${x}%` }}><span className={styles.wagonUnit} style={{ "--cargo-level": `${Math.min(100, wagon.cargo / truckCapacity(upgrades) * 100)}%` } as CSSProperties}><i /><b /><em /></span></div>;
      })}
      {toolDragPreview && <div className={styles.toolDragGhost} style={{ left: toolDragPreview.x, top: toolDragPreview.y }}><OilToolIcon type={toolDragPreview.tool} /></div>}
      {pipeTool && <div className={styles.pipeHint}>拖动任意节点“+”规划支管 · 多条管道可并行钻探 · 单击节点开关阀门</div>}
      {placingTool === "scanner" && !scannerScan && <div className={styles.scannerHint}>扫描仪已跟随鼠标 · 到地下点击开始扩圈 · 点击圆圈停止并结算</div>}
      {scannerScan && <button className={styles.scannerCircle} style={{ left: `${scannerScan.x}%`, top: `${scannerScan.y}%`, width: `${scannerScan.radius * 2}%` }} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); finishScanner(); }} aria-label="停止扫描并揭示范围"><span>$100/秒 · 当前 ${Math.max(100, Math.ceil(Math.max(1, scannerScan.elapsedMs) / 1000) * 100)} · 点击停止</span></button>}
      {scannerBurst && <div key={scannerBurst.key} className={styles.scannerBurst} style={{ left: `${scannerBurst.x}%`, top: `${scannerBurst.y}%`, width: `${scannerBurst.radius * 2}%` }} />}
    </section>

    {notice && <div className={styles.notice}>{notice}</div>}
    <CampaignOverlay status={status} round={campaignRound} cash={cash} sold={sold} characters={OIL_CHARACTERS} selectedCharacterId={selectedCharacterId} rivals={rivals} plots={plots} selectedPlotId={selectedPlotId} auctionBids={auctionBids} auctionSeconds={auctionSeconds} ranking={capitalRanking} onStart={startRound} onChooseCharacter={chooseCharacter} onSelectPlot={selectPlot} onBid={placeAuctionBid} onLease={leasePlot} onResume={() => setStatus("running")} onNextRound={startNextCampaignRound} />
  </div>;
}
