#!/usr/bin/env ts-node

// /**
//  * tools/rename-project.ts (updated)
//  *
//  * Usage:
//  *   npx ts-node tools/rename-project.ts --map tools/rename-map.json --src "src/**/*.{ts,tsx,js,jsx,json}" --backupDir rename-backups
//  *
//  * Key changes:
//  *  - safer ts-morph usage: only renames interface property signatures via .rename()
//  *  - removed brittle calls that caused TypeScript errors
//  *  - improved error handling
//  */

import { Project } from "ts-morph";
import * as fs from "fs-extra";
import * as path from "path";
import * as glob from "glob";
import { Command } from "commander";

const program = new Command();
program
  .option("--map <path>", "rename map JSON", "tools/rename-map.json")
  .option(
    "--src <glob>",
    "glob for files to process (ts/js/json)",
    "src/**/*.{ts,tsx,js,jsx,json}",
  )
  .option("--backupDir <dir>", "backup directory", "rename-backups")
  .option("--dryRun", "don't write files, only show summary", false)
  .parse(process.argv);

const opts = program.opts();

async function loadRenameMap(mapPath: string) {
  if (!(await fs.pathExists(mapPath))) {
    throw new Error(`rename map not found: ${mapPath}`);
  }
  const content = await fs.readFile(mapPath, "utf8");
  const parsed = JSON.parse(content);
  // expected shape: { "oldKey": "newKey", ... }
  return parsed as Record<string, string>;
}

function makeTimestamp() {
  const dt = new Date().toISOString().replace(/[:.]/g, "-");
  return dt;
}

function escapeRegexLiteral(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Do several targeted regex transforms to replace property names */
function transformText(content: string, renameMap: Record<string, string>) {
  let text = content;

  // Order: object keys, bracket access, property access with dot
  for (const [oldKey, newKey] of Object.entries(renameMap)) {
    const oldEsc = escapeRegexLiteral(oldKey);

    // 1) object literal key: "oldKey":   or 'oldKey':
    const objKeyDouble = new RegExp(`"${oldEsc}"\\s*:`, "g");
    const objKeySingle = new RegExp(`'${oldEsc}'\\s*:`, "g");
    text = text.replace(objKeyDouble, `"${newKey}":`);
    text = text.replace(objKeySingle, `'${newKey}':`);

    // 2) bracket access: obj['oldKey'] or obj["oldKey"]
    const bracketSingle = new RegExp(`\\['${oldEsc}'\\]`, "g");
    const bracketDouble = new RegExp(`\\["${oldEsc}"\\]`, "g");
    text = text.replace(bracketSingle, `['${newKey}']`);
    text = text.replace(bracketDouble, `["${newKey}"]`);

    // 3) property access with dot: .oldKey  (ensure not to match longer identifiers)
    const dotProp = new RegExp(`\\.${oldEsc}(?![\\w$])`, "g");
    text = text.replace(dotProp, `.${newKey}`);

    // 4) shorthand property in object literal: { oldKey, }
    // Replace occurrences where oldKey is followed by comma or closing brace on same line.
    const shorthandRegex = new RegExp(`\\b${oldEsc}\\b(?=\\s*[,}\\]])`, "g");
    text = text.replace(shorthandRegex, newKey);
  }

  return text;
}

async function backupFile(originalPath: string, backupRoot: string) {
  const rel = path.relative(process.cwd(), originalPath);
  const dest = path.join(backupRoot, rel);
  await fs.ensureDir(path.dirname(dest));
  await fs.copyFile(originalPath, dest);
  return dest;
}

async function main() {
  const renameMap = await loadRenameMap(opts.map);
  const timestamp = makeTimestamp();
  const backupRoot = path.join(opts.backupDir, timestamp);
  const srcGlob = opts.src;

  const files = glob.sync(srcGlob, { nodir: true, absolute: true });
  console.log(`Found ${files.length} files to scan using glob: ${srcGlob}`);

  const summary: { file: string; changed: boolean; backup?: string }[] = [];

  for (const filePath of files) {
    try {
      const original = await fs.readFile(filePath, "utf8");
      const transformed = transformText(original, renameMap);

      if (transformed === original) {
        summary.push({ file: filePath, changed: false });
        continue;
      }

      // backup
      const backupPath = await backupFile(filePath, backupRoot);

      if (opts.dryRun) {
        console.log(
          `[dryRun] would modify: ${filePath} (backup at ${backupPath})`,
        );
        summary.push({ file: filePath, changed: true, backup: backupPath });
        continue;
      }

      // write new content
      await fs.writeFile(filePath, transformed, "utf8");
      summary.push({ file: filePath, changed: true, backup: backupPath });
      console.log(`Updated: ${filePath} — backup: ${backupPath}`);
    } catch (err) {
      console.error(
        `Error processing ${filePath}:`,
        (err as any).message ?? err,
      );
    }
  }

  // TS-morph pass: safely rename interface property signatures only.
  try {
    const tsProject = new Project({
      tsConfigFilePath: fs.existsSync("tsconfig.json")
        ? "tsconfig.json"
        : undefined,
      skipAddingFilesFromTsConfig: true,
    });

    const tsFiles = files.filter((f) => /\.(ts|tsx)$/.test(f));
    if (tsFiles.length) {
      tsProject.addSourceFilesAtPaths(tsFiles);
      const sourceFiles = tsProject.getSourceFiles();

      for (const src of sourceFiles) {
        let changed = false;

        // Rename properties in interface declarations
        const interfaces = src.getInterfaces();
        for (const iface of interfaces) {
          const props = iface.getProperties();
          for (const prop of props) {
            const name = prop.getName();
            if (renameMap[name]) {
              try {
                prop.rename(renameMap[name]);
                changed = true;
              } catch (renameErr) {
                // Non-fatal: log and continue
                console.warn(
                  `Failed to rename interface property ${name} in ${src.getFilePath()}:`,
                  (renameErr as any).message ?? renameErr,
                );
              }
            }
          }
        }

        // Optionally: rename property signatures in type literal nodes (Type alias with object literal)
        // We'll attempt a conservative pass: find type aliases with TypeLiteral nodes and rename property signatures within
        const typeAliases = src.getTypeAliases();
        for (const ta of typeAliases) {
          const typeNode = ta.getTypeNode();
          // Only operate if the type node is a literal-like node exposing getMembers
          // (ts-morph's TypeLiteralNode type has getMembers())
          // Use a try/catch because some type nodes won't expose getMembers()
          try {
            const members: any = (typeNode as any)?.getMembers?.();
            if (Array.isArray(members) && members.length) {
              for (const member of members) {
                // Member may be a PropertySignature
                const memberName =
                  typeof member.getName === "function"
                    ? member.getName()
                    : undefined;
                if (memberName && renameMap[memberName]) {
                  try {
                    member.rename(renameMap[memberName]);
                    changed = true;
                  } catch (renameErr) {
                    console.warn(
                      `Failed to rename type alias member ${memberName} in ${src.getFilePath()}:`,
                      (renameErr as any).message ?? renameErr,
                    );
                  }
                }
              }
            }
          } catch {
            // ignore nodes we can't handle safely
          }
        }

        if (changed) {
          await src.save();
          console.log(`ts-morph: updated AST file: ${src.getFilePath()}`);
        }
      }
    }
  } catch (err) {
    console.warn(
      "ts-morph pass failed or skipped (non-fatal):",
      (err as any).message ?? err,
    );
  }

  const changedCount = summary.filter((s) => s.changed).length;
  console.log(
    `\nCompleted. Files changed: ${changedCount}. Backups are in: ${backupRoot}`,
  );
  console.log("Please review changes (git diff) and run your tests/build.");

  const report = {
    timestamp,
    map: renameMap,
    summary,
  };
  await fs.writeFile(
    path.join(backupRoot, "rename-report.json"),
    JSON.stringify(report, null, 2),
    "utf8",
  );
  console.log(
    `Report written to ${path.join(backupRoot, "rename-report.json")}`,
  );
}

main().catch((err) => {
  console.error("Fatal:", (err as any).message ?? err);
  process.exit(1);
});
