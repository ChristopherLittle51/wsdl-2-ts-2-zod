import { generate } from "npm:ts-to-zod@3.13.0";
import { load } from "jsr:@std/dotenv@^0.225.2";
import * as fs from "jsr:@std/fs@^1.0.4";
import * as path from "jsr:@std/path@^1.0.6";

// Function to generate Zod schemas
function generateZodSchemas(typesContent: string, outputPath: string) {
  // Pre-process the TypeScript content to remove index signatures
  const processedContent = typesContent.replace(
    /\[key: string\]: unknown;/g,
    "",
  );

  const { getZodSchemasFile, errors } = generate({
    sourceText: processedContent,
  });

  if (errors.length > 0) {
    console.error("Errors generating Zod schemas:", errors);
    return;
  }

  const zodSchemas = getZodSchemasFile(outputPath);
  return zodSchemas;
}

const dotenvConfigPath = Deno.args[1];

// Only load env if path is provided
if (dotenvConfigPath) {
  await load({ export: true, envPath: dotenvConfigPath });
}

// Optional ZOD_BUNDLE_PATH
const ZOD_BUNDLE_PATH = Deno.env.get("ZOD_BUNDLE_PATH");

try {
  const typesFilePath = Deno.args[0];
  const zodSchemasOutputPath = Deno.args[2] || Deno.args[1]; // Fall back to arg[1] if no env file

  if (!typesFilePath) {
    throw new Error(
      "Please provide the path to the generated types file as the first command line argument.",
    );
  }

  if (!await fs.exists(typesFilePath)) {
    throw new Error(`Types file not found: ${typesFilePath}`);
  }

  const outputDir = path.dirname(zodSchemasOutputPath);
  await fs.ensureDir(outputDir);

  // Read TypeScript types file content
  const tsTypesContent = await Deno.readTextFile(typesFilePath);

  // Generate Zod schemas using ts-to-zod
  const zodSchema = await generateZodSchemas(
    tsTypesContent,
    zodSchemasOutputPath,
  );

  if (zodSchema) {
    // Only modify the import if ZOD_BUNDLE_PATH is provided
    const fixedZodSchema = ZOD_BUNDLE_PATH
      ? zodSchema.replace(
        /import\s+{ z }\s+from\s+"zod";/,
        `import { z } from "${ZOD_BUNDLE_PATH}";`,
      )
      : zodSchema;

    // Write the generated Zod schema to file
    await Deno.writeTextFile(zodSchemasOutputPath, fixedZodSchema);
    console.log(`Zod schemas generated and saved to: ${zodSchemasOutputPath}`);
  } else {
    console.error("Failed to generate Zod schemas.");
  }
} catch (error) {
  console.error(
    "An error occurred:",
    error instanceof Error ? error.message : String(error),
  );
  Deno.exit(1);
}
