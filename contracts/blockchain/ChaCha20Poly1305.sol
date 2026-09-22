// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title ChaCha20Poly1305
 * @dev THIS IS NOT REAL ENCRYPTION. It exists purely to satisfy
 * MetadataParser2.sol's `new ChaCha20Poly1305()` and
 * `encryptionHandler.encrypt(payload, key, nonce)` calls so the project
 * compiles and deploys.
 *
 * A real ChaCha20-Poly1305 AEAD cipher is a genuine cryptographic
 * implementation (32-bit ARX rounds, a Poly1305 MAC over GF(2^130-5)) — far
 * more than a "missing import" fix, and not something to hand-roll inside a
 * quick compile-error pass; a subtly-wrong hand-written cipher is worse
 * than an honestly-fake one. Your own codebase already does the same thing
 * elsewhere for the same reason — see ClusterManager2.sol's
 * ClusterCommunication.sendClusterMessage():
 *
 *   // AES-GCM encryption would be implemented here
 *   bytes memory encrypted = content; // Placeholder
 *
 * This mirrors that existing pattern: `encrypt()` returns the payload
 * unchanged (so downstream code has something shaped right to work with)
 * plus a hash-based tag that is NOT a real authentication tag. Do not use
 * this for anything that needs actual confidentiality or integrity. For a
 * class demo where the encryption step is illustrative rather than
 * load-bearing, this is enough to keep everything compiling and wired
 * together end to end. For real encryption later: do it off-chain before
 * the payload ever reaches this contract, or integrate an audited on-chain
 * cipher library — don't extend this file into "real" crypto.
 */
contract ChaCha20Poly1305 {
    function encrypt(
        bytes calldata payload,
        bytes32 key,
        bytes12 nonce
    ) external pure returns (bytes memory encryptedPayload, bytes memory authTag) {
        encryptedPayload = payload; // NOT encrypted — placeholder, see note above
        authTag = abi.encodePacked(keccak256(abi.encodePacked(payload, key, nonce))); // NOT a real MAC
    }
}
