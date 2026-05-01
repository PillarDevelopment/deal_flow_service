import assert from "node:assert/strict";
import { test } from "node:test";
import {
  normalizeActivityType,
  normalizeBoolean,
  normalizeCampaignStatus,
  normalizeDealPropertyStatus,
  normalizeDealStage,
  normalizeHypothesisStatus,
  normalizeNumber,
  normalizeString,
  normalizeStringArray,
} from "../src/validation.js";

test("normalizes free-form values for CRM payloads", () => {
  assert.equal(normalizeString("  Иван  "), "Иван");
  assert.equal(normalizeString(null), "");
  assert.equal(normalizeNumber("12000000"), 12000000);
  assert.equal(normalizeNumber("abc"), null);
  assert.equal(normalizeBoolean("true"), true);
  assert.equal(normalizeBoolean("false"), false);
});

test("normalizes enum values with safe fallbacks", () => {
  assert.equal(normalizeDealStage("meeting"), "meeting");
  assert.equal(normalizeDealStage("bad-stage"), "new_lead");
  assert.equal(normalizeDealPropertyStatus("sent"), "sent");
  assert.equal(normalizeDealPropertyStatus("bad-status"), "shortlist");
  assert.equal(normalizeActivityType("call"), "call");
  assert.equal(normalizeActivityType("bad-type"), "note");
  assert.equal(normalizeCampaignStatus("running"), "running");
  assert.equal(normalizeCampaignStatus("bad-status"), "draft");
  assert.equal(normalizeHypothesisStatus("approved"), "approved");
  assert.equal(normalizeHypothesisStatus("bad-status"), "draft");
});

test("normalizes arrays as unique trimmed strings", () => {
  assert.deepEqual(normalizeStringArray([" Москва ", "Москва", "", "Кипр"]), ["Москва", "Кипр"]);
  assert.deepEqual(normalizeStringArray("Москва"), []);
});
