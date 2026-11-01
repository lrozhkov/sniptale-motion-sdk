import type { ViewerAppContext } from "./context.js";

export function observeSidebarHeader(ctx: ViewerAppContext): void {
  const header = ctx.refs.appShell.querySelector(".topbar");
  if (!(header instanceof HTMLElement)) {
    throw new Error("Viewer header is missing.");
  }
  const sync = () => {
    const bottom =
      header.getBoundingClientRect().bottom -
      ctx.refs.appShell.getBoundingClientRect().top;
    ctx.refs.appShell.style.setProperty(
      "--viewer-header-bottom",
      `${bottom}px`,
    );
  };
  const observer = new ResizeObserver(sync);
  observer.observe(header);
  observer.observe(ctx.refs.appShell);
  sync();
  window.addEventListener("pagehide", (event) => {
    if (!event.persisted) observer.disconnect();
  });
}
