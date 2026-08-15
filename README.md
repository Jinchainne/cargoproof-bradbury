# CargoProof — freight delivery escrow on GenLayer Bradbury

CargoProof is a small, reproducible proof-of-delivery workflow for freight operators. A buyer deposits GEN for one shipment, the carrier submits a delivery URL, and the buyer either confirms delivery or opens a dispute. A disputed claim is resolved by GenLayer's validator consensus after validators independently fetch the booking, delivery, and counter-evidence sources. The final result settles the escrow exactly once.

## Why this is a real industry workflow

The pattern maps directly to freight forwarders, 3PLs, and marketplace logistics:

1. **Buyer creates a shipment** with cargo, origin, destination, a future block window, a booking or policy URL, and GEN escrow.
2. **Carrier submits delivery evidence** such as a signed POD, carrier tracking page, or warehouse receipt.
3. **Buyer chooses an outcome**: confirm and pay the carrier, or dispute with counter-evidence and a reason.
4. **GenLayer adjudicates disputed claims**. Each validator fetches the evidence independently, keeps the immutable URL origin in its packet, and returns a structured delivered/failed decision.
5. **The contract settles once**: delivered pays the carrier; failed refunds the buyer; an inactive carrier after the delivery window also refunds the buyer through the neutral timeout path.

This makes the business rule auditable: no buyer can reclaim a challenged shipment without adjudication, no carrier can leave a missed delivery window locked forever, and every payout path is represented by an on-chain status.

## Contract workflow

`OPEN → DELIVERED → PAID` is the normal path. A buyer may instead move `DELIVERED → DISPUTED → PAID` or `DELIVERED → DISPUTED → REFUNDED` through GenLayer consensus. An unresponsive carrier follows `OPEN → REFUNDED` through `timeout_shipment` after the block deadline. Escrow is zeroed before the recipient transfer and the `settled` flag prevents a second payout.

The contract is [`contracts/cargoproof.py`](contracts/cargoproof.py). The important GenLayer-native decision is `gl.eq_principle.prompt_comparative(judge, ...)`; `judge` uses both `gl.nondet.web.get` and `gl.nondet.exec_prompt`. The prompt explicitly labels `BOOKING_ORIGIN`, `DELIVERY_ORIGIN`, and `COUNTER_ORIGIN` (or their unavailable equivalents), so validators evaluate both the result and the evidence provenance.

## Run the frontend

```bash
cd frontend
npm install
copy .env.example .env.local
# set VITE_CONTRACT_ADDRESS to the deployed Bradbury CargoProof address
npm run dev
```

Open the Vite URL, connect a Bradbury wallet, then follow the numbered workflow. The UI contains real `readContract` and `writeContract` calls for every action; it is not a screenshot-only demo.

## Deploy to Bradbury

Deploy `contracts/cargoproof.py` in GenLayer Studio/CLI using the pinned `py-genlayer` dependency at the top of the file. After deployment, copy the contract address into `frontend/.env.local`. Add the Bradbury Explorer address to the project submission as contract evidence. Keep the deployed source and repository commit paired so reviewers can reproduce the exact code.

## Test the project

```bash
cd ..
npm test
```

The repository tests are behavioral contract/client checks: they verify every payout branch, the neutral timeout guard, evidence-origin handling, and that the frontend is wired to the actual contract methods. For a live Bradbury run, use a small delivery window, create a shipment with test GEN, submit a delivery URL, then exercise confirm or dispute/adjudicate from separate wallets.

## Evidence URL guidance

Use HTTPS pages that a validator can fetch without a login: a carrier tracking page, signed POD hosted by the operator, warehouse receipt, or a stable public document. The URL is treated as evidence, not as executable instructions. A failed fetch is recorded as `*_UNAVAILABLE_ORIGIN:<url>` and remains visible to the adjudication prompt.
