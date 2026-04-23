import type { ParamType } from "ethers";
import type { ExtractedEventParticipant } from "../events/indexedEvent.types.js";

const addressPattern = /^0x[a-fA-F0-9]{40}$/;

export function extractEventParticipants(
  network: string,
  inputs: readonly ParamType[],
  args: readonly unknown[]
): ExtractedEventParticipant[] {
  const extracted = new Map<string, ExtractedEventParticipant>();

  for (const [index, input] of inputs.entries()) {
    const basePath = input.name || index.toString();

    collectParticipants(network, input, args[index], basePath, extracted);
  }

  return [...extracted.values()];
}

function collectParticipants(
  network: string,
  param: ParamType,
  value: unknown,
  path: string,
  extracted: Map<string, ExtractedEventParticipant>
): void {
  const baseType = param.baseType;

  if (baseType === "address") {
    if (typeof value === "string" && addressPattern.test(value)) {
      const normalizedAddress = value.toLowerCase();
      const role = deriveRole(path);
      const argName = path || null;
      const key = [normalizedAddress, role, argName ?? ""].join("|");

      if (!extracted.has(key)) {
        extracted.set(key, {
          network,
          address: normalizedAddress,
          role,
          argName
        });
      }
    }

    return;
  }

  if (baseType === "array") {
    if (!Array.isArray(value) || !param.arrayChildren) {
      return;
    }

    for (const [index, item] of value.entries()) {
      collectParticipants(network, param.arrayChildren, item, `${path}[${index}]`, extracted);
    }

    return;
  }

  if (baseType === "tuple") {
    if (!param.components?.length) {
      return;
    }

    for (const [index, component] of param.components.entries()) {
      const componentValue = getTupleComponentValue(value, component.name, index);

      collectParticipants(
        network,
        component,
        componentValue,
        component.name ? `${path}.${component.name}` : `${path}.${index}`,
        extracted
      );
    }
  }
}

function getTupleComponentValue(value: unknown, componentName: string, index: number): unknown {
  if (Array.isArray(value)) {
    return value[index];
  }

  if (value && typeof value === "object") {
    return (value as Record<string, unknown>)[componentName];
  }

  return undefined;
}

function deriveRole(path: string): string {
  const segments = path.match(/[A-Za-z_][A-Za-z0-9_]*/g) ?? [];

  return segments.at(-1)?.toLowerCase() ?? "participant";
}
