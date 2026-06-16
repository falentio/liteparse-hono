import { readFileSync } from "node:fs";
import typescript from "@rollup/plugin-typescript";
import nodeResolve from "@rollup/plugin-node-resolve";
import replace from "@rollup/plugin-replace";
import dts from "rollup-plugin-dts";

const pkg = JSON.parse(readFileSync("./package.json", "utf-8"));

const entries = [
  { input: "src/index.ts", file: "index.js" },
  { input: "src/node.ts", file: "node.js" },
  { input: "src/test-utils.ts", file: "test-utils.js" },
];

export default entries.flatMap((entry) => [
  {
    input: entry.input,
    output: {
      file: `dist/${entry.file}`,
      format: "esm",
      sourcemap: true,
    },
    plugins: [
      replace({
        PKG_VERSION: JSON.stringify(pkg.version),
        preventAssignment: true,
      }),
      nodeResolve(),
      typescript({
        tsconfig: "./tsconfig.json",
      }),
    ],
  },
  {
    input: entry.input,
    output: {
      file: `dist/${entry.file.replace(".js", ".d.ts")}`,
      format: "esm",
    },
    plugins: [dts()],
  },
]);
