import type { RuneUpgrade, RuneUpgradeId } from "./types";

export function pegDamage(kind:"normal"|"critical"|"bomb"|"refresh", power:number, blast:number){
  if(kind==="critical")return 7+power;
  if(kind==="bomb")return 13+power+blast;
  return 3+power;
}

export function reducedAttack(attack:number,armor:number){return Math.max(1,attack-armor*2);}

export function upgradeChoices(all:RuneUpgrade[],owned:RuneUpgradeId[],wave:number){
  const offset=(wave*2+owned.length)%all.length;
  return [0,1,2].map((step)=>all[(offset+step*2)%all.length]);
}
