import type { NightfallSprite } from "./assets";
import type { BossVariant, EnemyKind, StageId } from "./types";

export const STAGE_DURATION = 300;
export const STAGE_BOSS_AT = 270;

export type StoryLine = { speaker: string; text: string };
export type StoryScene = { eyebrow: string; title: string; lines: StoryLine[] };
export type StageTransitionInfo = {
  from: { id: StageId; chapter: string; name: string; subtitle: string; accent: string; base: string };
  to: { id: StageId; chapter: string; name: string; subtitle: string; accent: string; base: string };
};

export type StageDefinition = {
  id: StageId;
  chapter: string;
  name: string;
  subtitle: string;
  boss: BossVariant;
  bossName: string;
  bossTitle: string;
  bossSprite: NightfallSprite;
  palette: { base: string; grid: string; accent: string; vignette: string };
  pool: Array<Exclude<EnemyKind, "boss">>;
  latePool: Array<Exclude<EnemyKind, "boss">>;
  intro: StoryScene;
  bossScene: StoryScene;
  clearScene: StoryScene;
  battleScenes?: Array<{ threshold: number; scene: StoryScene }>;
};

export const STAGES: StageDefinition[] = [
  {
    id: "desert", chapter: "第一幕", name: "烬沙荒漠", subtitle: "被太阳遗忘的王魂坟场",
    boss: "sand", bossName: "赫沙", bossTitle: "沙暴执政官", bossSprite: "bossDesert",
    palette: { base: "#a96845", grid: "#d9a26738", accent: "#f7c86a", vignette: "#3c1d28" },
    pool: ["shade", "shade", "wolf", "spider"], latePool: ["wolf", "brute", "cultist", "spider"],
    intro: { eyebrow: "PROLOGUE", title: "五枚熄灭的界碑", lines: [
      { speaker: "旁白", text: "永夜历一百三十七年，镇压魔王阿斯莫德的五枚界碑，在同一夜失去了光。" },
      { speaker: "引路人·伊芙", text: "魔王尚未苏醒。他的五名执政官正带着王魂碎片逃向封印之地。" },
      { speaker: "引路人·伊芙", text: "第一枚碎片就在烬沙荒漠。追上赫沙，别让风暴埋掉最后的路。" },
    ] },
    bossScene: { eyebrow: "FINAL ENCOUNTER", title: "沙暴吞没天际", lines: [
      { speaker: "沙暴执政官·赫沙", text: "凡人的脚印，活不过一场风。你会和旧王朝一起埋在这里。" },
      { speaker: "幸存者", text: "那就让你的风暴，替我吹开前往下一枚碎片的路。" },
    ] },
    clearScene: { eyebrow: "SOUL SHARD I", title: "沙海止息", lines: [
      { speaker: "赫沙", text: "这个步法……和他当年一模一样。维萝若看见，也会明白。" },
      { speaker: "引路人·伊芙", text: "他的护腕内侧刻着一枚被磨损的太阳徽记。王国史里没有这种军徽。" },
    ] },
  },
  {
    id: "forest", chapter: "第二幕", name: "翡翠迷林", subtitle: "会吞噬旅人的古老森林",
    boss: "forest", bossName: "维萝", bossTitle: "荆棘女巫", bossSprite: "bossForest",
    palette: { base: "#31583f", grid: "#77a65a30", accent: "#8fe36f", vignette: "#10251d" },
    pool: ["wolf", "spider", "spider", "slime"], latePool: ["spider", "slime", "cultist", "wraith"],
    intro: { eyebrow: "CHAPTER II", title: "森林不再歌唱", lines: [
      { speaker: "引路人·伊芙", text: "维萝曾是守护界碑的祭司。她把森林的生命献给魔王，换来永不凋零的躯壳。" },
      { speaker: "幸存者", text: "不凋零，不代表还活着。" },
    ] },
    bossScene: { eyebrow: "FINAL ENCOUNTER", title: "万根归于一心", lines: [
      { speaker: "荆棘女巫·维萝", text: "听啊，每一片叶子都在呼唤新王。成为森林的养分吧。" },
      { speaker: "幸存者", text: "我听见的，只有被你困住的灵魂。" },
    ] },
    clearScene: { eyebrow: "SOUL SHARD II", title: "晨光穿过树冠", lines: [
      { speaker: "维萝", text: "我们六人曾在这棵树下发誓。如今，只剩五个人还记得誓言。" },
      { speaker: "引路人·伊芙", text: "树干上确有六个名字，可最中间那个被人刻意刮去了。去火山，卡戎也许知道更多。" },
    ] },
  },
  {
    id: "volcano", chapter: "第三幕", name: "赤冠火山", subtitle: "魔王军锻造兵器的熔炉",
    boss: "volcano", bossName: "卡戎", bossTitle: "炼狱将军", bossSprite: "bossVolcano",
    palette: { base: "#41272b", grid: "#b947383d", accent: "#ff7045", vignette: "#180c14" },
    pool: ["brute", "cultist", "slime", "demon"], latePool: ["cultist", "demon", "demon", "wraith"],
    intro: { eyebrow: "CHAPTER III", title: "群山流下火焰", lines: [
      { speaker: "引路人·伊芙", text: "卡戎正在用王魂碎片唤醒地下熔炉。再晚一步，魔王军就会拥有烧穿城墙的兵器。" },
      { speaker: "幸存者", text: "那就把将军和他的兵器，一起留在炉里。" },
    ] },
    bossScene: { eyebrow: "FINAL ENCOUNTER", title: "炼狱军旗升起", lines: [
      { speaker: "炼狱将军·卡戎", text: "我征服过十二座城。你只是第十三堆灰。" },
      { speaker: "幸存者", text: "记住这个数字。它是你败过的第一场。" },
    ] },
    clearScene: { eyebrow: "SOUL SHARD III", title: "熔炉沉寂", lines: [
      { speaker: "卡戎", text: "他救过我们每一个人。可当人们把头冠递给他时，我们谁也没能拉住他。" },
      { speaker: "引路人·伊芙", text: "旧壁画上，五名随从围着一位无脸的持剑者。那人的脸也被火熔去了。" },
    ] },
  },
  {
    id: "ice", chapter: "第四幕", name: "霜寂冰原", subtitle: "时间凝固在最后一场雪",
    boss: "ice", bossName: "乌尔", bossTitle: "霜冠巨人", bossSprite: "bossIce",
    palette: { base: "#496f83", grid: "#a9deed45", accent: "#b7f3ff", vignette: "#102431" },
    pool: ["slime", "wraith", "wolf", "brute"], latePool: ["wraith", "knight", "brute", "demon"],
    intro: { eyebrow: "CHAPTER IV", title: "冻结的远征军", lines: [
      { speaker: "引路人·伊芙", text: "三十年前，乌尔把整支王国远征军冻成冰雕。那些士兵至今仍站在风雪里。" },
      { speaker: "幸存者", text: "等我取回碎片，他们会重新看见春天。" },
    ] },
    bossScene: { eyebrow: "FINAL ENCOUNTER", title: "霜冠俯视众生", lines: [
      { speaker: "霜冠巨人·乌尔", text: "火会熄灭，钢会折断，只有寒冬永恒。" },
      { speaker: "幸存者", text: "永恒，也会在黎明到来时结束。" },
    ] },
    clearScene: { eyebrow: "SOUL SHARD IV", title: "冰层出现裂痕", lines: [
      { speaker: "乌尔", text: "我们不是王的将军。我们只是没能陪勇者走到最后的……旧友。" },
      { speaker: "引路人·伊芙", text: "史书称上一任勇者独自归来，却从未记载同行者。暮钟镇保存着最早的远征名册。" },
    ] },
  },
  {
    id: "town", chapter: "第五幕", name: "暮钟小镇", subtitle: "黎明前最后一盏灯",
    boss: "town", bossName: "莱恩", bossTitle: "堕誓骑士", bossSprite: "bossTown",
    palette: { base: "#59606c", grid: "#c6c8ca30", accent: "#f2c879", vignette: "#20202d" },
    pool: ["cultist", "knight", "shade", "wraith"], latePool: ["knight", "knight", "demon", "wraith"],
    intro: { eyebrow: "CHAPTER V", title: "没有钟声的城镇", lines: [
      { speaker: "引路人·伊芙", text: "莱恩曾发誓守住暮钟镇。他接受王魂碎片，只因魔王承诺让死去的居民回来。" },
      { speaker: "幸存者", text: "被永夜叫醒的，不会再是他们。" },
    ] },
    bossScene: { eyebrow: "FINAL ENCOUNTER", title: "誓言只剩回声", lines: [
      { speaker: "堕誓骑士·莱恩", text: "再等一夜，他们就会回家。你为什么偏要夺走这点希望？" },
      { speaker: "幸存者", text: "因为真正的他们，绝不会要你用整座世界陪葬。" },
    ] },
    clearScene: { eyebrow: "SOUL SHARD V", title: "暮钟再次响起", lines: [
      { speaker: "莱恩", text: "名册最后一行不是阿斯莫德。那是他戴上头冠之后，世人给他的名字。" },
      { speaker: "引路人·伊芙", text: "五枚碎片映出同一个人影：上一任勇者。可他的真名仍被头冠遮住了。" },
    ] },
  },
  {
    id: "throne", chapter: "终幕", name: "永夜王座", subtitle: "所有道路在此迎来终点",
    boss: "demonKing", bossName: "阿斯莫德", bossTitle: "永夜魔王", bossSprite: "bossKing",
    palette: { base: "#21162d", grid: "#7d4a9c32", accent: "#e06cff", vignette: "#090710" },
    pool: ["demon", "wraith", "knight", "cultist"], latePool: ["demon", "demon", "knight", "wraith"],
    intro: { eyebrow: "FINAL CHAPTER", title: "魔王现世", lines: [
      { speaker: "永夜魔王·阿斯莫德", text: "赫沙、维萝、卡戎、乌尔、莱恩……你带回了他们最后的记忆。" },
      { speaker: "引路人·伊芙", text: "五个人正是旧壁画里的远征者。王座上的第六个人……就是上一任勇者。" },
      { speaker: "幸存者", text: "你曾经救过这个世界。为什么最后要成为它的魔王？" },
      { speaker: "永夜魔王·阿斯莫德", text: "来取下我的头冠。等你足够接近答案，我会告诉你。" },
    ] },
    bossScene: { eyebrow: "THE LAST NIGHT", title: "王座降临人间", lines: [
      { speaker: "永夜魔王·阿斯莫德", text: "我也曾站在你的位置，说过一模一样的话。" },
      { speaker: "幸存者", text: "那我就走到你没能走完的地方。" },
    ] },
    battleScenes: [
      { threshold: .72, scene: { eyebrow: "THE FORGOTTEN HERO", title: "被抹去的第六个名字", lines: [
        { speaker: "阿斯莫德", text: "旧魔王死后，诅咒并未消失。它需要一颗足够强大的灵魂，替世界承受永夜。" },
        { speaker: "幸存者", text: "所以他们把头冠交给了凯旋的勇者。" },
        { speaker: "阿斯莫德", text: "不。是我亲手戴上的。因为那时的我，也相信自己能够驾驭它。" },
      ] } },
      { threshold: .42, scene: { eyebrow: "FIVE OLD FRIENDS", title: "五枚碎片的真相", lines: [
        { speaker: "阿斯莫德", text: "五枚所谓王魂，是赫沙他们替我保管的人性。你杀死了他们，也替我解脱了最后的牵挂。" },
        { speaker: "幸存者", text: "他们明知会死，仍把我引到这里。不是为了让你复活，是为了让我终结你。" },
        { speaker: "阿斯莫德", text: "也许。他们总是比我更相信下一位勇者。" },
      ] } },
      { threshold: .14, scene: { eyebrow: "THE CROWN WAITS", title: "王座只允许一个答案", lines: [
        { speaker: "阿斯莫德", text: "杀了我，永夜会短暂退去。但诅咒将选择现场最强的灵魂。现在，你知道头冠为何一直空着了。" },
        { speaker: "幸存者", text: "我不会成为你。" },
        { speaker: "阿斯莫德", text: "我当年，也这样回答。" },
      ] } },
    ],
    clearScene: { eyebrow: "A NEW NIGHT", title: "头冠选择了新的主人", lines: [
      { speaker: "阿斯莫德", text: "终于……我又看见他们站在篝火旁。轮到你守住这漫长的一夜了，勇者。" },
      { speaker: "引路人·伊芙", text: "别碰那顶头冠！封印正在寻找新的承载者——" },
      { speaker: "旁白", text: "魔王倒下，第一束晨光越过王座。幸存者伸手摘下头冠，却在触碰的一瞬听见了千万人的噩梦。" },
      { speaker: "幸存者", text: "如果必须有人承受永夜……至少，让他们先看见黎明。" },
      { speaker: "旁白", text: "暮钟响了六次。世人欢呼魔王已死，却无人看见王座上重新睁开的眼睛。新的魔王，诞生了。" },
    ] },
  },
];

export function stageAt(index: number) { return STAGES[Math.max(0, Math.min(STAGES.length - 1, index))]; }

export function combineScenes(first: StoryScene, second: StoryScene): StoryScene {
  return { eyebrow: second.eyebrow, title: `${first.title} · ${second.title}`, lines: [...first.lines, ...second.lines] };
}
