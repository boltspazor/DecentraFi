// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

// Non-transferable investment share token.
// Transfers are disabled so share ownership can be treated as fixed per contribution.
error TransfersDisabled();
error NotMinter();

contract InvestmentShareToken is ERC20 {
    address public immutable minter; // the FundingPoolHome (or other pool) contract
    uint256 public immutable campaignId;

    constructor(
        address _minter,
        uint256 _campaignId,
        string memory name_,
        string memory symbol_
    ) ERC20(name_, symbol_) {
        require(_minter != address(0), "Zero minter");
        minter = _minter;
        campaignId = _campaignId;
    }

    function mint(address to, uint256 amount) external {
        if (msg.sender != minter) revert NotMinter();
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external {
        if (msg.sender != minter) revert NotMinter();
        _burn(from, amount);
    }

    function _beforeTokenTransfer(address from, address to, uint256 amount) internal override {
        super._beforeTokenTransfer(from, to, amount);

        // Allow mint (from == 0) and burn (to == 0).
        if (from != address(0) && to != address(0)) revert TransfersDisabled();
    }
}

