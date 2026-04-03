// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title ServiceContract
/// @notice Escrow contract for agency-client service agreements.
///         Manages milestone-based payments with platform and BD fee splits.
contract ServiceContract is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ── Custom Errors ────────────────────────────────────────────────────

    error NotActive();
    error NotClientOrPlatform();
    error InvalidAmount();
    error InvalidMilestone();
    error MilestoneAlreadySettled();
    error MilestoneNotRefundable();
    error NotAuthorized();

    // ── Enums ────────────────────────────────────────────────────────────

    enum MilestoneStatus { Pending, Delivered, Approved, Rejected, Disputed, Failed }
    enum ContractStatus { Draft, Active, Completed, Disputed, Failed }

    // ── Structs ──────────────────────────────────────────────────────────

    struct Milestone {
        string name;
        uint256 amount;
        uint256 deadline;
        MilestoneStatus status;
        bytes32 proofHash;
        uint256 deliveredAt;
        uint256 approvedAt;
        // AI verdict fields
        // Settlement guard
        bool settled;
    }

    struct ContractData {
        address client;
        address agency;
        address bd;
        uint16 bdFeeBps;
        uint16 platformFeeBps;
        bytes32 termsHash;
        uint256 totalValue;
        ContractStatus status;
        uint256 createdAt;
    }

    // ── Events ───────────────────────────────────────────────────────────

    event ContractCreated(address indexed client, address indexed agency, uint256 totalValue);
    event EscrowDeposited(address indexed client, uint256 amount);
    event DeliverableSubmitted(uint256 indexed milestoneId, bytes32 proofHash);
    event MilestoneApproved(uint256 indexed milestoneId, uint256 agencyPayout, uint256 platformFee, uint256 bdFee);
    event MilestoneSettled(uint256 indexed milestoneId, uint256 settlementAmount, uint256 platformFee, uint256 bdFee, uint256 agencyPayout);
    event MilestoneRejected(uint256 indexed milestoneId, bytes32 reason);
    event MilestoneDisputed(uint256 indexed milestoneId);
    event MilestoneRefunded(uint256 indexed milestoneId, uint256 amount);
    event ContractCompleted(uint256 totalPaid);
    event ContractFailed(uint256 refundAmount);
    event EscrowRefunded(address indexed client, uint256 amount);

    // ── Constants ────────────────────────────────────────────────────────

    uint16 public constant PLATFORM_FEE_BPS = 250; // 2.5%
    uint16 public constant MAX_BD_FEE_BPS = 2000;  // 20%
    uint16 public constant BPS_DENOMINATOR = 10000;

    // ── Storage ──────────────────────────────────────────────────────────

    ContractData private _contractData;
    Milestone[] private _milestones;
    address public immutable platformTreasury;
    IERC20 public immutable paymentToken;   // tUSD — the ERC20 used for all payments
    uint256 private _totalPaid;


    // ── Modifiers ────────────────────────────────────────────────────────

    modifier onlyClient() {
        require(msg.sender == _contractData.client, "Only client");
        _;
    }

    modifier onlyAgency() {
        require(msg.sender == _contractData.agency, "Only agency");
        _;
    }

    /// @dev Allows the client OR the platform operator (platform treasury) to act.
    ///      Enables server-side transaction relaying.
    modifier onlyClientOrOperator() {
        require(
            msg.sender == _contractData.client ||
            msg.sender == platformTreasury,
            "Only client or operator"
        );
        _;
    }

    /// @dev Allows the agency OR the platform operator to act.
    modifier onlyAgencyOrOperator() {
        require(
            msg.sender == _contractData.agency ||
            msg.sender == platformTreasury,
            "Only agency or operator"
        );
        _;
    }


    // ── Constructor ──────────────────────────────────────────────────────

    /// @param _client           Client address (pays for services)
    /// @param _agency           Agency address (delivers services)
    /// @param _bd               Business dev address (address(0) if none)
    /// @param _bdFeeBps         BD fee in basis points (0-2000)
    /// @param _termsHash        IPFS hash of the contract document
    /// @param _milestoneNames   Names for each milestone
    /// @param _milestoneAmounts Payment amounts for each milestone (in wei)
    /// @param _milestoneDeadlines Unix timestamps for each milestone deadline
    /// @param _platformTreasury Address to receive platform fees
    constructor(
        address _client,
        address _agency,
        address _bd,
        uint16 _bdFeeBps,
        bytes32 _termsHash,
        string[] memory _milestoneNames,
        uint256[] memory _milestoneAmounts,
        uint256[] memory _milestoneDeadlines,
        address _platformTreasury,
        address _paymentToken
    ) {
        require(_client != address(0), "Invalid client");
        require(_agency != address(0), "Invalid agency");
        require(_client != _agency, "Client cannot be agency");
        require(_platformTreasury != address(0), "Invalid treasury");
        require(_bdFeeBps <= MAX_BD_FEE_BPS, "BD fee too high");
        require(_milestoneNames.length > 0, "No milestones");
        require(
            _milestoneNames.length == _milestoneAmounts.length &&
            _milestoneNames.length == _milestoneDeadlines.length,
            "Milestone arrays mismatch"
        );

        // If no BD, fee must be zero
        if (_bd == address(0)) {
            require(_bdFeeBps == 0, "BD fee without BD");
        }

        uint256 total;
        for (uint256 i; i < _milestoneNames.length; i++) {
            require(_milestoneAmounts[i] > 0, "Milestone amount is zero");
            total += _milestoneAmounts[i];

            _milestones.push(Milestone({
                name: _milestoneNames[i],
                amount: _milestoneAmounts[i],
                deadline: _milestoneDeadlines[i],
                status: MilestoneStatus.Pending,
                proofHash: bytes32(0),
                deliveredAt: 0,
                approvedAt: 0,
                settled: false
            }));
        }

        _contractData = ContractData({
            client: _client,
            agency: _agency,
            bd: _bd,
            bdFeeBps: _bdFeeBps,
            platformFeeBps: PLATFORM_FEE_BPS,
            termsHash: _termsHash,
            totalValue: total,
            status: ContractStatus.Draft,
            createdAt: block.timestamp,
        });

        require(_paymentToken != address(0), "Invalid payment token");
        platformTreasury = _platformTreasury;
        paymentToken = IERC20(_paymentToken);

        emit ContractCreated(_client, _agency, total);
    }

    // ── Client Functions ─────────────────────────────────────────────────

    /// @notice Client deposits escrow to activate the contract.
    ///         Client must approve this contract to spend tUSD first.
    function depositEscrow() external onlyClientOrOperator nonReentrant {
        require(_contractData.status == ContractStatus.Draft, "Not in Draft");

        uint256 amount = _contractData.totalValue;
        paymentToken.safeTransferFrom(msg.sender, address(this), amount);

        _contractData.status = ContractStatus.Active;

        emit EscrowDeposited(msg.sender, amount);
    }

    /// @notice Client approves a delivered milestone, releasing escrowed funds.
    /// @param milestoneId Index of the milestone to approve
    function approveMilestone(uint256 milestoneId) external onlyClientOrOperator nonReentrant {
        require(_contractData.status == ContractStatus.Active || _contractData.status == ContractStatus.Disputed, "Not active");
        if (milestoneId >= _milestones.length) revert InvalidMilestone();

        Milestone storage m = _milestones[milestoneId];
        require(m.status == MilestoneStatus.Delivered, "Not delivered");
        if (m.settled) revert MilestoneAlreadySettled();

        // Calculate fee split
        uint256 amount = m.amount;
        uint256 platformFee = (amount * PLATFORM_FEE_BPS) / BPS_DENOMINATOR;
        uint256 bdFee;
        if (_contractData.bd != address(0) && _contractData.bdFeeBps > 0) {
            bdFee = (amount * _contractData.bdFeeBps) / BPS_DENOMINATOR;
        }
        uint256 agencyPayout = amount - platformFee - bdFee;

        // Effects
        m.status = MilestoneStatus.Approved;
        m.approvedAt = block.timestamp;
        m.settled = true;
        _totalPaid += amount;

        // Check if all milestones are now approved
        bool allApproved = true;
        for (uint256 i; i < _milestones.length; i++) {
            if (_milestones[i].status != MilestoneStatus.Approved) {
                allApproved = false;
                break;
            }
        }
        if (allApproved) {
            _contractData.status = ContractStatus.Completed;
        } else if (_contractData.status == ContractStatus.Disputed) {
            // If we're approving during a dispute, revert to Active
            // (only if there are still pending/delivered milestones)
            _contractData.status = ContractStatus.Active;
        }

        // Interactions — transfer tUSD to each party
        paymentToken.safeTransfer(platformTreasury, platformFee);

        if (bdFee > 0) {
            paymentToken.safeTransfer(_contractData.bd, bdFee);
        }

        paymentToken.safeTransfer(_contractData.agency, agencyPayout);

        emit MilestoneApproved(milestoneId, agencyPayout, platformFee, bdFee);
        emit MilestoneSettled(milestoneId, amount, platformFee, bdFee, agencyPayout);

        if (allApproved) {
            emit ContractCompleted(_totalPaid);
        }
    }

    /// @notice Client disputes a delivered milestone.
    /// @param milestoneId Index of the milestone to dispute
    function disputeMilestone(uint256 milestoneId) external onlyClientOrOperator {
        require(
            _contractData.status == ContractStatus.Active ||
            _contractData.status == ContractStatus.Disputed,
            "Not active"
        );
        require(milestoneId < _milestones.length, "Invalid milestone");

        Milestone storage m = _milestones[milestoneId];
        require(m.status == MilestoneStatus.Delivered, "Not delivered");

        m.status = MilestoneStatus.Disputed;
        _contractData.status = ContractStatus.Disputed;

        emit MilestoneDisputed(milestoneId);
    }

    /// @notice Client rejects a delivered milestone, sending it back to the agency for rework.
    /// @param milestoneId The milestone to reject
    /// @param reason Reason for rejection (stored on-chain as bytes32)
    function rejectMilestone(uint256 milestoneId, bytes32 reason) external onlyClientOrOperator {
        require(
            _contractData.status == ContractStatus.Active ||
            _contractData.status == ContractStatus.Disputed,
            "Not active"
        );
        require(milestoneId < _milestones.length, "Invalid milestone");

        Milestone storage m = _milestones[milestoneId];
        require(m.status == MilestoneStatus.Delivered, "Not delivered");

        m.status = MilestoneStatus.Rejected;

        emit MilestoneRejected(milestoneId, reason);
    }

    /// @notice Refund remaining escrow to client. Only callable when contract is Failed.
    function refundEscrow() external onlyClientOrOperator nonReentrant {
        require(_contractData.status == ContractStatus.Failed, "Not failed");

        uint256 balance = paymentToken.balanceOf(address(this));
        require(balance > 0, "No balance to refund");

        paymentToken.safeTransfer(_contractData.client, balance);

        emit EscrowRefunded(_contractData.client, balance);
    }

    /// @notice Refund a single failed or disputed-against-agency milestone to the client.
    /// @param milestoneId Index of the milestone to refund
    function refundMilestone(uint256 milestoneId) external nonReentrant {
        if (msg.sender != _contractData.client && msg.sender != platformTreasury) {
            revert NotClientOrPlatform();
        }
        if (milestoneId >= _milestones.length) revert InvalidMilestone();

        Milestone storage m = _milestones[milestoneId];

        // Only refundable if Failed or Disputed (resolved against agency)
        if (m.status != MilestoneStatus.Failed && m.status != MilestoneStatus.Disputed) {
            revert MilestoneNotRefundable();
        }
        if (m.settled) revert MilestoneAlreadySettled();

        uint256 amount = m.amount;

        // Effects
        m.settled = true;

        // Interactions
        paymentToken.safeTransfer(_contractData.client, amount);

        emit MilestoneRefunded(milestoneId, amount);
    }

    /// @notice Mark the contract as failed. Sets all non-approved milestones to Failed.
    ///         Callable by client or through governance.
    function markFailed() external onlyClientOrOperator {
        require(
            _contractData.status != ContractStatus.Completed &&
            _contractData.status != ContractStatus.Failed,
            "Already completed or failed"
        );

        uint256 refundable;
        for (uint256 i; i < _milestones.length; i++) {
            if (_milestones[i].status != MilestoneStatus.Approved) {
                _milestones[i].status = MilestoneStatus.Failed;
                refundable += _milestones[i].amount;
            }
        }

        _contractData.status = ContractStatus.Failed;

        emit ContractFailed(refundable);
    }

    // ── Agency Functions ─────────────────────────────────────────────────

    /// @notice Agency submits (or resubmits) a deliverable proof for a milestone.
    ///         Allowed from Pending or Rejected state, supporting the 2-phase dispute flow.
    /// @param milestoneId Index of the milestone
    /// @param proofHash  IPFS hash of the deliverable proof
    function submitDeliverable(uint256 milestoneId, bytes32 proofHash) external onlyAgencyOrOperator {
        require(
            _contractData.status == ContractStatus.Active ||
            _contractData.status == ContractStatus.Disputed,
            "Not active"
        );
        require(milestoneId < _milestones.length, "Invalid milestone");

        Milestone storage m = _milestones[milestoneId];
        require(
            m.status == MilestoneStatus.Pending || m.status == MilestoneStatus.Rejected,
            "Not pending or rejected"
        );
        require(proofHash != bytes32(0), "Empty proof hash");

        m.status = MilestoneStatus.Delivered;
        m.proofHash = proofHash;
        m.deliveredAt = block.timestamp;

        emit DeliverableSubmitted(milestoneId, proofHash);
    }



    /// @param milestoneId  Index of the milestone
    /// @param verdictHash  IPFS hash of the full AI verdict JSON
    /// @param decision     0=insufficient_data, 1=approved, 2=rejected
    /// @param score        AI confidence score 0-100
        uint256 milestoneId,
        bytes32 verdictHash,
        uint8 decision,
        uint8 score
    ) external {
        if (milestoneId >= _milestones.length) revert InvalidMilestone();
        if (score > 100) revert InvalidScore();

        Milestone storage m = _milestones[milestoneId];

        emit AiVerdictRecorded(milestoneId, verdictHash, decision, score);
    }


    // ── View Functions ───────────────────────────────────────────────────

    /// @notice Returns the full contract metadata.
    function getContractData() external view returns (ContractData memory) {
        return _contractData;
    }

    /// @notice Returns a single milestone by index.
    /// @param id Milestone index
    function getMilestone(uint256 id) external view returns (Milestone memory) {
        require(id < _milestones.length, "Invalid milestone");
        return _milestones[id];
    }

    /// @notice Returns the total number of milestones.
    function milestoneCount() external view returns (uint256) {
        return _milestones.length;
    }

    /// @notice Returns the current escrow balance held by this contract.
    function getEscrowBalance() external view returns (uint256) {
        return paymentToken.balanceOf(address(this));
    }

}
