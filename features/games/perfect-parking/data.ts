import type { ParkingStage } from "./types";

export const PARKING_STAGES: ParkingStage[] = [
  { name: "街角练习", hint: "宽车位 · 干燥路面", surface: "dry", vehicle: "compact", carLength: 68, bayStart: 704, bayWidth: 164, acceleration: 112, braking: 250, maxSpeed: 176, slope: 0, theme: "morning" },
  { name: "花店门前", hint: "车位稍窄，提前松开", surface: "dry", vehicle: "sedan", carLength: 74, bayStart: 688, bayWidth: 148, acceleration: 116, braking: 246, maxSpeed: 182, slope: 0, theme: "day" },
  { name: "雨后车站", hint: "湿地制动距离更长", surface: "wet", vehicle: "compact", carLength: 68, bayStart: 726, bayWidth: 142, acceleration: 118, braking: 198, maxSpeed: 184, slope: 0, theme: "day" },
  { name: "缓坡书店", hint: "下坡会推动车辆", surface: "dry", vehicle: "sedan", carLength: 75, bayStart: 692, bayWidth: 137, acceleration: 115, braking: 232, maxSpeed: 185, slope: 18, theme: "sunset" },
  { name: "夜市小巷", hint: "看清反光停车线", surface: "wet", vehicle: "van", carLength: 82, bayStart: 713, bayWidth: 145, acceleration: 104, braking: 190, maxSpeed: 174, slope: 4, theme: "night" },
  { name: "海边公路", hint: "短车位 · 高速接近", surface: "dry", vehicle: "compact", carLength: 69, bayStart: 735, bayWidth: 124, acceleration: 126, braking: 238, maxSpeed: 198, slope: 0, theme: "sunset" },
  { name: "清晨薄冰", hint: "冰面需要更早制动", surface: "ice", vehicle: "compact", carLength: 69, bayStart: 690, bayWidth: 128, acceleration: 108, braking: 150, maxSpeed: 180, slope: 0, theme: "morning" },
  { name: "山城下坡", hint: "长车身与下坡组合", surface: "dry", vehicle: "van", carLength: 84, bayStart: 718, bayWidth: 137, acceleration: 105, braking: 218, maxSpeed: 180, slope: 24, theme: "day" },
  { name: "霓虹雨夜", hint: "湿滑窄位，稳住节奏", surface: "wet", vehicle: "sedan", carLength: 76, bayStart: 704, bayWidth: 121, acceleration: 122, braking: 184, maxSpeed: 192, slope: 8, theme: "night" },
  { name: "金牌车位", hint: "最终挑战 · 几乎没有余量", surface: "dry", vehicle: "sedan", carLength: 76, bayStart: 726, bayWidth: 108, acceleration: 124, braking: 225, maxSpeed: 196, slope: 12, theme: "sunset" },
];

export const PARKING_ROUND_SECONDS = 30;
