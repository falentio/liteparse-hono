import typescript from "@rollup/plugin-typescript";
import nodeResolve from "@rollup/plugin-node-resolve";
import dts from "rollup-plugin-dts";

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
      nodeResolve(),
      typescript({
        tsconfig: "./tsconfig.json",
        compilerOptions: {
          noEmit: false,
          declaration: false,
          declarationDir: undefined,
        },
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
