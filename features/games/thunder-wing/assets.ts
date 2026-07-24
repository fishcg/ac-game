export const ASSET_ROOT = "/assets/kenney-space-shooter";

export const thunderAssets = {
  background: `${ASSET_ROOT}/darkPurple.png`,
  player: `${ASSET_ROOT}/playerShip1_blue.png`,
  wingmanLeft: `${ASSET_ROOT}/playerShip2_green.png`,
  wingmanRight: `${ASSET_ROOT}/playerShip3_orange.png`,
  playerLife: `${ASSET_ROOT}/playerLife1_blue.png`,
  enemyScout: `${ASSET_ROOT}/enemyRed1.png`,
  enemyZigzag: `${ASSET_ROOT}/enemyBlack2.png`,
  enemyTank: `${ASSET_ROOT}/enemyBlue3.png`,
  bossScarlet: `${ASSET_ROOT}/ufoRed.png`,
  bossAzure: `${ASSET_ROOT}/ufoBlue.png`,
  bossVerdant: `${ASSET_ROOT}/ufoGreen.png`,
  playerLaser: `${ASSET_ROOT}/laserBlue01.png`,
  enemyLaser: `${ASSET_ROOT}/laserRed01.png`,
  firePowerup: `${ASSET_ROOT}/powerupRed_bolt.png`,
  shieldPowerup: `${ASSET_ROOT}/powerupBlue_shield.png`,
  wingmanPowerup: `${ASSET_ROOT}/powerupGreen_star.png`,
  shield: `${ASSET_ROOT}/shield1.png`,
  meteor: `${ASSET_ROOT}/meteorGrey_big2.png`,
  flame: `${ASSET_ROOT}/fire08.png`,
} as const;

export type ThunderAsset = keyof typeof thunderAssets;
export type ThunderImages = Record<ThunderAsset, HTMLImageElement>;

let imagePromise: Promise<ThunderImages> | null = null;

export function loadThunderImages() {
  if (imagePromise) return imagePromise;
  imagePromise = Promise.all(
    Object.entries(thunderAssets).map(([key, path]) => new Promise<[ThunderAsset, HTMLImageElement]>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve([key as ThunderAsset, image]);
      image.onerror = () => reject(new Error(`无法加载游戏素材：${path}`));
      image.src = path;
    })),
  ).then((entries) => Object.fromEntries(entries) as ThunderImages);
  return imagePromise;
}
