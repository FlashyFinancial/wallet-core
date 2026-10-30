# @flashyfinancial/signer

The isolated signer for the FlashyOS wallet authorization plane. It is the
only process that holds a seed, and it never holds the plane's private key.
For every request it does five things in a fixed order:

1. verify the `SpendAuthorization`'s Ed25519 signature and validity window
   against the plane's **public** key;
2. refuse a nonce it has already seen (in memory, or in a file across
   restarts);
3. re-derive the `OperationRecord` from the actual call — the transaction,
   the swap, the bridge, the EIP-3009 typed data — never from the
   authorization;
4. refuse any mismatch between what was authorized and what is being asked
   (kind, chain, asset, destination, amount above the cap), and, where an
   on-chain limit is configured, anything the account contract would refuse;
5. mark the nonce spent, execute through Tether WDK, and report settlement
   back to the plane.

The re-derivation is the point. The authorization says what *may* happen; the
call says what *is* happening. If an agent was authorized to pay vendor A and
the call pays vendor B, no signature makes that acceptable, and this is where
it is caught.

## Testnets only

`TESTNETS` is the whole list of chains this signer will talk to — Base,
Ethereum, Arbitrum and OP Sepolia for EVM, Nile and Shasta for TRON. There is no environment
variable, flag or option that widens it. Every chain backend throws
`MainnetNotEnabled` when constructed for anything else, so a mainnet chain id
cannot reach a seed by mistake. Enabling a mainnet is a change to
`src/testnets.ts`, made in a pull request, after the pilot gate in
`docs/wallet/runbook.md` has been met.

## Use

```ts
import { Signer, WdkChain, FileNonceStore, FlashyOSSettlementReporter, createSignerServer, TESTNETS } from '@flashyfinancial/signer';

const signer = new Signer({
  planePublicKeyPem: process.env.WALLET_AUTHZ_PUBLIC_KEY!,      // the plane's public half only
  chains: [new WdkChain({ chain: TESTNETS[0].chain, seedPhrase: process.env.SIGNER_SEED! })],
  nonces: new FileNonceStore('./nonces.json'),
  settlement: new FlashyOSSettlementReporter({
    baseUrl: process.env.FLASHYOS_API_URL!,
    orgId: process.env.FLASHYOS_ORG_ID!,
    settleToken: process.env.SETTLE_TOKEN!,                     // a token holding wallet:settle and nothing else
  }),
});

// POST /execute { authorization, call } → { ok, txHash } or { ok: false, code, reason }
// POST /sign-typed-data { authorization, typedData } → an EIP-3009 signature, or a refusal
createSignerServer(signer).listen(8787);
```

The HTTP face has no authentication of its own by design: the signer is
reachable only from inside the deployment's network, and the authorization
*is* the credential. A request without a valid one does nothing. Exposing the
port to the internet is a deployment error, and the runbook says so.

## What it refuses, and how it says so

Every refusal is a code, never a free-text reason alone:

| Code | Meaning |
|---|---|
| `BAD_SIGNATURE` | The authorization was not signed by the plane's key |
| `EXPIRED` / `NOT_YET_VALID` | Outside the authorization's window |
| `REPLAY` | This authorization id has already been executed |
| `NO_BACKEND` | No chain backend for the chain named |
| `UNRECOGNISED_CALL` | The call is not a shape any extractor vouches for |
| `MISMATCH` | The re-derived record is not within the authorization |
| `ONCHAIN_LIMIT` | The Safe Allowance Module would refuse it |
| `EXECUTION_FAILED` | The chain refused it, after everything above passed |

`UNRECOGNISED_CALL` is deliberate: a call the extractors cannot read is
refused, not passed through, because a signer that executes what it cannot
describe is a signer with no policy.

## The three lines

The plane is the first line (envelopes, caps, a human decision above
`autoApproveMax`). The signer is the second: it enforces the plane's verdict
against the real call. The optional `onChainLimit` is the third — a
`SafeAllowanceLimit` reads the Safe Allowance Module before execution so the
signer refuses what the chain would refuse, and `safeAllowancePlan` renders an
organization's envelope tree as the calldata a person executes to install
those allowances. The chain still decides; the read is a pre-flight, not the
enforcement.

## Also here

- `ReceiptPoller` — waits for a transaction to land and reports `confirmed`,
  `reverted` or `ReceiptTimeout`, so settlement is reported from a receipt
  rather than from a hash.
- `WdkTronChain` — the TRON backend, through WDK's TRON module, on Nile.
- `verifyAuthorization`, `canonicalize`, `publicKeyFromPem` — the verifier,
  exported so a test or a second plane can check an authorization without
  constructing a signer.

## Fixed since 0.1.0 — pending a republish

`0.1.0` is on npm, and it predates two fixes this tree now carries, so the next
publish must be a version bump: the registry's `0.1.0` does **not** have them.

- **At-most-once execution under concurrency.** Two executions of one
  authorization could both pass the nonce check before either recorded it —
  the check and the record sat either side of an `await`. `NonceStore.spend`
  is now one synchronous check-and-record step returning a boolean, and
  `execute`/`signTypedData` broadcast only when it returns `true`; a loser is
  refused `REPLAY`. (`I-1`, `I-2` in `INVARIANTS.md`.)
- **Stranded, never doubled, across a crash.** An authorization killed between
  spend and broadcast stays spent after a restart over the same file store, so
  it is refused on replay and never executed twice; a nonce file torn
  mid-append no longer concatenates the fragment with the next id and unspend
  an authorization that had already broadcast. (`I-6`.)

Every fix is pinned by the `invariants/1` harness in `src/invariants.test.ts`
and `src/recovery.test.ts`, each carrying a mutation check that fails the
harness on the pre-fix shape.

## Read more

`docs/wallet/spec.md` is the contract; `docs/wallet/runbook.md` is how it is
operated (keys, custody tiers, separation of duties, how to stop);
`docs/wallet/onchain-limit.md` is the third line; `docs/wallet/testnet.md`
is how to run a week on Base Sepolia. The signer is tested against a
cross-package fixture under `docs/wallet/fixtures/`: an authorization the API
signed that this package must verify, so the two sides cannot drift apart
silently.
