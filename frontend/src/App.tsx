import { FormEvent, useMemo, useState } from "react";
import { CONTRACT_ADDRESS, EXPLORER_URL, readClient, waitForBradbury, writeClient } from "./genlayer";
import { readShipment, sendShipmentAction } from "./workflow";

type Shipment = Record<string, any>;
type Tx = { state: "idle" | "pending" | "success" | "error"; message?: string; hash?: string };

const DEFAULT_PROOF = "https://www.fmc.gov/resources/consumer-assistance/";

function asJson(value: any): Shipment {
  if (typeof value === "string") {
    try { return JSON.parse(value); } catch { return { raw: value }; }
  }
  return value || {};
}

export default function App() {
  const [account, setAccount] = useState("");
  const [tx, setTx] = useState<Tx>({ state: "idle" });
  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [form, setForm] = useState({
    shipmentId: "CP-2026-001", carrier: "", cargo: "Temperature-sensitive medicine",
    origin: "Ho Chi Minh City, VN", destination: "Singapore, SG", window: "1440",
    bookingUrl: DEFAULT_PROOF, deliveryUrl: DEFAULT_PROOF, counterUrl: DEFAULT_PROOF,
    reason: "The delivered package was reported damaged on arrival.", escrow: "0.01",
  });
  const clientReady = useMemo(() => Boolean(CONTRACT_ADDRESS && CONTRACT_ADDRESS !== "0x0000000000000000000000000000000000000000"), []);

  const set = (key: string, value: string) => setForm((old) => ({ ...old, [key]: value }));

  async function connect() {
    if (!window.ethereum) { setTx({ state: "error", message: "Install a wallet extension that supports Bradbury." }); return; }
    try {
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      setAccount(accounts[0] || "");
      setTx({ state: "success", message: "Wallet connected. Switch the wallet to GenLayer Bradbury before sending." });
    } catch (e: any) { setTx({ state: "error", message: e?.message || String(e) }); }
  }

  async function write(name: string, args: any[], value = "0") {
    if (!clientReady) throw new Error("Set VITE_CONTRACT_ADDRESS to the deployed CargoProof contract first.");
    if (!account) throw new Error("Connect the wallet first.");
    setTx({ state: "pending", message: `Submitting ${name} to Bradbury…` });
    const client: any = writeClient(account as `0x${string}`);
    const hash = await sendShipmentAction(client, CONTRACT_ADDRESS, name, args, BigInt(value));
    await waitForBradbury(client, String(hash));
    setTx({ state: "success", message: `${name} accepted on Bradbury.`, hash: String(hash) });
    // Bind the UI to the post-execution state, not to a guessed local result.
    const latest_state = await loadShipment(form.shipmentId);
    if (latest_state) setShipment(latest_state);
  }

  async function loadShipment(id = form.shipmentId): Promise<Shipment | null> {
    if (!clientReady || !id) return null;
    try {
      const raw = await readShipment(readClient() as any, CONTRACT_ADDRESS, id);
      const latest = asJson(raw);
      setShipment(latest);
      return latest;
    } catch (e: any) { setTx({ state: "error", message: `Read failed: ${e?.message || String(e)}` }); return null; }
  }

  async function action(event: FormEvent, name: string, args: any[], value = "0") {
    event.preventDefault();
    try { await write(name, args, value); } catch (e: any) { setTx({ state: "error", message: e?.message || String(e) }); }
  }

  const addressLink = clientReady ? `${EXPLORER_URL}/address/${CONTRACT_ADDRESS}` : "#";

  return <main className="shell">
    <header className="hero">
      <div><span className="eyebrow">GENLAYER BRADBURY · INDUSTRY WORKFLOW</span><h1>CargoProof</h1><p>Freight delivery escrow where public evidence and validator consensus decide the payout.</p></div>
      <div className="hero-actions"><button onClick={connect}>{account ? `${account.slice(0, 6)}…${account.slice(-4)}` : "Connect wallet"}</button><a href={addressLink} target="_blank">Contract explorer ↗</a></div>
    </header>

    {!clientReady && <div className="notice">Deployment address is not configured yet. Deploy <code>contracts/cargoproof.py</code> to Bradbury, then set <code>VITE_CONTRACT_ADDRESS</code> in <code>frontend/.env.local</code>.</div>}
    {tx.state !== "idle" && <div className={`tx ${tx.state}`}><strong>{tx.state === "pending" ? "Processing" : tx.state === "success" ? "Done" : "Action needed"}</strong> {tx.message}{tx.hash && <> · <a href={`${EXPLORER_URL}/tx/${tx.hash}`} target="_blank">view transaction</a></>}</div>}

    <section className="workflow"><div className="section-title"><span>01—06</span><h2>One shipment, one explicit decision path</h2></div>
      <div className="steps"><div><b>01</b><strong>Buyer deposits escrow</strong><small>Creates an OPEN shipment with a block delivery window.</small></div><div><b>02</b><strong>Carrier posts proof</strong><small>Submits a public HTTPS POD or tracking source.</small></div><div><b>03</b><strong>Buyer confirms or disputes</strong><small>Normal delivery pays immediately; a challenge cannot be reclaimed directly.</small></div><div><b>04</b><strong>Validators fetch evidence</strong><small>GenLayer compares booking, delivery and counter-evidence origins.</small></div><div><b>05</b><strong>Contract settles once</strong><small>Carrier receives a valid delivery payout or buyer receives a refund.</small></div><div><b>06</b><strong>Neutral timeout</strong><small>If the carrier is inactive past the window, the buyer can recover escrow.</small></div></div>
    </section>

    <section className="grid">
      <form className="card" onSubmit={(e) => action(e, "create_shipment", [form.shipmentId, form.carrier, form.cargo, form.origin, form.destination, Number(form.window), form.bookingUrl], form.escrow)}><div className="card-head"><span className="number">01</span><div><h2>Create shipment</h2><p>Buyer action · escrow is sent with this transaction</p></div></div><div className="fields"><label>Shipment ID<input value={form.shipmentId} onChange={(e) => set("shipmentId", e.target.value)} /></label><label>Carrier address<input required placeholder="0x…" value={form.carrier} onChange={(e) => set("carrier", e.target.value)} /></label><label>Cargo description<input value={form.cargo} onChange={(e) => set("cargo", e.target.value)} /></label><label>Delivery window (blocks)<input type="number" min="1" max="100000" value={form.window} onChange={(e) => set("window", e.target.value)} /></label><label>Origin<input value={form.origin} onChange={(e) => set("origin", e.target.value)} /></label><label>Destination<input value={form.destination} onChange={(e) => set("destination", e.target.value)} /></label><label className="wide">Booking / policy evidence URL<input type="url" required value={form.bookingUrl} onChange={(e) => set("bookingUrl", e.target.value)} /></label><label>Escrow (GEN base units)<input value={form.escrow} onChange={(e) => set("escrow", e.target.value)} /><small>Use the smallest test value accepted by your wallet; this field is converted to wei-like base units.</small></label></div><button className="primary">Create and lock escrow</button></form>

      <div className="card"><div className="card-head"><span className="number">02</span><div><h2>Carrier submits delivery</h2><p>Carrier action · only the recorded carrier can call this</p></div></div><form onSubmit={(e) => action(e, "submit_delivery", [form.shipmentId, form.deliveryUrl])}><label>Delivery proof URL<input type="url" required value={form.deliveryUrl} onChange={(e) => set("deliveryUrl", e.target.value)} /></label><button className="primary">Mark delivered</button></form><div className="divider" /><div className="card-head"><span className="number">03</span><div><h2>Buyer chooses outcome</h2><p>Confirm pays carrier; dispute starts neutral adjudication.</p></div></div><div className="button-row"><button onClick={(e) => action(e, "confirm_delivery", [form.shipmentId])}>Confirm & pay carrier</button><button className="danger" onClick={(e) => action(e, "dispute_delivery", [form.shipmentId, form.counterUrl, form.reason])}>Open dispute</button></div><label>Counter-evidence URL<input type="url" value={form.counterUrl} onChange={(e) => set("counterUrl", e.target.value)} /></label><label>Dispute reason<textarea value={form.reason} onChange={(e) => set("reason", e.target.value)} /></label></div>

      <div className="card"><div className="card-head"><span className="number">04</span><div><h2>Adjudicate the dispute</h2><p>Either shipment party can trigger validator consensus.</p></div></div><p className="explain">Validators independently fetch the three HTTPS sources. Their comparative principle requires the delivered decision to agree and the rationale to address the evidence origins and route.</p><button className="primary" onClick={(e) => action(e, "adjudicate", [form.shipmentId])}>Run GenLayer adjudication</button><div className="divider" /><div className="card-head"><span className="number">05</span><div><h2>Read the settlement</h2><p>Inspect the exact on-chain state after any step.</p></div></div><div className="button-row"><button onClick={() => loadShipment()}>Read shipment</button><button className="danger" onClick={(e) => action(e, "timeout_shipment", [form.shipmentId])}>Refund after timeout</button></div>{shipment && <pre className="result">{JSON.stringify(shipment, null, 2)}</pre>}</div>
    </section>
    <footer>Built for reproducible Bradbury review · <a href="https://github.com/Jinchainne/cargoproof-bradbury" target="_blank">repository</a> · evidence URLs remain visible in the adjudication state.</footer>
  </main>;
}
