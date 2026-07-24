"use client";

import { useEffect, useMemo, useState } from "react";
import { games, type GameId, type GameInfo } from "@/config/games";
import { guestSDK } from "@/lib/game-sdk/guest";
import type { GuestProfile, ScoreEntry, UserRankingEntry } from "@/lib/game-sdk/types";
import { GameModal } from "@/features/games/GameModal";
import { UsernameGate } from "@/features/auth/UsernameGate";
import { Sidebar } from "./components/Sidebar";
import { Topbar } from "./components/Topbar";
import { Hero } from "./components/Hero";
import { GameCatalog, type Category } from "./components/GameCatalog";
import { PlayerPanels } from "./components/PlayerPanels";
import { AssetSection } from "./components/AssetSection";
import { SiteFooter } from "./components/SiteFooter";
import { RankingPanel } from "./components/RankingPanel";

export function GameHub() {
  const [profile, setProfile] = useState<GuestProfile | null>(null);
  const [scores, setScores] = useState<ScoreEntry[]>([]);
  const [ranking, setRanking] = useState<UserRankingEntry[]>([]);
  const [activeGame, setActiveGame] = useState<GameInfo | null>(null);
  const [recentIds, setRecentIds] = useState<GameId[]>([]);
  const [category, setCategory] = useState<Category>("全部");
  const [query, setQuery] = useState("");
  const [mobileNav, setMobileNav] = useState(false);

  useEffect(() => {
    // Guest data lives in localStorage and can only be loaded after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setProfile(guestSDK.auth.getProfile());
    setScores(guestSDK.leaderboard.getAll());
    setRanking(guestSDK.leaderboard.getUserRanking());
    setRecentIds(guestSDK.storage.get<GameId[]>("recent", []));
  }, []);

  const filteredGames = useMemo(() => games.filter((game) => {
    const categoryMatch = category === "全部" || game.category === category;
    const text = `${game.title}${game.description}${game.category}`.toLowerCase();
    return categoryMatch && text.includes(query.trim().toLowerCase());
  }), [category, query]);

  const openGame = (game: GameInfo) => {
    const nextRecent = [game.id, ...recentIds.filter((id) => id !== game.id)].slice(0, 3);
    setRecentIds(nextRecent);
    guestSDK.storage.set("recent", nextRecent);
    guestSDK.analytics.track("game_open", { gameId: game.id });
    setActiveGame(game);
  };

  const submitScore = (score: number) => {
    if (!activeGame) return;
    guestSDK.leaderboard.submit(activeGame.id, score);
    setScores(guestSDK.leaderboard.getAll());
    setRanking(guestSDK.leaderboard.getUserRanking());
  };

  const getBest = (id: GameId) => scores.find((score) => score.gameId === id)?.score ?? 0;
  const totalScore = scores.reduce((sum, entry) => sum + entry.score, 0);
  const recentGames = recentIds.map((id) => games.find((game) => game.id === id)).filter(Boolean) as GameInfo[];
  const renameGuest = () => {
    if (!profile) return;
    const name = window.prompt("给游客角色起个名字", profile.displayName);
    if (name !== null && name.trim().length >= 2) {
      setProfile(guestSDK.auth.setDisplayName(name));
      setRanking(guestSDK.leaderboard.getUserRanking());
    }
  };

  if (!profile) return <main className="username-loading"><span className="brand-mark"><i /><i /><i /></span></main>;

  const needsUsername = !profile.displayName.trim() || profile.displayName === "漫游玩家";
  if (needsUsername) {
    return <UsernameGate initialName={profile.displayName} onSubmit={(name) => {
      const nextProfile = guestSDK.auth.setDisplayName(name);
      setProfile(nextProfile);
      setScores(guestSDK.leaderboard.getAll());
      setRanking(guestSDK.leaderboard.getUserRanking());
    }} />;
  }

  return (
    <main className="app-shell">
      <Sidebar open={mobileNav} profile={profile} totalScore={totalScore} onClose={() => setMobileNav(false)} onRename={renameGuest} />
      <section className="content" id="top">
        <Topbar query={query} onQuery={setQuery} onMenu={() => setMobileNav((open) => !open)} />
        <div className="page-content">
          <Hero featured={games[0]} onPlay={openGame} />
          <GameCatalog games={filteredGames} category={category} onCategory={setCategory} onPlay={openGame} getBest={getBest} />
          <PlayerPanels recentGames={recentGames} scoreCount={scores.length} totalScore={totalScore} getBest={getBest} onPlay={openGame} fallbackGame={games[0]} />
          <RankingPanel ranking={ranking} currentUserId={profile.id} />
          <AssetSection />
          <SiteFooter />
        </div>
      </section>
      {mobileNav && <button className="nav-backdrop" onClick={() => setMobileNav(false)} aria-label="关闭菜单" />}
      {activeGame && <GameModal game={activeGame} bestScore={getBest(activeGame.id)} onClose={() => setActiveGame(null)} onScore={submitScore} />}
    </main>
  );
}
