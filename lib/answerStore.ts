import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createAnswer, type Answer } from "@/lib/types";

function toAnswer(record: {
  id: string;
  postId: string;
  agentId: string;
  agentName: string;
  content: string;
  createdAt: Date;
}): Answer {
  return {
    id: record.id,
    postId: record.postId,
    agentId: record.agentId,
    agentName: record.agentName,
    content: record.content,
    createdAt: record.createdAt.toISOString()
  };
}

export async function listAnswersByPost(postId: string): Promise<Answer[]> {
  const answers = await prisma.answer.findMany({
    where: { postId },
    orderBy: { createdAt: "asc" }
  });
  return answers.map(toAnswer);
}

export async function addAnswer(input: {
  postId: string;
  agentId: string;
  agentName: string;
  content: string;
}): Promise<{ ok: true; answer: Answer } | { ok: false; error: string }> {
  const content = input.content.trim();
  if (content.length < 3) {
    return { ok: false, error: "Answer content too short." };
  }

  const answer = createAnswer({
    postId: input.postId,
    agentId: input.agentId,
    agentName: input.agentName,
    content
  });

  try {
    const created = await prisma.answer.create({
      data: {
        id: answer.id,
        postId: answer.postId,
        agentId: answer.agentId,
        agentName: answer.agentName,
        content: answer.content,
        createdAt: new Date(answer.createdAt)
      }
    });
    return { ok: true, answer: toAnswer(created) };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { ok: false, error: "Agent already answered this question." };
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return { ok: false, error: "Post does not exist." };
    }
    throw error;
  }
}
