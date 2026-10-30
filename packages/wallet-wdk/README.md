# @flashyfinancial/wallet-wdk

Governed economic agency for FlashyOS agents on Tether WDK. This is the
package an agent runtime, a signer, or a stranger verifying our records
installs; it carries no dependency on the FlashyOS API.

Four things live here:

- **The wire types and the extractors.** `OperationRecord` — kind, chain,
  asset, amount in base units, destination — is the one description of a
  spend that the plane, the signer and the agent all agree on. The extractors
  derive it from a real call: an EVM transaction (`extractEvmOperation`), a
  TRON transaction (`extractTronOperation`), a swap or bridge protocol call
  (`extractSwap`, `extractBridge`), an EIP-3009 typed-data transfer. What the
  packs vouch for, per family and protocol, is published in
  `docs/wallet/schema/extractor-packs.json` from `EXTRACTOR_MANIFEST` and
  drift-checked by test. A call no extractor can read is refused, not
  guessed.
- **The authorizer client and the AAO capability.** `FlashyOSAuthorizer`
  asks the plane for a verdict on a record — `ALLOW` with a signed
  `SpendAuthorization`, `ESCALATE` with a decision id a human will resolve,
  or `DENY` with a code — and `FlashyOSWalletCapability` is the same thing
  as an AAO `WalletCapability`, so an agent built on `@flashyos/aao`
  declares it like any other capability. `remoteAuthorizationRule` plugs the
  same verdict into WDK's own policy engine as a second line.
- **Interop.** `signInvoice` / `verifyInvoice` and `signReceipt` /
  `verifyReceipt` are the signed documents two organizations exchange, with
  `verifyPlaneDocument` resolving the signing key from a plane's published
  identity. `parseX402Challenge` turns an HTTP 402 into a bounded record the
  plane can rule on, and `eip3009TypedData` builds the transfer the signer
  signs off-chain.
- **Provenance.** `verifyExport` checks an organization's hash-chained
  export and its signed Merkle root offline, with nothing but the public
  key; `metricsFromExport` re-derives the weekly numbers from the export so
  the figures on a page can be checked against the bytes behind them.

## Use, from an agent

```ts
import { FlashyOSAuthorizer, extractOperation } from '@flashyfinancial/wallet-wdk';

const authorizer = new FlashyOSAuthorizer({ baseUrl: 'https://api.flashyos.com', orgId, agentToken });

const record = extractOperation('evm:84532', { to: USDT, data: transferCalldata(VENDOR, 12_000_000n) });
if (!record) throw new Error('not a call this package can describe');

const verdict = await authorizer.propose(record);
// { verdict: 'ALLOW', authorization }   → hand authorization + the same call to the signer
// { verdict: 'ESCALATE', decisionId }   → a human decides; poll or wait for the event
// { verdict: 'DENY', code, reason }     → PER_TX_CAP, DESTINATION_NOT_PERMITTED, …
```

## Use, from a stranger

```ts
import { verifyReceipt, verifyExport } from '@flashyfinancial/wallet-wdk';

verifyReceipt(receipt, { trustedKeys: [planePublicKeyPem] }); // { ok: true } or the code for what failed
verifyExport(exportText, { root: signedRoot, publicKey });     // every hash re-computed, the root re-verified
```

Both run offline. Neither needs an account, a token, or the API.

## What it refuses

- An amount that is not a non-negative integer string in base units.
- A chain outside `<family>:<id>`, an asset that is not an exact address or
  `native`, a destination that is not an exact address.
- A swap or bridge whose protocol is not in the manifest.
- A receipt or invoice whose signed fields do not canonicalize to the
  signature, or whose window has passed.
- A verdict it cannot parse: `AuthorizerRefused` carries the plane's own
  code, `AuthorizerUnreachable` says the plane did not answer, and neither
  is ever silently `ALLOW`.

## Testnets only

Nothing here signs or broadcasts; the signer does, and the signer's table of
chains is testnets only. This package will describe a mainnet call — an
extractor reads calldata, not policy — but the plane refuses a chain it has
no envelope for, and the signer refuses to construct for one.

## Read more

`docs/wallet/spec.md` (the contract), `docs/wallet/interop.md` (invoices,
receipts, x402), `docs/wallet/provenance.md` (the export and the seal),
`docs/wallet/schema/` (the JSON Schemas, generated from the validators this
package and the API share, drift-checked by test).
