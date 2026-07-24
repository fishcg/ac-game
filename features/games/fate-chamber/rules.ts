import{ITEM_POOL}from"./data";
import type{DuelActor,DuelItemId,DuelResult,DuelState,Shell}from"./types";

export function seeded(seed:number){let value=seed>>>0;return()=>{value=(value*1664525+1013904223)>>>0;return value/4294967296;};}
const other=(actor:DuelActor):DuelActor=>actor==="player"?"dealer":"player";
const actorName=(actor:DuelActor)=>actor==="player"?"你":"庄家";
const withHistory=(state:DuelState,line:string)=>({...state,message:line,history:[line,...state.history].slice(0,5)});

function shuffle<T>(items:T[],random:()=>number){const result=[...items];for(let i=result.length-1;i>0;i-=1){const j=Math.floor(random()*(i+1));[result[i],result[j]]=[result[j],result[i]];}return result;}
function dealItems(round:number,random:()=>number){const count=Math.min(4,2+Math.floor(round/2));return Array.from({length:count},()=>ITEM_POOL[Math.floor(random()*ITEM_POOL.length)]);}

export function reloadChamber(state:DuelState,random:()=>number,increment=true):DuelState{
  const round=state.round+(increment?1:0);const size=round>=4?7:6;const chargeCount=Math.min(size-2,2+Math.floor(round/2));
  const chamber=shuffle<Shell>([...Array.from({length:chargeCount},()=>"charge"as const),...Array.from({length:size-chargeCount},()=>"dud"as const)],random);
  return withHistory({...state,round,chamber,playerItems:[...state.playerItems,...dealItems(round,random)].slice(-5),dealerItems:[...state.dealerItems,...dealItems(round,random)].slice(-5),known:{player:null,dealer:null}},`第 ${round} 轮装填：${chargeCount} 枚实能量，${size-chargeCount} 枚惰性能量`);
}

export function createDuel(random:()=>number):DuelState{
  const base:DuelState={phase:"playing",turn:"player",round:0,chamber:[],playerHp:5,dealerHp:5,maxHp:5,playerItems:[],dealerItems:[],known:{player:null,dealer:null},shields:{player:false,dealer:false},boosts:{player:false,dealer:false},skip:{player:false,dealer:false},actions:0,score:0,message:"",history:[]};
  return reloadChamber(base,random,true);
}

export function countShells(chamber:Shell[]){return{charge:chamber.filter(item=>item==="charge").length,dud:chamber.filter(item=>item==="dud").length};}

export function applyDuelItem(state:DuelState,actor:DuelActor,index:number,random:()=>number):DuelResult{
  if(state.phase!=="playing"||state.turn!==actor)return{state,event:"item"};
  const key=actor==="player"?"playerItems":"dealerItems";const items=[...state[key]];const item=items[index];if(!item)return{state,event:"item"};items.splice(index,1);const next:{state:DuelState;event:DuelResult["event"]}={state:{...state,[key]:items,actions:state.actions+1},event:"item"};const target=other(actor);
  if(item==="lens")next.state={...next.state,known:{...next.state.known,[actor]:state.chamber[0]??null}};
  if(item==="inverter"&&state.chamber.length){const chamber=[...state.chamber];chamber[0]=chamber[0]==="charge"?"dud":"charge";next.state={...next.state,chamber,known:{player:null,dealer:null}};}
  if(item==="shield")next.state={...next.state,shields:{...next.state.shields,[actor]:true}};
  if(item==="amplifier")next.state={...next.state,boosts:{...next.state.boosts,[actor]:true}};
  if(item==="cuffs")next.state={...next.state,skip:{...next.state.skip,[target]:true}};
  if(item==="salve")next.state={...next.state,[actor==="player"?"playerHp":"dealerHp"]:Math.min(state.maxHp,actor==="player"?state.playerHp+1:state.dealerHp+1)};
  if(item==="ejector"&&state.chamber.length){next.state={...next.state,chamber:state.chamber.slice(1),known:{player:null,dealer:null}};if(next.state.chamber.length===0){next.state=reloadChamber(next.state,random,true);next.event="reload";}}
  const names:Record<DuelItemId,string>={lens:"观星镜",inverter:"逆相器",shield:"折光盾",amplifier:"增幅栓",cuffs:"时停环",ejector:"退能杆",salve:"修复剂"};
  next.state=withHistory(next.state,`${actorName(actor)}使用了${names[item]}`);return next;
}

export function fireChamber(state:DuelState,actor:DuelActor,target:DuelActor,random:()=>number):DuelResult{
  if(state.phase!=="playing"||state.turn!==actor||state.chamber.length===0)return{state,event:"dud"};
  const shell=state.chamber[0],chamber=state.chamber.slice(1);let next:DuelState={...state,chamber,known:{player:null,dealer:null},actions:state.actions+1};let event:DuelResult["event"]=shell==="charge"?"charge":"dud";let line="";
  if(shell==="charge"){
    const damage=state.boosts[actor]?2:1;next={...next,boosts:{...next.boosts,[actor]:false}};
    if(state.shields[target]){next={...next,shields:{...next.shields,[target]:false}};event="block";line=`${actorName(actor)}释放实能量，但${actorName(target)}的折光盾挡住了冲击`;}
    else{const hpKey=target==="player"?"playerHp":"dealerHp";next={...next,[hpKey]:Math.max(0,next[hpKey]-damage)};line=`${actorName(actor)}向${target===actor?"自己":actorName(target)}释放实能量，造成 ${damage} 点伤害`;}
  }else line=`${actorName(actor)}释放的是惰性能量${target===actor?"，获得连续行动":""}`;
  let nextTurn:DuelActor=shell==="dud"&&target===actor?actor:other(actor);
  if(next.skip[nextTurn]){next={...next,skip:{...next.skip,[nextTurn]:false}};nextTurn=other(nextTurn);line+="，时停环令对手失去行动";}
  next={...next,turn:nextTurn,score:Math.max(0,next.dealerHp<state.dealerHp?state.score+450*(state.dealerHp-next.dealerHp):state.score)};
  if(next.playerHp<=0){next={...next,phase:"lost",score:Math.max(0,next.score)};line="你的生命刻度归零，庄家赢得了对局";}
  else if(next.dealerHp<=0){next={...next,phase:"won",score:next.score+next.playerHp*900+next.round*300};line="庄家的生命刻度归零，你赢得了命运对局";}
  next=withHistory(next,line);
  if(next.phase==="playing"&&next.chamber.length===0){next=reloadChamber(next,random,true);event="reload";}
  return{state:next,event};
}

export function chooseDealerAction(state:DuelState):{type:"item";index:number}|{type:"fire";target:DuelActor}{
  const items=state.dealerItems;const indexOf=(id:DuelItemId)=>items.indexOf(id);const known=state.known.dealer;
  if(state.dealerHp<=2&&indexOf("salve")>=0)return{type:"item",index:indexOf("salve")};
  if(!known&&indexOf("lens")>=0)return{type:"item",index:indexOf("lens")};
  if(known==="charge"&&indexOf("amplifier")>=0&&!state.boosts.dealer)return{type:"item",index:indexOf("amplifier")};
  if(known==="charge"&&indexOf("cuffs")>=0&&!state.skip.player)return{type:"item",index:indexOf("cuffs")};
  if(!state.shields.dealer&&indexOf("shield")>=0&&state.playerHp<=3)return{type:"item",index:indexOf("shield")};
  if(known==="dud")return{type:"fire",target:"dealer"};
  if(known==="charge")return{type:"fire",target:"player"};
  const counts=countShells(state.chamber);return{type:"fire",target:counts.charge>counts.dud?"player":"dealer"};
}
