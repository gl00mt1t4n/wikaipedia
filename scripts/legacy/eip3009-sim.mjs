import { createPublicClient, http, parseUnits, parseSignature } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';

const alphaKey = "0xc9323a7574499447bd3262282bd3f015a9dd04461d2bb049769863aaa012f88d";
const alphaAcc = privateKeyToAccount(alphaKey);

const facKey = "0x95b2206be885b5d8744a335ee83021dfeaa732f399c8ebb1414b05ab28c31eee";
const facAcc = privateKeyToAccount(facKey);

const usdc = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
const escrow = "0xFC7bfBF2535C569937b5B9eEaBC310cF887D1DAF";
const pc = createPublicClient({ chain: baseSepolia, transport: http() });

async function run() {
  const nonce = "0x" + Array.from({length: 32}, () => Math.floor(Math.random() * 256).toString(16).padStart(2, '0')).join('');
  
  const domain = {
    name: "USDC", // Test with "USDC"
    version: "2",
    chainId: baseSepolia.id,
    verifyingContract: usdc
  };
  
  const message = {
    from: alphaAcc.address,
    to: escrow,
    value: parseUnits("0.75", 6),
    validAfter: 0n,
    validBefore: 2000000000n,
    nonce
  };
  
  const types = {
    TransferWithAuthorization: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "value", type: "uint256" },
      { name: "validAfter", type: "uint256" },
      { name: "validBefore", type: "uint256" },
      { name: "nonce", type: "bytes32" }
    ]
  };

  const sig = await alphaAcc.signTypedData({ domain, types, primaryType: "TransferWithAuthorization", message });
  const parsedSig = parseSignature(sig);

  const eip3009ABI = [{
    type: "function",
    name: "transferWithAuthorization",
    stateMutability: "nonpayable",
    inputs: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "value", type: "uint256" },
      { name: "validAfter", type: "uint256" },
      { name: "validBefore", type: "uint256" },
      { name: "nonce", type: "bytes32" },
      { name: "v", type: "uint8" },
      { name: "r", type: "bytes32" },
      { name: "s", type: "bytes32" }
    ],
    outputs: []
  }];

  try {
    await pc.simulateContract({
      account: facAcc,
      address: usdc,
      abi: eip3009ABI,
      functionName: "transferWithAuthorization",
      args: [
        message.from, message.to, message.value, message.validAfter, message.validBefore, message.nonce,
        parsedSig.v || parsedSig.yParity, parsedSig.r, parsedSig.s
      ]
    });
    console.log("Simulation SUCCESS with name: USDC");
  } catch (e) {
    console.error("Simulation FAILED with name: USDC ==>", e.message.substring(0, 150));
  }
}

run();
