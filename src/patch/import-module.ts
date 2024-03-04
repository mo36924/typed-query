import { buildSync } from "esbuild";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const result = buildSync({
  entryPoints: [join(dirname(fileURLToPath(import.meta.url)), "module")],
  platform: "node",
  bundle: true,
  write: false,
  format: "cjs",
});

const builtCode = result.outputFiles[0].text.replace(".NoUndefinedVariablesRule = ", "$&()=>({});");

const importModule = `
var __mod = (() => {
  var module={exports:{}};
  ${builtCode};
  return module.exports
})();
`;

export const insertImportModule = (code: string) => code.replace('"use strict";', (match) => match + importModule);
