import { constants, copyFileSync, readFileSync, writeFileSync } from "fs";
import { createRequire } from "module";
import { dirname, join } from "path";
import { replaceGetEffectiveCallArguments } from "./effective-call-arguments";
import { insertImportModule } from "./import-module";
import { replaceCreateLanguageService } from "./language-service";

const require = createRequire(import.meta.url);
const tsdkDir = dirname(require.resolve("typescript"));

for (const name of ["tsc.js", "tsserver.js", "typescript.js"]) {
  const src = join(tsdkDir, name);
  const dest = `${src}_`;

  try {
    copyFileSync(src, dest, constants.COPYFILE_EXCL);
  } catch {}

  const code = replaceGetEffectiveCallArguments(
    replaceCreateLanguageService(insertImportModule(readFileSync(dest, "utf8")))
  );

  writeFileSync(src, code);
}
