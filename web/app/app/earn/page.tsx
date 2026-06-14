import { OrderTicket } from "@/components/OrderTicket";

export default function EarnPage() {
  return (
    <div style={{ paddingTop: 28 }}>
      <h1 style={{ fontSize: 40, margin: "0 0 6px" }}>Earn upfront on ETH</h1>
      <p className="muted" style={{ margin: "0 0 4px", maxWidth: 640 }}>
        Post an order, collect the premium immediately. Premium is priced live and
        shown as APR for your size and expiry. Fully collateralised on Arc — no
        margin, no liquidations.
      </p>
      <div className="section-title">Order</div>
      <OrderTicket />
      <p className="small muted" style={{ marginTop: 18 }}>
        New to options? <a href="/learn">Learn how it works →</a>
      </p>
    </div>
  );
}
