export type WormVisualAssets = {
  fire: HTMLImageElement | null;
  smoke: HTMLImageElement | null;
  dirt: HTMLImageElement | null;
  spark: HTMLImageElement | null;
};

const SOURCES = {
  fire: "/assets/kenney-particle-pack/PNG/fire_01.png",
  smoke: "/assets/kenney-particle-pack/PNG/smoke_04.png",
  dirt: "/assets/kenney-particle-pack/PNG/dirt_02.png",
  spark: "/assets/kenney-particle-pack/PNG/spark_03.png",
} as const;

export function createWormVisualAssets(onReady:()=>void):WormVisualAssets {
  const assets:WormVisualAssets={fire:null,smoke:null,dirt:null,spark:null};
  (Object.keys(SOURCES) as Array<keyof typeof SOURCES>).forEach((key)=>{
    const image=new Image();
    image.onload=()=>{assets[key]=image;onReady();};
    image.onerror=()=>onReady();
    image.src=SOURCES[key];
  });
  return assets;
}
