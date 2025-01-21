// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title PKP Tool Registry Tool Events Library
/// @notice Events emitted during tool management operations
/// @dev Contains events for registering, removing, enabling, and disabling tools
library PKPToolRegistryToolEvents {
    /// @notice Emitted when new tools are registered for a PKP
    /// @dev Tools must be registered before they can be used in policies
    /// @param pkpTokenId The ID of the PKP token (indexed for efficient filtering)
    /// @param enabled Whether the tools are enabled or disabled
    /// @param toolIpfsCids Array of IPFS CIDs for the tools being registered
    event ToolsRegistered(uint256 indexed pkpTokenId, bool indexed enabled, string[] toolIpfsCids);

    /// @notice Emitted when tools are removed from a PKP
    /// @dev Removing a tool also removes all associated policies and parameters
    /// @param pkpTokenId The ID of the PKP token (indexed for efficient filtering)
    /// @param toolIpfsCids Array of IPFS CIDs for the tools being removed
    event ToolsRemoved(uint256 indexed pkpTokenId, string[] toolIpfsCids);

    /// @notice Emitted when previously registered tools are enabled
    /// @dev Only enabled tools can be used in active policies
    /// @param pkpTokenId The ID of the PKP token (indexed for efficient filtering)
    /// @param toolIpfsCids Array of IPFS CIDs for the tools being enabled
    event ToolsEnabled(uint256 indexed pkpTokenId, string[] toolIpfsCids);

    /// @notice Emitted when tools are temporarily disabled
    /// @dev Disabled tools remain registered but cannot be used in active policies
    /// @param pkpTokenId The ID of the PKP token (indexed for efficient filtering)
    /// @param toolIpfsCids Array of IPFS CIDs for the tools being disabled
    event ToolsDisabled(uint256 indexed pkpTokenId, string[] toolIpfsCids);

    /// @notice Emitted when tools are permitted for delegatees
    /// @dev Granting tool permissions allows delegatees to use specific tools
    /// @param pkpTokenId The ID of the PKP token (indexed for efficient filtering)
    /// @param toolIpfsCids Array of IPFS CIDs of the tools being permitted
    /// @param delegatees Array of delegatee addresses being granted permissions
    event ToolsPermitted(uint256 indexed pkpTokenId, string[] toolIpfsCids, address[] delegatees);

    /// @notice Emitted when tool permissions are removed from delegatees
    /// @dev Removing tool permissions prevents delegatees from using specific tools
    /// @param pkpTokenId The ID of the PKP token (indexed for efficient filtering)
    /// @param toolIpfsCids Array of IPFS CIDs of the tools being unpermitted
    /// @param delegatees Array of delegatee addresses having permissions removed
    event ToolsUnpermitted(uint256 indexed pkpTokenId, string[] toolIpfsCids, address[] delegatees);
} 