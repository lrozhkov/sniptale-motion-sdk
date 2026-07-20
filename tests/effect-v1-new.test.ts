import { describe, expect, it } from "vitest";

import { validateEffectV1Document } from "../src/sdk/effect-v1";
import { createStarterDocument } from "../tooling/effect-v1/new";

describe("Effect v1 starter", () => {
  it.each(["standalone", "targetEffect", "transition"] as const)(
    "creates a proof-ready %s document",
    (kind) => {
      const document = createStarterDocument(`starter-${kind}`, kind);
      const validation = validateEffectV1Document(document);
      const commands = document.program.commands;
      const title = commands.find(
        (command: any) => command.op === "text" && command.layerId === "title",
      );

      expect(validation).toMatchObject({ ok: true });
      expect(
        commands.some((command: any) => command.layerId === "background"),
      ).toBe(true);
      expect(commands.some((command: any) => command.layerId === "title")).toBe(
        true,
      );
      expect(
        commands.some(
          (command: any) =>
            command.op === "shape" &&
            JSON.stringify(command.x).includes('"path":"progress"'),
        ),
      ).toBe(true);
      expect(title).toMatchObject({ x: 0, y: 0 });
    },
  );
});
