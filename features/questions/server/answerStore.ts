import { Prisma, type Answer as PrismaAnswer } from "@prisma/client";
import { prisma } from "@/shared/db/prisma";
import { MAX_RESPONSES_PER_POST } from "@/shared/questions/constants";
import { createAnswer, type Answer } from "@/shared/types";

function toAnswer(record: PrismaAnswer): Answer {
  return {
    id: record.id,
    postId: record.postId,
    agentId: record.agentId,
    agentName: record.agentName,
    content: record.content,
    likesCount: Number(record.likesCount ?? 0),
    dislikesCount: Number(record.dislikesCount ?? 0),
    createdAt: record.createdAt.toISOString()
  };
}

export async function listAnswersByPost(postId: string): Promise<Answer[]> {
  const answers = await prisma.answer.findMany({
    where: { postId },
    orderBy: { createdAt: "asc" }
  });
  return answers.map((answer) => toAnswer(answer));
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
    const created = await prisma.$transaction(async (tx) => {
      const post = await tx.post.findUnique({
        where: { id: input.postId },
        select: { answersCloseAt: true, settlementStatus: true }
      });

      if (!post) {
        throw new Error("Post does not exist.");
      }

      if (post.settlementStatus !== "open") {
        throw new Error("Bidding is closed for this post.");
      }

      if (post.answersCloseAt && new Date() > new Date(post.answersCloseAt)) {
        throw new Error("Bidding window has ended for this post.");
      }

      await tx.$queryRaw`SELECT id FROM "Post" WHERE id = ${input.postId} FOR UPDATE`;

      const answerCount = await tx.answer.count({
        where: { postId: input.postId }
      });

      if (answerCount >= MAX_RESPONSES_PER_POST) {
        throw new Error(`Response cap reached for this post (${MAX_RESPONSES_PER_POST}).`);
      }

      const inserted = await tx.answer.create({
        data: {
          id: answer.id,
          postId: answer.postId,
          agentId: answer.agentId,
          agentName: answer.agentName,
          content: answer.content,
          likesCount: 0,
          dislikesCount: 0,
          createdAt: new Date(answer.createdAt)
        }
      });

      return inserted;
    });

    return { ok: true, answer: toAnswer(created) };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { ok: false, error: "Agent already answered this question." };
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return { ok: false, error: "Post does not exist." };
    }
    if (error instanceof Error && error.message === "Post does not exist.") {
      return { ok: false, error: "Post does not exist." };
    }
    if (error instanceof Error && error.message === "Bidding is closed for this post.") {
      return { ok: false, error: "Bidding is closed for this post." };
    }
    if (error instanceof Error && error.message === "Bidding window has ended for this post.") {
      return { ok: false, error: "Bidding window has ended for this post." };
    }
    if (error instanceof Error && error.message === `Response cap reached for this post (${MAX_RESPONSES_PER_POST}).`) {
      return { ok: false, error: `Response cap reached for this post (${MAX_RESPONSES_PER_POST}).` };
    }
    throw error;
  }
}

export async function findAnswerById(answerId: string): Promise<Answer | null> {
  const answer = await prisma.answer.findUnique({
    where: { id: answerId }
  });
  return answer ? toAnswer(answer) : null;
}

export async function getLatestAnswerAnchor(): Promise<{ id: string; createdAt: string } | null> {
  const latest = await prisma.answer.findFirst({
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: { id: true, createdAt: true }
  });
  if (!latest) {
    return null;
  }
  return {
    id: latest.id,
    createdAt: latest.createdAt.toISOString()
  };
}

export async function listAnswersAfterAnchor(
  anchor: { id: string; createdAt: string } | null,
  options?: { wikiIds?: string[]; limit?: number }
): Promise<Answer[]> {
  const limit = Math.min(500, Math.max(1, Math.floor(options?.limit ?? 200)));
  const wikiIds = options?.wikiIds?.filter(Boolean) ?? [];
  if (wikiIds.length === 0) {
    return [];
  }

  const where: Prisma.AnswerWhereInput = {
    post: {
      wikiId: {
        in: wikiIds
      }
    }
  };

  if (anchor) {
    where.OR = [
      { createdAt: { gt: new Date(anchor.createdAt) } },
      {
        AND: [
          { createdAt: { equals: new Date(anchor.createdAt) } },
          { id: { gt: anchor.id } }
        ]
      }
    ];
  }

  const answers = await prisma.answer.findMany({
    where,
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: limit
  });
  return answers.map((answer) => toAnswer(answer));
}
