import type { EffectV1Document } from "../../../src/sdk/effect-v1/types.js";
import { createNeutralEffectV1Document } from "./effect-v1-documents.ts";
import { responseArray, responseObject } from "./response.ts";

export function createControlPresentationDocument(): EffectV1Document {
  const document = createNeutralEffectV1Document("standalone");
  document.controlGroups = [
    {
      id: "paint",
      parentId: "appearance",
      label: { ru: "Оформление", en: "Paint" },
      icon: "palette",
      order: 0,
      collapsed: false,
    },
    {
      id: "fill",
      parentId: "paint",
      label: { ru: "Заливка", en: "Fill" },
      icon: "fill",
    },
    { id: "detail", parentId: "fill", label: { ru: "Детали", en: "Detail" } },
  ];
  document.controls = [
    {
      id: "amount",
      kind: "number",
      defaultValue: 20,
      min: 1,
      max: 100,
      step: 1,
      group: "detail",
      unit: "px",
      presentation: "slider",
      icon: "width",
      label: { ru: "Ширина", en: "Width" },
    },
    {
      id: "mode",
      kind: "text",
      defaultValue: "A",
      group: "content",
      presentation: "dropdown",
      icon: "text",
      options: [
        { value: "A", label: { en: "First" }, icon: "check" },
        { value: "B", label: { en: "Second" }, icon: "x" },
      ],
    },
  ];
  document.program.commands.push(
    {
      op: "shape",
      shape: "rect",
      x: 0,
      y: 0,
      width: { op: "read", path: "controls.amount" },
      height: 20,
      fill: "#fff",
    },
    {
      op: "text",
      text: { op: "read", path: "controls.mode" },
      x: 0,
      y: 30,
      fill: "#fff",
    },
  );
  return document;
}

export type ControlPresentationFixture = {
  id: string;
  document: unknown;
  accepted: boolean;
  diagnostic?: { severity: "error" | "warning"; code: string; path: string };
};

export function createControlPresentationFixtures(): ControlPresentationFixture[] {
  const result: ControlPresentationFixture[] = [
    {
      id: "nested-metadata",
      document: createControlPresentationDocument(),
      accepted: true,
    },
  ];
  function invalid(
    id: string,
    mutate: (document: Record<string, unknown>) => void,
    code: string,
    path: string,
  ) {
    const document = responseObject(createControlPresentationDocument());
    mutate(document);
    result.push({
      id,
      document,
      accepted: false,
      diagnostic: { severity: "error", code, path },
    });
  }
  invalid(
    "unit-id",
    (d) => {
      responseObject(d, "controls", 0).unit = "points";
    },
    "CONTROL_UNIT",
    "$.controls[0].unit",
  );
  invalid(
    "unit-kind",
    (d) => {
      responseObject(d, "controls", 1).unit = "px";
    },
    "CONTROL_UNIT",
    "$.controls[1].unit",
  );
  invalid(
    "presentation-id",
    (d) => {
      responseObject(d, "controls", 0).presentation = "code";
    },
    "CONTROL_PRESENTATION",
    "$.controls[0].presentation",
  );
  invalid(
    "presentation-kind",
    (d) => {
      responseObject(d, "controls", 0).presentation = "text";
    },
    "CONTROL_PRESENTATION_KIND",
    "$.controls[0].presentation",
  );
  invalid(
    "presentation-missing-options",
    (d) => {
      responseObject(d, "controls", 0).presentation = "dropdown";
    },
    "CONTROL_PRESENTATION_OPTIONS",
    "$.controls[0].presentation",
  );
  invalid(
    "presentation-with-options",
    (d) => {
      responseObject(d, "controls", 0).options = [
        { value: 20, label: { en: "20" } },
        { value: 40, label: { en: "40" } },
      ];
    },
    "CONTROL_PRESENTATION_OPTIONS",
    "$.controls[0].presentation",
  );
  invalid(
    "segmented-limit",
    (d) => {
      const control = responseObject(d, "controls", 1);
      control.presentation = "segmented";
      control.options = Array.from({ length: 9 }, (_, index) => ({
        value: String.fromCharCode(65 + index),
        label: { en: `Option ${index}` },
      }));
    },
    "CONTROL_PRESENTATION_OPTIONS",
    "$.controls[1].presentation",
  );
  invalid(
    "toggle-limit",
    (d) => {
      const control = responseObject(d, "controls", 1);
      control.presentation = "toggle";
      control.options = [
        ...responseArray(control, "options"),
        { value: "C", label: { en: "Third" } },
      ];
    },
    "CONTROL_PRESENTATION_OPTIONS",
    "$.controls[1].presentation",
  );
  invalid(
    "control-icon",
    (d) => {
      responseObject(d, "controls", 0).icon = "raw-svg";
    },
    "CONTROL_ICON",
    "$.controls[0].icon",
  );
  invalid(
    "option-icon",
    (d) => {
      responseObject(d, "controls", 1, "options", 0).icon = "<svg/>";
    },
    "CONTROL_ICON",
    "$.controls[1].options[0].icon",
  );
  invalid(
    "group-icon",
    (d) => {
      responseObject(d, "controlGroups", 0).icon = "lucide:code";
    },
    "CONTROL_ICON",
    "$.controlGroups[0].icon",
  );
  invalid(
    "groups-type",
    (d) => {
      d.controlGroups = null;
    },
    "CONTROL_GROUPS",
    "$.controlGroups",
  );
  invalid(
    "groups-limit",
    (d) => {
      d.controlGroups = Array.from({ length: 65 }, (_, index) => ({
        id: `group-${index}`,
        parentId: "appearance",
        label: { en: "Group" },
      }));
    },
    "CONTROL_GROUPS",
    "$.controlGroups",
  );
  invalid(
    "group-type",
    (d) => {
      d.controlGroups = [null];
    },
    "CONTROL_GROUP",
    "$.controlGroups[0]",
  );
  invalid(
    "group-reserved",
    (d) => {
      responseObject(d, "controlGroups", 0).id = "appearance";
    },
    "CONTROL_GROUP_RESERVED",
    "$.controlGroups[0].id",
  );
  invalid(
    "group-duplicate",
    (d) => {
      d.controlGroups = [
        ...responseArray(d, "controlGroups"),
        structuredClone(responseObject(d, "controlGroups", 0)),
      ];
    },
    "CONTROL_GROUP_DUPLICATE",
    "$.controlGroups[3].id",
  );
  invalid(
    "group-parent",
    (d) => {
      responseObject(d, "controlGroups", 0).parentId = "missing";
    },
    "CONTROL_GROUP_PARENT",
    "$.controlGroups[0].parentId",
  );
  invalid(
    "group-cycle",
    (d) => {
      responseObject(d, "controlGroups", 0).parentId = "detail";
    },
    "CONTROL_GROUP_CYCLE",
    "$.controlGroups[0].parentId",
  );
  invalid(
    "group-depth",
    (d) => {
      d.controlGroups = [
        ...responseArray(d, "controlGroups"),
        { id: "extra", parentId: "detail", label: { en: "Extra" } },
      ];
      responseObject(d, "controls", 0).group = "extra";
    },
    "CONTROL_GROUP_DEPTH",
    "$.controlGroups[3].parentId",
  );
  invalid(
    "group-label",
    (d) => {
      responseObject(d, "controlGroups", 0).label = { ru: "Группа" };
    },
    "LOCALE_EN_REQUIRED",
    "$.controlGroups[0].label.en",
  );
  invalid(
    "group-order",
    (d) => {
      responseObject(d, "controlGroups", 0).order = -1;
    },
    "CONTROL_ORDER",
    "$.controlGroups[0].order",
  );
  invalid(
    "group-collapsed",
    (d) => {
      responseObject(d, "controlGroups", 0).collapsed = "yes";
    },
    "CONTROL_GROUP_COLLAPSED",
    "$.controlGroups[0].collapsed",
  );
  invalid(
    "group-reference",
    (d) => {
      responseObject(d, "controls", 0).group = "unknown";
    },
    "CONTROL_GROUP_REFERENCE",
    "$.controls[0].group",
  );
  const legacy = responseObject(createControlPresentationDocument());
  delete legacy.controlGroups;
  responseObject(legacy, "controls", 0).group = "appearance";
  delete responseObject(legacy, "controls", 0).unit;
  result.push({
    id: "legacy-no-groups-or-unit",
    document: legacy,
    accepted: true,
  });
  const unknown = structuredClone(legacy);
  responseObject(unknown, "controls", 0).group = "future";
  result.push({
    id: "legacy-unknown-group",
    document: unknown,
    accepted: true,
    diagnostic: {
      severity: "warning",
      code: "CONTROL_GROUP_UNKNOWN",
      path: "$.controls[0].group",
    },
  });
  return result;
}
