// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import '@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol';
import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';
import '@axelar-network/axelar-gmp-sdk-solidity/contracts/interfaces/IAxelarGateway.sol';
import '@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol';

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
        EVENTS
    /*************/
  event MultichainTokenDeployed(address tokenAddress);

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

    (bytes32 saltImplementation, bytes32 saltProxy, bytes32 itsTokenId) = abi
      .decode(_payload, (bytes32, bytes32, bytes32));

    // bytes32 itsTokenId = s_its.deployTokenManager(
    //   S_SALT_ITS_TOKEN,
    //   _destChain,
    //   ITokenManagerType.TokenManagerType.MINT_BURN,
    //   _itsTokenParams,
    //   msg.value
    // );

    // Deploy implementation
    address newTokenImpl = _create3(
      type(NativeTokenV1).creationCode,
      saltImplementation
    );
    if (newTokenImpl == address(0)) revert DeploymentFailed();

    // Deploy ProxyAdmin
    ProxyAdmin proxyAdmin = new ProxyAdmin(msg.sender);

    bytes memory creationCode = _getEncodedCreationCodeSemiNative(
      address(proxyAdmin),
      newTokenImpl,
      itsTokenId
    );

    // Deploy the contract
    address newToken = _create3(creationCode, saltProxy);
    if (newToken == address(0)) revert DeploymentFailed();
    emit MultichainTokenDeployed(newToken);
  }

  /***************************\
       INTERNAL FUNCTIONALITY
    \***************************/
  function _getEncodedCreationCodeSemiNative(
      address _proxyAdmin,
      address _liveImpl,
      bytes32 _itsTokenId
  ) internal view returns (bytes memory proxyCreationCode) {
      bytes memory initData = abi.encodeWithSelector(
          MultichainToken.initialize.selector,
          s_accessControl,
          s_its,
          _itsTokenId
      );

      //TODO change from bytes.concat() to abi.encodePacked()
      proxyCreationCode = bytes.concat(
          type(TransparentUpgradeableProxy).creationCode,
          abi.encode(_liveImpl, _proxyAdmin, initData)
      );
  }
}
