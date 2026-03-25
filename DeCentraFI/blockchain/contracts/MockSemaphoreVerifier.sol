// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// Test-only Semaphore verifier mock.
// It accepts proofs only when `proof.message` and `proof.nullifier` match expected values.
contract MockSemaphoreVerifier {
    struct SemaphoreProof {
        uint256 merkleTreeDepth;
        uint256 merkleTreeRoot;
        uint256 nullifier;
        uint256 message;
        uint256 scope;
        uint256[8] points;
    }

    uint256 public immutable expectedGroupId;
    uint256 public immutable validMessage;

    constructor(uint256 _expectedGroupId, uint256 _validMessage) {
        expectedGroupId = _expectedGroupId;
        validMessage = _validMessage;
    }

    function verifyProof(uint256 groupId, SemaphoreProof calldata proof) external view returns (bool) {
        if (groupId != expectedGroupId) return false;
        if (proof.nullifier == 0) return false;
        return proof.message == validMessage;
    }
}

