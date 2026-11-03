// ONE place to make the kit yours. Change these values and every component
// (title, card, number, sticker, captions, end card, mascot) re-skins itself.
import type { FontName } from "./fonts";

export type Brand = {
  colors: {
    bg: string; // video background
    surface: string; // cards and caption strip
    text: string; // main text
    accent: string; // highlights, big numbers, active caption word, mascot body
    accent2: string; // stickers and small details
  };
  font: FontName; // see src/fonts.ts
  radius: number; // corner roundness in px (0 = sharp)
  shadow: boolean; // soft drop shadow under cards
  handle: string; // shown above the title and on the end card
};

export const brand: Brand = {
  colors: {
    bg: "#F5F5F2",
    surface: "#FFFFFF",
    text: "#14161A",
    accent: "#2B6CF6",
    accent2: "#12B886",
  },
  font: "Inter",
  radius: 32,
  shadow: true,
  handle: "@yourhandle",
};
