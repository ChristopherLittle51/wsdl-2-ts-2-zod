#!/usr/bin/env -S deno run --allow-read --allow-write --allow-run --allow-env

import { parseArgs } from "jsr:@std/cli@^1.0.6";
import * as fs from "jsr:@std/fs@^1.0.4";
import * as path from "jsr:@std/path@^1.0.6";
import { load as loadEnv } from "jsr:@std/dotenv@^0.225.2";

async function executeCommand(
  args: string[],
  dir: string,
  permissions: string[],
) {
  const cmd = new Deno.Command(Deno.execPath(), {
    args: ["run", ...permissions, path.join(dir, ...args)],
  });

  const output = await cmd.output();
  if (!output.success) {
    const decoder = new TextDecoder();
    const stderr = decoder.decode(output.stderr);
    throw new Error(`Command failed: ${stderr}`);
  }
  return output;
}

async function main() {
  try {
    const args = parseArgs(Deno.args, {
      string: ["wsdl", "output", "dotenv", "overrides"],
      boolean: ["save-json"],
      default: {
        "save-json": false,
      },
    });

    const wsdlPath = args.values.wsdl;
    const outputDir = args.values.output;
    const dotenvPath = args.values.dotenv;
    const overridesPath = args.values.overrides;
    const saveJson = args.values["save-json"];

    if (!wsdlPath || !outputDir || !dotenvPath || !overridesPath) {
      console.error("Missing required arguments. Usage:");
      console.error("deno run mod.ts \\");
      console.error("  --wsdl <path-to-wsdl> \\");
      console.error("  --output <output-directory> \\");
      console.error("  --dotenv <path-to-dotenv> \\");
      console.error("  --overrides <path-to-overrides> \\");
      console.error("  [--save-json]");
      Deno.exit(1);
    }

    // Setup directory structure
    const dirs = {
      complex: path.join(outputDir, "json", "complex"),
      simple: path.join(outputDir, "json", "simple"),
      types: path.join(outputDir, "ts"),
      zod: path.join(outputDir, "zod"),
    };

    // Ensure directories exist
    await Promise.all(
      Object.values(dirs).map((dir) => fs.ensureDir(dir)),
    );

    const utilsDir = path.join(
      path.dirname(path.fromFileUrl(import.meta.url)),
      "utils",
    );

    console.log("🔄 Starting conversion process...");

    // 1. Convert WSDL to JSON
    console.log("📑 Converting WSDL to JSON chunks...");
    await executeCommand(
      ["convertWSDLtoJSON.ts", wsdlPath, dirs.complex, dirs.simple],
      utilsDir,
      ["--allow-read", "--allow-write"],
    );

    // 2. Convert JSON to TypeScript
    console.log("📝 Generating TypeScript types...");
    const typesFile = path.join(dirs.types, "types.ts");
    await executeCommand(
      [
        "convertJSONtoTypes.ts",
        dirs.complex,
        dirs.simple,
        typesFile,
        overridesPath,
      ],
      utilsDir,
      ["--allow-read", "--allow-write"],
    );

    // 3. Generate Zod schemas
    console.log("🔧 Generating Zod schemas...");
    await loadEnv({ export: true, envPath: dotenvPath });
    const zodFile = path.join(dirs.zod, "types.zod.ts");
    await executeCommand(
      ["generateZodSchema.ts", typesFile, dotenvPath, zodFile],
      utilsDir,
      ["--allow-read", "--allow-write", "--allow-env"],
    );

    // 4. Cleanup JSON if not needed
    if (!saveJson) {
      console.log("🧹 Cleaning up temporary files...");
      await Deno.remove(path.join(outputDir, "json"), { recursive: true });
    }

    console.log("✅ Conversion completed successfully!");
  } catch (error) {
    console.error(
      "❌ Error:",
      error instanceof Error ? error.message : String(error),
    );
    Deno.exit(1);
  }
}

if (import.meta.main) {
  main();
}
