import json from "@rollup/plugin-json";
import builtins from "builtin-modules";
import babel from "rollup-plugin-babel";
import commonjs from "rollup-plugin-commonjs";
import resolve from "rollup-plugin-node-resolve";
import typescript from "rollup-plugin-typescript2";

const extensions = [".js", ".jsx", ".ts", ".tsx"];

export default {
  input: "./src/index.ts",
  output: {
	format: "cjs",
	dir:"dist",
    sourcemap: true
  },
  plugins: [
    typescript({
      typescript: require("typescript"),
      objectHashIgnoreUnknownHack: true,
      tsconfigDefaults: {
        sourceMap: true
      }
    }),
    resolve({
      preferBuiltins: true
    }),
    commonjs(),
    babel({
      extensions,
      exclude: "node_modules/**"
    }),
    json()
  ],
  external: ["aws-sdk", ...builtins]
};
