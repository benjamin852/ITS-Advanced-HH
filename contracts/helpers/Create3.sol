// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import {CreateDeploy} from "./CreateDeploy.sol";
import {Create3Address} from "./Create3Address.sol";

library ContractAddress {
    function isContract(address contractAddress) internal view returns (bool) {
        bytes32 existingCodeHash = contractAddress.codehash;

        // https://eips.ethereum.org/EIPS/eip-1052
        // keccak256('') == 0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470
        return
            existingCodeHash != bytes32(0) &&
            existingCodeHash !=
            0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470;
    }
}

/**
 * @title IDeploy Interface
 * @notice This interface defines the errors for a contract that is responsible for deploying new contracts.
 */
interface IDeploy {
    error EmptyBytecode();
    error AlreadyDeployed();
    error DeployFailed();
}

/**
 * @title Create3 contract
 * @notice This contract can be used to deploy a contract with a deterministic address that depends only on
 * the deployer address and deployment salt, not the contract bytecode and constructor parameters.
 */
contract Create3 is Create3Address, IDeploy {
    using ContractAddress for address;

    /**
     * @notice Deploys a new contract using the `CREATE3` method.
     * @dev This function first deploys the CreateDeploy contract using
     * the `CREATE2` opcode and then utilizes the CreateDeploy to deploy the
     * new contract with the `CREATE` opcode.
     * @param bytecode The bytecode of the contract to be deployed
     * @param deploySalt A salt to influence the contract address
     * @return deployed The address of the deployed contract
     */
    function _create3(
        bytes memory bytecode,
        bytes32 deploySalt
    ) internal returns (address deployed) {
        deployed = _create3Address(deploySalt);

        if (bytecode.length == 0) revert EmptyBytecode();
        if (deployed.isContract()) revert AlreadyDeployed();

        // Deploy using create2
        CreateDeploy create = new CreateDeploy{salt: deploySalt}();

        if (address(create) == address(0)) revert DeployFailed();

        // Deploy using create
        create.deploy(bytecode);
    }
}
