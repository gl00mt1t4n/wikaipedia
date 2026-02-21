// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title AgentReputationRegistry
 * @notice Simplified ERC-8004 Reputation Registry for AI agents
 */
contract AgentReputationRegistry {
    struct Feedback {
        address client;
        int128 value;
        string tag1;
        uint256 timestamp;
    }

    mapping(uint256 => Feedback[]) private _feedbacks;
    mapping(uint256 => address[]) private _clients;
    mapping(uint256 => mapping(address => bool)) private _isClient;

    event NewFeedback(
        uint256 indexed agentId,
        address indexed clientAddress,
        uint64 feedbackIndex,
        int128 value,
        string tag1
    );

    /**
     * @notice Submit feedback for an agent
     * @param agentId The agent's token ID from the Identity Registry
     * @param value The feedback value (positive = good, negative = bad)
     * @param valueDecimals Unused, kept for interface compatibility
     * @param tag1 Category tag (e.g., "answerQuality", "winnerSelected")
     * @param tag2 Unused, kept for interface compatibility
     * @param endpoint Unused, kept for interface compatibility
     * @param feedbackURI Unused, kept for interface compatibility
     * @param feedbackHash Unused, kept for interface compatibility
     */
    function giveFeedback(
        uint256 agentId,
        int128 value,
        uint8 valueDecimals,
        string calldata tag1,
        string calldata tag2,
        string calldata endpoint,
        string calldata feedbackURI,
        bytes32 feedbackHash
    ) external {
        // Silence unused variable warnings
        valueDecimals; tag2; endpoint; feedbackURI; feedbackHash;
        
        if (!_isClient[agentId][msg.sender]) {
            _isClient[agentId][msg.sender] = true;
            _clients[agentId].push(msg.sender);
        }

        uint64 feedbackIndex = uint64(_feedbacks[agentId].length);

        _feedbacks[agentId].push(Feedback({
            client: msg.sender,
            value: value,
            tag1: tag1,
            timestamp: block.timestamp
        }));

        emit NewFeedback(agentId, msg.sender, feedbackIndex, value, tag1);
    }

    /**
     * @notice Get all clients who have given feedback to an agent
     */
    function getClients(uint256 agentId) external view returns (address[] memory) {
        return _clients[agentId];
    }

    /**
     * @notice Get aggregated feedback summary for an agent
     */
    function getSummary(
        uint256 agentId,
        address[] calldata clientAddresses,
        string calldata tag1,
        string calldata tag2
    ) external view returns (uint64 count, int128 summaryValue, uint8 summaryValueDecimals) {
        tag2; // silence warning
        
        Feedback[] storage feedbacks = _feedbacks[agentId];
        bool filterByClients = clientAddresses.length > 0;
        bool filterByTag1 = bytes(tag1).length > 0;

        for (uint256 i = 0; i < feedbacks.length; i++) {
            Feedback storage fb = feedbacks[i];

            if (filterByClients && !_containsAddress(clientAddresses, fb.client)) continue;
            if (filterByTag1 && keccak256(bytes(fb.tag1)) != keccak256(bytes(tag1))) continue;

            count++;
            summaryValue += fb.value;
        }

        summaryValueDecimals = 0;
    }

    /**
     * @notice Get the number of feedback entries for an agent
     */
    function getFeedbackCount(uint256 agentId) external view returns (uint256) {
        return _feedbacks[agentId].length;
    }

    function _containsAddress(address[] calldata arr, address addr) private pure returns (bool) {
        for (uint256 i = 0; i < arr.length; i++) {
            if (arr[i] == addr) return true;
        }
        return false;
    }
}
