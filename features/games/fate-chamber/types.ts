export type Shell="charge"|"dud";
export type DuelActor="player"|"dealer";
export type DuelPhase="idle"|"playing"|"paused"|"won"|"lost";
export type DuelItemId="lens"|"inverter"|"shield"|"amplifier"|"cuffs"|"ejector"|"salve";
export type DuelItem={id:DuelItemId;name:string;icon:string;description:string};
export type DuelState={
  phase:DuelPhase;turn:DuelActor;round:number;chamber:Shell[];playerHp:number;dealerHp:number;maxHp:number;
  playerItems:DuelItemId[];dealerItems:DuelItemId[];known:{player:Shell|null;dealer:Shell|null};
  shields:{player:boolean;dealer:boolean};boosts:{player:boolean;dealer:boolean};skip:{player:boolean;dealer:boolean};
  actions:number;score:number;message:string;history:string[];
};
export type DuelResult={state:DuelState;event:"item"|"charge"|"dud"|"block"|"reload"};
