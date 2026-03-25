// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface ILzReceiver {
    function lzReceive(
        uint16 _srcChainId,
        bytes calldata _srcAddress,
        uint64 _nonce,
        bytes calldata _payload
    ) external payable;
}

/**
 * @notice Test double for LayerZero endpoint.
 * It only stores the last send parameters and value.
 */
contract MockLayerZeroEndpoint {
    uint16 public lastDstChainId;
    bytes public lastDestination;
    bytes public lastPayload;
    address public lastRefundAddress;
    address public lastZroPaymentAddress;
    bytes public lastAdapterParams;
    uint256 public lastValue;

    function send(
        uint16 _dstChainId,
        bytes calldata _destination,
        bytes calldata _payload,
        address payable _refundAddress,
        address _zroPaymentAddress,
        bytes calldata _adapterParams
    ) external payable {
        lastDstChainId = _dstChainId;
        lastDestination = _destination;
        lastPayload = _payload;
        lastRefundAddress = _refundAddress;
        lastZroPaymentAddress = _zroPaymentAddress;
        lastAdapterParams = _adapterParams;
        lastValue = msg.value;
    }

    function triggerLzReceive(
        address receiver,
        uint16 srcChainId,
        bytes calldata srcAddress,
        uint64 nonce,
        bytes calldata payload
    ) external payable {
        ILzReceiver(receiver).lzReceive{value: msg.value}(srcChainId, srcAddress, nonce, payload);
    }
}

