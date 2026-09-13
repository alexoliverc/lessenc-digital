import { parseP08CommercialEnv, parseServerEnv } from "./env-schema";

export const serverEnv = parseServerEnv(process.env);

export function getP08CommercialEnv() {
  if (typeof window !== "undefined") {
    throw new Error("P08 commercial configuration is server-only");
  }

  return parseP08CommercialEnv({
    P08_PRODUCT_ID: process.env.P08_PRODUCT_ID,
    P08_OFFER_ID: process.env.P08_OFFER_ID,
  });
}
