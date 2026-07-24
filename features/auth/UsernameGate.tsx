"use client";

import { useState } from "react";
import styles from "./UsernameGate.module.css";

export function UsernameGate({ initialName = "", onSubmit }: { initialName?: string; onSubmit: (name: string) => void }) {
  const [name, setName] = useState(initialName === "漫游玩家" ? "" : initialName);
  const [error, setError] = useState("");

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalized = name.trim().replace(/\s+/g, " ");
    if (normalized.length < 2) {
      setError("用户名至少需要 2 个字符");
      return;
    }
    if (normalized.length > 16) {
      setError("用户名不能超过 16 个字符");
      return;
    }
    onSubmit(normalized);
  };

  return (
    <main className={styles.page}>
      <div className={styles.ambient}><i /><i /><i /></div>
      <form className={styles.card} onSubmit={submit}>
        <span className={styles.logo}><i /><i /><i /></span>
        <span className={styles.eyebrow}>欢迎来到 狗耳GAME</span>
        <h1>先认识一下吧</h1>
        <p>设置一个用户名，用来保存游戏成绩并参与玩家排名。</p>
        <label htmlFor="player-name">你的用户名</label>
        <div className={`${styles.inputBox} ${error ? styles.inputError : ""}`}>
          <input id="player-name" name="player-name" value={name} onChange={(event) => { setName(event.target.value); setError(""); }} placeholder="输入 2–16 个字符" maxLength={16} autoComplete="nickname" autoFocus />
          <span>{name.trim().length}/16</span>
        </div>
        <div className={styles.message}>{error || "支持中文、字母、数字及空格"}</div>
        <button type="submit">进入游戏大厅 <span>→</span></button>
        <small>当前为本地游客身份，无需密码。数据保存在此浏览器中。</small>
      </form>
    </main>
  );
}
