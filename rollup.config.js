import json from "@rollup/plugin-json";
import builtins from "builtin-modules";
import { babel } from "@rollup/plugin-babel";
import commonjs from "@rollup/plugin-commonjs";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import typescript from "rollup-plugin-typescript2";

const extensions = [".js", ".jsx", ".ts", ".tsx"];

export default {
  input: "./src/index.ts",
  output: {
    format: "cjs",
    dir: "dist",
    sourcemap: true,
    exports: "named",
  },
  plugins: [
    typescript({
      typescript: require("typescript"),
      // objectHashIgnoreUnknownHack: true,
      tsconfigDefaults: {
        sourceMap: true,
      },
    }),
    nodeResolve({
      preferBuiltins: true,
      // skip: ["aws-sdk", "pg", "pg-native"],
    }),
    commonjs(),
    babel({
      extensions,
      exclude: "node_modules/**",
    }),
    json(),
  ],
  external: ["aws-sdk", "pg",  ...builtins],
};
