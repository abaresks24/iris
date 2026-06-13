import type { Metadata } from "next";
import { PageTopbar } from "@/components/PageTopbar";

export const metadata: Metadata = {
  title: "Iris — Learn options",
  description:
    "A clear, detailed guide to options: what they are, why they're useful, how they're priced, and how to trade them on Iris.",
};

const TOC: [string, string][] = [
  ["what", "What is an option?"],
  ["calls-puts", "Calls vs. puts"],
  ["vocab", "The vocabulary"],
  ["two-sides", "Buyer vs. seller"],
  ["pricing", "How a price is built"],
  ["greeks", "The greeks, simply"],
  ["why", "Why options are useful"],
  ["retail", "Why they fit retail"],
  ["csp", "Strategy: cash-secured put"],
  ["cc", "Strategy: covered call"],
  ["call", "Strategy: buy a call"],
  ["orderbook", "How trading works"],
  ["how-iris", "How to trade on Iris"],
  ["risks", "Risks to watch"],
  ["glossary", "Glossary"],
];

export default function Learn() {
  return (
    <>
      <PageTopbar active="learn" />
      <div className="doc-layout">
        <aside className="doc-toc">
          <span className="toc-title">Contents</span>
          {TOC.map(([id, label]) => (
            <a key={id} href={`#${id}`}>
              {label}
            </a>
          ))}
        </aside>

        <article className="prose">
          <h1>Learn: options, from zero</h1>
          <p className="lede">
            Options sound intimidating, but the core idea is simple and useful.
            This guide builds you up from &quot;what is an option&quot; to actually
            placing a yield-earning trade — with concrete numbers throughout
            (we&apos;ll use ETH at around $1,700).
          </p>

          <h2 id="what">What is an option?</h2>
          <p>
            An option is a <strong>contract that gives the right — but not the
            obligation — to buy or sell an asset at a fixed price, before a set
            date.</strong> You pay a small amount today (the{" "}
            <strong>premium</strong>) for that right.
          </p>
          <p>
            Think of it like a deposit on a house. You pay €5,000 to lock the
            right to buy a €300,000 house at that price for 3 months. If prices
            jump, you exercise and buy cheap. If they crash, you walk away — you
            only lose the €5,000 deposit. That asymmetry — small, known cost for a
            large, optional upside — is the heart of options.
          </p>
          <div className="callout ex">
            <span className="tag">Key idea</span>
            The <em>buyer</em> of an option has a right and a known, capped cost.
            The <em>seller</em> takes on an obligation in exchange for cash (the
            premium) up front. Iris&apos; yield products are mostly about being a
            smart, fully-collateralised <em>seller</em>.
          </div>

          <h2 id="calls-puts">Calls vs. puts</h2>
          <p>There are exactly two kinds of option:</p>
          <ul>
            <li>
              <strong>Call</strong> — the right to <strong>buy</strong> the asset
              at the strike. You want a call when you think the price will{" "}
              <strong>go up</strong>.
            </li>
            <li>
              <strong>Put</strong> — the right to <strong>sell</strong> the asset
              at the strike. You want a put when you think the price will{" "}
              <strong>go down</strong> (or to insure something you own).
            </li>
          </ul>
          <p>
            Mnemonic: you <strong>call</strong> something <em>up</em> to you (buy),
            you <strong>put</strong> something <em>down</em> / away (sell).
          </p>

          <h2 id="vocab">The vocabulary</h2>
          <table>
            <thead>
              <tr><th>Term</th><th>Meaning</th></tr>
            </thead>
            <tbody>
              <tr><td><strong>Underlying</strong></td><td>the asset the option is about (e.g. ETH).</td></tr>
              <tr><td><strong>Strike</strong></td><td>the fixed price you can buy/sell at.</td></tr>
              <tr><td><strong>Expiry</strong></td><td>the date the option ends.</td></tr>
              <tr><td><strong>Premium</strong></td><td>the price of the option itself — paid by the buyer, received by the seller.</td></tr>
              <tr><td><strong>Contract size</strong></td><td>how much underlying one option covers (on Derive, 1 option = 1 unit, e.g. 1 ETH).</td></tr>
              <tr><td><strong>ITM</strong> (in-the-money)</td><td>the option already has intrinsic value (call: spot &gt; strike; put: spot &lt; strike).</td></tr>
              <tr><td><strong>OTM</strong> (out-of-the-money)</td><td>no intrinsic value yet — only time value.</td></tr>
              <tr><td><strong>Exercise</strong></td><td>the buyer uses their right.</td></tr>
              <tr><td><strong>Assignment</strong></td><td>the seller is forced to fulfil it (buy/sell at the strike).</td></tr>
              <tr><td><strong>Settlement</strong></td><td>how it&apos;s closed at expiry (Derive settles in USDC against an index price).</td></tr>
            </tbody>
          </table>

          <h2 id="two-sides">Buyer vs. seller (the two sides)</h2>
          <p>Every option has a buyer and a seller. Their positions are mirror images:</p>
          <table>
            <thead>
              <tr><th></th><th>Buyer (long)</th><th>Seller (short)</th></tr>
            </thead>
            <tbody>
              <tr><td>Premium</td><td>pays it</td><td>receives it (your yield)</td></tr>
              <tr><td>Right / obligation</td><td>has the right</td><td>has the obligation</td></tr>
              <tr><td>Max gain</td><td>large / unbounded</td><td>the premium</td></tr>
              <tr><td>Max loss</td><td>the premium</td><td>large (unless collateralised)</td></tr>
              <tr><td>Wants</td><td>a big move</td><td>calm / time to pass</td></tr>
            </tbody>
          </table>
          <div className="callout">
            <span className="tag">The Iris twist</span>
            Selling options earns income but is &quot;risky&quot; in textbooks
            because the loss can be large. Iris only does{" "}
            <strong>fully-collateralised</strong> selling — the worst case is
            pre-funded — so there are no margin calls and no liquidations. That
            turns a scary strategy into a clean yield product.
          </div>

          <h2 id="pricing">How an option&apos;s price is built</h2>
          <p>A premium is made of two parts:</p>
          <pre className="payoff">{`premium = intrinsic value  +  time value

intrinsic value = what it's worth if exercised right now
   call:  max(0, spot − strike)
   put:   max(0, strike − spot)

time value = extra paid for the chance it moves your way
   before expiry — driven mostly by:
     • time left   (more time → more value)
     • volatility  (wilder asset → more value)`}</pre>
          <p>
            Example: ETH is $1,700. A call with strike $1,650 has{" "}
            <strong>$50 of intrinsic value</strong> ($1,700 − $1,650). If it trades
            at $80, the other <strong>$30 is time value</strong>. An OTM option
            (e.g. a $1,800 call) has <em>zero</em> intrinsic value — its whole
            premium is time value, and it decays to zero if the move never comes.
          </p>

          <h3>Implied volatility (IV)</h3>
          <p>
            IV is the market&apos;s expectation of how much the asset will move.
            It&apos;s the single biggest driver of time value:{" "}
            <strong>higher IV → fatter premiums</strong>. As a seller (the Iris
            yield strategies), high IV is good — you get paid more. Iris shows the
            IV on every option so you can see when premiums are rich.
          </p>

          <h2 id="greeks">The greeks, in plain language</h2>
          <p>
            &quot;Greeks&quot; just measure how the premium reacts to things. You
            don&apos;t need the maths — only the intuition:
          </p>
          <table>
            <thead>
              <tr><th>Greek</th><th>Answers</th><th>For an Iris seller</th></tr>
            </thead>
            <tbody>
              <tr><td><strong>Delta</strong></td><td>how much the premium moves per $1 of the asset</td><td>roughly your odds of being assigned</td></tr>
              <tr><td><strong>Theta</strong></td><td>how much value decays per day</td><td>works <em>for</em> you — time decay is your income</td></tr>
              <tr><td><strong>Vega</strong></td><td>sensitivity to IV changes</td><td>you sold vol; falling IV helps you</td></tr>
              <tr><td><strong>Gamma</strong></td><td>how fast delta changes</td><td>how quickly risk ramps near the strike</td></tr>
            </tbody>
          </table>
          <p>
            Derive computes all of these server-side — Iris just displays them.
            You never calculate anything.
          </p>

          <h2 id="why">Why options are useful</h2>
          <ul>
            <li><strong>Income</strong> — sell options to collect premium as recurring yield (the core Iris use-case).</li>
            <li><strong>Insurance / hedging</strong> — buy a put to protect a holding from a crash, like an insurance policy.</li>
            <li><strong>Leverage with defined risk</strong> — buy a call for big upside while risking only the premium.</li>
            <li><strong>Precision</strong> — express &quot;I&apos;m fine owning ETH below $1,600&quot; or &quot;I&apos;ll cap my upside at $1,800 for extra yield&quot; — views you can&apos;t express by just holding spot.</li>
          </ul>

          <h2 id="retail">Why they fit retail (the Iris angle)</h2>
          <ul>
            <li><strong>Defined, known risk</strong> — fully collateralised, so no liquidation and no surprise debt.</li>
            <li><strong>Real yield</strong> — premiums are paid by the market, not printed by a token.</li>
            <li><strong>Small capital</strong> — start with the size of one contract.</li>
            <li><strong>Plain framing</strong> — Iris turns &quot;sell a 0.25-delta put&quot; into &quot;deposit USDC, earn X% APR, worst case buy ETH cheaper.&quot;</li>
          </ul>

          <h2 id="csp">Strategy: the cash-secured put ⭐</h2>
          <p>
            The flagship. You <strong>sell a put</strong> and set aside the cash to
            buy the asset if you&apos;re assigned. You get paid to agree to buy
            something you&apos;d be happy to own — at a discount.
          </p>
          <div className="callout ex">
            <span className="tag">Worked example</span>
            ETH is $1,700. You sell one <strong>$1,600 put, 30 days</strong>, and
            collect a <strong>$45 premium</strong>. You lock <strong>$1,600
            USDC</strong> as collateral.
            <br />• If ETH stays above $1,600 → the put expires worthless, you keep
            the $45. Return = 45 / 1,600 ≈ 2.8% in 30 days ≈ <strong>34%
            APR</strong>.
            <br />• If ETH falls below $1,600 → you buy 1 ETH at $1,600, but you
            kept $45, so your effective cost is <strong>$1,555</strong> — cheaper
            than the $1,700 it was when you started.
          </div>
          <pre className="payoff">{`Cash-secured put — payoff at expiry (sold $1,600 put, +$45)

 profit
   +45 ┤━━━━━━━━━━━━━━━━━●────────────  ← keep premium if ETH ≥ 1600
     0 ┤            ╱
       ┤          ╱
       ┤        ╱
  −loss┤      ╱   (you own ETH below 1600, but cheaper)
       └──────┼────────┼───────────────▶ ETH price
            1555     1600
         breakeven  strike`}</pre>
          <p>
            You win in two of three scenarios (price up or flat → keep premium;
            price down a bit → still above breakeven). You only &quot;lose&quot;
            if ETH drops hard — and even then you simply own ETH you wanted, bought
            below today&apos;s price. This is why it maps cleanly to{" "}
            <strong>&quot;deposit USDC, earn APR.&quot;</strong>
          </p>

          <h2 id="cc">Strategy: the covered call</h2>
          <p>
            You already <strong>own the asset</strong> and sell a call against it to
            earn extra yield. The trade-off: you cap your upside.
          </p>
          <div className="callout ex">
            <span className="tag">Worked example</span>
            You hold 1 ETH ($1,700). You sell one <strong>$1,800 call, 30
            days</strong>, collecting <strong>$40</strong>.
            <br />• ETH below $1,800 at expiry → keep your ETH <em>and</em> the $40.
            <br />• ETH above $1,800 → your ETH is sold (&quot;called away&quot;) at
            $1,800; with the $40 you effectively sold at $1,840.
          </div>
          <pre className="payoff">{`Covered call — you hold ETH + sold $1,800 call (+$40)

 profit
       ┤            ╱──────────●─────── ← upside capped above 1800
   +40 ┤          ╱
     0 ┤────────●
       ┤      ╱
       ┤    ╱  (still exposed to ETH falling)
       └────┼──────────┼──────────────▶ ETH price
          1660       1800
       breakeven*   strike      (*on the ETH you hold)`}</pre>

          <h2 id="call">Strategy: buying a call</h2>
          <p>
            The simplest bullish bet. You <strong>buy a call</strong>: big upside,
            and the most you can lose is the premium.
          </p>
          <div className="callout ex">
            <span className="tag">Worked example</span>
            ETH is $1,700. You buy one <strong>$1,800 call, 30 days</strong>, for{" "}
            <strong>$40</strong>.
            <br />• ETH above $1,840 → profit (strike + premium = breakeven).
            <br />• ETH below $1,800 → the call expires worthless; you lose only the
            $40, nothing more.
          </div>
          <pre className="payoff">{`Long call — bought $1,800 call (−$40)

 profit
       ┤                    ╱──────────
     0 ┤━━━━━━━━━━━━━━━━●──╱   ← unlimited upside
   −40 ┤───────────────●         loss capped at premium
       └───────────────┼──┼──────────▶ ETH price
                     1800 1840
                    strike breakeven`}</pre>

          <h2 id="orderbook">How trading actually works</h2>
          <p>
            Derive runs an <strong>orderbook</strong>, like a stock exchange. At any
            moment there&apos;s a <strong>best bid</strong> (highest price buyers
            will pay) and a <strong>best ask</strong> (lowest price sellers will
            take). When you sell a put, you&apos;re hitting the bid; when you buy a
            call, you&apos;re lifting the ask.
          </p>
          <ul>
            <li><strong>Limit order</strong> — &quot;trade only at this price or better.&quot; Iris places a limit that crosses the spread so it fills immediately.</li>
            <li><strong>Matching</strong> — Derive matches your order off-chain (fast), then settles it on-chain (non-custodial).</li>
            <li><strong>Fully collateralised</strong> — because your worst case is pre-funded, there&apos;s no margin engine that can liquidate you.</li>
          </ul>
          <p>
            Each order you place is cryptographically <strong>signed</strong> —
            it&apos;s a precise authorization (this instrument, this size, this
            price, this fee cap). That&apos;s what makes a fast off-chain orderbook
            safe and non-custodial. (See the{" "}
            <a href="/docs#signing">Docs → Order signing</a> for the mechanics.)
          </p>

          <h2 id="how-iris">How to trade on Iris</h2>
          <ol>
            <li><strong>Connect</strong> with Privy (email/social → an embedded wallet, or your own wallet).</li>
            <li><strong>Fund</strong> — pick any token on any chain; LI.FI routes it into USDC on Derive Chain.</li>
            <li><strong>Pick a yield</strong> — browse live cash-secured puts shown as APR. Each card has the premium, collateral, breakeven and IV.</li>
            <li><strong>Earn</strong> — click a card, confirm; Iris signs the order and it hits Derive&apos;s live book.</li>
            <li><strong>Track</strong> — your position, collateral and P&amp;L show in Portfolio; closed trades in History.</li>
          </ol>

          <h2 id="risks">Risks to watch</h2>
          <ul>
            <li><strong>Assignment / direction.</strong> Selling a put means you may have to buy the asset. Only sell puts on assets you&apos;d be happy to own.</li>
            <li><strong>Capped upside.</strong> A covered call gives up gains above the strike. Fine if you&apos;re neutral-to-mildly-bullish.</li>
            <li><strong>Time decay (for buyers).</strong> A bought call loses value every day if the move doesn&apos;t come — theta works against you.</li>
            <li><strong>Liquidity.</strong> Thin books mean worse fills; Iris flags whether a quote is live or marked.</li>
            <li><strong>Volatility.</strong> Premiums are paid <em>because</em> the asset can move. High yield often means higher risk — IV tells you how much.</li>
          </ul>
          <div className="callout warn">
            <span className="tag">Not financial advice</span>
            Options carry real risk. This page is educational. Start small, on
            testnet, and only with capital you can lose.
          </div>

          <h2 id="glossary">Glossary (quick recap)</h2>
          <ul>
            <li><strong>Call / Put</strong> — right to buy / right to sell at the strike.</li>
            <li><strong>Strike</strong> — the fixed price. <strong>Expiry</strong> — when it ends.</li>
            <li><strong>Premium</strong> — the option&apos;s price (seller&apos;s income).</li>
            <li><strong>ITM / OTM</strong> — has / doesn&apos;t have intrinsic value.</li>
            <li><strong>Assignment</strong> — seller is forced to fulfil the contract.</li>
            <li><strong>IV</strong> — implied volatility; the main driver of premium size.</li>
            <li><strong>Greeks</strong> — delta/theta/vega/gamma: how the premium reacts.</li>
            <li><strong>Cash-secured put</strong> — sell a put, fully backed by USDC = &quot;deposit, earn APR.&quot;</li>
          </ul>

          <p style={{ marginTop: 32 }}>
            Ready? <a href="/app">Launch the app →</a>
          </p>
        </article>
      </div>
    </>
  );
}
