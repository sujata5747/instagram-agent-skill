import React, { createContext, useContext } from "react";
import { brand as defaultBrand, type Brand } from "./brand";
import { FONTS } from "./fonts";

const BrandContext = createContext<Brand>(defaultBrand);

export const BrandProvider: React.FC<{ brand: Brand; children: React.ReactNode }> = ({ brand, children }) => (
  <BrandContext.Provider value={brand}>{children}</BrandContext.Provider>
);

/** Current brand + ready-to-use helpers for components. */
export const useBrand = () => {
  const b = useContext(BrandContext);
  return {
    ...b,
    fontFamily: FONTS[b.font],
    boxShadow: b.shadow ? "0 24px 60px rgba(0, 0, 0, 0.16), 0 4px 12px rgba(0, 0, 0, 0.08)" : "none",
  };
};
