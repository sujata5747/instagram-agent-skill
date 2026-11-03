// Three neutral looks. Copy one into src/brand.ts as a starting point,
// or render a preset directly: npx remotion render Demo-BoldDark
import type { Brand } from "./brand";

export const cleanLight: Brand = {
  colors: { bg: "#F5F5F2", surface: "#FFFFFF", text: "#14161A", accent: "#2B6CF6", accent2: "#12B886" },
  font: "Inter",
  radius: 32,
  shadow: true,
  handle: "@yourhandle",
};

export const boldDark: Brand = {
  colors: { bg: "#0D0F14", surface: "#1B1F29", text: "#F4F5F7", accent: "#F5C518", accent2: "#38D6E8" },
  font: "SpaceGrotesk",
  radius: 12,
  shadow: false,
  handle: "@yourhandle",
};

export const softPastel: Brand = {
  colors: { bg: "#FBF3EC", surface: "#FFFFFF", text: "#2A2433", accent: "#E8590C", accent2: "#7C5CFC" },
  font: "Nunito",
  radius: 44,
  shadow: true,
  handle: "@yourhandle",
};

export const PRESETS = { cleanLight, boldDark, softPastel };
