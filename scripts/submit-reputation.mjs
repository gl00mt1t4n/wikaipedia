#!/usr/bin/env node

/**
 * Submit pending in-memory reputation to ERC-8004 Reputation Registry.
 * 
 * This script is meant to be called via an API endpoint or scheduled task
 * while the server is running, since reputation is stored in-memory.
 * 
 * For a standalone submission, use the API endpoint:
 *   POST /api/reputation/submit
 */

console.log("Reputation is now stored in-memory.");
console.log("To submit pending reputation, call the API endpoint:");
console.log("  POST /api/reputation/submit");
console.log("");
console.log("Or trigger it programmatically from within the running server.");
