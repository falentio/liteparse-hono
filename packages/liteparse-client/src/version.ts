declare const PKG_VERSION: string;
export const VERSION: string =
  typeof PKG_VERSION !== "undefined" ? PKG_VERSION : "0.0.0-dev";
