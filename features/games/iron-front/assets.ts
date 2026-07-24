export const IRON_ASSET_ROOT = "/assets/iron-front";

export const ironAssets = {
  city: `${IRON_ASSET_ROOT}/complete2.png`,
  clouds: `${IRON_ASSET_ROOT}/cloud_back.png`,
  tiles: `${IRON_ASSET_ROOT}/outside.png`,
  playerPistol: `${IRON_ASSET_ROOT}/pistol.png`,
  playerShotgun: `${IRON_ASSET_ROOT}/shotgun.png`,
  enemySoldier: `${IRON_ASSET_ROOT}/soldier_recolor2.png`,
  enemyGunner: `${IRON_ASSET_ROOT}/soldier2_recolor3.png`,
  enemyDog: `${IRON_ASSET_ROOT}/dog_recolor1.png`,
  tank: `${IRON_ASSET_ROOT}/tank2.png`,
  car: `${IRON_ASSET_ROOT}/car2.png`,
  explosion: `${IRON_ASSET_ROOT}/Explosion.png`,
  flag: `${IRON_ASSET_ROOT}/flag.png`,
  chest: `${IRON_ASSET_ROOT}/Chest.png`,
  door: `${IRON_ASSET_ROOT}/door.png`,
  bullet: `${IRON_ASSET_ROOT}/bullet1.png`,
  grenade: `${IRON_ASSET_ROOT}/Bomb.png`,
  face: `${IRON_ASSET_ROOT}/face1.png`,
  hp: `${IRON_ASSET_ROOT}/hp.png`,
} as const;

export type IronAsset = keyof typeof ironAssets;
export type IronImages = Record<IronAsset, HTMLImageElement>;

let imagePromise: Promise<IronImages> | null = null;

export function loadIronImages() {
  if (imagePromise) return imagePromise;
  imagePromise = Promise.all(Object.entries(ironAssets).map(([key, path]) => new Promise<[IronAsset, HTMLImageElement]>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve([key as IronAsset, image]);
    image.onerror = () => reject(new Error(`无法加载游戏素材：${path}`));
    image.src = path;
  }))).then((entries) => Object.fromEntries(entries) as IronImages);
  return imagePromise;
}
