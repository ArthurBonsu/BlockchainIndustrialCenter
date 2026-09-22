// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title TransactionTypes
 * @dev Shared struct definitions for passchain channels/transactions,
 * referenced by PacechainChannel2.sol but never defined anywhere in the
 * project.
 *
 * `Channel` is reconstructed with full confidence — its fields come
 * directly from the struct literal PacechainChannel2.createChannel()
 * builds:
 *
 *   channels[channelId] = TransactionTypes.Channel({
 *       id: channelId, sourceBridge: sourceBridge, targetBridge: targetBridge,
 *       creationTime: block.timestamp, isActive: true,
 *       confidenceThreshold: confidenceThreshold
 *   });
 *
 * `SpeculativeTx` and `ConfirmableTx` are declared as mapping value types
 * (`speculativeTxs`, `confirmableTxs`) but nothing in the files I've seen
 * ever constructs or reads one — no code confirms their real fields. I've
 * inferred them from the two events declared right next to those mappings
 * (SpeculativeTxCreated, ConfirmableTxCreated), the closest available
 * evidence of intent. Treat these two as placeholders: they'll compile and
 * let PacechainChannel2.sol build, but if you later write code that
 * actually populates speculativeTxs/confirmableTxs, double-check these
 * field names match what you actually need.
 */
library TransactionTypes {
    struct Channel {
        bytes32 id;
        address sourceBridge;
        address targetBridge;
        uint256 creationTime;
        bool isActive;
        uint256 confidenceThreshold;
    }

    // Inferred from `SpeculativeTxCreated(bytes32 indexed txId, address sender, uint256 anticipatedTime)`
    // — not confirmed by any actual struct construction in the code seen so far.
    struct SpeculativeTx {
        bytes32 txId;
        address sender;
        uint256 anticipatedTime;
        bool isConfirmed;
    }

    // Inferred from `ConfirmableTxCreated(bytes32 indexed txId, bytes32 speculativeTxId)`
    // — same caveat as SpeculativeTx above.
    struct ConfirmableTx {
        bytes32 txId;
        bytes32 speculativeTxId;
        uint256 confirmationTime;
        bool isFinalized;
    }
}
