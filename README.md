# wallet-core

The FlashyFinancial wallet plane: three npm packages that give a FlashyOS
agent governed economic agency on [Tether WDK](https://github.com/tetherto/wdk) —
extracted verbatim from `flashyos/packages/{wallet-wdk,signer,wdk}` into their
own repository and scope.

| Package | What it is |
|---|---|
| `packages/wallet-wdk` → [`@flashyfinancial/wallet-wdk`](packages/wallet-wdk) | The AAO `WalletCapability`, a FlashyOS authorizer client, an MCP elicitation handler, and a WDK policy rule that defers to the authorization plane. |
| `packages/signer` → [`@flashyfinancial/signer`](packages/signer) | The isolated signer: verifies an Ed25519-signed `SpendAuthorization`, re-derives the operation from the real call, refuses on any mismatch, executes through Tether WDK, and reports settlement. Holds the seed; never holds the plane's private key. |
| `packages/wdk` → [`@flashyfinancial/wdk`](packages/wdk) | The FlashyOS agent object: identity, authority, wallet, memory and partners behind one interface. |

`wdk` depends on `wallet-wdk`; `signer` depends on `wallet-wdk`. Both
cross-package dependencies point at the `@flashyfinancial/*` scope.

## Provenance

This repository is an extraction, not a rewrite. The source, the tests and
the READMEs in `packages/*` are the same content that lives in
`flashyos/packages/wallet-wdk`, `flashyos/packages/signer` and
`flashyos/packages/wdk` — only the npm scope (`@flashyos/*` →
`@flashyfinancial/*`), the cross-package dependency versions that name that
scope, and the `repository`/`homepage` fields were changed. No logic was
changed to make this extraction; nothing here diverges in behaviour from the
flashyos originals as of the commit that created this repository.

flashyos's own copies of these three packages are untouched by this
extraction and continue to work exactly as they did before it — this
repository is a new, independent home for the same code, not a move.
Reconciling the two (e.g. having flashyos consume these packages instead of
its own copies) is a deliberate follow-up, not part of this change.

Each package still describes, and still talks to, the real FlashyOS mesh
platform (`api.flashyos.com`, the AAO `WalletCapability` contract, the
`invariants/1` harness, etc.) — that is a fact about what this code does, not
a FlashyOS-specific detail to rename away.

## Commands

```bash
npm install                # installs all three workspaces
npm run typecheck           # tsc --noEmit, every workspace
npm run test                # vitest run, every workspace
npm run build                # tsup build, every workspace
```

Per package:

```bash
npm run test -w @flashyfinancial/wallet-wdk
npm run test -w @flashyfinancial/signer
npm run test -w @flashyfinancial/wdk
```

## Supporting fixtures

A handful of tests read small, non-secret data files that live outside the
package they test — a published JSON schema the code's own manifest must
match, and a signed-fixture/public-key pair used to check the signer's
verifier against an independently-produced signature. In the original
flashyos monorepo those lived under the repository's shared `docs/wallet/`
directory; this repository carries the same files at the same
root-relative path (`docs/wallet/schema/`, `docs/wallet/fixtures/`) so the
tests resolve without a monorepo around them. Nothing in `docs/wallet/` here
is a secret — `test-signing-key.pub.pem` is a public key, and
`authorization.json` is a fixture record, not a live credential.

## CI

`.github/workflows/ci.yml` runs `npm ci`, `npm run typecheck` and
`npm run test` across all three workspaces on every push and pull request.

`.github/workflows/publish.yml` publishes a package to the public npm
registry on a `<package>-vX.Y.Z` tag, following the same refuse-before-install
pattern `flashy-ledger`'s `publish.yml` uses: the job checks for the
`NPM_TOKEN` repository secret before installing anything, and refuses the run
rather than falling back to an unauthenticated or wrong registry. Nothing is
published yet — add `NPM_TOKEN` as a repository secret (an npm access token
with publish rights on the `@flashyfinancial` scope) and push a tag
(`wallet-wdk-v0.1.0`, `signer-v0.1.0`, or `wdk-v0.1.0`) when a release is
actually intended.

## Licence

Apache-2.0, per each package's own `LICENSE` file — carried over unchanged
from flashyos.
