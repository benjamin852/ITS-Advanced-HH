// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import '@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol';
import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';
import '@axelar-network/axelar-gmp-sdk-solidity/contracts/interfaces/IAxelarGateway.sol';
import '@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol';
import '@axelar-network/interchain-token-service/contracts/interfaces/ITokenManagerType.sol';
import '@axelar-network/interchain-token-service/contracts/interfaces/IInterchainTokenService.sol';
import { AddressBytes } from '@axelar-network/axelar-gmp-sdk-solidity/contracts/libs/AddressBytes.sol';

import './AccessControl.sol';

import '@axelar-network/axelar-gmp-sdk-solidity/contracts/deploy/Create3.sol';

contract Deployer is Initializable, Create3 {
  using AddressBytes for address;

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

  /*****************\
     INITIALIZATION
  /*****************/

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
    if (
      !s_gateway.validateContractCall(
        _commandId,
        _sourceChain,
        _sourceAddress,
        keccak256(_payload)
      )
    ) revert NotApprovedByGateway();
    (
      bytes32 computedTokenId,
      address factoryAddr,
      bytes memory semiNativeTokenBytecode,
      bytes4 semiNativeSelector
    ) = abi.decode(_payload, (bytes32, address, bytes, bytes4));

    bytes32 SALT_PROXY = 0x000000000000000000000000000000000000000000000000000000000000007B; //123
    bytes32 SALT_IMPL = 0x00000000000000000000000000000000000000000000000000000000000004D2; //1234

    // Deploy implementation
    address newTokenImpl = _create3(semiNativeTokenBytecode, SALT_IMPL);
    if (newTokenImpl == address(0)) revert DeploymentFailed();

    // Deploy ProxyAdmin
    ProxyAdmin proxyAdmin = new ProxyAdmin(factoryAddr);

    bytes memory creationCodeProxy = _getEncodedCreationCodeSemiNative(
      address(proxyAdmin),
      newTokenImpl,
      computedTokenId,
      semiNativeSelector
    );

    address newTokenProxy = _create3(creationCodeProxy, SALT_PROXY);
    if (newTokenProxy == address(0)) revert DeploymentFailed();

    //circumvent stack too deep
    string memory chain = _sourceChain;

    s_gateway.callContract(chain, _sourceAddress, abi.encode(newTokenProxy));
  }

  // 0xB5FB4BE02232B1bBA4dC8f81dc24C26980dE9e3C
  function _getEncodedCreationCodeSemiNative(
    address _proxyAdmin,
    address _implAddr,
    bytes32 _itsTokenId,
    bytes4 semiNativeSelector
  ) internal view returns (bytes memory proxyCreationCode) {
    bytes memory initData = abi.encodeWithSelector(
      semiNativeSelector,
      s_accessControl,
      s_its,
      _itsTokenId
    );

    proxyCreationCode = abi.encodePacked(
      type(TransparentUpgradeableProxy).creationCode,
      abi.encode(_implAddr, _proxyAdmin, initData)
    );
  }
}
