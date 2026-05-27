import assert from "node:assert/strict";
import test from "node:test";
import { renderTemplate } from "./html.mjs";

test("interpolates variables", () => {
  assert.equal(renderTemplate("<p>{{x}}</p>", { x: "hi" }), "<p>hi</p>");
});

test("truthy conditional block", () => {
  const tpl = "{{#on}}yes{{/on}}{{#off}}no{{/off}}";
  assert.equal(renderTemplate(tpl, { on: true, off: false }), "yes");
});

test("inverse conditional block", () => {
  const tpl = "{{^off}}nope{{/off}}{{#on}}ok{{/on}}";
  assert.equal(renderTemplate(tpl, { on: true, off: false }), "nopeok");
});

test("nested conditionals", () => {
  const tpl = "{{#a}}A{{#b}}B{{/b}}C{{/a}}";
  assert.equal(renderTemplate(tpl, { a: true, b: true }), "ABC");
  assert.equal(renderTemplate(tpl, { a: true, b: false }), "AC");
});
