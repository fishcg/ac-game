import type{DuelItem,DuelItemId}from"./types";
export const DUEL_ITEMS:Record<DuelItemId,DuelItem>={
  lens:{id:"lens",name:"观星镜",icon:"◉",description:"查看当前弹仓的下一枚能量。"},
  inverter:{id:"inverter",name:"逆相器",icon:"⇄",description:"实能量与惰性能量相互转换。"},
  shield:{id:"shield",name:"折光盾",icon:"⬡",description:"抵挡下一次实能量伤害。"},
  amplifier:{id:"amplifier",name:"增幅栓",icon:"⚡",description:"下一枚实能量造成双倍伤害。"},
  cuffs:{id:"cuffs",name:"时停环",icon:"∞",description:"让对手跳过下一次行动。"},
  ejector:{id:"ejector",name:"退能杆",icon:"↗",description:"安全弹出当前能量，但不揭示类型。"},
  salve:{id:"salve",name:"修复剂",icon:"＋",description:"恢复 1 点生命，不能超过上限。"},
};
export const ITEM_POOL=Object.keys(DUEL_ITEMS)as DuelItemId[];
