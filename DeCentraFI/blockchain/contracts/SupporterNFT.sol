// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title SupporterNFT
 * @notice ERC721 badges for campaign supporters.
 *
 * Levels are determined by total contributed amount (in wei):
 * - Bronze: >= 0.1 ETH
 * - Silver: >= 0.5 ETH
 * - Gold:   >= 1 ETH
 *
 * Level calculation is enforced on-chain, but calls to mint are made
 * by an authorised account (e.g. backend service, factory, or campaign admin)
 * after verifying the contributor's total support off-chain or via other contracts.
 */
contract SupporterNFT is ERC721URIStorage, Ownable {
    uint256 public nextTokenId;

    // Thresholds expressed in wei.
    uint256 public constant BRONZE_THRESHOLD = 0.1 ether;
    uint256 public constant SILVER_THRESHOLD = 0.5 ether;
    uint256 public constant GOLD_THRESHOLD = 1 ether;

    enum Level {
        None,
        Bronze,
        Silver,
        Gold
    }

    // Contributor -> highest level minted so far.
    mapping(address => Level) public supporterLevel;

    event NFTMinted(address indexed contributor, uint256 indexed tokenId, Level level);

    constructor(string memory name_, string memory symbol_) ERC721(name_, symbol_) Ownable(msg.sender) {}

    /**
     * @notice Compute level for a given total contribution amount.
     */
    function _levelForAmount(uint256 totalContributionWei) internal pure returns (Level) {
        if (totalContributionWei >= GOLD_THRESHOLD) {
            return Level.Gold;
        } else if (totalContributionWei >= SILVER_THRESHOLD) {
            return Level.Silver;
        } else if (totalContributionWei >= BRONZE_THRESHOLD) {
            return Level.Bronze;
        }
        return Level.None;
    }

    /**
     * @notice Mint a supporter NFT when contributor passes a threshold.
     * @dev Only owner (e.g. trusted minter) may call.
     *
     * @param contributor wallet to receive NFT
     * @param totalContributionWei total amount contributed (in wei) used for level calculation
     * @param tokenUri metadata URI (e.g. IPFS) for the NFT
     */
    function mintSupporterNFT(
        address contributor,
        uint256 totalContributionWei,
        string calldata tokenUri
    ) external onlyOwner returns (uint256) {
        require(contributor != address(0), "Invalid contributor");

        Level newLevel = _levelForAmount(totalContributionWei);
        require(newLevel != Level.None, "Contribution below thresholds");

        // Prevent downgrades; allow mint only if newLevel is higher than current.
        Level current = supporterLevel[contributor];
        require(uint8(newLevel) > uint8(current), "Level already granted");

        uint256 tokenId = ++nextTokenId;
        _safeMint(contributor, tokenId);
        _setTokenURI(tokenId, tokenUri);

        supporterLevel[contributor] = newLevel;

        emit NFTMinted(contributor, tokenId, newLevel);
        return tokenId;
    }
}

