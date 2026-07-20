import { describe, expect, it } from "vitest";

import { isSafeSvgAssetText } from "../src/apps/viewer/assets/model";
import { isSafeSvg } from "../src/sdk/effect-v1/validation-shared";
import { isSafeSvgText } from "../src/sdk/svg-safety";

const validators = [isSafeSvgText, isSafeSvg, isSafeSvgAssetText];

describe("SVG safety boundary", () => {
  it.each(validators)(
    "accepts declarative SVG and local fragment references",
    (validate) => {
      expect(
        validate(
          '<svg xmlns="http://www.w3.org/2000/svg"><defs><path id="shape" d="M0 0h1v1z"/></defs><use href="#shape"/></svg>',
        ),
      ).toBe(true);
    },
  );

  it.each([
    '<svg><image href="//example.test/image.png"/></svg>',
    '<svg><image href="/image.png"/></svg>',
    '<svg><image href="ftp://example.test/image.png"/></svg>',
    '<svg><image href="data:image/png;base64,AA=="/></svg>',
    '<svg><image src="image.png"/></svg>',
    '<svg><style>@import "theme.css";</style></svg>',
    "<svg><style>rect { fill: url(//example.test/fill.svg); }</style></svg>",
    '<svg><rect fill="url(#gradient)"/></svg>',
    "<svg><style>rect { fill: u\\72l(//example.test/fill.svg); }</style></svg>",
    '<svg><rect style="fill: \\75rl(//example.test/fill.svg)"/></svg>',
    '<svg><rect fill="&#x75;rl(&#x2f;&#x2f;example.test/fill.svg)"/></svg>',
    '<svg xml:base="https://example.test/"><use href="#shape"/></svg>',
    '<svg xmlns:remote="urn:remote"><use remote:href="/shape.svg"/></svg>',
    '<svg xmlns:remote="urn:remote"><remote:script>unsafe()</remote:script></svg>',
    '<svg xmlns:ev="urn:events"><rect ev:onload="unsafe()"/></svg>',
    '<?xml version="1.0"?><svg><?xml-stylesheet href="/theme.css"?></svg>',
    '<svg><set attributeName="href" to="https://example.test/image.svg"/></svg>',
    '<svg><animate attributeName="xlink:href" values="#safe;/remote.svg"/></svg>',
    '<svg><animateTransform attributeName="transform" values="scale(1);scale(2)"/></svg>',
    '<svg><discard href="#shape" begin="1s"/></svg>',
    "<svg><foreignObject><div>unsafe</div></foreignObject></svg>",
    "<svg><script>unsafe()</script></svg>",
    '<svg><rect onclick="unsafe()"/></svg>',
    '<!DOCTYPE svg SYSTEM "file:///tmp/entity"><svg/>',
  ])("rejects URL-bearing or executable SVG: %s", (svg) => {
    for (const validate of validators) {
      expect(validate(svg)).toBe(false);
    }
  });
});
