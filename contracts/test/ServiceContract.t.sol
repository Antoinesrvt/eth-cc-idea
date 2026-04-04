// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {ServiceContract} from "../src/ServiceContract.sol";
import {ContractToken} from "../src/ContractToken.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice Mock USDC for testing
contract MockUSDC is ERC20 {
    constructor() ERC20("Mock USDC", "USDC") {
        _mint(msg.sender, 1_000_000 * 10**18);
    }
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract ServiceContractTest is Test {
    ServiceContract public sc;
    ContractToken public token;
    MockUSDC public usdc;

    address client = address(0x1);
    address agency = address(0x2);
    address bd = address(0x3);
    address treasury = address(0x4);

    uint256 milestoneAmount = 10_000 * 10**18;

    function setUp() public {
        // Deploy mock USDC
        usdc = new MockUSDC();

        // Milestone arrays
        string[] memory names = new string[](2);
        names[0] = "Design";
        names[1] = "Development";
        uint256[] memory amounts = new uint256[](2);
        amounts[0] = milestoneAmount;
        amounts[1] = milestoneAmount;
        uint256[] memory deadlines = new uint256[](2);
        deadlines[0] = block.timestamp + 30 days;
        deadlines[1] = block.timestamp + 60 days;

        // Deploy ServiceContract
        sc = new ServiceContract(
            client,
            agency,
            bd,
            500, // 5% BD fee
            bytes32(0),
            names,
            amounts,
            deadlines,
            treasury,
            address(usdc)
        );

        // Deploy ContractToken owned by ServiceContract
        token = new ContractToken("Deal Token", "DEAL", address(sc));

        // Fund client with USDC
        usdc.mint(client, 100_000 * 10**18);
    }

    // ── Deposit Tests ──────────────────────────────────────────────────

    function test_depositEscrow() public {
        uint256 totalValue = milestoneAmount * 2; // 20,000

        // Client approves and deposits
        vm.startPrank(client);
        usdc.approve(address(sc), totalValue);
        sc.depositEscrow();
        vm.stopPrank();

        // Check contract holds the USDC
        assertEq(usdc.balanceOf(address(sc)), totalValue);
    }

    function test_depositEscrow_revertIfNotClient() public {
        vm.prank(agency);
        vm.expectRevert("Only client or operator");
        sc.depositEscrow();
    }

    function test_depositEscrow_revertIfAlreadyActive() public {
        uint256 totalValue = milestoneAmount * 2;
        vm.startPrank(client);
        usdc.approve(address(sc), totalValue);
        sc.depositEscrow();

        vm.expectRevert("Not in Draft");
        sc.depositEscrow();
        vm.stopPrank();
    }

    // ── Delivery Tests ─────────────────────────────────────────────────

    function test_submitDeliverable() public {
        _activateContract();

        vm.prank(agency);
        sc.submitDeliverable(0, bytes32("proof1"));

        ServiceContract.Milestone memory m = sc.getMilestone(0);
        assertEq(uint8(m.status), 1); // Delivered
        assertEq(m.proofHash, bytes32("proof1"));
    }

    function test_submitDeliverable_revertIfNotAgency() public {
        _activateContract();

        vm.prank(client);
        vm.expectRevert("Only agency or operator");
        sc.submitDeliverable(0, bytes32("proof1"));
    }

    // ── Approval Tests ─────────────────────────────────────────────────

    function test_approveMilestone_feesSplit() public {
        _activateContract();

        // Agency delivers
        vm.prank(agency);
        sc.submitDeliverable(0, bytes32("proof1"));

        uint256 treasuryBefore = usdc.balanceOf(treasury);
        uint256 bdBefore = usdc.balanceOf(bd);
        uint256 agencyBefore = usdc.balanceOf(agency);

        // Client approves
        vm.prank(client);
        sc.approveMilestone(0);

        // Check fee split: 2.5% platform + 5% BD + 92.5% agency
        uint256 platformFee = milestoneAmount * 250 / 10000; // 250 USDC
        uint256 bdFee = milestoneAmount * 500 / 10000; // 500 USDC
        uint256 agencyPayout = milestoneAmount - platformFee - bdFee; // 9250 USDC

        assertEq(usdc.balanceOf(treasury) - treasuryBefore, platformFee);
        assertEq(usdc.balanceOf(bd) - bdBefore, bdFee);
        assertEq(usdc.balanceOf(agency) - agencyBefore, agencyPayout);
    }

    function test_contractCompletes_whenAllApproved() public {
        _activateContract();

        // Deliver and approve both milestones
        vm.prank(agency);
        sc.submitDeliverable(0, bytes32("proof1"));
        vm.prank(client);
        sc.approveMilestone(0);

        vm.prank(agency);
        sc.submitDeliverable(1, bytes32("proof2"));
        vm.prank(client);
        sc.approveMilestone(1);

        ServiceContract.ContractData memory data = sc.getContractData();
        assertEq(uint8(data.status), 2); // Completed
    }

    // ── Reject + Dispute Tests ─────────────────────────────────────────

    function test_rejectMilestone() public {
        _activateContract();

        vm.prank(agency);
        sc.submitDeliverable(0, bytes32("proof1"));

        vm.prank(client);
        sc.rejectMilestone(0, bytes32("bad quality"));

        ServiceContract.Milestone memory m = sc.getMilestone(0);
        assertEq(uint8(m.status), 3); // Rejected
    }

    function test_disputeMilestone() public {
        _activateContract();

        vm.prank(agency);
        sc.submitDeliverable(0, bytes32("proof1"));

        vm.prank(client);
        sc.disputeMilestone(0);

        ServiceContract.Milestone memory m = sc.getMilestone(0);
        assertEq(uint8(m.status), 4); // Disputed
    }

    function test_resubmitAfterRejection() public {
        _activateContract();

        // Deliver → reject → resubmit
        vm.prank(agency);
        sc.submitDeliverable(0, bytes32("v1"));

        vm.prank(client);
        sc.rejectMilestone(0, bytes32("needs rework"));

        vm.prank(agency);
        sc.submitDeliverable(0, bytes32("v2"));

        ServiceContract.Milestone memory m = sc.getMilestone(0);
        assertEq(uint8(m.status), 1); // Delivered again
        assertEq(m.proofHash, bytes32("v2"));
    }

    // ── Refund Tests ───────────────────────────────────────────────────

    function test_markFailed_and_refund() public {
        _activateContract();
        uint256 totalValue = milestoneAmount * 2;

        vm.prank(client);
        sc.markFailed();

        uint256 clientBefore = usdc.balanceOf(client);
        vm.prank(client);
        sc.refundEscrow();

        assertEq(usdc.balanceOf(client) - clientBefore, totalValue);
        assertEq(usdc.balanceOf(address(sc)), 0);
    }

    function test_refundMilestone() public {
        _activateContract();

        // Deliver and dispute milestone 0
        vm.prank(agency);
        sc.submitDeliverable(0, bytes32("proof"));
        vm.prank(client);
        sc.disputeMilestone(0);

        uint256 clientBefore = usdc.balanceOf(client);
        vm.prank(client);
        sc.refundMilestone(0);

        assertEq(usdc.balanceOf(client) - clientBefore, milestoneAmount);
    }

    // ── ContractToken Tests ────────────────────────────────────────────

    function test_tokenMint_onlyOwner() public {
        // ServiceContract is the owner — it can't mint directly in tests
        // but we test that non-owner can't mint
        vm.prank(agency);
        vm.expectRevert();
        token.mint(agency, 1000);
    }

    // ── Helper ─────────────────────────────────────────────────────────

    function _activateContract() internal {
        uint256 totalValue = milestoneAmount * 2;
        vm.startPrank(client);
        usdc.approve(address(sc), totalValue);
        sc.depositEscrow();
        vm.stopPrank();
    }
}
