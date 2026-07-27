import type { LifeDeathLevel } from "./lifeDeathTypes";
import type { Stone } from "./types";

export const LIFE_DEATH_SOURCE = {
  repository: "https://github.com/ambak/tsumego-bot",
  license: "MIT",
  note: "题目由公开 SGF 转换为完整 19 路棋盘；标准主变化和题库分级保持不变。",
} as const;

const decodeBoard = (encoded: string): Stone[] => Array.from(encoded, (value) => Number(value) as Stone);

export const lifeDeathLevels: LifeDeathLevel[] = [
  {
    "id": 1,
    "title": "标准入门题 · 10107",
    "chapter": "基础眼形",
    "difficulty": 1,
    "boardSize": 19,
    "board": decodeBoard("0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002220200000000000000110020000000000000000112000000000000001202000000000000000"),
    "playerColor": 1,
    "targetColor": 2,
    "targetGroup": [
      343
    ],
    "goal": "solve",
    "requiredLiberties": 0,
    "maxMoves": 2,
    "solution": [
      324,
      344
    ],
    "opponentResponses": [
      323,
      null
    ],
    "hint": "先读清目标棋块的眼形，找急所；提示会标出标准变化的下一手。",
    "explanation": "题目来自公开 SGF 题库，保留原题主变化与对手应手。完成 2 手标准变化即可过关，偏离后需要重新读题。",
    "source": "ambak/tsumego-bot · elementary/10107.sgf",
    "sourceUrl": "https://raw.githubusercontent.com/ambak/tsumego-bot/master/tsumego/elementary/10107.sgf",
    "license": "MIT"
  },
  {
    "id": 2,
    "title": "标准入门题 · 10110",
    "chapter": "基础眼形",
    "difficulty": 1,
    "boardSize": 19,
    "board": decodeBoard("0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000022000000000000000001022000000000000000100020000000000000012012000000000000000121200000000000000"),
    "playerColor": 1,
    "targetColor": 2,
    "targetGroup": [
      324
    ],
    "goal": "solve",
    "requiredLiberties": 0,
    "maxMoves": 2,
    "solution": [
      305,
      325
    ],
    "opponentResponses": [
      342,
      null
    ],
    "hint": "先读清目标棋块的眼形，找急所；提示会标出标准变化的下一手。",
    "explanation": "题目来自公开 SGF 题库，保留原题主变化与对手应手。完成 2 手标准变化即可过关，偏离后需要重新读题。",
    "source": "ambak/tsumego-bot · elementary/10110.sgf",
    "sourceUrl": "https://raw.githubusercontent.com/ambak/tsumego-bot/master/tsumego/elementary/10110.sgf",
    "license": "MIT"
  },
  {
    "id": 3,
    "title": "标准入门题 · 10113",
    "chapter": "基础眼形",
    "difficulty": 1,
    "boardSize": 19,
    "board": decodeBoard("0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000222020000000000000211112000000000000021001200000000000002121120000000000000020012000000000000"),
    "playerColor": 1,
    "targetColor": 2,
    "targetGroup": [
      326
    ],
    "goal": "solve",
    "requiredLiberties": 0,
    "maxMoves": 2,
    "solution": [
      345,
      307
    ],
    "opponentResponses": [
      346,
      null
    ],
    "hint": "先读清目标棋块的眼形，找急所；提示会标出标准变化的下一手。",
    "explanation": "题目来自公开 SGF 题库，保留原题主变化与对手应手。完成 2 手标准变化即可过关，偏离后需要重新读题。",
    "source": "ambak/tsumego-bot · elementary/10113.sgf",
    "sourceUrl": "https://raw.githubusercontent.com/ambak/tsumego-bot/master/tsumego/elementary/10113.sgf",
    "license": "MIT"
  },
  {
    "id": 4,
    "title": "标准入门题 · 10115",
    "chapter": "基础眼形",
    "difficulty": 1,
    "boardSize": 19,
    "board": decodeBoard("0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002200000000000000000120220000000000000012112000000000000002101200000000000000000120000000000000"),
    "playerColor": 1,
    "targetColor": 2,
    "targetGroup": [
      324
    ],
    "goal": "solve",
    "requiredLiberties": 0,
    "maxMoves": 2,
    "solution": [
      323,
      344
    ],
    "opponentResponses": [
      343,
      null
    ],
    "hint": "先读清目标棋块的眼形，找急所；提示会标出标准变化的下一手。",
    "explanation": "题目来自公开 SGF 题库，保留原题主变化与对手应手。完成 2 手标准变化即可过关，偏离后需要重新读题。",
    "source": "ambak/tsumego-bot · elementary/10115.sgf",
    "sourceUrl": "https://raw.githubusercontent.com/ambak/tsumego-bot/master/tsumego/elementary/10115.sgf",
    "license": "MIT"
  },
  {
    "id": 5,
    "title": "标准入门题 · 10116",
    "chapter": "基础眼形",
    "difficulty": 1,
    "boardSize": 19,
    "board": decodeBoard("0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000222000000000000000211122000000000000021001200000000000002000120000000000000210112000000000000"),
    "playerColor": 1,
    "targetColor": 1,
    "targetGroup": [
      344
    ],
    "goal": "solve",
    "requiredLiberties": 0,
    "maxMoves": 2,
    "solution": [
      326,
      325
    ],
    "opponentResponses": [
      308,
      null
    ],
    "hint": "先读清目标棋块的眼形，找急所；提示会标出标准变化的下一手。",
    "explanation": "题目来自公开 SGF 题库，保留原题主变化与对手应手。完成 2 手标准变化即可过关，偏离后需要重新读题。",
    "source": "ambak/tsumego-bot · elementary/10116.sgf",
    "sourceUrl": "https://raw.githubusercontent.com/ambak/tsumego-bot/master/tsumego/elementary/10116.sgf",
    "license": "MIT"
  },
  {
    "id": 6,
    "title": "标准入门题 · 10120",
    "chapter": "基础眼形",
    "difficulty": 1,
    "boardSize": 19,
    "board": decodeBoard("0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000222200000000000000211120000000000000020012000000000000001101200000000000000020120000000000000"),
    "playerColor": 1,
    "targetColor": 1,
    "targetGroup": [
      287,
      288,
      289,
      308,
      327,
      346
    ],
    "goal": "solve",
    "requiredLiberties": 0,
    "maxMoves": 2,
    "solution": [
      306,
      343
    ],
    "opponentResponses": [
      323,
      null
    ],
    "hint": "先读清目标棋块的眼形，找急所；提示会标出标准变化的下一手。",
    "explanation": "题目来自公开 SGF 题库，保留原题主变化与对手应手。完成 2 手标准变化即可过关，偏离后需要重新读题。",
    "source": "ambak/tsumego-bot · elementary/10120.sgf",
    "sourceUrl": "https://raw.githubusercontent.com/ambak/tsumego-bot/master/tsumego/elementary/10120.sgf",
    "license": "MIT"
  },
  {
    "id": 7,
    "title": "标准入门题 · 10122",
    "chapter": "基础眼形",
    "difficulty": 1,
    "boardSize": 19,
    "board": decodeBoard("0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002222222000000000000121111200000000000011002120000000000000120020000000000000"),
    "playerColor": 1,
    "targetColor": 2,
    "targetGroup": [
      344
    ],
    "goal": "solve",
    "requiredLiberties": 0,
    "maxMoves": 2,
    "solution": [
      345,
      325
    ],
    "opponentResponses": [
      346,
      null
    ],
    "hint": "先读清目标棋块的眼形，找急所；提示会标出标准变化的下一手。",
    "explanation": "题目来自公开 SGF 题库，保留原题主变化与对手应手。完成 2 手标准变化即可过关，偏离后需要重新读题。",
    "source": "ambak/tsumego-bot · elementary/10122.sgf",
    "sourceUrl": "https://raw.githubusercontent.com/ambak/tsumego-bot/master/tsumego/elementary/10122.sgf",
    "license": "MIT"
  },
  {
    "id": 8,
    "title": "标准入门题 · 10128",
    "chapter": "基础眼形",
    "difficulty": 1,
    "boardSize": 19,
    "board": decodeBoard("0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000200000000000000000002020000000000000222112000000000000211101200000000000021222120000000000000120012000000000000"),
    "playerColor": 1,
    "targetColor": 2,
    "targetGroup": [
      326,
      327,
      325,
      344
    ],
    "goal": "solve",
    "requiredLiberties": 0,
    "maxMoves": 2,
    "solution": [
      345,
      308
    ],
    "opponentResponses": [
      346,
      null
    ],
    "hint": "先读清目标棋块的眼形，找急所；提示会标出标准变化的下一手。",
    "explanation": "题目来自公开 SGF 题库，保留原题主变化与对手应手。完成 2 手标准变化即可过关，偏离后需要重新读题。",
    "source": "ambak/tsumego-bot · elementary/10128.sgf",
    "sourceUrl": "https://raw.githubusercontent.com/ambak/tsumego-bot/master/tsumego/elementary/10128.sgf",
    "license": "MIT"
  },
  {
    "id": 9,
    "title": "标准入门题 · 10134",
    "chapter": "基础眼形",
    "difficulty": 1,
    "boardSize": 19,
    "board": decodeBoard("0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002222000000000000000211020000000000000211012000000000000021001202000000000002020012000000000000000101000000000000"),
    "playerColor": 1,
    "targetColor": 1,
    "targetGroup": [
      346
    ],
    "goal": "solve",
    "requiredLiberties": 0,
    "maxMoves": 2,
    "solution": [
      327,
      308
    ],
    "opponentResponses": [
      325,
      null
    ],
    "hint": "先读清目标棋块的眼形，找急所；提示会标出标准变化的下一手。",
    "explanation": "题目来自公开 SGF 题库，保留原题主变化与对手应手。完成 2 手标准变化即可过关，偏离后需要重新读题。",
    "source": "ambak/tsumego-bot · elementary/10134.sgf",
    "sourceUrl": "https://raw.githubusercontent.com/ambak/tsumego-bot/master/tsumego/elementary/10134.sgf",
    "license": "MIT"
  },
  {
    "id": 10,
    "title": "标准入门题 · 10146",
    "chapter": "基础眼形",
    "difficulty": 1,
    "boardSize": 19,
    "board": decodeBoard("0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000022200000000000000002112220000000000002100112000000000000210021000000000000"),
    "playerColor": 1,
    "targetColor": 1,
    "targetGroup": [
      328,
      329,
      348
    ],
    "goal": "solve",
    "requiredLiberties": 0,
    "maxMoves": 2,
    "solution": [
      327,
      326
    ],
    "opponentResponses": [
      345,
      null
    ],
    "hint": "先读清目标棋块的眼形，找急所；提示会标出标准变化的下一手。",
    "explanation": "题目来自公开 SGF 题库，保留原题主变化与对手应手。完成 2 手标准变化即可过关，偏离后需要重新读题。",
    "source": "ambak/tsumego-bot · elementary/10146.sgf",
    "sourceUrl": "https://raw.githubusercontent.com/ambak/tsumego-bot/master/tsumego/elementary/10146.sgf",
    "license": "MIT"
  },
  {
    "id": 11,
    "title": "标准入门题 · 10156",
    "chapter": "基础眼形",
    "difficulty": 2,
    "boardSize": 19,
    "board": decodeBoard("0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001000000000000000000011110000000000000010221000000000000022002100000000000000202010000000000000"),
    "playerColor": 1,
    "targetColor": 2,
    "targetGroup": [
      324,
      323,
      343
    ],
    "goal": "solve",
    "requiredLiberties": 0,
    "maxMoves": 2,
    "solution": [
      325,
      346
    ],
    "opponentResponses": [
      306,
      null
    ],
    "hint": "先读清目标棋块的眼形，找急所；提示会标出标准变化的下一手。",
    "explanation": "题目来自公开 SGF 题库，保留原题主变化与对手应手。完成 2 手标准变化即可过关，偏离后需要重新读题。",
    "source": "ambak/tsumego-bot · elementary/10156.sgf",
    "sourceUrl": "https://raw.githubusercontent.com/ambak/tsumego-bot/master/tsumego/elementary/10156.sgf",
    "license": "MIT"
  },
  {
    "id": 12,
    "title": "标准入门题 · 10163",
    "chapter": "基础眼形",
    "difficulty": 2,
    "boardSize": 19,
    "board": decodeBoard("0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001111110000000000000220001000000000000002002100000000000000212010000000000000"),
    "playerColor": 1,
    "targetColor": 2,
    "targetGroup": [
      345
    ],
    "goal": "solve",
    "requiredLiberties": 0,
    "maxMoves": 2,
    "solution": [
      326,
      346
    ],
    "opponentResponses": [
      307,
      null
    ],
    "hint": "先读清目标棋块的眼形，找急所；提示会标出标准变化的下一手。",
    "explanation": "题目来自公开 SGF 题库，保留原题主变化与对手应手。完成 2 手标准变化即可过关，偏离后需要重新读题。",
    "source": "ambak/tsumego-bot · elementary/10163.sgf",
    "sourceUrl": "https://raw.githubusercontent.com/ambak/tsumego-bot/master/tsumego/elementary/10163.sgf",
    "license": "MIT"
  },
  {
    "id": 13,
    "title": "标准入门题 · 10171",
    "chapter": "基础眼形",
    "difficulty": 2,
    "boardSize": 19,
    "board": decodeBoard("0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000101111100000000000001202210000000000001220021000000000000020022100000000000"),
    "playerColor": 1,
    "targetColor": 2,
    "targetGroup": [
      326,
      325,
      344,
      307
    ],
    "goal": "solve",
    "requiredLiberties": 0,
    "maxMoves": 2,
    "solution": [
      327,
      346
    ],
    "opponentResponses": [
      308,
      null
    ],
    "hint": "先读清目标棋块的眼形，找急所；提示会标出标准变化的下一手。",
    "explanation": "题目来自公开 SGF 题库，保留原题主变化与对手应手。完成 2 手标准变化即可过关，偏离后需要重新读题。",
    "source": "ambak/tsumego-bot · elementary/10171.sgf",
    "sourceUrl": "https://raw.githubusercontent.com/ambak/tsumego-bot/master/tsumego/elementary/10171.sgf",
    "license": "MIT"
  },
  {
    "id": 14,
    "title": "标准入门题 · 10173",
    "chapter": "基础眼形",
    "difficulty": 2,
    "boardSize": 19,
    "board": decodeBoard("0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000111100000000000000012210000000000000001202111000000000001220222100000000000121100210000000000"),
    "playerColor": 1,
    "targetColor": 2,
    "targetGroup": [
      326,
      325,
      344,
      307,
      288,
      289
    ],
    "goal": "solve",
    "requiredLiberties": 0,
    "maxMoves": 2,
    "solution": [
      327,
      347
    ],
    "opponentResponses": [
      308,
      null
    ],
    "hint": "先读清目标棋块的眼形，找急所；提示会标出标准变化的下一手。",
    "explanation": "题目来自公开 SGF 题库，保留原题主变化与对手应手。完成 2 手标准变化即可过关，偏离后需要重新读题。",
    "source": "ambak/tsumego-bot · elementary/10173.sgf",
    "sourceUrl": "https://raw.githubusercontent.com/ambak/tsumego-bot/master/tsumego/elementary/10173.sgf",
    "license": "MIT"
  },
  {
    "id": 15,
    "title": "标准入门题 · 10178",
    "chapter": "基础眼形",
    "difficulty": 2,
    "boardSize": 19,
    "board": decodeBoard("0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000011100000000000000001221110000000000000202221000000000000010002100000000000002020210000000000000"),
    "playerColor": 1,
    "targetColor": 1,
    "targetGroup": [
      323
    ],
    "goal": "solve",
    "requiredLiberties": 0,
    "maxMoves": 2,
    "solution": [
      324,
      325
    ],
    "opponentResponses": [
      305,
      null
    ],
    "hint": "先读清目标棋块的眼形，找急所；提示会标出标准变化的下一手。",
    "explanation": "题目来自公开 SGF 题库，保留原题主变化与对手应手。完成 2 手标准变化即可过关，偏离后需要重新读题。",
    "source": "ambak/tsumego-bot · elementary/10178.sgf",
    "sourceUrl": "https://raw.githubusercontent.com/ambak/tsumego-bot/master/tsumego/elementary/10178.sgf",
    "license": "MIT"
  },
  {
    "id": 16,
    "title": "标准入门题 · 10181",
    "chapter": "基础眼形",
    "difficulty": 2,
    "boardSize": 19,
    "board": decodeBoard("0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001000000000000000000010110000000000000112220000000000000012212100000000000022121101000000000000211020000000000000"),
    "playerColor": 1,
    "targetColor": 2,
    "targetGroup": [
      347
    ],
    "goal": "solve",
    "requiredLiberties": 0,
    "maxMoves": 3,
    "solution": [
      348,
      345,
      346
    ],
    "opponentResponses": [
      346,
      344,
      null
    ],
    "hint": "先读清目标棋块的眼形，找急所；提示会标出标准变化的下一手。",
    "explanation": "题目来自公开 SGF 题库，保留原题主变化与对手应手。完成 3 手标准变化即可过关，偏离后需要重新读题。",
    "source": "ambak/tsumego-bot · elementary/10181.sgf",
    "sourceUrl": "https://raw.githubusercontent.com/ambak/tsumego-bot/master/tsumego/elementary/10181.sgf",
    "license": "MIT"
  },
  {
    "id": 17,
    "title": "标准入门题 · 10184",
    "chapter": "基础眼形",
    "difficulty": 2,
    "boardSize": 19,
    "board": decodeBoard("0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000020000000000000002222111000000000000211212110000000000011012221000000000000210020000000000000"),
    "playerColor": 1,
    "targetColor": 1,
    "targetGroup": [
      344
    ],
    "goal": "solve",
    "requiredLiberties": 0,
    "maxMoves": 1,
    "solution": [
      345
    ],
    "opponentResponses": [
      null
    ],
    "hint": "先读清目标棋块的眼形，找急所；提示会标出标准变化的下一手。",
    "explanation": "题目来自公开 SGF 题库，保留原题主变化与对手应手。完成 1 手标准变化即可过关，偏离后需要重新读题。",
    "source": "ambak/tsumego-bot · elementary/10184.sgf",
    "sourceUrl": "https://raw.githubusercontent.com/ambak/tsumego-bot/master/tsumego/elementary/10184.sgf",
    "license": "MIT"
  },
  {
    "id": 18,
    "title": "标准入门题 · 10188",
    "chapter": "基础眼形",
    "difficulty": 2,
    "boardSize": 19,
    "board": decodeBoard("0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001112200000000000000122102000000000000021211200000000000000020000000000000000"),
    "playerColor": 1,
    "targetColor": 1,
    "targetGroup": [
      324
    ],
    "goal": "solve",
    "requiredLiberties": 0,
    "maxMoves": 2,
    "solution": [
      343,
      343
    ],
    "opponentResponses": [
      342,
      null
    ],
    "hint": "先读清目标棋块的眼形，找急所；提示会标出标准变化的下一手。",
    "explanation": "题目来自公开 SGF 题库，保留原题主变化与对手应手。完成 2 手标准变化即可过关，偏离后需要重新读题。",
    "source": "ambak/tsumego-bot · elementary/10188.sgf",
    "sourceUrl": "https://raw.githubusercontent.com/ambak/tsumego-bot/master/tsumego/elementary/10188.sgf",
    "license": "MIT"
  },
  {
    "id": 19,
    "title": "标准入门题 · 10189",
    "chapter": "基础眼形",
    "difficulty": 2,
    "boardSize": 19,
    "board": decodeBoard("0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001100000000000000000012220000000000000002111200000000000022010120000000000000020122000000000000"),
    "playerColor": 1,
    "targetColor": 2,
    "targetGroup": [
      306
    ],
    "goal": "solve",
    "requiredLiberties": 0,
    "maxMoves": 2,
    "solution": [
      325,
      343
    ],
    "opponentResponses": [
      305,
      null
    ],
    "hint": "先读清目标棋块的眼形，找急所；提示会标出标准变化的下一手。",
    "explanation": "题目来自公开 SGF 题库，保留原题主变化与对手应手。完成 2 手标准变化即可过关，偏离后需要重新读题。",
    "source": "ambak/tsumego-bot · elementary/10189.sgf",
    "sourceUrl": "https://raw.githubusercontent.com/ambak/tsumego-bot/master/tsumego/elementary/10189.sgf",
    "license": "MIT"
  },
  {
    "id": 20,
    "title": "标准入门题 · 10190",
    "chapter": "基础眼形",
    "difficulty": 2,
    "boardSize": 19,
    "board": decodeBoard("0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001112200000000000000122122200000000000021211120000000000000020000000000000000"),
    "playerColor": 1,
    "targetColor": 1,
    "targetGroup": [
      324
    ],
    "goal": "solve",
    "requiredLiberties": 0,
    "maxMoves": 2,
    "solution": [
      343,
      324
    ],
    "opponentResponses": [
      342,
      null
    ],
    "hint": "先读清目标棋块的眼形，找急所；提示会标出标准变化的下一手。",
    "explanation": "题目来自公开 SGF 题库，保留原题主变化与对手应手。完成 2 手标准变化即可过关，偏离后需要重新读题。",
    "source": "ambak/tsumego-bot · elementary/10190.sgf",
    "sourceUrl": "https://raw.githubusercontent.com/ambak/tsumego-bot/master/tsumego/elementary/10190.sgf",
    "license": "MIT"
  },
  {
    "id": 21,
    "title": "标准中级题 · 10109",
    "chapter": "连接与攻杀",
    "difficulty": 3,
    "boardSize": 19,
    "board": decodeBoard("0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002220000000000000000111222000000000000000001200000000000000100020000000000000"),
    "playerColor": 1,
    "targetColor": 1,
    "targetGroup": [
      306,
      305,
      304
    ],
    "goal": "solve",
    "requiredLiberties": 0,
    "maxMoves": 2,
    "solution": [
      325,
      326
    ],
    "opponentResponses": [
      323,
      null
    ],
    "hint": "先读清目标棋块的眼形，找急所；提示会标出标准变化的下一手。",
    "explanation": "题目来自公开 SGF 题库，保留原题主变化与对手应手。完成 2 手标准变化即可过关，偏离后需要重新读题。",
    "source": "ambak/tsumego-bot · intermediate/10109.sgf",
    "sourceUrl": "https://raw.githubusercontent.com/ambak/tsumego-bot/master/tsumego/intermediate/10109.sgf",
    "license": "MIT"
  },
  {
    "id": 22,
    "title": "标准中级题 · 10114",
    "chapter": "连接与攻杀",
    "difficulty": 3,
    "boardSize": 19,
    "board": decodeBoard("0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000022220000000000000002010200000000000000210120000000000000010102000000000000000020200000000000000"),
    "playerColor": 1,
    "targetColor": 1,
    "targetGroup": [
      325
    ],
    "goal": "solve",
    "requiredLiberties": 0,
    "maxMoves": 2,
    "solution": [
      326,
      343
    ],
    "opponentResponses": [
      345,
      null
    ],
    "hint": "先读清目标棋块的眼形，找急所；提示会标出标准变化的下一手。",
    "explanation": "题目来自公开 SGF 题库，保留原题主变化与对手应手。完成 2 手标准变化即可过关，偏离后需要重新读题。",
    "source": "ambak/tsumego-bot · intermediate/10114.sgf",
    "sourceUrl": "https://raw.githubusercontent.com/ambak/tsumego-bot/master/tsumego/intermediate/10114.sgf",
    "license": "MIT"
  },
  {
    "id": 23,
    "title": "标准中级题 · 10118",
    "chapter": "连接与攻杀",
    "difficulty": 3,
    "boardSize": 19,
    "board": decodeBoard("0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002000000000000000002202200000000000002111120000000000000200212000000000000021211200000000000000010220000000000000"),
    "playerColor": 1,
    "targetColor": 1,
    "targetGroup": [
      324
    ],
    "goal": "solve",
    "requiredLiberties": 0,
    "maxMoves": 2,
    "solution": [
      305,
      343
    ],
    "opponentResponses": [
      345,
      null
    ],
    "hint": "先读清目标棋块的眼形，找急所；提示会标出标准变化的下一手。",
    "explanation": "题目来自公开 SGF 题库，保留原题主变化与对手应手。完成 2 手标准变化即可过关，偏离后需要重新读题。",
    "source": "ambak/tsumego-bot · intermediate/10118.sgf",
    "sourceUrl": "https://raw.githubusercontent.com/ambak/tsumego-bot/master/tsumego/intermediate/10118.sgf",
    "license": "MIT"
  },
  {
    "id": 24,
    "title": "标准中级题 · 10121",
    "chapter": "连接与攻杀",
    "difficulty": 3,
    "boardSize": 19,
    "board": decodeBoard("0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000022220000000000000001111200000000000000010220000000000000000012000000000000000010200000000000000"),
    "playerColor": 1,
    "targetColor": 1,
    "targetGroup": [
      326
    ],
    "goal": "solve",
    "requiredLiberties": 0,
    "maxMoves": 2,
    "solution": [
      323,
      343
    ],
    "opponentResponses": [
      325,
      null
    ],
    "hint": "先读清目标棋块的眼形，找急所；提示会标出标准变化的下一手。",
    "explanation": "题目来自公开 SGF 题库，保留原题主变化与对手应手。完成 2 手标准变化即可过关，偏离后需要重新读题。",
    "source": "ambak/tsumego-bot · intermediate/10121.sgf",
    "sourceUrl": "https://raw.githubusercontent.com/ambak/tsumego-bot/master/tsumego/intermediate/10121.sgf",
    "license": "MIT"
  },
  {
    "id": 25,
    "title": "标准中级题 · 10123",
    "chapter": "连接与攻杀",
    "difficulty": 3,
    "boardSize": 19,
    "board": decodeBoard("0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000022200000000000000002112220000000000000000112000000000000000001200000000000000010120000000000000"),
    "playerColor": 1,
    "targetColor": 1,
    "targetGroup": [
      286,
      287
    ],
    "goal": "solve",
    "requiredLiberties": 0,
    "maxMoves": 3,
    "solution": [
      324,
      306,
      304
    ],
    "opponentResponses": [
      305,
      323,
      null
    ],
    "hint": "先读清目标棋块的眼形，找急所；提示会标出标准变化的下一手。",
    "explanation": "题目来自公开 SGF 题库，保留原题主变化与对手应手。完成 3 手标准变化即可过关，偏离后需要重新读题。",
    "source": "ambak/tsumego-bot · intermediate/10123.sgf",
    "sourceUrl": "https://raw.githubusercontent.com/ambak/tsumego-bot/master/tsumego/intermediate/10123.sgf",
    "license": "MIT"
  },
  {
    "id": 26,
    "title": "标准中级题 · 10126",
    "chapter": "连接与攻杀",
    "difficulty": 3,
    "boardSize": 19,
    "board": decodeBoard("0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000200000000000000000002200000000000000222120000000000000211101200000000000021200120000000000000120012000000000000"),
    "playerColor": 1,
    "targetColor": 2,
    "targetGroup": [
      344,
      325
    ],
    "goal": "solve",
    "requiredLiberties": 0,
    "maxMoves": 2,
    "solution": [
      345,
      308
    ],
    "opponentResponses": [
      327,
      null
    ],
    "hint": "先读清目标棋块的眼形，找急所；提示会标出标准变化的下一手。",
    "explanation": "题目来自公开 SGF 题库，保留原题主变化与对手应手。完成 2 手标准变化即可过关，偏离后需要重新读题。",
    "source": "ambak/tsumego-bot · intermediate/10126.sgf",
    "sourceUrl": "https://raw.githubusercontent.com/ambak/tsumego-bot/master/tsumego/intermediate/10126.sgf",
    "license": "MIT"
  },
  {
    "id": 27,
    "title": "标准中级题 · 10127",
    "chapter": "连接与攻杀",
    "difficulty": 3,
    "boardSize": 19,
    "board": decodeBoard("0012200000000000000100120000000000000000012000000000000000010200000000000000222200000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"),
    "playerColor": 1,
    "targetColor": 1,
    "targetGroup": [
      2
    ],
    "goal": "solve",
    "requiredLiberties": 0,
    "maxMoves": 3,
    "solution": [
      39,
      1,
      40
    ],
    "opponentResponses": [
      21,
      60,
      null
    ],
    "hint": "先读清目标棋块的眼形，找急所；提示会标出标准变化的下一手。",
    "explanation": "题目来自公开 SGF 题库，保留原题主变化与对手应手。完成 3 手标准变化即可过关，偏离后需要重新读题。",
    "source": "ambak/tsumego-bot · intermediate/10127.sgf",
    "sourceUrl": "https://raw.githubusercontent.com/ambak/tsumego-bot/master/tsumego/intermediate/10127.sgf",
    "license": "MIT"
  },
  {
    "id": 28,
    "title": "标准中级题 · 10129",
    "chapter": "连接与攻杀",
    "difficulty": 3,
    "boardSize": 19,
    "board": decodeBoard("2211220000000000000210012000000000000001001200000000000002211220000000000000022200000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"),
    "playerColor": 1,
    "targetColor": 1,
    "targetGroup": [
      42,
      23
    ],
    "goal": "solve",
    "requiredLiberties": 0,
    "maxMoves": 2,
    "solution": [
      41,
      21
    ],
    "opponentResponses": [
      38,
      null
    ],
    "hint": "先读清目标棋块的眼形，找急所；提示会标出标准变化的下一手。",
    "explanation": "题目来自公开 SGF 题库，保留原题主变化与对手应手。完成 2 手标准变化即可过关，偏离后需要重新读题。",
    "source": "ambak/tsumego-bot · intermediate/10129.sgf",
    "sourceUrl": "https://raw.githubusercontent.com/ambak/tsumego-bot/master/tsumego/intermediate/10129.sgf",
    "license": "MIT"
  },
  {
    "id": 29,
    "title": "标准中级题 · 10130",
    "chapter": "连接与攻杀",
    "difficulty": 3,
    "boardSize": 19,
    "board": decodeBoard("0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002000000000000000022020200000000000002101102000000000002100211200000000000210120120000000000"),
    "playerColor": 1,
    "targetColor": 1,
    "targetGroup": [
      325,
      344
    ],
    "goal": "solve",
    "requiredLiberties": 0,
    "maxMoves": 2,
    "solution": [
      326,
      348
    ],
    "opponentResponses": [
      308,
      null
    ],
    "hint": "先读清目标棋块的眼形，找急所；提示会标出标准变化的下一手。",
    "explanation": "题目来自公开 SGF 题库，保留原题主变化与对手应手。完成 2 手标准变化即可过关，偏离后需要重新读题。",
    "source": "ambak/tsumego-bot · intermediate/10130.sgf",
    "sourceUrl": "https://raw.githubusercontent.com/ambak/tsumego-bot/master/tsumego/intermediate/10130.sgf",
    "license": "MIT"
  },
  {
    "id": 30,
    "title": "标准中级题 · 10131",
    "chapter": "连接与攻杀",
    "difficulty": 3,
    "boardSize": 19,
    "board": decodeBoard("0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000022222000000000000001111200000000000000002120000000000000000211200000000000001200120000000000000"),
    "playerColor": 1,
    "targetColor": 2,
    "targetGroup": [
      343
    ],
    "goal": "solve",
    "requiredLiberties": 0,
    "maxMoves": 2,
    "solution": [
      324,
      305
    ],
    "opponentResponses": [
      323,
      null
    ],
    "hint": "先读清目标棋块的眼形，找急所；提示会标出标准变化的下一手。",
    "explanation": "题目来自公开 SGF 题库，保留原题主变化与对手应手。完成 2 手标准变化即可过关，偏离后需要重新读题。",
    "source": "ambak/tsumego-bot · intermediate/10131.sgf",
    "sourceUrl": "https://raw.githubusercontent.com/ambak/tsumego-bot/master/tsumego/intermediate/10131.sgf",
    "license": "MIT"
  },
  {
    "id": 31,
    "title": "标准中级题 · 10132",
    "chapter": "连接与攻杀",
    "difficulty": 4,
    "boardSize": 19,
    "board": decodeBoard("0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000022220000000000000002111220000000000000102012000000000000010001200000000000001011220000000000000"),
    "playerColor": 1,
    "targetColor": 1,
    "targetGroup": [
      286,
      287,
      288
    ],
    "goal": "solve",
    "requiredLiberties": 0,
    "maxMoves": 2,
    "solution": [
      305,
      325
    ],
    "opponentResponses": [
      324,
      null
    ],
    "hint": "先读清目标棋块的眼形，找急所；提示会标出标准变化的下一手。",
    "explanation": "题目来自公开 SGF 题库，保留原题主变化与对手应手。完成 2 手标准变化即可过关，偏离后需要重新读题。",
    "source": "ambak/tsumego-bot · intermediate/10132.sgf",
    "sourceUrl": "https://raw.githubusercontent.com/ambak/tsumego-bot/master/tsumego/intermediate/10132.sgf",
    "license": "MIT"
  },
  {
    "id": 32,
    "title": "标准中级题 · 10133",
    "chapter": "连接与攻杀",
    "difficulty": 4,
    "boardSize": 19,
    "board": decodeBoard("0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002022200000000000000021120000000000000221012000000000000121101200000000000021002120000000000002010020000000000000"),
    "playerColor": 1,
    "targetColor": 1,
    "targetGroup": [
      309,
      328,
      290,
      271,
      270
    ],
    "goal": "solve",
    "requiredLiberties": 0,
    "maxMoves": 3,
    "solution": [
      308,
      346,
      325
    ],
    "opponentResponses": [
      326,
      345,
      null
    ],
    "hint": "先读清目标棋块的眼形，找急所；提示会标出标准变化的下一手。",
    "explanation": "题目来自公开 SGF 题库，保留原题主变化与对手应手。完成 3 手标准变化即可过关，偏离后需要重新读题。",
    "source": "ambak/tsumego-bot · intermediate/10133.sgf",
    "sourceUrl": "https://raw.githubusercontent.com/ambak/tsumego-bot/master/tsumego/intermediate/10133.sgf",
    "license": "MIT"
  },
  {
    "id": 33,
    "title": "标准中级题 · 10135",
    "chapter": "连接与攻杀",
    "difficulty": 4,
    "boardSize": 19,
    "board": decodeBoard("0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000222220000000000000021112000000000000021000200000000000002101002000000000000000101200000000000"),
    "playerColor": 1,
    "targetColor": 1,
    "targetGroup": [
      290,
      289,
      288
    ],
    "goal": "solve",
    "requiredLiberties": 0,
    "maxMoves": 2,
    "solution": [
      309,
      307
    ],
    "opponentResponses": [
      328,
      null
    ],
    "hint": "先读清目标棋块的眼形，找急所；提示会标出标准变化的下一手。",
    "explanation": "题目来自公开 SGF 题库，保留原题主变化与对手应手。完成 2 手标准变化即可过关，偏离后需要重新读题。",
    "source": "ambak/tsumego-bot · intermediate/10135.sgf",
    "sourceUrl": "https://raw.githubusercontent.com/ambak/tsumego-bot/master/tsumego/intermediate/10135.sgf",
    "license": "MIT"
  },
  {
    "id": 34,
    "title": "标准中级题 · 10136",
    "chapter": "连接与攻杀",
    "difficulty": 4,
    "boardSize": 19,
    "board": decodeBoard("0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000022220000000000000001112000000000000000001200000000000000010012200000000000000200000000000000000"),
    "playerColor": 1,
    "targetColor": 2,
    "targetGroup": [
      343
    ],
    "goal": "solve",
    "requiredLiberties": 0,
    "maxMoves": 4,
    "solution": [
      344,
      305,
      325,
      342
    ],
    "opponentResponses": [
      324,
      346,
      345,
      null
    ],
    "hint": "先读清目标棋块的眼形，找急所；提示会标出标准变化的下一手。",
    "explanation": "题目来自公开 SGF 题库，保留原题主变化与对手应手。完成 4 手标准变化即可过关，偏离后需要重新读题。",
    "source": "ambak/tsumego-bot · intermediate/10136.sgf",
    "sourceUrl": "https://raw.githubusercontent.com/ambak/tsumego-bot/master/tsumego/intermediate/10136.sgf",
    "license": "MIT"
  },
  {
    "id": 35,
    "title": "标准中级题 · 10137",
    "chapter": "连接与攻杀",
    "difficulty": 4,
    "boardSize": 19,
    "board": decodeBoard("0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000022000000000000000001022200000000000000211120000000000000000001200000000000001000120000000000000"),
    "playerColor": 1,
    "targetColor": 2,
    "targetGroup": [
      304
    ],
    "goal": "solve",
    "requiredLiberties": 0,
    "maxMoves": 5,
    "solution": [
      323,
      325,
      324,
      326,
      344
    ],
    "opponentResponses": [
      344,
      343,
      345,
      286,
      null
    ],
    "hint": "先读清目标棋块的眼形，找急所；提示会标出标准变化的下一手。",
    "explanation": "题目来自公开 SGF 题库，保留原题主变化与对手应手。完成 5 手标准变化即可过关，偏离后需要重新读题。",
    "source": "ambak/tsumego-bot · intermediate/10137.sgf",
    "sourceUrl": "https://raw.githubusercontent.com/ambak/tsumego-bot/master/tsumego/intermediate/10137.sgf",
    "license": "MIT"
  },
  {
    "id": 36,
    "title": "标准中级题 · 10139",
    "chapter": "连接与攻杀",
    "difficulty": 4,
    "boardSize": 19,
    "board": decodeBoard("0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000020000000000000002220200000000000000101120000000000000000012000000000000000001200000000000000"),
    "playerColor": 1,
    "targetColor": 1,
    "targetGroup": [
      304
    ],
    "goal": "solve",
    "requiredLiberties": 0,
    "maxMoves": 3,
    "solution": [
      324,
      344,
      323
    ],
    "opponentResponses": [
      343,
      305,
      null
    ],
    "hint": "先读清目标棋块的眼形，找急所；提示会标出标准变化的下一手。",
    "explanation": "题目来自公开 SGF 题库，保留原题主变化与对手应手。完成 3 手标准变化即可过关，偏离后需要重新读题。",
    "source": "ambak/tsumego-bot · intermediate/10139.sgf",
    "sourceUrl": "https://raw.githubusercontent.com/ambak/tsumego-bot/master/tsumego/intermediate/10139.sgf",
    "license": "MIT"
  },
  {
    "id": 37,
    "title": "标准中级题 · 10140",
    "chapter": "连接与攻杀",
    "difficulty": 4,
    "boardSize": 19,
    "board": decodeBoard("0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000022000000000000000001122000000000000000011200000000000000000002000000000000000011200000000000000"),
    "playerColor": 1,
    "targetColor": 1,
    "targetGroup": [
      285,
      286,
      305,
      306
    ],
    "goal": "solve",
    "requiredLiberties": 0,
    "maxMoves": 2,
    "solution": [
      323,
      343
    ],
    "opponentResponses": [
      325,
      null
    ],
    "hint": "先读清目标棋块的眼形，找急所；提示会标出标准变化的下一手。",
    "explanation": "题目来自公开 SGF 题库，保留原题主变化与对手应手。完成 2 手标准变化即可过关，偏离后需要重新读题。",
    "source": "ambak/tsumego-bot · intermediate/10140.sgf",
    "sourceUrl": "https://raw.githubusercontent.com/ambak/tsumego-bot/master/tsumego/intermediate/10140.sgf",
    "license": "MIT"
  },
  {
    "id": 38,
    "title": "标准中级题 · 10143",
    "chapter": "连接与攻杀",
    "difficulty": 4,
    "boardSize": 19,
    "board": decodeBoard("0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000022220000000000000002112000000000000000101122000000000000010001200000000000000020120000000000000"),
    "playerColor": 1,
    "targetColor": 1,
    "targetGroup": [
      323,
      304
    ],
    "goal": "solve",
    "requiredLiberties": 0,
    "maxMoves": 2,
    "solution": [
      324,
      326
    ],
    "opponentResponses": [
      343,
      null
    ],
    "hint": "先读清目标棋块的眼形，找急所；提示会标出标准变化的下一手。",
    "explanation": "题目来自公开 SGF 题库，保留原题主变化与对手应手。完成 2 手标准变化即可过关，偏离后需要重新读题。",
    "source": "ambak/tsumego-bot · intermediate/10143.sgf",
    "sourceUrl": "https://raw.githubusercontent.com/ambak/tsumego-bot/master/tsumego/intermediate/10143.sgf",
    "license": "MIT"
  },
  {
    "id": 39,
    "title": "标准中级题 · 10148",
    "chapter": "连接与攻杀",
    "difficulty": 4,
    "boardSize": 19,
    "board": decodeBoard("0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000022222000000000000022111122000000000022112001200000000002102000120000000000"),
    "playerColor": 1,
    "targetColor": 1,
    "targetGroup": [
      343
    ],
    "goal": "solve",
    "requiredLiberties": 0,
    "maxMoves": 4,
    "solution": [
      347,
      348,
      346,
      328
    ],
    "opponentResponses": [
      329,
      328,
      344,
      null
    ],
    "hint": "先读清目标棋块的眼形，找急所；提示会标出标准变化的下一手。",
    "explanation": "题目来自公开 SGF 题库，保留原题主变化与对手应手。完成 4 手标准变化即可过关，偏离后需要重新读题。",
    "source": "ambak/tsumego-bot · intermediate/10148.sgf",
    "sourceUrl": "https://raw.githubusercontent.com/ambak/tsumego-bot/master/tsumego/intermediate/10148.sgf",
    "license": "MIT"
  },
  {
    "id": 40,
    "title": "标准中级题 · 10149",
    "chapter": "连接与攻杀",
    "difficulty": 4,
    "boardSize": 19,
    "board": decodeBoard("0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002200000000000000001212220000000000000211112000000000000020121200000000000000020120000000000000"),
    "playerColor": 1,
    "targetColor": 2,
    "targetGroup": [
      344
    ],
    "goal": "solve",
    "requiredLiberties": 0,
    "maxMoves": 2,
    "solution": [
      343,
      324
    ],
    "opponentResponses": [
      266,
      null
    ],
    "hint": "先读清目标棋块的眼形，找急所；提示会标出标准变化的下一手。",
    "explanation": "题目来自公开 SGF 题库，保留原题主变化与对手应手。完成 2 手标准变化即可过关，偏离后需要重新读题。",
    "source": "ambak/tsumego-bot · intermediate/10149.sgf",
    "sourceUrl": "https://raw.githubusercontent.com/ambak/tsumego-bot/master/tsumego/intermediate/10149.sgf",
    "license": "MIT"
  },
  {
    "id": 41,
    "title": "标准高级题 · 10194",
    "chapter": "复杂劫活",
    "difficulty": 5,
    "boardSize": 19,
    "board": decodeBoard("0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002222200000000000000212112200000000000011100120000000000000000002000000000000"),
    "playerColor": 1,
    "targetColor": 1,
    "targetGroup": [
      307,
      308
    ],
    "goal": "solve",
    "requiredLiberties": 0,
    "maxMoves": 3,
    "solution": [
      346,
      326,
      347
    ],
    "opponentResponses": [
      344,
      343,
      null
    ],
    "hint": "先读清目标棋块的眼形，找急所；提示会标出标准变化的下一手。",
    "explanation": "题目来自公开 SGF 题库，保留原题主变化与对手应手。完成 3 手标准变化即可过关，偏离后需要重新读题。",
    "source": "ambak/tsumego-bot · advanced/10194.sgf",
    "sourceUrl": "https://raw.githubusercontent.com/ambak/tsumego-bot/master/tsumego/advanced/10194.sgf",
    "license": "MIT"
  },
  {
    "id": 42,
    "title": "标准高级题 · 10198",
    "chapter": "复杂劫活",
    "difficulty": 5,
    "boardSize": 19,
    "board": decodeBoard("0002200100000000000021011112000000000000211022200000000000022200000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"),
    "playerColor": 1,
    "targetColor": 2,
    "targetGroup": [
      20
    ],
    "goal": "solve",
    "requiredLiberties": 0,
    "maxMoves": 3,
    "solution": [
      1,
      5,
      22
    ],
    "opponentResponses": [
      2,
      0,
      null
    ],
    "hint": "先读清目标棋块的眼形，找急所；提示会标出标准变化的下一手。",
    "explanation": "题目来自公开 SGF 题库，保留原题主变化与对手应手。完成 3 手标准变化即可过关，偏离后需要重新读题。",
    "source": "ambak/tsumego-bot · advanced/10198.sgf",
    "sourceUrl": "https://raw.githubusercontent.com/ambak/tsumego-bot/master/tsumego/advanced/10198.sgf",
    "license": "MIT"
  },
  {
    "id": 43,
    "title": "标准高级题 · 10476",
    "chapter": "复杂劫活",
    "difficulty": 5,
    "boardSize": 19,
    "board": decodeBoard("0010000000000000000010212000000000000010001200000000000000211220000000000000022200000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"),
    "playerColor": 1,
    "targetColor": 1,
    "targetGroup": [
      23,
      42
    ],
    "goal": "solve",
    "requiredLiberties": 0,
    "maxMoves": 3,
    "solution": [
      4,
      41,
      21
    ],
    "opponentResponses": [
      40,
      39,
      null
    ],
    "hint": "先读清目标棋块的眼形，找急所；提示会标出标准变化的下一手。",
    "explanation": "题目来自公开 SGF 题库，保留原题主变化与对手应手。完成 3 手标准变化即可过关，偏离后需要重新读题。",
    "source": "ambak/tsumego-bot · advanced/10476.sgf",
    "sourceUrl": "https://raw.githubusercontent.com/ambak/tsumego-bot/master/tsumego/advanced/10476.sgf",
    "license": "MIT"
  },
  {
    "id": 44,
    "title": "标准高级题 · 10553",
    "chapter": "复杂劫活",
    "difficulty": 5,
    "boardSize": 19,
    "board": decodeBoard("0000000000000000000000002211000120000000000002101112000000000000222212000000000000000002200000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"),
    "playerColor": 1,
    "targetColor": 1,
    "targetGroup": [
      31,
      50,
      49,
      48,
      68
    ],
    "goal": "solve",
    "requiredLiberties": 0,
    "maxMoves": 4,
    "solution": [
      11,
      7,
      47,
      10
    ],
    "opponentResponses": [
      29,
      28,
      9,
      null
    ],
    "hint": "先读清目标棋块的眼形，找急所；提示会标出标准变化的下一手。",
    "explanation": "题目来自公开 SGF 题库，保留原题主变化与对手应手。完成 4 手标准变化即可过关，偏离后需要重新读题。",
    "source": "ambak/tsumego-bot · advanced/10553.sgf",
    "sourceUrl": "https://raw.githubusercontent.com/ambak/tsumego-bot/master/tsumego/advanced/10553.sgf",
    "license": "MIT"
  },
  {
    "id": 45,
    "title": "标准高级题 · 10795",
    "chapter": "复杂劫活",
    "difficulty": 5,
    "boardSize": 19,
    "board": decodeBoard("0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000010100000000000000001001000000000000002222100000000000000010120200000000000000012020000000000000000000000000000000"),
    "playerColor": 1,
    "targetColor": 1,
    "targetGroup": [
      307,
      326
    ],
    "goal": "solve",
    "requiredLiberties": 0,
    "maxMoves": 4,
    "solution": [
      343,
      324,
      325,
      269
    ],
    "opponentResponses": [
      304,
      306,
      345,
      null
    ],
    "hint": "先读清目标棋块的眼形，找急所；提示会标出标准变化的下一手。",
    "explanation": "题目来自公开 SGF 题库，保留原题主变化与对手应手。完成 4 手标准变化即可过关，偏离后需要重新读题。",
    "source": "ambak/tsumego-bot · advanced/10795.sgf",
    "sourceUrl": "https://raw.githubusercontent.com/ambak/tsumego-bot/master/tsumego/advanced/10795.sgf",
    "license": "MIT"
  },
  {
    "id": 46,
    "title": "标准高级题 · 10799",
    "chapter": "复杂劫活",
    "difficulty": 5,
    "boardSize": 19,
    "board": decodeBoard("0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001000000000000111110000000000000022222100000000000000000010000000000000000000000000000000"),
    "playerColor": 1,
    "targetColor": 1,
    "targetGroup": [
      273
    ],
    "goal": "solve",
    "requiredLiberties": 0,
    "maxMoves": 5,
    "solution": [
      346,
      347,
      325,
      304,
      343
    ],
    "opponentResponses": [
      345,
      327,
      324,
      323,
      null
    ],
    "hint": "先读清目标棋块的眼形，找急所；提示会标出标准变化的下一手。",
    "explanation": "题目来自公开 SGF 题库，保留原题主变化与对手应手。完成 5 手标准变化即可过关，偏离后需要重新读题。",
    "source": "ambak/tsumego-bot · advanced/10799.sgf",
    "sourceUrl": "https://raw.githubusercontent.com/ambak/tsumego-bot/master/tsumego/advanced/10799.sgf",
    "license": "MIT"
  },
  {
    "id": 47,
    "title": "标准高级题 · 10800",
    "chapter": "复杂劫活",
    "difficulty": 5,
    "boardSize": 19,
    "board": decodeBoard("0000000000000000000000000010200000000001221110200000000000101222202000000000021100000000000000002222000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"),
    "playerColor": 1,
    "targetColor": 1,
    "targetGroup": [
      39,
      58
    ],
    "goal": "solve",
    "requiredLiberties": 0,
    "maxMoves": 3,
    "solution": [
      20,
      22,
      21
    ],
    "opponentResponses": [
      59,
      80,
      null
    ],
    "hint": "先读清目标棋块的眼形，找急所；提示会标出标准变化的下一手。",
    "explanation": "题目来自公开 SGF 题库，保留原题主变化与对手应手。完成 3 手标准变化即可过关，偏离后需要重新读题。",
    "source": "ambak/tsumego-bot · advanced/10800.sgf",
    "sourceUrl": "https://raw.githubusercontent.com/ambak/tsumego-bot/master/tsumego/advanced/10800.sgf",
    "license": "MIT"
  },
  {
    "id": 48,
    "title": "标准高级题 · 10802",
    "chapter": "复杂劫活",
    "difficulty": 5,
    "boardSize": 19,
    "board": decodeBoard("0000010000000000000000210000000000000002222110000000000000211100000000000000212001000000000000001100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"),
    "playerColor": 1,
    "targetColor": 2,
    "targetGroup": [
      78
    ],
    "goal": "solve",
    "requiredLiberties": 0,
    "maxMoves": 4,
    "solution": [
      1,
      2,
      57,
      0
    ],
    "opponentResponses": [
      20,
      3,
      38,
      null
    ],
    "hint": "先读清目标棋块的眼形，找急所；提示会标出标准变化的下一手。",
    "explanation": "题目来自公开 SGF 题库，保留原题主变化与对手应手。完成 4 手标准变化即可过关，偏离后需要重新读题。",
    "source": "ambak/tsumego-bot · advanced/10802.sgf",
    "sourceUrl": "https://raw.githubusercontent.com/ambak/tsumego-bot/master/tsumego/advanced/10802.sgf",
    "license": "MIT"
  },
  {
    "id": 49,
    "title": "标准高级题 · 10806",
    "chapter": "复杂劫活",
    "difficulty": 5,
    "boardSize": 19,
    "board": decodeBoard("0000000200000000000001020021000000000000102102100000000000002012100000000000011122210000000000000001111000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"),
    "playerColor": 1,
    "targetColor": 2,
    "targetGroup": [
      63,
      82,
      81,
      80
    ],
    "goal": "solve",
    "requiredLiberties": 0,
    "maxMoves": 6,
    "solution": [
      5,
      61,
      24,
      41,
      61,
      24
    ],
    "opponentResponses": [
      4,
      44,
      6,
      25,
      62,
      null
    ],
    "hint": "先读清目标棋块的眼形，找急所；提示会标出标准变化的下一手。",
    "explanation": "题目来自公开 SGF 题库，保留原题主变化与对手应手。完成 6 手标准变化即可过关，偏离后需要重新读题。",
    "source": "ambak/tsumego-bot · advanced/10806.sgf",
    "sourceUrl": "https://raw.githubusercontent.com/ambak/tsumego-bot/master/tsumego/advanced/10806.sgf",
    "license": "MIT"
  },
  {
    "id": 50,
    "title": "标准高级题 · 10826",
    "chapter": "复杂劫活",
    "difficulty": 5,
    "boardSize": 19,
    "board": decodeBoard("0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002000000000000000001222000000000000000001122000000000000000001200000000000000001120000000000000"),
    "playerColor": 1,
    "targetColor": 1,
    "targetGroup": [
      306,
      307
    ],
    "goal": "solve",
    "requiredLiberties": 0,
    "maxMoves": 4,
    "solution": [
      325,
      305,
      323,
      343
    ],
    "opponentResponses": [
      324,
      342,
      304,
      null
    ],
    "hint": "先读清目标棋块的眼形，找急所；提示会标出标准变化的下一手。",
    "explanation": "题目来自公开 SGF 题库，保留原题主变化与对手应手。完成 4 手标准变化即可过关，偏离后需要重新读题。",
    "source": "ambak/tsumego-bot · advanced/10826.sgf",
    "sourceUrl": "https://raw.githubusercontent.com/ambak/tsumego-bot/master/tsumego/advanced/10826.sgf",
    "license": "MIT"
  }
];
