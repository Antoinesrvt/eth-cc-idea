// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ServiceContract} from "./ServiceContract.sol";
import {ContractToken} from "./ContractToken.sol";

/// @title ContractFactory
/// @notice Deploys ServiceContract + ContractToken pairs atomically.
///         One factory per deployment. Creates a new contract for each deal.
contract ContractFactory {
    struct DealRecord {
        address serviceContract;
        address token;
        uint256 createdAt;
    }

    event DealCreated(
        uint256 indexed dealId,
        address indexed serviceContract,
        address indexed token
    );

    address public immutable platformTreasury;
    address public immutable paymentToken;

    DealRecord[] public deals;

    constructor(address _platformTreasury, address _paymentToken) {
        require(_platformTreasury != address(0), "Invalid treasury");
        require(_paymentToken != address(0), "Invalid payment token");
        platformTreasury = _platformTreasury;
        paymentToken = _paymentToken;
    }

    function createDeal(
        address client,
        address agency,
        address bd,
        uint16 bdFeeBps,
        bytes32 termsHash,
        string[] calldata milestoneNames,
        uint256[] calldata milestoneAmounts,
        uint256[] calldata milestoneDeadlines,
        string calldata tokenName,
        string calldata tokenSymbol
    ) external returns (address serviceContract, address token) {
        // Deploy ServiceContract
        serviceContract = address(new ServiceContract(
            client,
            agency,
            bd,
            bdFeeBps,
            termsHash,
            milestoneNames,
            milestoneAmounts,
            milestoneDeadlines,
            platformTreasury,
            paymentToken
        ));

        // Deploy ContractToken owned by the ServiceContract
        token = address(new ContractToken(tokenName, tokenSymbol, serviceContract));

        // Record
        uint256 dealId = deals.length;
        deals.push(DealRecord({
            serviceContract: serviceContract,
            token: token,
            createdAt: block.timestamp
        }));

        emit DealCreated(dealId, serviceContract, token);
    }

    function dealCount() external view returns (uint256) {
        return deals.length;
    }
}
