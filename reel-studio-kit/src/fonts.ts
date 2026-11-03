// Google fonts, loaded once. Remotion waits for them before it renders a frame
// (needs internet the first time). Want another font? Import it the same way from
// "@remotion/google-fonts/<FontName>" (list: https://www.remotion.dev/docs/google-fonts)
// and add it to FONTS.
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadNunito } from "@remotion/google-fonts/Nunito";
import { loadFont as loadSpaceGrotesk } from "@remotion/google-fonts/SpaceGrotesk";

export const FONTS = {
  Inter: loadInter("normal", { weights: ["400", "600", "800"], subsets: ["latin"] }).fontFamily,
  SpaceGrotesk: loadSpaceGrotesk("normal", { weights: ["400", "600", "700"], subsets: ["latin"] }).fontFamily,
  Nunito: loadNunito("normal", { weights: ["400", "600", "800"], subsets: ["latin"] }).fontFamily,
};

export type FontName = keyof typeof FONTS;
