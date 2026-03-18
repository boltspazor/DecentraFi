// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./Campaign.sol";

error InvalidGoal();
error InvalidDeadline();

contract CampaignFactory {
    address public admin;
    Campaign[] public campaigns;

    event CampaignCreated(address indexed campaign, address indexed creator, uint256 goal, uint256 deadline);

    constructor(address _admin) {
        admin = _admin == address(0) ? msg.sender : _admin;
    }

    function createCampaign(uint256 _goal, uint256 _deadline) external returns (address) {
        if (_goal == 0) revert InvalidGoal();
        if (_deadline <= block.timestamp) revert InvalidDeadline();
        Campaign campaign = new Campaign(msg.sender, _goal, _deadline, admin);
        campaigns.push(campaign);
        emit CampaignCreated(address(campaign), msg.sender, _goal, _deadline);
        return address(campaign);
    }

    /// @notice Update factory admin (e.g. transfer to DAO timelock).
    function setAdmin(address newAdmin) external {
        require(msg.sender == admin, "Not admin");
        require(newAdmin != address(0), "Zero admin");
        admin = newAdmin;
    }

    function getCampaigns() external view returns (address[] memory) {
        address[] memory addrs = new address[](campaigns.length);
        for (uint256 i = 0; i < campaigns.length; i++) {
            addrs[i] = address(campaigns[i]);
        }
        return addrs;
    }
}
