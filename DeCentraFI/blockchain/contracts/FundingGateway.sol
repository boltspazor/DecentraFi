// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

// Minimal LayerZero endpoint interface (send only).
interface ILayerZeroEndpoint {
    function send(
        uint16 _dstChainId,
        bytes calldata _destination,
        bytes calldata _payload,
        address payable _refundAddress,
        address _zroPaymentAddress,
        bytes calldata _adapterParams
    ) external payable;
}

/**
 * @title FundingGateway
 * @notice Remote-chain gateway for Option A multi-chain funding.
 *
 * - Accepts ETH deposits from contributors for a given `campaignId`.
 * - Sends a LayerZero message to the home pool with payload:
 *   (campaignId, contributor, amount, originChainId)
 *
 * Security: This contract relies on the configured LayerZero endpoint and
 * home pool destination address. The home pool validates trusted remotes.
 */
contract FundingGateway is ReentrancyGuard {
    ILayerZeroEndpoint public endpoint;
    address public homePool; // destination contract address on the home chain
    uint16 public homeChainId; // LayerZero destination chain id
    bytes public destinationBytes; // encoded destination for LayerZero
    uint256 public originChainId; // for payload

    // Optional: adapter params (gas for the destination execution)
    bytes public adapterParams;

    constructor(
        address _endpoint,
        uint16 _homeChainId,
        address _homePool,
        bytes memory _destinationBytes,
        bytes memory _adapterParams
    ) {
        endpoint = ILayerZeroEndpoint(_endpoint);
        homeChainId = _homeChainId;
        homePool = _homePool;
        destinationBytes = _destinationBytes;
        originChainId = block.chainid;
        adapterParams = _adapterParams;
    }

    function deposit(uint256 campaignId) external payable nonReentrant {
        require(msg.value > 0, "No value");

        bytes memory payload = abi.encode(campaignId, msg.sender, msg.value, originChainId);

        // In a real deployment, the LayerZero fee is separate from value bridging.
        // For this project, we assume the bridged ETH arrives at the home pool,
        // so we forward the deposit value along with the message.
        endpoint.send{value: msg.value}(
            homeChainId,
            destinationBytes,
            payload,
            payable(msg.sender),
            address(0),
            adapterParams
        );
    }
}

