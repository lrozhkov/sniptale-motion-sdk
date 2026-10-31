import type * as Fields from "../../src/apps/viewer/panels/control-fields.js";
import type * as Groups from "../../src/apps/viewer/panels/control-groups.js";
import type * as Icons from "../../src/apps/viewer/panels/control-icons.js";
import type * as Locale from "../../src/shared/i18n/index.js";
import type * as Model from "../../src/sdk/effect-v1/control-presentation-model.js";

declare global {
  interface Window {
    ControlPanelProof: typeof Fields &
      typeof Groups &
      typeof Icons &
      typeof Locale &
      typeof Model;
  }
}
