// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @notice Minimal on-chain config for "platform changes" governed by the DAO timelock.
 * Owner should be the TimelockController.
 */
contract PlatformConfig is Ownable {
    mapping(bytes32 => uint256) public uintParams;
    mapping(bytes32 => address) public addressParams;
    mapping(bytes32 => bool) public boolParams;

    event UintParamSet(bytes32 indexed key, uint256 value);
    event AddressParamSet(bytes32 indexed key, address value);
    event BoolParamSet(bytes32 indexed key, bool value);

    constructor(address initialOwner) {
        if (initialOwner != _msgSender()) {
            transferOwnership(initialOwner);
        }
    }

    function setUint(bytes32 key, uint256 value) external onlyOwner {
        uintParams[key] = value;
        emit UintParamSet(key, value);
    }

    function setAddress(bytes32 key, address value) external onlyOwner {
        addressParams[key] = value;
        emit AddressParamSet(key, value);
    }

    function setBool(bytes32 key, bool value) external onlyOwner {
        boolParams[key] = value;
        emit BoolParamSet(key, value);
    }
}

