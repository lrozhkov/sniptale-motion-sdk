import { vi } from "vitest";

class FixtureButton {
  title = "";
  classList = {
    toggle(_token: string, force?: boolean): boolean {
      return force ?? false;
    },
  };
  setAttribute(_name: string, _value: string): void {}
}

/** Native allocation boundary; only attributes and explicit CSS toggle calls are observed. */
export function createNativeButtonFixture() {
  vi.stubGlobal("HTMLButtonElement", FixtureButton);
  const button = new HTMLButtonElement();
  const toggle = vi.spyOn(button.classList, "toggle");
  const setAttribute = vi.spyOn(button, "setAttribute");
  return Object.assign(button, {
    classList: Object.assign(button.classList, { toggle }),
    setAttribute,
  });
}
