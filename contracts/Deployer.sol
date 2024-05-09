// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import '@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol';
import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';
import '@axelar-network/axelar-gmp-sdk-solidity/contracts/interfaces/IAxelarGateway.sol';
import '@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol';
import '@axelar-network/interchain-token-service/contracts/interfaces/ITokenManagerType.sol';

import './AccessControl.sol';

import './helpers/Create3.sol';

contract Deployer is Initializable, Create3 {
  /*************\
        ERRORS
    /*************/

  error DeploymentFailed();
  error NotApprovedByGateway();

  /*************\
        STORAGE
    /*************/
  AccessControl public s_accessControl;
  IAxelarGateway public s_gateway;

  /*************\
     INITIALIZATION
    /*************/

  function initialize(
    AccessControl _accessControl,
    IAxelarGateway _gateway
  ) external initializer {
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
      bytes32 computedTokenId,
      address factoryAddr,
      address its,
      bytes memory semiNativeTokenBytecode,
      bytes4 semiNativeSelector
    ) = abi.decode(
        _payload,
        (bytes32, bytes32, bytes32, address, address, bytes, bytes4)
      );

    // Deploy implementation
    address newTokenImpl = _create3(
      semiNativeTokenBytecode,
      saltImplementation
    );
    if (newTokenImpl == address(0)) revert DeploymentFailed();

    // Deploy ProxyAdmin
    ProxyAdmin proxyAdmin = new ProxyAdmin(factoryAddr);

    bytes memory creationCodeProxy = _getEncodedCreationCodeSemiNative(
      address(proxyAdmin),
      newTokenImpl,
      computedTokenId,
      its,
      semiNativeSelector
    );

    address newToken = _create3(creationCodeProxy, saltProxy);
    if (newToken == address(0)) revert DeploymentFailed();

    s_gateway.callContract(_sourceChain, _sourceAddress, abi.encode(newToken));
  }

  function _getEncodedCreationCodeSemiNative(
    address _proxyAdmin,
    address _implAddr,
    bytes32 _itsTokenId,
    address its,
    bytes4 semiNativeSelector
  ) internal view returns (bytes memory proxyCreationCode) {
    bytes memory initData = abi.encodeWithSelector(
      semiNativeSelector,
      s_accessControl,
      its,
      _itsTokenId
    );

    proxyCreationCode = abi.encodePacked(
      type(TransparentUpgradeableProxy).creationCode,
      abi.encode(_implAddr, _proxyAdmin, initData)
    );
  }
}
