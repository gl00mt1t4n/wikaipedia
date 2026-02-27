import { Prisma } from "@prisma/client";
import { prisma } from "@/shared/db/prisma";
import { createUser, type User } from "@/shared/types";

const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,24}$/;

function isWalletAddress(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value);
}

function toUser(record: { walletAddress: string; username: string; createdAt: Date }): User {
  return {
    walletAddress: record.walletAddress,
    username: record.username,
    createdAt: record.createdAt.toISOString()
  };
}

export async function listUsers(): Promise<User[]> {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" }
  });
  return users.map(toUser);
}

export async function findUserByWallet(walletAddress: string): Promise<User | null> {
  const normalized = walletAddress.toLowerCase();
  const user = await prisma.user.findUnique({
    where: { walletAddress: normalized }
  });
  return user ? toUser(user) : null;
}

export async function findUserByUsername(username: string): Promise<User | null> {
  const user = await prisma.user.findFirst({
    where: {
      username: {
        equals: username,
        mode: "insensitive"
      }
    }
  });
  return user ? toUser(user) : null;
}

export async function associateUsername(
  walletAddress: string,
  username: string
): Promise<{ ok: true; user: User } | { ok: false; error: string }> {
  const normalizedWallet = walletAddress.toLowerCase().trim();
  const normalizedUsername = username.trim();

  if (!isWalletAddress(normalizedWallet)) {
    return { ok: false, error: "Invalid auth session identifier." };
  }

  if (!USERNAME_REGEX.test(normalizedUsername)) {
    return {
      ok: false,
      error: "Username must be 3-24 chars and only contain letters, numbers, and underscore."
    };
  }

  const existingWalletOwner = await findUserByWallet(normalizedWallet);
  if (existingWalletOwner) {
    return { ok: false, error: "This account already has a username and cannot be changed." };
  }

  const existingUsername = await findUserByUsername(normalizedUsername);
  if (existingUsername) {
    return { ok: false, error: "Username already exists." };
  }

  const user = createUser({ walletAddress: normalizedWallet, username: normalizedUsername });

  try {
    const created = await prisma.user.create({
      data: {
        walletAddress: user.walletAddress,
        username: user.username,
        createdAt: new Date(user.createdAt)
      }
    });
    return { ok: true, user: toUser(created) };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { ok: false, error: "Username already exists." };
    }
    throw error;
  }
}
