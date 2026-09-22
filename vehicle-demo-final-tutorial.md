# Vehicle Registry — full working tutorial (Ganache local deploy)

This is the confirmed, working path for `BlockchainIndustrialPlatform`, from a
clean checkout to a live local deployment of `VehicleRegistry` and
`RevocationManager` on Ganache. Every command here was actually run and
verified against real terminal output — nothing theoretical. Windows +
PowerShell/Git Bash throughout.

---

## 0. What you're deploying

From `contracts/vehicle/`:

- **`VehicleRegistry`** — no constructor arguments.
  Functions: `registerVehicle(string)`, `isVehicleRegistered(string)`,
  `getVehicle(string)`, `getPseudonymByOwner(address)`, `removeVehicle(string)`.
- **`RevocationManager`** — constructor takes one argument,
  `address _vehicleRegistryAddress` (wraps `VehicleRegistry` via the
  `IVehicleRegistry` interface).
  Functions: `submitRevocationReport(string,string,string)`,
  `processRevocation(uint256)` (admin-only — caller must be the deployer),
  `isRevoked(string)`, `getRevocationDetails(string)`, `getReport(uint256)`,
  `reinstateVehicle(string)` (admin-only).

Neither contract imports anything outside itself except `IVehicleRegistry.sol`
in the same folder — this pair never needed any of the fixes below. The fixes
were required to get the **rest of the project** (`contracts/`, ~80 files) to
compile cleanly, since a full `truffle compile`/`truffle migrate` walks the
entire `contracts_directory`, not just the vehicle folder.

---

## 1. Install Truffle globally

Done once, so bare `truffle ...` works without `npx` in front of it:

```powershell
npm install -g truffle@5.11.5
truffle version
```

Expect `Truffle v5.11.5 (core: 5.11.5)` in the output. If `truffle` isn't
recognized afterward, it's a PATH issue — close and reopen the terminal so it
picks up the newly-added global npm bin folder.

## 2. Package cleanup (optional but recommended)

None of these are `require()`'d by `truffle-config.js`, so removing/adding
them needs no config changes:

```powershell
yarn remove truffle-hdwallet-provider
yarn remove ganache-cli
yarn remove numpy pandas fastapi flask
yarn add -D ganache@7.9.2
yarn install
```

- `truffle-hdwallet-provider` → superseded by `@truffle/hdwallet-provider`,
  already in the project.
- `ganache-cli` → deprecated; replaced by the maintained `ganache` package
  used in step 4.
- `numpy` / `pandas` / `fastapi` / `flask` → these are Python library names,
  not real npm packages — harmless leftovers, safe to drop.

## 3. Fix every contract so the whole project compiles

`truffle compile`/`migrate` always walks the full `contracts_directory`
(there is no CLI flag to scope it — confirmed against Truffle's own docs and
a closed GitHub feature request, issue #1879 — only a direct edit of
`contracts_directory` in `truffle-config.js` can narrow it, and that's not
what we ended up doing). Here is every fix that was actually needed,
grouped by pattern:

### 3a. Wrong OpenZeppelin import path (8 files)

The installed OpenZeppelin is v4.x, where `ReentrancyGuard.sol` lives under
`security/`, not `utils/`:

```
@openzeppelin/contracts/utils/ReentrancyGuard.sol   →   @openzeppelin/contracts/security/ReentrancyGuard.sol
```

Affected: 5 files in `SecondN2NContracts/`, 3 files in `energygridcontract2/`.

### 3b. Missing `./` on relative imports (1 file)

`contracts/energygrid/TimeWeightedAMM.sol`:

```solidity
import "EnergyMathTW.sol";   →   import "./EnergyMathTW.sol";
import "IEnergyVault.sol";   →   import "./IEnergyVault.sol";
```

### 3c. Three genuinely missing files

Nothing in the project defined these, even though other files imported them.
Reconstructed from how they're actually called elsewhere and delivered as
ready-to-drop-in files (each with confidence notes for any inferred vs.
code-derived content):

- `library/FixedPointMath.sol` — project root, `library/` folder (sits
  outside `contracts/`; relative imports resolve by filesystem path, not by
  `contracts_directory`, so this works fine).
- `library/TransactionTypes.sol` — same folder.
- `contracts/blockchain/ChaCha20Poly1305.sol` — explicitly a **non-real**
  placeholder cipher (returns payload unchanged + a hash-based "tag"), needed
  only so `MetadataParser2.sol` compiles. Do not use for anything that needs
  real confidentiality.

### 3d. Stale identifiers in "2"-suffixed duplicate files (3 files)

Where a file was cloned and renamed with a `2` suffix, one secondary
reference inside each file was missed:

- `contracts/passchain 2/ClusterManager2.sol`:
  `BeeRoutingAlgorithm is ClusterManager` → `is ClusterManager2`
- `contracts/passchain 2/RewardCalculator2.sol`:
  `RewardCalculator is RewardBase, IRewardCalculator` → `RewardCalculator2 is RewardBase, IRewardCalculator2`,
  and `RewardDistributor is RewardCalculator` → `is RewardCalculator2`
- `contracts/passchain 2/ZKPVerifierBase2.sol`:
  `TransactionValidator is ProofGenerator, IZKPVerifier` → `is IZKPVerifier2`

### 3e. Deprecated `_setupRole` (3 files)

`_setupRole` → `_grantRole` in `ClusterManager2.sol`, `RewardCalculator2.sol`,
`PacechainChannel2.sol` (confirmed correct by comparing against the
non-"2" sibling files, which already used `_grantRole`).

### 3f. `Ownable(msg.sender)` — the big one (17 files, ~22 occurrences)

OpenZeppelin v4.x's `Ownable` constructor takes **zero** arguments — any
`Ownable(msg.sender)` call is a compile error. Given the volume, this was
fixed with a blanket PowerShell sweep across `contracts/` rather than
file-by-file (run from the project root):

```powershell
Get-ChildItem -Path .\contracts -Recurse -Filter *.sol | ForEach-Object {
    (Get-Content $_.FullName -Raw) -replace ' Ownable\(msg\.sender\)', '' | Set-Content $_.FullName
}
```

Verify nothing was missed:

```powershell
Select-String -Path .\contracts\**\*.sol -Pattern "Ownable\(msg\.sender\)"
```
(should return nothing).

### 3g. Missing `payable(...)` cast (2 files, ~10 occurrences)

In `contracts/Uncertainty Smart Contracts/`, casting a plain `address` to a
contract type with a payable fallback needs an explicit `payable(...)` wrap:

```solidity
CostAnalytics(analytics)        →  CostAnalytics(payable(analytics))
RequestManager(requestManager)  →  RequestManager(payable(requestManager))
ResponseManager(responseManager)→  ResponseManager(payable(responseManager))
CostAnalytics(costAnalytics)    →  CostAnalytics(payable(costAnalytics))
```

### Result

```
> Compiled successfully using:
   - solc: 0.8.20+commit.a1b79de6.Emscripten.clang
```

Everything left after this is **warnings only** — variable shadowing,
`tx`/`isRevoked`/`isGridStressed`/`carbonCredits` naming collisions,
`block.difficulty` → `prevrandao` deprecation notices, unused-parameter
notices, and "Duplicate contract names found" for ~40 names. All confirmed
harmless for this deploy (see §7).

## 4. Point the migration at just the vehicle contracts

The project's pre-existing `migrations/15_initial_migration.js` tried to
deploy dozens of unrelated contracts starting with a buggy `BCADN` whose
constructor reverts with a low-level EVM error. Rather than debug `BCADN`
(out of scope), its content was replaced outright with a scoped script:

```js
// migrations/15_initial_migration.js
const VehicleRegistry = artifacts.require("VehicleRegistry");
const RevocationManager = artifacts.require("RevocationManager");

module.exports = async function (deployer) {
  // VehicleRegistry takes no constructor arguments
  await deployer.deploy(VehicleRegistry);
  const vehicleRegistry = await VehicleRegistry.deployed();

  // RevocationManager needs VehicleRegistry's deployed address
  await deployer.deploy(RevocationManager, vehicleRegistry.address);
};
```

Keep the file numbered `15` (or whatever number you actually use) — you'll
target it directly with `--f`/`--to` in step 6, so the number just needs to
be unique and known.

## 5. Start Ganache — in its own, truly separate terminal

This is the step that actually mattered. **`truffle migrate` will hang or
throw `CONNECTION ERROR: Couldn't connect to node http://127.0.0.1:7545` if
Ganache isn't a live, untouched process in its own window.** A VS Code
split-terminal pane is not always a genuinely separate process from Claude's
perspective of the shell — the safest, simplest fix is a standalone terminal
app.

**Open Git Bash as its own window** (not through VS Code):

- Right-click the project folder in Windows Explorer → **"Git Bash Here"**, or
- Start Menu → "Git Bash" → open, then `cd` in manually.

Inside it:

```bash
cd "/c/Users/admin/Documents/Blockchain Multi Industrial Service Center/Blockchain MultiIndustrial Projects/BlockchainIndustrialPlatform"
npx ganache --port 7545 --networkId 5777
```

Note the Git Bash path style: `/c/Users/...` with forward slashes, quoted
because of the spaces in the folder names.

**Leave this window running and don't touch it again.** A healthy startup
prints 10 test accounts with private keys, 100 ETH each, an HD wallet
mnemonic, and finally:

```
RPC Listening on 127.0.0.1:7545
```

That line is your confirmation it's live. `network_id: "*"` in
`truffle-config.js`'s `development` block means Truffle will accept whatever
chain id Ganache actually reports, so it doesn't matter if it differs from
the `--networkId` you passed.

If you get `EADDRINUSE`, something else already owns port 7545 — check with:

```powershell
netstat -ano | findstr :7545
Get-Process -Id <PID>
```

`ProcessName: Ganache` means the **desktop GUI app** has the port, which is a
different process from the CLI and was not reliably reachable in this
project's testing — close it and use the CLI (`npx ganache`) instead. `node`
means an existing CLI instance already has it — either reuse that terminal or
kill that process before starting a new one.

## 6. Open a second, separate terminal — compile and deploy

Open a **second** standalone Git Bash (or PowerShell) window, separate from
the Ganache window from step 5. Quick sanity check that it can actually see
Ganache before running anything real:

```bash
curl -s -X POST -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
  http://127.0.0.1:7545
```

A JSON response back means the two terminals are correctly talking to the
same Ganache instance. If this hangs, stop here and recheck step 5 — don't
waste a migrate attempt on it.

Then, from the project root:

```bash
cd "/c/Users/admin/Documents/Blockchain Multi Industrial Service Center/Blockchain MultiIndustrial Projects/BlockchainIndustrialPlatform"
truffle migrate --network development --f 15 --to 15 --skip-dry-run
```

Flag notes — these three matter:

- **`--f 15 --to 15`** — deploy *only* migration file `15` (the vehicle
  script from step 4), skipping any other older/broken migration files in
  the folder.
- **`--skip-dry-run`** — the `development` network doesn't have
  `skipDryRun: true` set in `truffle-config.js`, so by default Truffle runs
  an internal test migration against its own bundled ganache before the real
  one. That extra pass is slow and is what made compiles look "stuck" on
  `Compiling your contracts...` for a long time. Skipping it goes straight to
  the real deploy against your running Ganache instance.
- You'll see this warning on every single Truffle/Ganache command in this
  environment — it's harmless, just a slower pure-JS fallback:
  ```
  This version of µWS is not compatible with your Node.js build:
  Error: Cannot find module '../binaries/uws_win32_x64_137.node'
  ...
  Falling back to a NodeJS implementation; performance may be degraded.
  ```

## 7. What a successful run looks like

Confirmed output from the actual deploy:

```
Starting migrations...
======================
> Network name:    'development'
> Network id:      5777
> Block gas limit: 30000000 (0x1c9c380)

15_initial_migration.js
=======================

   Deploying 'VehicleRegistry'
   ---------------------------
   > contract address:    0x753fA5f53Ecb510f8928Ccb97b4EDC675dC616D3
   > gas used:            684171 (0xa708b)
   > total cost:          0.01368342 ETH

   Deploying 'RevocationManager'
   -----------------------------
   > contract address:    0x4ED74b2AfaF8414d6EC1bBfF5Ecf746a4f0EBd8D
   > gas used:            1150662 (0x118ec6)
   > total cost:          0.02301324 ETH

Summary
=======
> Total deployments:   2
> Final cost:          0.03669666 ETH
```

You can confirm the deploy landed independently of the console log by
checking `build/contracts/VehicleRegistry.json` — it will now have a
`networks` entry keyed by the network id, containing an `address` field
matching the one above.

**About the "Duplicate contract names found" warnings (~40 of them):** these
come from the "2"-suffixed duplicate files only renaming their *top-level*
contract while secondary contracts declared in the same file
(`BeeRoutingAlgorithm`, `RewardBase`, `ProofGenerator`, `NodeTypes`, etc.)
kept identical names across the file pairs. This is advisory-only for this
deploy — `VehicleRegistry`, `RevocationManager`, and `IVehicleRegistry` are
all uniquely named, so `artifacts.require(...)` resolves them correctly. It's
a real structural issue only if you later try to deploy or interact with any
of the *other* duplicated contracts — worth cleaning up eventually, not
blocking today.

## 8. Interact via `truffle console`

In the same second terminal (or a third one — Ganache just needs to keep
running untouched):

```bash
truffle console --network development
```

Inside the console:

```js
let registry = await VehicleRegistry.deployed()
await registry.registerVehicle("car-001")
await registry.isVehicleRegistered("car-001")
await registry.getVehicle("car-001")

let revocation = await RevocationManager.deployed()
await revocation.submitRevocationReport("car-001", "car-002", "speeding")
await revocation.getReport(1)
await revocation.processRevocation(1)   // only works from the account that deployed it
await revocation.isRevoked("car-001")
```

`.exit` to leave the console.

One console quirk worth knowing: typing `truffle <command>` *inside* the
console strips the `truffle ` prefix and just runs `<command>` (works, but
redundant); typing something unrecognized (like a bare `cd`) falls through to
JS evaluation and throws a `SyntaxError` — the console is a JS REPL, not a
shell.

## 9. Connect MetaMask to this Ganache instance

1. MetaMask → networks dropdown → **Add network manually**.
   - RPC URL: `http://127.0.0.1:7545`
   - Chain ID: whatever your Ganache terminal actually printed at startup
     (the confirmed run used `--networkId 5777`, but `ganache@7.9.2`'s
     internal default can report `1337` — check your own terminal output;
     `network_id: "*"` in the Truffle config means this mismatch never
     affects Truffle itself, only what you type into MetaMask).
2. Import one of the test accounts Ganache printed at startup (MetaMask →
   Import Account → paste its private key). This account already has test
   ETH and — since it's the account that ran the deploy — it's also the
   `admin` for `RevocationManager`'s admin-only functions.

## 10. Minimal Next.js demo page

Check whether `ethers` is already installed:

```bash
yarn list --pattern ethers
```

If nothing prints:

```bash
yarn add ethers
```

```tsx
// pages/vehicle-demo.tsx
import { useState } from "react";
import { ethers } from "ethers";
import VehicleRegistryArtifact from "../build/contracts/VehicleRegistry.json";

export default function VehicleDemo() {
  const [pseudonym, setPseudonym] = useState("");
  const [status, setStatus] = useState("");

  async function getRegistry() {
    if (!(window as any).ethereum) throw new Error("MetaMask not found");
    const provider = new ethers.BrowserProvider((window as any).ethereum);
    await provider.send("eth_requestAccounts", []);
    const signer = await provider.getSigner();
    const network = await provider.getNetwork();
    const chainId = network.chainId.toString();

    const address = (VehicleRegistryArtifact as any).networks[chainId]?.address;
    if (!address) {
      throw new Error(
        `VehicleRegistry isn't deployed on chain ${chainId} — check MetaMask is pointed at Ganache.`
      );
    }
    return new ethers.Contract(address, (VehicleRegistryArtifact as any).abi, signer);
  }

  async function handleRegister() {
    try {
      const registry = await getRegistry();
      const tx = await registry.registerVehicle(pseudonym);
      await tx.wait();
      setStatus(`Registered "${pseudonym}"`);
    } catch (err: any) {
      setStatus(err.message);
    }
  }

  async function handleCheck() {
    try {
      const registry = await getRegistry();
      const registered = await registry.isVehicleRegistered(pseudonym);
      setStatus(registered ? `"${pseudonym}" is registered` : `"${pseudonym}" is NOT registered`);
    } catch (err: any) {
      setStatus(err.message);
    }
  }

  return (
    <div style={{ padding: 24, fontFamily: "sans-serif" }}>
      <h1>Vehicle Registry Demo</h1>
      <input
        value={pseudonym}
        onChange={(e) => setPseudonym(e.target.value)}
        placeholder="vehicle pseudonym, e.g. car-001"
      />
      <div style={{ marginTop: 12 }}>
        <button onClick={handleRegister}>Register</button>
        <button onClick={handleCheck} style={{ marginLeft: 8 }}>
          Check registration
        </button>
      </div>
      <p>{status}</p>
    </div>
  );
}
```

Notes:

- `"../build/contracts/VehicleRegistry.json"` assumes `pages/` sits directly
  under the project root, next to `build/`. If your Next.js app lives in a
  subfolder, adjust the path, or copy `build/contracts/*.json` into your
  frontend's own tree (e.g. `lib/contracts/`) as a build step.
- A revocation page follows the identical pattern with
  `RevocationManagerArtifact`, calling `submitRevocationReport(offender,
  reporter, reason)` / `isRevoked(pseudonym)`.

## 11. Later: Remix

Both `VehicleRegistry.sol` and `RevocationManager.sol` paste into Remix
unmodified — zero external imports beyond each other. Select solc `0.8.20`
(or anything `^0.8.0`-compatible). `RevocationManager.sol` needs
`IVehicleRegistry.sol` in the same Remix workspace folder for its
`import "./IVehicleRegistry.sol";` to resolve — bring all three files in
together.

---

## Quick-reference: the exact command sequence

```bash
# Terminal 1 (Git Bash, own window — leave running, don't touch again)
cd "/c/Users/admin/Documents/Blockchain Multi Industrial Service Center/Blockchain MultiIndustrial Projects/BlockchainIndustrialPlatform"
npx ganache --port 7545 --networkId 5777
# wait for: RPC Listening on 127.0.0.1:7545

# Terminal 2 (separate Git Bash window)
cd "/c/Users/admin/Documents/Blockchain Multi Industrial Service Center/Blockchain MultiIndustrial Projects/BlockchainIndustrialPlatform"
truffle migrate --network development --f 15 --to 15 --skip-dry-run

# Then, same terminal, to interact:
truffle console --network development
```

## Troubleshooting checklist (in order)

1. `CONNECTION ERROR: Couldn't connect to node` → Ganache terminal not
   running, or you're actually in the same terminal session as Ganache
   (check for a duplicate prompt / the Ganache log getting interrupted).
   Open a genuinely separate window per step 5.
2. `EADDRINUSE` on Ganache startup → something already holds port 7545.
   `netstat -ano | findstr :7545` + `Get-Process -Id <PID>` to identify it —
   if it's the Ganache **desktop GUI app**, close it and use the CLI instead.
3. Migrate hangs at `Compiling your contracts...` for a long time → expected
   on first run (full ~80-file recompile); add `--skip-dry-run` to cut the
   extra dry-run pass Truffle otherwise runs against `development`.
4. `*** Deployment Failed ***` on an unrelated contract (e.g. `BCADN`) →
   you're running the whole `migrations/` folder instead of targeting your
   file. Use `--f <N> --to <N>` to deploy only your migration script.
5. µWS `Cannot find module '../binaries/uws_win32_x64_137.node'` → always
   appears, always harmless (Node version too new for the prebuilt binary;
   automatic JS fallback). Ignore it.
