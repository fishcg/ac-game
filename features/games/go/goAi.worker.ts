import { chooseAiMove } from "./goAi";
import type { BoardSize, PlayerStone, Stone } from "./types";

type ThinkRequest = {
  id: number;
  board: Stone[];
  color: PlayerStone;
  size: BoardSize;
  hashes: string[];
  moveNumber: number;
};

const workerScope = self as unknown as {
  onmessage: ((event: MessageEvent<ThinkRequest>) => void) | null;
  postMessage: (message: { id: number; index: number | null }) => void;
};

workerScope.onmessage = ({ data }) => {
  const index = chooseAiMove(data.board, data.color, data.size, data.hashes, data.moveNumber);
  workerScope.postMessage({ id: data.id, index });
};

export {};
