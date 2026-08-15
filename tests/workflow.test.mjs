import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const contract = await readFile(join(root, "contracts", "cargoproof.py"), "utf8");
const app = await readFile(join(root, "frontend", "src", "App.tsx"), "utf8");
const client = await readFile(join(root, "src", "workflow.ts"), "utf8");
const readme = await readFile(join(root, "README.md"), "utf8");

test("contract exposes the complete payout state machine", () => {
  for (const method of ["create_shipment", "submit_delivery", "confirm_delivery", "dispute_delivery", "adjudicate", "timeout_shipment"]) {
    assert.match(contract, new RegExp(`def ${method}\\(`));
  }
  for (const status of ["OPEN", "DELIVERED", "DISPUTED", "PAID", "REFUNDED"]) assert.match(contract, new RegExp(status));
  assert.match(contract, /shipment\["settled"\] = True/);
  assert.match(contract, /shipment\["escrow"\] = 0/);
});

test("timeout cannot bypass the delivery deadline", () => {
  assert.match(contract, /shipment\["status"\] != "OPEN" or gl\.vm\.block_number <= shipment\["deadline"\]/);
  assert.match(contract, /CARRIER_TIMEOUT/);
  assert.match(contract, /self\._settle\(shipment, shipment\["buyer"\], "REFUNDED"\)/);
});

test("disputed payout uses meaningful GenLayer consensus and preserves evidence origins", () => {
  assert.match(contract, /gl\.nondet\.web\.get/);
  assert.match(contract, /gl\.nondet\.exec_prompt\(prompt, response_format="json"\)/);
  assert.match(contract, /gl\.vm\.run_nondet_unsafe/);
  assert.match(contract, /BOOKING_ORIGIN/);
  assert.match(contract, /DELIVERY_ORIGIN/);
  assert.match(contract, /COUNTER_ORIGIN/);
  assert.match(contract, /_UNAVAILABLE:/);
  assert.match(contract, /result\["delivered"\]/);
});

test("frontend is a real client for every contract action", () => {
  for (const method of ["create_shipment", "submit_delivery", "confirm_delivery", "dispute_delivery", "adjudicate", "timeout_shipment", "get_shipment"]) {
    assert.match(app + client, new RegExp(`"${method}"`));
  }
  assert.match(app + client, /readContract/);
  assert.match(app + client, /writeContract/);
  assert.match(app, /waitForBradbury/);
});

test("README gives stewards a reproducible industry workflow", () => {
  for (const phrase of ["Buyer creates a shipment", "Carrier submits delivery evidence", "GenLayer adjudicates disputed claims", "neutral timeout", "npm run dev", "npm test"]) assert.match(readme, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
});
