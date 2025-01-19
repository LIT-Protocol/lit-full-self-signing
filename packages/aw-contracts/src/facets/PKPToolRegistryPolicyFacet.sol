// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "../abstract/PKPToolRegistryPolicyBase.sol";
import "../libraries/PKPToolRegistryStorage.sol";
import "../libraries/PKPToolRegistryErrors.sol";
import "../libraries/PKPToolRegistryPolicyEvents.sol";

/// @title PKP Tool Registry Policy Facet
/// @notice Diamond facet for managing delegatee-specific policies for PKP tools
/// @dev Inherits from PKPToolRegistryPolicyBase for common policy management functionality
/// @custom:security-contact security@litprotocol.com
contract PKPToolRegistryPolicyFacet is PKPToolRegistryPolicyBase {
    using PKPToolRegistryStorage for PKPToolRegistryStorage.Layout;
    using EnumerableSet for EnumerableSet.Bytes32Set;
    using EnumerableSet for EnumerableSet.AddressSet;

    /// @notice Get the effective policy IPFS CID for a tool and delegatee, considering both delegatee-specific and blanket policies
    /// @dev First checks for a delegatee-specific policy, then falls back to blanket policy if none exists
    /// @param pkpTokenId The PKP token ID
    /// @param toolIpfsCid The IPFS CID of the tool
    /// @param delegatee The delegatee address to get the policy for
    /// @return policyIpfsCid The effective policy IPFS CID (delegatee-specific if set, otherwise blanket policy)
    /// @return isDelegateeSpecific Whether the returned policy is delegatee-specific (true) or blanket (false)
    /// @custom:throws ToolNotFound if tool is not registered or enabled
    function getEffectiveToolPolicyForDelegatee(
        uint256 pkpTokenId,
        string calldata toolIpfsCid,
        address delegatee
    ) external view returns (string memory policyIpfsCid, bool isDelegateeSpecific) {
        PKPToolRegistryStorage.Layout storage l = PKPToolRegistryStorage.layout();
        PKPToolRegistryStorage.PKPData storage pkpData = l.pkpStore[pkpTokenId];
        bytes32 toolCidHash = _hashToolCid(toolIpfsCid);
        
        // Check if tool exists
        if (!pkpData.toolCids.contains(toolCidHash)) {
            revert PKPToolRegistryErrors.ToolNotFound(toolIpfsCid);
        }
        
        PKPToolRegistryStorage.ToolInfo storage tool = pkpData.toolMap[toolCidHash];
        
        // First try delegatee-specific policy
        PKPToolRegistryStorage.Policy storage delegateePolicy = tool.delegateeCustomPolicies[delegatee];
        if (delegateePolicy.policyIpfsCidHash != bytes32(0) && delegateePolicy.enabled) {
            return (l.hashedPolicyCidToOriginalCid[delegateePolicy.policyIpfsCidHash], true);
        }
        
        // Fall back to blanket policy if it exists
        PKPToolRegistryStorage.Policy storage blanketPolicy = tool.blanketPolicy[0];
        if (blanketPolicy.policyIpfsCidHash != bytes32(0) && blanketPolicy.enabled) {
            return (l.hashedPolicyCidToOriginalCid[blanketPolicy.policyIpfsCidHash], false);
        }

        return ("", false);
    }

    /// @notice Get the policy IPFS CID for a specific tool and delegatee
    /// @dev Returns only delegatee-specific policy, ignoring blanket policy
    /// @param pkpTokenId The PKP token ID
    /// @param toolIpfsCid The IPFS CID of the tool
    /// @param delegatee The delegatee address to get the policy for
    /// @return policyIpfsCid The policy IPFS CID for this delegatee, or empty string if not set
    /// @return enabled Whether the policy is currently enabled
    function getCustomToolPolicyForDelegatee(
        uint256 pkpTokenId,
        string calldata toolIpfsCid,
        address delegatee
    ) external view returns (string memory policyIpfsCid, bool enabled) {
        PKPToolRegistryStorage.Layout storage l = PKPToolRegistryStorage.layout();
        PKPToolRegistryStorage.PKPData storage pkpData = l.pkpStore[pkpTokenId];
        bytes32 toolCidHash = _hashToolCid(toolIpfsCid);
        
        // Check if tool exists
        if (!pkpData.toolCids.contains(toolCidHash)) {
            revert PKPToolRegistryErrors.ToolNotFound(toolIpfsCid);
        }
        
        PKPToolRegistryStorage.ToolInfo storage tool = pkpData.toolMap[toolCidHash];
        PKPToolRegistryStorage.Policy storage policy = tool.delegateeCustomPolicies[delegatee];
        
        if (policy.policyIpfsCidHash != bytes32(0)) {
            return (l.hashedPolicyCidToOriginalCid[policy.policyIpfsCidHash], policy.enabled);
        }
        return ("", false);
    }

    /// @notice Set policies for specific tools and delegatees
    /// @dev Only callable by PKP owner. Sets delegatee-specific policies that override blanket policies
    /// @param pkpTokenId The PKP token ID
    /// @param toolIpfsCids The array of IPFS CIDs of the tools
    /// @param delegatees The array of delegatee addresses to set the policies for
    /// @param policyIpfsCids The array of IPFS CIDs of the policies to set
    /// @param enablePolicies Whether to enable the policies when set
    /// @custom:throws ArrayLengthMismatch if array lengths don't match
    /// @custom:throws InvalidDelegatee if any delegatee is the zero address
    /// @custom:throws NotPKPOwner if caller is not the PKP owner
    /// @custom:throws EmptyIPFSCID if any tool CID is empty
    /// @custom:throws EmptyPolicyIPFSCID if any policy CID is empty
    /// @custom:throws ToolNotFound if any tool is not registered or enabled
    function setCustomToolPoliciesForDelegatees(
        uint256 pkpTokenId,
        string[] calldata toolIpfsCids,
        address[] calldata delegatees,
        string[] calldata policyIpfsCids,
        bool enablePolicies
    ) external onlyPKPOwner(pkpTokenId) {
        if (toolIpfsCids.length != delegatees.length || delegatees.length != policyIpfsCids.length) {
            revert PKPToolRegistryErrors.ArrayLengthMismatch();
        }

        PKPToolRegistryStorage.Layout storage l = PKPToolRegistryStorage.layout();
        for (uint256 i = 0; i < toolIpfsCids.length;) {
            if (delegatees[i] == address(0)) revert PKPToolRegistryErrors.InvalidDelegatee();
            _setToolPolicy(l, pkpTokenId, toolIpfsCids[i], delegatees[i], policyIpfsCids[i], enablePolicies);
            unchecked { ++i; }
        }

        emit PKPToolRegistryPolicyEvents.ToolPoliciesSet(pkpTokenId, toolIpfsCids, delegatees, policyIpfsCids, enablePolicies);
    }

    /// @notice Remove delegatee-specific policies for tools
    /// @dev Only callable by PKP owner. Removes custom policies, falling back to blanket policies
    /// @param pkpTokenId The PKP token ID
    /// @param toolIpfsCids The array of IPFS CIDs of the tools
    /// @param delegatees The array of delegatee addresses whose policies should be removed
    /// @custom:throws ArrayLengthMismatch if array lengths don't match
    /// @custom:throws InvalidDelegatee if any delegatee is the zero address
    /// @custom:throws NotPKPOwner if caller is not the PKP owner
    /// @custom:throws EmptyIPFSCID if any tool CID is empty
    /// @custom:throws NoPolicySet if attempting to remove a non-existent policy
    function removeCustomToolPoliciesForDelegatees(
        uint256 pkpTokenId,
        string[] calldata toolIpfsCids,
        address[] calldata delegatees
    ) external onlyPKPOwner(pkpTokenId) {
        if (toolIpfsCids.length != delegatees.length) revert PKPToolRegistryErrors.ArrayLengthMismatch();

        PKPToolRegistryStorage.Layout storage l = PKPToolRegistryStorage.layout();
        for (uint256 i = 0; i < toolIpfsCids.length;) {
            if (delegatees[i] == address(0)) revert PKPToolRegistryErrors.InvalidDelegatee();
            _removeToolPolicy(l, pkpTokenId, toolIpfsCids[i], delegatees[i]);
            unchecked { ++i; }
        }

        emit PKPToolRegistryPolicyEvents.ToolPoliciesRemoved(pkpTokenId, toolIpfsCids, delegatees);
    }

    /// @notice Enable delegatee-specific policies for tools
    /// @dev Only callable by PKP owner. Enables previously set but disabled custom policies
    /// @param pkpTokenId The PKP token ID
    /// @param toolIpfsCids The array of IPFS CIDs of the tools
    /// @param delegatees The array of delegatee addresses whose policies should be enabled
    /// @custom:throws ArrayLengthMismatch if array lengths don't match
    /// @custom:throws InvalidDelegatee if any delegatee is the zero address
    /// @custom:throws NotPKPOwner if caller is not the PKP owner
    /// @custom:throws EmptyIPFSCID if any tool CID is empty
    /// @custom:throws NoPolicySet if attempting to enable a non-existent policy
    /// @custom:throws ToolNotFound if any tool is not registered or enabled
    function enableCustomToolPoliciesForDelegatees(
        uint256 pkpTokenId,
        string[] calldata toolIpfsCids,
        address[] calldata delegatees
    ) external onlyPKPOwner(pkpTokenId) {
        if (toolIpfsCids.length != delegatees.length) revert PKPToolRegistryErrors.ArrayLengthMismatch();

        PKPToolRegistryStorage.Layout storage l = PKPToolRegistryStorage.layout();
        for (uint256 i = 0; i < toolIpfsCids.length;) {
            if (delegatees[i] == address(0)) revert PKPToolRegistryErrors.InvalidDelegatee();
            _enablePolicy(l, pkpTokenId, toolIpfsCids[i], delegatees[i]);
            unchecked { ++i; }
        }

        emit PKPToolRegistryPolicyEvents.PoliciesEnabled(pkpTokenId, toolIpfsCids, delegatees);
    }

    /// @notice Disable delegatee-specific policies for tools
    /// @dev Only callable by PKP owner. Temporarily disables custom policies without removing them
    /// @param pkpTokenId The PKP token ID
    /// @param toolIpfsCids The array of IPFS CIDs of the tools
    /// @param delegatees The array of delegatee addresses whose policies should be disabled
    /// @custom:throws ArrayLengthMismatch if array lengths don't match
    /// @custom:throws InvalidDelegatee if any delegatee is the zero address
    /// @custom:throws NotPKPOwner if caller is not the PKP owner
    /// @custom:throws EmptyIPFSCID if any tool CID is empty
    /// @custom:throws NoPolicySet if attempting to disable a non-existent policy
    /// @custom:throws ToolNotFound if any tool is not registered or enabled
    function disableCustomToolPoliciesForDelegatees(
        uint256 pkpTokenId,
        string[] calldata toolIpfsCids,
        address[] calldata delegatees
    ) external onlyPKPOwner(pkpTokenId) {
        if (toolIpfsCids.length != delegatees.length) revert PKPToolRegistryErrors.ArrayLengthMismatch();

        PKPToolRegistryStorage.Layout storage l = PKPToolRegistryStorage.layout();
        for (uint256 i = 0; i < toolIpfsCids.length;) {
            if (delegatees[i] == address(0)) revert PKPToolRegistryErrors.InvalidDelegatee();
            _disablePolicy(l, pkpTokenId, toolIpfsCids[i], delegatees[i]);
            unchecked { ++i; }
        }

        emit PKPToolRegistryPolicyEvents.PoliciesDisabled(pkpTokenId, toolIpfsCids, delegatees);
    }
} 