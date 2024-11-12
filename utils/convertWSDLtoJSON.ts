import * as fs from "jsr:@std/fs@^1.0.4";
import * as path from "jsr:@std/path@^1.0.6";
import { parse as parseXml } from "jsr:@libs/xml";

const xmlOpts = {
  clean: {
    attributes: false,
    comments: true,
    doctype: true,
    instructions: true,
  },
  flatten: {
    attributes: true,
    text: true,
    empty: true,
  },
  revive: {
    trim: true,
    entities: true,
    booleans: true,
    numbers: true,
  },
};

interface ConversionOptions {
  wsdlPath: string;
  complexTypeOutputDir?: string;
  simpleTypeOutputDir?: string;
}

type ValueType =
  | string
  | number
  | boolean
  | null
  | { [key: string]: ValueType }
  | ValueType[];
type ComplexType = {
  "@name": string; // Changed: moved from $ to root level
  [key: string]: ValueType;
};

type SimpleType = {
  "@name": string; // Changed: moved from $ to root level
  [key: string]: ValueType;
};

interface WSDLDefinition {
  "wsdl:definitions": {
    "wsdl:types": {
      "xs:schema": {
        "xs:element": unknown[];
        "xs:complexType": unknown[];
        "xs:simpleType": unknown[];
        "xs:annotation": unknown[];
      };
    };
  };
}

async function convertWsdlToJsonChunks(
  options: ConversionOptions,
): Promise<void> {
  const { wsdlPath, complexTypeOutputDir, simpleTypeOutputDir } = options;

  console.log(`Starting conversion for WSDL file: ${wsdlPath}`);

  try {
    const wsdlContent = await Deno.readTextFile(wsdlPath);
    console.log("WSDL content read successfully.");

    const jsonData = await parseXml(
      wsdlContent,
      xmlOpts,
    ) as unknown as WSDLDefinition;
    console.log("WSDL content parsed to JSON successfully.");

    const schema = jsonData["wsdl:definitions"]["wsdl:types"]["xs:schema"];
    if (!schema) {
      throw new Error("No schema found in WSDL");
    }

    // Handle complexTypes
    if (schema["xs:complexType"]) {
      const complexTypes = schema["xs:complexType"];
      console.log(`Found ${complexTypes.length} complexTypes.`);

      if (complexTypeOutputDir) {
        await fs.ensureDir(complexTypeOutputDir);

        for (const complexType of complexTypes) {
          try {
            if (!complexType || typeof complexType !== "object") {
              console.warn("Invalid complex type:", complexType);
              continue;
            }

            const name = (complexType as ComplexType)["@name"];
            if (!name) {
              console.warn("Complex type missing name:", complexType);
              continue;
            }

            const filePath = path.join(complexTypeOutputDir, `${name}.json`);
            await Deno.writeTextFile(
              filePath,
              JSON.stringify(complexType, null, 2),
            );
            console.log(`ComplexType '${name}' saved to: ${filePath}`);
          } catch (error) {
            console.error("Error processing complex type:", error);
            continue;
          }
        }
      }
    }

    // Handle simpleTypes
    if (schema["xs:simpleType"]) {
      const simpleTypes = schema["xs:simpleType"];
      console.log(`Found ${simpleTypes.length} simpleTypes.`);

      if (simpleTypeOutputDir) {
        await fs.ensureDir(simpleTypeOutputDir);

        for (const simpleType of simpleTypes) {
          try {
            if (!simpleType || typeof simpleType !== "object") {
              console.warn("Invalid simple type:", simpleType);
              continue;
            }

            const name = (simpleType as SimpleType)["@name"];
            if (!name) {
              console.warn("Simple type missing name:", simpleType);
              continue;
            }

            const filePath = path.join(simpleTypeOutputDir, `${name}.json`);
            await Deno.writeTextFile(
              filePath,
              JSON.stringify(simpleType, null, 2),
            );
            console.log(`SimpleType '${name}' saved to: ${filePath}`);
          } catch (error) {
            console.error("Error processing simple type:", error);
            continue;
          }
        }
      }
    }
  } catch (error) {
    console.error("Error converting WSDL to JSON chunks:", error);
    throw error;
  }
}

// Example usage:
const options: ConversionOptions = {
  wsdlPath: Deno.args[0],
  complexTypeOutputDir: Deno.args[1],
  simpleTypeOutputDir: Deno.args[2],
};

convertWsdlToJsonChunks(options);
