import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { Contract, Signer, Wallet } from "ethers";

import { createNetwork, relay } from '@axelar-network/axelar-local-dev';

describe("TokenFactory", function () {
    let polygon: any;
    let avalanche: any;
    let TokenFactory: any;
    let tokenFactory: Contract;
    let deployer: Signer;
    let addr1: Signer;

    let polygonUserWallet: Wallet;
    let avalancheUserWallet: Wallet;


    before(async function () {
        // Initialize a Polygon network
        polygon = await createNetwork({
            name: 'Polygon',
            port: 1545
        });

        // Initialize an Avalanche network
        avalanche = await createNetwork({
            name: 'Avalanche',
        });
        [polygonUserWallet] = polygon.userWallets;
        [avalancheUserWallet] = avalanche.userWallets;

    });

    let factoryProxy: any
    beforeEach(async function () {
        TokenFactory = await ethers.getContractFactory("TokenFactory");
        [deployer, addr1] = await ethers.getSigners();
        console.log(polygon.gateway.address, 'poly gatewya')
        factoryProxy = await upgrades.deployProxy(TokenFactory, [polygon.interchainTokenService.address,
        polygon.gasService.address,
        polygon.gateway.address,], { initializer: 'initialize' });
    });

    describe("Deployment and Initialization", function () {
        it("Should set the right deployer", async function () {
            console.log(await factoryProxy.s_gateway(), 'gateway from storage')
            await factoryProxy.testMe()
            // console.log(await factoryProxy.testMeTwo(), 'waz')
            // console.log(await factoryProxy.waz(), 'the waz')
        });

    });

});
