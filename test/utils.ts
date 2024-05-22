import { AbiCoder, keccak256, toUtf8Bytes, hexlify, getAddress } from 'ethers';

export function calculateExpectedTokenId(abiCoder: AbiCoder, deployer: string): string {
    const PREFIX_INTERCHAIN_TOKEN_ID: string = keccak256(toUtf8Bytes('its-interchain-token-id'));
    const SALT: string = '0x0000000000000000000000000000000000000000000000000000000000003039';

    // Define the types of the data to encode
    const types: string[] = ['bytes32', 'address', 'bytes32'];

    // Encode the data
    const data: string = abiCoder.encode(types, [PREFIX_INTERCHAIN_TOKEN_ID, deployer, SALT]);

    // Hash the encoded data to get the expected token ID
    const expectedTokenId: string = keccak256(data);

    return expectedTokenId;
}





