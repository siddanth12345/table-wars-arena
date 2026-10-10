/** Shared mobile touch state read by World each frame. */

export const MOB = {
  active: false,
  moveX: 0,
  moveY: 0,
  lookDX: 0,
  lookDY: 0,
  fire: false,
  fireTap: false,
  fireDouble: false,
  jumpTap: false,
  jumpDouble: false,
  dashTap: false,
  reloadTap: false,
  parryTap: false,
  bombTap: false,
};

export function consumeTaps() {
  MOB.fireTap = false;
  MOB.fireDouble = false;
  MOB.jumpTap = false;
  MOB.jumpDouble = false;
  MOB.dashTap = false;
  MOB.reloadTap = false;
  MOB.parryTap = false;
  MOB.bombTap = false;
  MOB.lookDX = 0;
  MOB.lookDY = 0;
}

export function isTouchDevice() {
  if (typeof window === "undefined") return false;
  return (
    "ontouchstart" in window ||
    navigator.maxTouchPoints > 0 ||
    window.matchMedia("(pointer: coarse)").matches
  );
}
