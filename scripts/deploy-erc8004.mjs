#!/usr/bin/env node

/**
 * Deploy ERC-8004 Identity and Reputation Registry contracts to Base Sepolia
 */

import { createWalletClient, createPublicClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import { readFileSync, writeFileSync, existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import solc from "solc";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

// Load .env
try {
  const envPath = path.join(ROOT, ".env");
  if (existsSync(envPath)) {
    const envContent = readFileSync(envPath, "utf8");
    for (const line of envContent.split("\n")) {
      const match = line.match(/^([^#=]+)=(.*)$/);
      if (match) {
        const [, key, value] = match;
        process.env[key.trim()] = value.trim().replace(/^["']|["']$/g, "");
      }
    }
  }
} catch (e) {
  console.error("Warning: Could not load .env file");
}

const DEPLOYER_KEY = process.env.DEPLOYER_PRIVATE_KEY || process.env.ERC8004_REGISTRAR_PRIVATE_KEY;

if (!DEPLOYER_KEY) {
  console.error("Error: Set DEPLOYER_PRIVATE_KEY or ERC8004_REGISTRAR_PRIVATE_KEY in .env");
  process.exit(1);
}

// Already deployed Identity Registry
const IDENTITY_REGISTRY = "0xea81e945454f3ce357516f35a9bb69c7dd11b43a";

function compileContract(contractName) {
  const contractPath = path.join(ROOT, "contracts", `${contractName}.sol`);
  const source = readFileSync(contractPath, "utf8");
  
  const input = {
    language: "Solidity",
    sources: {
      [`${contractName}.sol`]: { content: source }
    },
    settings: {
      optimizer: { enabled: true, runs: 200 },
      outputSelection: {
        "*": {
          "*": ["abi", "evm.bytecode.object"]
        }
      }
    }
  };

  console.log(`Compiling ${contractName}...`);
  
  const output = JSON.parse(solc.compile(JSON.stringify(input)));
  
  if (output.errors?.some(e => e.severity === "error")) {
    console.error("Compilation errors:");
    for (const err of output.errors) {
      if (err.severity === "error") console.error(err.formattedMessage);
    }
    process.exit(1);
  }

  const contract = output.contracts[`${contractName}.sol`][contractName];
  console.log(`Compiled successfully!`);
  return {
    abi: contract.abi,
    bytecode: `0x${contract.evm.bytecode.object}`
  };
}

async function deploy() {
  const account = privateKeyToAccount(DEPLOYER_KEY);
  console.log(`Deployer address: ${account.address}`);
  console.log(`Chain: Base Sepolia (${baseSepolia.id})`);
  console.log("");

  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http()
  });

  const walletClient = createWalletClient({
    account,
    chain: baseSepolia,
    transport: http()
  });

  const balance = await publicClient.getBalance({ address: account.address });
  console.log(`Balance: ${(Number(balance) / 1e18).toFixed(4)} ETH`);
  console.log("");

  console.log(`Identity Registry (already deployed): ${IDENTITY_REGISTRY}`);
  console.log("");

  // Deploy Reputation Registry only
  console.log("=== Deploying AgentReputationRegistry ===");
  const reputation = compileContract("AgentReputationRegistry");
  
  const reputationHash = await walletClient.deployContract({
    abi: reputation.abi,
    bytecode: reputation.bytecode,
    account
  });
  console.log(`Transaction: ${reputationHash}`);
  console.log("Waiting for confirmation...");
  
  const reputationReceipt = await publicClient.waitForTransactionReceipt({ hash: reputationHash });
  const reputationAddress = reputationReceipt.contractAddress;
  console.log(`Reputation Registry deployed: ${reputationAddress}`);
  console.log("");

  console.log("===========================================");
  console.log("Deployment complete! Add to your .env file:");
  console.log("===========================================");
  console.log("");
  console.log(`ERC8004_CHAIN_ID=84532`);
  console.log(`ERC8004_IDENTITY_REGISTRY=${IDENTITY_REGISTRY}`);
  console.log(`ERC8004_REPUTATION_REGISTRY=${reputationAddress}`);
  console.log(`ERC8004_REGISTRAR_PRIVATE_KEY=${DEPLOYER_KEY}`);
  console.log("");

  const deploymentInfo = {
    chainId: 84532,
    chainName: "Base Sepolia",
    deployedAt: new Date().toISOString(),
    deployer: account.address,
    contracts: {
      identityRegistry: {
        address: IDENTITY_REGISTRY,
        txHash: "0xc440bfb76749703e0762550b2c5a99942a14ccc63b2a0b696cb64253d4149122"
      },
      reputationRegistry: {
        address: reputationAddress,
        txHash: reputationHash
      }
    }
  };

  writeFileSync(
    path.join(ROOT, "erc8004-deployment.json"),
    JSON.stringify(deploymentInfo, null, 2)
  );
  console.log("Deployment info saved to: erc8004-deployment.json");
}

deploy().catch(err => {
  console.error("Deployment failed:", err.message);
  process.exit(1);
});
