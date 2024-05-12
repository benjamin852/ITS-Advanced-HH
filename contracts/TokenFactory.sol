// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import '@axelar-network/axelar-gmp-sdk-solidity/contracts/interfaces/IAxelarGasService.sol';
import { StringToAddress, AddressToString } from '@axelar-network/axelar-gmp-sdk-solidity/contracts/libs/AddressString.sol';
import { AddressBytes } from '@axelar-network/axelar-gmp-sdk-solidity/contracts/libs/AddressBytes.sol';
import '@axelar-network/axelar-gmp-sdk-solidity/contracts/interfaces/IAxelarGateway.sol';
import '@axelar-network/interchain-token-service/contracts/interfaces/IInterchainTokenService.sol';
import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';
import '@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol';
import '@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol';
import '@axelar-network/interchain-token-service/contracts/interfaces/ITokenManagerType.sol';
import './helpers/Create3.sol';
import './NativeTokenV1.sol';
import './MultichainToken.sol';
import './AccessControl.sol';
import './Deployer.sol';

contract TokenFactory is Create3, Initializable {
  using AddressToString for address;
  using AddressBytes for address;

  /*************\
        ERRORS
    /*************/
  error DeploymentFailed();
  error OnlyAdmin();
  error NotApprovedByGateway();
  error TokenAlreadyDeployed();
  error InvalidChain();
  error InvalidToken();

  /*************\
        STORAGE
    /*************/
  IInterchainTokenService public s_its;
  AccessControl public s_accessControl;
  IAxelarGasService public s_gasService;
  IAxelarGateway public s_gateway;
  Deployer public s_deployer;
  bytes32 public S_SALT_PROXY; //123
  bytes32 public S_SALT_IMPL; //1234
  bytes32 public S_SALT_ITS_TOKEN; //12345

  mapping(string => address) public s_nativeTokens;
  mapping(string => address) public s_semiNativeTokens;

  /*************\
        MODIFIERS
    /*************/
  modifier isAdmin() {
    if (s_accessControl.isAdmin(msg.sender)) revert OnlyAdmin();
    _;
  }

  /*************\
        EVENTS
    /*************/
  event NativeTokenDeployed(address tokenAddress);
  event MultichainTokenDeployed(address tokenAddress);

  /*************\
     INITIALIZATION
    /*************/
  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  function initialize(
    IInterchainTokenService _its,
    IAxelarGasService _gasService,
    IAxelarGateway _gateway,
    AccessControl _accessControl,
    Deployer _deployer
  ) external initializer {
    s_its = _its;
    s_gasService = _gasService;
    s_gateway = _gateway;
    s_accessControl = _accessControl;
    s_deployer = _deployer;

    S_SALT_PROXY = 0x000000000000000000000000000000000000000000000000000000000000007B; //123
    S_SALT_IMPL = 0x00000000000000000000000000000000000000000000000000000000000004D2; //1234
    S_SALT_ITS_TOKEN = 0x0000000000000000000000000000000000000000000000000000000000003039; //12345
  }

  /***************************\
       EXTERNAL FUNCTIONALITY
    \***************************/

  //param for deployTokenManager()
  function getItsDeploymentParams() external view returns (bytes memory) {
    address computedTokenAddr = getExpectedAddress(S_SALT_PROXY);
    return abi.encode(address(this).toBytes(), computedTokenAddr);
  }

  //exec() will deploy create3 token
  //crosschain semi native deployment (does not wire up to its)
  function deployRemoteSemiNativeToken(
    string calldata _destChain
  ) external payable {
    //Add revert if token already deployed
    if (
      s_semiNativeTokens[_destChain] != address(0) &&
      s_nativeTokens[_destChain] != address(0)
    ) revert TokenAlreadyDeployed();

    bytes32 computedTokenId = keccak256(
      abi.encode(
        keccak256('its-interchain-token-id'),
        address(this), //sender
        S_SALT_ITS_TOKEN
      )
    );

    // Set Payload To Deploy Crosschain Token with Init Args
    bytes memory gmpPayload = abi.encode(
      computedTokenId,
      address(this),
      type(MultichainToken).creationCode,
      MultichainToken.initialize.selector
    );

    s_gasService.payNativeGasForContractCall{ value: msg.value }(
      address(this),
      _destChain,
      address(s_deployer).toString(),
      gmpPayload,
      msg.sender
    );

    // send gmp tx to deploy new token (manager waiting on dest chain already)
    s_gateway.callContract(
      _destChain,
      address(s_deployer).toString(),
      gmpPayload
    );
  }

  //deploy native token on eth
  function deployHomeNative(
    uint256 _burnRate,
    uint256 _txFeeRate /*isAdmin*/
  ) external payable returns (address newTokenProxy) {
    // require(block.chainid == 1, 'only deployable from ethereum');
    if (s_nativeTokens['ethereum'] != address(0)) revert TokenAlreadyDeployed();

    // Deploy implementation
    address newTokenImpl = _create3(
      type(NativeTokenV1).creationCode,
      S_SALT_IMPL
    );
    if (newTokenImpl == address(0)) revert DeploymentFailed();

    // Deploy ProxyAdmin
    ProxyAdmin proxyAdmin = new ProxyAdmin(address(this));

    // Generate Proxy Creation Code (Bytecode + Constructor)
    bytes memory proxyCreationCode = _getEncodedCreationCodeNative(
      address(proxyAdmin),
      newTokenImpl,
      _burnRate,
      _txFeeRate
    );
    // Deploy proxy
    newTokenProxy = _create3(proxyCreationCode, S_SALT_PROXY);
    if (newTokenProxy == address(0)) revert DeploymentFailed();

    emit NativeTokenDeployed(newTokenProxy);
    s_nativeTokens['ethereum'] = newTokenProxy;
  }

  function connectTokenToITS(
    string calldata _destChain,
    bytes calldata _itsTokenParams
  ) external payable {
    if (s_nativeTokens['ethereum'] == address(0)) revert InvalidToken();
    if (
      keccak256(abi.encode(_destChain)) != keccak256(abi.encode('')) &&
      s_semiNativeTokens[_destChain] == address(0)
    ) revert InvalidToken();
    s_its.deployTokenManager(
      S_SALT_ITS_TOKEN,
      _destChain,
      ITokenManagerType.TokenManagerType.MINT_BURN,
      _itsTokenParams,
      msg.value
    );
  }

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
    address liveTokenAddress = abi.decode(
      _payload,
      (address)
    );
    //Avalanche
    s_semiNativeTokens[_sourceChain] = liveTokenAddress;
  }

  function getExpectedAddress(bytes32 _salt) public view returns (address) {
    return _create3Address(_salt);
  }

  /***************************\
       INTERNAL FUNCTIONALITY
    \***************************/

  function _getEncodedCreationCodeNative(
    address _proxyAdmin,
    address _implAddr,
    uint256 _burnRate,
    uint256 _txFeeRate
  ) internal view returns (bytes memory proxyCreationCode) {
    bytes memory initData = abi.encodeWithSelector(
      NativeTokenV1.initialize.selector,
      s_accessControl,
      s_its,
      _burnRate,
      _txFeeRate
    );

    proxyCreationCode = abi.encodePacked(
      type(TransparentUpgradeableProxy).creationCode,
      abi.encode(_implAddr, _proxyAdmin, initData)
    );
  }
}
