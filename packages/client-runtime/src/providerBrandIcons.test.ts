import { describe, expect, it } from "vite-plus/test";
import { resolveProviderIconKind } from "./providerBrandIcons.ts";

describe("resolveProviderIconKind", () => {
  it.each([
    [undefined, "deepseek"],
    ['["deepseek-account","deepseek-flash"]', "deepseek"],
    ['["openai-codex","gpt-6-luna"]', "codex"],
    ['["openai","gpt-6-luna"]', "codex"],
    ['["anthropic","claude-haiku-4-5"]', "claudeAgent"],
    ['["xai","grok-4.3"]', "grok"],
    ['["grok-cli","grok-4.3"]', "grok"],
    ['["unknown","gpt-6-luna"]', "deepseek"],
    ['["openai",42]', "deepseek"],
    ['{"0":"openai","1":"gpt-6-luna"}', "deepseek"],
    ["gpt-6-luna", "deepseek"],
  ])("keeps harness branding separate from model %s", (model, expected) => {
    expect(
      resolveProviderIconKind({ driverKind: "acpRegistry", brandIcon: "deepseek", model }),
    ).toBe(expected);
  });

  it("leaves other harnesses alone even with a matching model ID", () => {
    const model = '["anthropic","claude-haiku-4-5"]';
    expect(resolveProviderIconKind({ driverKind: "acpRegistry", model })).toBe("acpRegistry");
    expect(resolveProviderIconKind({ driverKind: "pi", brandIcon: "deepseek", model })).toBe("pi");
  });
});
