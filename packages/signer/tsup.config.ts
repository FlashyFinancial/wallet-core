import { readFileSync } from 'node:fs'
import { defineConfig } from 'tsup'

/**
 * An optional dependency is one the package runs without, so it must also be
 * one the package BUILDS without.
 *
 * `chain.ts` and `tronChain.ts` reach Tether WDK through a dynamic `import()`
 * inside a try/catch that throws a sentence naming what to install — the whole
 * design says the subtree may be absent. esbuild does not read it that way: a
 * string literal in an `import()` is something it resolves and bundles, so a
 * missing optional subtree failed the build outright with four
 * `Could not resolve` errors.
 *
 * That is not hypothetical. `ci.yml` pins Node 22 because npm drops an optional
 * subtree whose engines it cannot satisfy, and `_deploy.yml` pinned Node 20 —
 * so the same commit built green on CI and red on Deploy prod, at a step named
 * after a package nobody had touched. Two fixes: this file, so the build stops
 * depending on an optional install at all, and the Node versions agreeing, so
 * CI is once again a faithful prediction of the deploy.
 *
 * The list is DERIVED from `optionalDependencies` rather than restated. A
 * hand-kept copy of a list is a copy that drifts on the day somebody adds the
 * fifth Tether module, and it would drift into exactly this failure again.
 */
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  optionalDependencies?: Record<string, string>
}

export const EXTERNAL = Object.keys(pkg.optionalDependencies ?? {})

export default defineConfig({ external: EXTERNAL })
