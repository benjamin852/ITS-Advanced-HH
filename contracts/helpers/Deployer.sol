// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import '@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol';
import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';
import '@axelar-network/axelar-gmp-sdk-solidity/contracts/interfaces/IAxelarGateway.sol';
import '@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol';
import '@axelar-network/interchain-token-service/contracts/interfaces/ITokenManagerType.sol';

import '../MultichainToken.sol';
import '../NativeTokenV1.sol';

import './Create3.sol';

contract Deployer is Initializable, Create3 {
  /*************\
        ERRORS
    /*************/

  error DeploymentFailed();
  error NotApprovedByGateway();

  /*************\
        STORAGE
    /*************/
  IInterchainTokenService public s_its;
  AccessControl public s_accessControl;
  IAxelarGateway public s_gateway;


  /*************\
     INITIALIZATION
    /*************/

  function initialize(
    IInterchainTokenService _its,
    AccessControl _accessControl,
    IAxelarGateway _gateway
  ) external initializer {
    s_its = _its;
    s_accessControl = _accessControl;
    s_gateway = _gateway;
  }

  /***************************\
       EXTERNAL FUNCTIONALITY
    \***************************/

  //on dest chain deploy token manager for new ITS token
  function execute(
    bytes32 _commandId,
    string calldata _sourceChain,
    string calldata _sourceAddress,
    bytes calldata _payload
  ) external {
    bytes32 payloadHash = keccak256(_payload);

    if (
      !s_gateway.validateContractCall(
        _commandId,
        _sourceChain,
        _sourceAddress,
        payloadHash
      )
    ) revert NotApprovedByGateway();

    (
      bytes32 saltImplementation,
      bytes32 saltProxy,
      bytes memory creationCodeProxy,
      address factoryAddr

    ) = abi.decode(_payload, (bytes32, bytes32, bytes, address));

    // Deploy implementation
    address newTokenImpl = _create3(
      type(NativeTokenV1).creationCode,
      saltImplementation
    );
    if (newTokenImpl == address(0)) revert DeploymentFailed();

    // Deploy ProxyAdmin
    ProxyAdmin proxyAdmin = new ProxyAdmin(factoryAddr);


    address newToken = _create3(creationCodeProxy, saltProxy);
    if (newToken == address(0)) revert DeploymentFailed();

    s_gateway.callContract(_sourceChain, _sourceAddress, abi.encode(newToken));
  }
}
