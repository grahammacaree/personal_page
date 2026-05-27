import assert from "node:assert/strict";
import test from "node:test";
import { homePageHref } from "./site-config.mjs";

const siteConfig = {
  home: { output: "index.html", pageType: "home", sections: [] },
};

test("homePageHref uses site root when home output is index.html", () => {
  assert.equal(
    homePageHref({ output: "cv.html" }, { siteConfig, basePath: "/" }),
    "/"
  );
  assert.equal(
    homePageHref({ output: "stories/foo.html" }, { siteConfig, basePath: "/" }),
    "/"
  );
});
