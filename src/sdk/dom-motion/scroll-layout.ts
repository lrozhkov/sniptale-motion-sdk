/** Retain the source scrollport's layout after overflow becomes visible for 3D. */
export function readDomMotionScrollLayout(
  element: HTMLElement,
  style: CSSStyleDeclaration,
) {
  const px = (value: string) => {
    const number = Number.parseFloat(value);
    return Number.isFinite(number) ? number : 0;
  };
  const scrollport = [style.overflowX, style.overflowY].some((value) =>
    ["auto", "scroll", "hidden"].includes(value),
  );
  const left = Math.max(0, element.clientLeft - px(style.borderLeftWidth));
  const top = Math.max(0, element.clientTop - px(style.borderTopWidth));
  const right = Math.max(
    0,
    element.offsetWidth -
      element.clientWidth -
      px(style.borderLeftWidth) -
      px(style.borderRightWidth) -
      left,
  );
  const bottom = Math.max(
    0,
    element.offsetHeight -
      element.clientHeight -
      px(style.borderTopWidth) -
      px(style.borderBottomWidth) -
      top,
  );
  const widthGutter = left + right >= 1;
  const heightGutter = top + bottom >= 1;
  const borderBox = style.boxSizing === "border-box";
  const outerSize = (base: number, gutter: number, measured: number) =>
    Math.abs(base + gutter - measured) < Math.abs(base - measured)
      ? base + gutter
      : base;
  const width = outerSize(
    px(style.width) +
      (borderBox
        ? 0
        : px(style.paddingLeft) +
          px(style.paddingRight) +
          px(style.borderLeftWidth) +
          px(style.borderRightWidth)),
    left + right,
    element.offsetWidth,
  );
  const height = outerSize(
    px(style.height) +
      (borderBox
        ? 0
        : px(style.paddingTop) +
          px(style.paddingBottom) +
          px(style.borderTopWidth) +
          px(style.borderBottomWidth)),
    top + bottom,
    element.offsetHeight,
  );
  return {
    ...(scrollport && style.minWidth === "auto" ? { minWidth: "0" } : {}),
    ...(scrollport && style.minHeight === "auto" ? { minHeight: "0" } : {}),
    ...(scrollport || widthGutter || heightGutter
      ? { boxSizing: "border-box", width: `${width}px`, height: `${height}px` }
      : {}),
    ...(widthGutter
      ? {
          paddingLeft: `${px(style.paddingLeft) + left}px`,
          paddingRight: `${px(style.paddingRight) + right}px`,
        }
      : {}),
    ...(heightGutter
      ? {
          paddingTop: `${px(style.paddingTop) + top}px`,
          paddingBottom: `${px(style.paddingBottom) + bottom}px`,
        }
      : {}),
  };
}
