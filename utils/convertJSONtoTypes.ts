import * as path from "jsr:@std/path@^1.0.6";

interface ConversionOptions {
  complexTypeDir: string;
  simpleTypeDir: string;
  outputPath: string;
  overridesPath?: string;
  stripComments: boolean; // Changed from 'stripComments?: boolean' to 'stripComments: boolean'
}

type CallInfo = {
  CallName: string;
  Context?: string;
  Details?: string;
  Returned: string;
  RequiredInput?: string;
};

// Update the type definitions to match the new JSON structure
type XsAnnotation = {
  "xs:documentation": string;
  "xs:appinfo"?: {
    CallInfo?: CallInfo[] | CallInfo;
    SeeLink?: {
      Title?: string;
      URL: string;
    } | {
      Title?: string;
      URL: string;
    }[];
    [key: string]: unknown;
  };
};

type XsElement = {
  "@name": string;
  "@type": string;
  "@minOccurs"?: string;
  "@maxOccurs"?: string;
  "xs:annotation"?: XsAnnotation;
  // ... other properties as needed
};

type XsChoice = {
  "xs:element"?: XsElement[];
  // ... other properties as needed
};

type XsAll = {
  "xs:element"?: XsElement[];
  // ... other properties as needed
};

type XsAny = {
  $: {
    maxOccurs?: string;
    minOccurs?: string;
    processContents?: string;
  };
  // ... other properties as needed
};

type XsSequence = {
  "xs:element"?: XsElement[];
  "xs:choice"?: XsChoice;
  "xs:all"?: XsAll;
  "xs:any"?: XsAny;
  // ... other properties as needed
};

type XsAttribute = {
  "@name": string;
  "@type": string;
  "@use"?: string;
  "xs:annotation"?: XsAnnotation;
};

type XsSimpleContent = {
  "xs:extension": {
    "@base": string;
    "xs:attribute"?: XsAttribute[];
  };
};

type XsComplexContent = {
  "xs:extension": {
    "@base": string;
    "xs:sequence"?: XsSequence;
  };
};

type XsRestriction = {
  "@base": string;
  "xs:enumeration"?: Array<{
    "@value": string;
    "xs:annotation"?: XsAnnotation;
  }>;
};

type JsonData = {
  "@name": string;
  "@abstract"?: boolean;
  "xs:annotation"?: XsAnnotation;
  "xs:restriction"?: {
    "@base": string;
    "xs:enumeration"?: Array<{
      "@value": string;
      "xs:annotation"?: XsAnnotation;
    }>;
  };
  "xs:sequence"?: {
    "xs:element":
      | {
        "@name": string;
        "@type": string;
        "@minOccurs"?: string;
        "@maxOccurs"?: string;
        "xs:annotation"?: XsAnnotation;
      }
      | Array<{
        "@name": string;
        "@type": string;
        "@minOccurs"?: string;
        "@maxOccurs"?: string;
        "xs:annotation"?: XsAnnotation;
      }>;
    "xs:any"?: {
      "@maxOccurs": string;
      "@minOccurs": string;
      "@processContents": string;
    };
  };
  "xs:complexContent"?: {
    "xs:extension": {
      "@base": string;
      "xs:sequence"?: XsSequence;
    };
  };
  "xs:simpleContent"?: XsSimpleContent;
  "xs:attribute"?: XsAttribute[];
  // ...existing code...
};

// Object to store generated type definitions
const generatedTypes: { [key: string]: string } = {};

// Update the overrides type to allow for complete type definitions and optionality flags
type OverrideField = {
  type: string;
  optional?: boolean;
};

type Override = {
  optional?: boolean;
  fields?: { [field: string]: OverrideField };
} | string;

const overrides: { [key: string]: Override } = {};

async function convertJsonToTypescript(
  options: ConversionOptions,
): Promise<void> {
  const {
    complexTypeDir,
    simpleTypeDir,
    outputPath,
    overridesPath,
    stripComments,
  } = options;

  // Load overrides if path is provided
  if (overridesPath) {
    await loadOverrides(overridesPath);
  }

  // Process complex and simple types (combined)
  await processTypes(complexTypeDir, "interface", stripComments);
  await processTypes(simpleTypeDir, "type", stripComments);

  // Generate types from overrides
  for (const [typeName, override] of Object.entries(overrides)) {
    if (!generatedTypes[typeName]) {
      if (typeof override === "string") {
        generatedTypes[typeName] = `export type ${typeName} = ${override}\n\n`;
      } else if (typeof override === "object" && override.fields) {
        let definition = `export interface ${typeName} {\n`;
        for (const [field, fieldOverride] of Object.entries(override.fields)) {
          const optional = fieldOverride.optional === false ? "" : "?";
          definition += `  ${field}${optional}: ${fieldOverride.type};\n`;
        }
        definition += "}\n\n";
        generatedTypes[typeName] = definition;
      }
    }
  }

  // Write type definitions to output file
  let typeDefinitions = "";
  for (const typeName in generatedTypes) {
    typeDefinitions += `${generatedTypes[typeName]}\n`;
  }
  await Deno.writeTextFile(outputPath, typeDefinitions);
  console.log(
    `TypeScript type definitions generated and saved to: ${outputPath}`,
  );
}

async function loadOverrides(overridesPath: string): Promise<void> {
  console.log("Loading overrides...");
  try {
    const overridesContent = await Deno.readTextFile(overridesPath);
    const parsedOverrides = JSON.parse(overridesContent);
    Object.assign(overrides, parsedOverrides);
    console.log(`Loaded ${Object.keys(overrides).length} overrides`);
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      console.log("No overrides file found");
    } else {
      console.error("Error parsing overrides JSON:", error);
    }
  }
}

// Update processTypes to generate enums first
async function processTypes(
  dir: string,
  typeKeyword: "interface" | "type",
  stripComments: boolean,
): Promise<void> {
  const files = [];
  for await (const dirEntry of Deno.readDir(dir)) {
    if (dirEntry.isFile) {
      files.push(dirEntry.name);
    }
  }

  // First generate all enums
  for (const fileName of files) {
    const filePath = path.join(dir, fileName);
    const jsonContent = await Deno.readTextFile(filePath);
    const jsonData = JSON.parse(jsonContent);
    if (jsonData["xs:restriction"]?.["xs:enumeration"]) {
      generateTypeDefinition(jsonData, typeKeyword, stripComments);
    }
  }

  // Then generate all other types
  for (const fileName of files) {
    const filePath = path.join(dir, fileName);
    const jsonContent = await Deno.readTextFile(filePath);
    const jsonData = JSON.parse(jsonContent);
    if (!jsonData["xs:restriction"]?.["xs:enumeration"]) {
      generateTypeDefinition(jsonData, typeKeyword, stripComments);
    }
  }
}

// Ensure that types are exported correctly
// Modify generateTypeDefinition to accept stripComments
function generateTypeDefinition(
  jsonData: JsonData,
  typeKeyword: "interface" | "type",
  stripComments: boolean,
): string {
  const typeName = jsonData["@name"];
  console.log(`Generating ${typeKeyword} definition for: ${typeName}`);

  const override = overrides[typeName];

  // Handle enums differently
  if (jsonData["xs:restriction"]?.["xs:enumeration"]) {
    const enumType = generateEnumType(typeName, jsonData);
    generatedTypes[typeName] = enumType;
    return enumType;
  }

  let definition = "";

  // Add documentation comments if available
  const docs = stripComments
    ? undefined
    : extractDocumentation(jsonData["xs:annotation"]);
  if (docs) {
    definition += `/**\n * ${docs}\n */\n`;
  }

  // Add 'export' keyword before the type/interface
  definition += `export ${typeKeyword} ${typeName} `;

  // Extract the extends part and properties
  let extendsClause = "";
  let extendedProperties = "";

  if (jsonData["xs:complexContent"]?.["xs:extension"]) {
    try {
      const extension = jsonData["xs:complexContent"]["xs:extension"];
      if (extension["@base"]) {
        const baseType = convertXmlTypeToTypescript(extension["@base"]);
        extendsClause = `extends ${baseType} `;

        // Extract extended type properties
        if (extension["xs:sequence"]?.["xs:element"]) {
          const elements = Array.isArray(extension["xs:sequence"]["xs:element"])
            ? extension["xs:sequence"]["xs:element"]
            : [extension["xs:sequence"]["xs:element"]];

          elements.forEach((element) => {
            if (!element["@name"] || !element["@type"]) {
              console.warn(`Invalid element in ${typeName}:`, element);
              return;
            }

            const elementName = element["@name"];
            const elementType = convertXmlTypeToTypescript(element["@type"]);
            const optional = element["@minOccurs"] === "0" ? "?" : "";
            const isArray = element["@maxOccurs"] === "unbounded";
            const finalType = isArray ? `${elementType}[]` : elementType;

            const docs = stripComments
              ? undefined
              : extractDocumentation(element["xs:annotation"]);
            if (docs) {
              extendedProperties += `  /** ${docs} */\n`;
            }

            extendedProperties +=
              `  ${elementName}${optional}: ${finalType};\n`;
          });
        }
      }
    } catch (error) {
      console.error(
        `Error processing complex content extension for ${typeName}:`,
        error,
      );
    }
  }

  // Add extends clause and opening brace
  definition += extendsClause;
  if (typeKeyword === "interface") {
    definition += "{\n";
    definition += extendedProperties;
  }

  // Define Element type
  type Element = {
    $: {
      name: string;
      type: string;
      minOccurs?: string;
    };
  };

  // Update sequence handling for new format
  if (jsonData["xs:sequence"]) {
    const sequence = jsonData["xs:sequence"];

    if (sequence["xs:element"]) {
      try {
        // Ensure elements is always an array
        const elements = Array.isArray(sequence["xs:element"])
          ? sequence["xs:element"]
          : [sequence["xs:element"]];

        console.log(`Processing ${elements.length} elements for ${typeName}`);

        elements.forEach((element) => {
          if (!element["@name"] || !element["@type"]) {
            console.warn(`Invalid element in ${typeName}:`, element);
            return;
          }

          const elementName = element["@name"];
          const elementType = convertXmlTypeToTypescript(element["@type"]);
          const optional = element["@minOccurs"] === "0" ? "?" : "";
          const isArray = element["@maxOccurs"] === "unbounded";

          const finalType = isArray ? `${elementType}[]` : elementType;

          const docs = stripComments
            ? undefined
            : extractDocumentation(element["xs:annotation"]);
          if (docs) {
            definition += `  /** ${docs} */\n`;
          }

          definition += `  ${elementName}${optional}: ${finalType};\n`;
        });
      } catch (error) {
        console.error(
          `Error processing sequence elements for ${typeName}:`,
          error,
        );
        console.log(
          "Sequence data:",
          JSON.stringify(sequence["xs:element"], null, 2),
        );
      }
    }

    // Handle xs:any
    if (sequence["xs:any"]) {
      definition += `  [key: string]: unknown;\n`;
    }
  }

  // Handle restrictions (simplified for string literals)
  if (jsonData["xs:restriction"]) {
    try {
      const restriction = jsonData["xs:restriction"];
      if (restriction["xs:enumeration"]) {
        definition += `= string;\n\n`; // Treat enumerations as strings
      } else if (typeKeyword === "type") {
        const baseType = restriction["@base"] ||
          (typeof restriction === "object" && restriction["@base"]) ||
          "unknown";
        const tsType = convertXmlTypeToTypescript(baseType);
        definition += `= ${tsType};\n\n`;
      } else {
        definition += `  // Add properties based on restriction\n`;
      }
    } catch (error) {
      console.error(`Error processing restriction for ${typeName}:`, error);
      console.log(
        "Restriction data:",
        JSON.stringify(jsonData["xs:restriction"], null, 2),
      );
      definition += `= unknown;\n\n`;
    }
  }

  // Handle simpleContent
  if (jsonData["xs:simpleContent"]) {
    try {
      const extension = jsonData["xs:simpleContent"]["xs:extension"];
      if (!extension["@base"]) {
        console.warn(
          `Missing base type in simple content extension for ${typeName}:`,
          extension,
        );
      } else {
        const baseType = convertXmlTypeToTypescript(extension["@base"]);
        if (extension["xs:attribute"]) {
          const attributes = Array.isArray(extension["xs:attribute"])
            ? extension["xs:attribute"]
            : [extension["xs:attribute"]];

          if (typeKeyword === "type") {
            definition += `{ `;
          }

          attributes.forEach((attribute: XsAttribute, index) => {
            if (!attribute["@name"] || !attribute["@type"]) {
              console.warn(`Invalid attribute in ${typeName}:`, attribute);
              return;
            }

            const attributeName = attribute["@name"];
            const attributeType = convertXmlTypeToTypescript(
              attribute["@type"],
            );
            const fieldOverride = override && typeof override === "object" &&
              override.fields && override.fields[attributeName];
            const optional = fieldOverride
              ? (fieldOverride.optional === false ? "" : "?")
              : (attribute["@use"] === "optional" ? "?" : "");
            const finalType = fieldOverride
              ? fieldOverride.type
              : attributeType;

            if (attribute["xs:annotation"]?.["xs:documentation"]) {
              const docs = extractDocumentation(attribute["xs:annotation"]);
              if (docs) {
                definition += `  /** ${docs} */\n`;
              }
            }

            definition += `${attributeName}${optional}: ${finalType};`;
            if (index < attributes.length - 1) {
              definition += " ";
            }
          });

          if (typeKeyword === "type") {
            definition += `value: ${baseType}; }\n\n`;
          } else {
            definition += `  value: ${baseType};\n`;
          }
        } else {
          definition += `${baseType}\n\n`;
        }
      }
    } catch (error) {
      console.error(`Error processing simple content for ${typeName}:`, error);
      console.log(
        "Simple content data:",
        JSON.stringify(jsonData["xs:simpleContent"], null, 2),
      );
    }
  }

  // Handle attributes
  if (jsonData["xs:attribute"]) {
    try {
      const attributes = Array.isArray(jsonData["xs:attribute"])
        ? jsonData["xs:attribute"]
        : [jsonData["xs:attribute"]];

      attributes.forEach((attribute: XsAttribute) => {
        if (!attribute["@name"] || !attribute["@type"]) {
          console.warn(`Invalid attribute in ${typeName}:`, attribute);
          return;
        }

        const attributeName = attribute["@name"];
        const attributeType = convertXmlTypeToTypescript(attribute["@type"]);
        const fieldOverride = override && typeof override === "object" &&
          override.fields && override.fields[attributeName];
        const optional = fieldOverride
          ? (fieldOverride.optional === false ? "" : "?")
          : (attribute["@use"] === "optional" ? "?" : "");
        const finalType = fieldOverride ? fieldOverride.type : attributeType;

        const docs = extractDocumentation(attribute["xs:annotation"]);
        if (docs) {
          definition += `  /** ${docs} */\n`;
        }

        definition += `  ${attributeName}${optional}: ${finalType};\n`;
      });
    } catch (error) {
      console.error(`Error processing attributes for ${typeName}:`, error);
      console.log(
        "Attribute data:",
        JSON.stringify(jsonData["xs:attribute"], null, 2),
      );
    }
  }

  // Apply field overrides
  if (override && typeof override === "object" && override.fields) {
    console.log(`Applying field overrides for ${typeName}`);
    for (const [field, fieldOverride] of Object.entries(override.fields)) {
      // Check if the field already exists in the definition
      const fieldRegex = new RegExp(`\\s${field}\\??:\\s[^;]+;`, "g");
      if (definition.match(fieldRegex)) {
        // Replace existing field
        const optional = fieldOverride.optional === false ? "" : "?";
        definition = definition.replace(
          fieldRegex,
          `  ${field}${optional}: ${fieldOverride.type};`,
        );
      } else {
        // Add new field
        const optional = fieldOverride.optional === false ? "" : "?";
        definition += `  ${field}${optional}: ${fieldOverride.type};\n`;
      }
    }
  }

  // Add closing curly brace for interfaces
  if (typeKeyword === "interface") {
    definition += "}\n\n";
  } else {
    definition += "\n\n";
  }

  generatedTypes[typeName] = definition;
  return definition;
}

// Update generateEnumType to create string union types instead of enums
function generateEnumType(typeName: string, jsonData: JsonData): string {
  const enumValues = jsonData["xs:restriction"]?.["xs:enumeration"] || [];
  const literals = enumValues.map((enumValue) => `"${enumValue["@value"]}"`)
    .join(" | ");

  // Gather documentation if available and stripComments is false
  const documentation = [];
  if (!options.stripComments) {
    documentation.push(`${typeName} enum.`);
    enumValues.forEach((enumValue) => {
      const docs = enumValue["xs:annotation"]?.["xs:documentation"];
      if (docs) {
        documentation.push(docs.replace(/\n\s+/g, " ").trim());
      }
    });
  }

  // Generate the type definition with or without comments
  if (documentation.length > 0) {
    return `/**\n * ${
      documentation.join("\n * ")
    }\n */\nexport type ${typeName} = ${literals};\n\n`;
  } else {
    return `export type ${typeName} = ${literals};\n\n`;
  }
}

function convertXmlTypeToTypescript(xmlType: string): string {
  // Add more specific type mappings
  const typeMap: Record<string, string> = {
    "xs:string": "string",
    "xs:token": "string",
    "xs:dateTime": "Date",
    "xs:time": "Date",
    "xs:date": "Date",
    "xs:int": "number",
    "xs:integer": "number",
    "xs:long": "number",
    "xs:short": "number",
    "xs:decimal": "number",
    "xs:float": "number",
    "xs:double": "number",
    "xs:boolean": "boolean",
    "xs:anyURI": "string",
    "xs:duration": "string",
    "xs:base64Binary": "string",
    "xs:hexBinary": "string",
    "xs:positiveInteger": "number",
    "xs:nonNegativeInteger": "number",
    "xs:negativeInteger": "number",
    "xs:nonPositiveInteger": "number",
  };

  // Handle references to other types/enums
  if (xmlType.startsWith("xs:")) {
    return typeMap[xmlType] || "unknown";
  }

  // Remove ns: prefix but keep the type name
  return xmlType.replace(/^ns:/, "");
}

function extractDocumentation(
  annotation: XsAnnotation | undefined,
): string | undefined {
  if (!annotation?.["xs:documentation"]) return undefined;

  const doc = annotation["xs:documentation"];
  if (typeof doc === "string") {
    return doc.replace(/\n\s+/g, " ").trim();
  } else if (typeof doc === "object") {
    // Handle object format documentation
    const parts: string[] = [];
    if (doc["#text"]) {
      parts.push(doc["#text"]);
    }
    // Add other fields if they exist
    Object.entries(doc).forEach(([key, value]) => {
      if (key !== "#text" && typeof value === "string") {
        parts.push(value);
      }
    });
    return parts.join(" ").replace(/\n\s+/g, " ").trim();
  }
  return undefined;
}

// Parse command line arguments
const args = Deno.args;
let strip = false;

const positionalArgs: string[] = [];

for (const arg of args) {
  if (arg === "--strip") {
    strip = true;
  } else {
    positionalArgs.push(arg);
  }
}

const options: ConversionOptions = {
  complexTypeDir: positionalArgs[0] || "./json/complex",
  simpleTypeDir: positionalArgs[1] || "./json/simple",
  outputPath: positionalArgs[2] || "./types.ts",
  overridesPath: positionalArgs[3],
  stripComments: strip, // Now always a boolean
};

// Validate arguments
if (positionalArgs.length < 3) {
  console.log(
    "Usage: deno run --allow-read --allow-write convertJSONtoTypes.ts <complexTypeDir> <simpleTypeDir> <outputPath> [overridesPath] [--strip]",
  );
  Deno.exit(1);
}

await convertJsonToTypescript(options);
