import type { Peg, RuneEnemy, RuneUpgrade } from "./types";

export const PEG_WIDTH=960, PEG_HEIGHT=540, BOARD_RIGHT=690;

export const UPGRADES: RuneUpgrade[] = [
  {id:"power",name:"重击符文",icon:"◆",description:"每次点亮钉子额外造成 1 点伤害。"},
  {id:"echo",name:"回声弹芯",icon:"◉",description:"每次发射增加一颗偏转弹珠，最多 3 颗。"},
  {id:"blast",name:"炽焰星",icon:"✹",description:"爆炸钉伤害提高 10 点，范围扩大。"},
  {id:"armor",name:"月银甲",icon:"⬡",description:"每次敌人反击伤害降低 2 点。"},
  {id:"heal",name:"生命露",icon:"♥",description:"立刻恢复 22 点生命，并提高 6 点上限。"},
  {id:"prism",name:"七曜镜",icon:"✦",description:"每点亮第 7 个钉子，追加 16 点棱镜伤害。"},
];

export function createPegs(): Peg[] {
  const pegs: Peg[]=[]; let id=0;
  for(let row=0;row<8;row+=1) for(let col=0;col<9;col+=1){
    const x=74+col*69+(row%2)*34.5; const y=142+row*46;
    if(x>BOARD_RIGHT-24) continue;
    let kind:Peg["kind"]="normal";
    if((row===2&&col===2)||(row===5&&col===6))kind="bomb";
    else if((row+col)%13===0)kind="refresh";
    else if((row*3+col)%11===0)kind="critical";
    pegs.push({id:id++,x,y,kind,lit:false,consumed:false});
  }
  return pegs;
}

export function createWave(wave:number):RuneEnemy[]{
  if(wave===1)return [{id:1,name:"苔晶团子",hp:58,maxHp:58,attack:5,color:"#64d29b",kind:"slime"}];
  if(wave===2)return [{id:2,name:"赤铜石像",hp:92,maxHp:92,attack:7,color:"#e99758",kind:"golem"},{id:3,name:"幽光团子",hp:68,maxHp:68,attack:5,color:"#8a7df1",kind:"slime"}];
  return [{id:4,name:"星门守卫",hp:245,maxHp:245,attack:10,color:"#d95f91",kind:"warden"}];
}
