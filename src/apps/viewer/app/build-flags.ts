export const includesLocalDemoPack =
  typeof __EFFECT_SDK_LOCAL_DEMO_PACK__ === "boolean"
    ? __EFFECT_SDK_LOCAL_DEMO_PACK__
    : true;

export const includesLocalEffects =
  typeof __EFFECT_SDK_LOCAL_EFFECTS__ === "boolean"
    ? __EFFECT_SDK_LOCAL_EFFECTS__
    : false;
