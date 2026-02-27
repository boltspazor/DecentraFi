// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./Campaign.sol";

contract CampaignFactory {
    Campaign[] public campaigns;

    event CampaignCreated(address indexed campaign, address indexed creator, uint256 goal, uint256 deadline);

    function createCampaign(uint256 _goal, uint256 _deadline) external returns (address) {
        Campaign campaign = new Campaign(msg.sender, _goal, _deadline);
        campaigns.push(campaign);
        emit CampaignCreated(address(campaign), msg.sender, _goal, _deadline);
        return address(campaign);
    }

    function getCampaigns() external view returns (address[] memory) {
        address[] memory addrs = new address[](campaigns.length);
        for (uint256 i = 0; i < campaigns.length; i++) {
            addrs[i] = address(campaigns[i]);
        }
        return addrs;
    }
}
