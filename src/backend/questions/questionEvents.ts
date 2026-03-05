import Redis from "ioredis";
import type { Answer, Post, Wiki } from "@/types";

export type QuestionCreatedEvent = {
  eventType: "question.created";
  eventId: string;
  postId: string;
  wikiId: string;
  header: string;
  content: string;
  poster: string;
  createdAt: string;
  answersCloseAt: string;
  tags: string[];
  timestamp: string;
};

export type WikiCreatedEvent = {
  eventType: "wiki.created";
  eventId: string;
  wikiId: string;
  wikiDisplayName: string;
  description: string;
  createdBy: string;
  createdAt: string;
  timestamp: string;
};

export type AnswerCreatedEvent = {
  eventType: "answer.created";
  eventId: string;
  answerId: string;
  postId: string;
  wikiId: string;
  agentId: string;
  agentName: string;
  contentPreview: string;
  createdAt: string;
  timestamp: string;
};

type Subscriber = (event: QuestionCreatedEvent) => void;

let nextId = 1;
// HACK: in-memory subscribers only work within one process and do not fan out across replicas.
// Keep for now while traffic is low; replace with shared pub/sub for multi-instance scale.
const subscribers = new Map<number, Subscriber>();

let redisClient: any | null = null;

function getRedisClient(): any | null {
  if (!redisClient) {
    const url = String(process.env.REDIS_URL ?? "").trim();
    if (!url) {
      return null;
    }
    redisClient = new Redis(url);
  }
  return redisClient;
}

function publishToBus(wikiId: string | null | undefined, payload: QuestionCreatedEvent | AnswerCreatedEvent | WikiCreatedEvent): void {
  const client = getRedisClient();
  if (!client) {
    return;
  }
  const channelWikiId = wikiId && wikiId.trim() ? wikiId.trim() : "general";
  const channel = `q:wiki:${channelWikiId}`;
  void client.publish(channel, JSON.stringify(payload));
}

// Register subscriber and return an unsubscribe handler.
export function subscribeToQuestionEvents(subscriber: Subscriber): () => void {
  const id = nextId++;
  subscribers.set(id, subscriber);

  return () => {
    subscribers.delete(id);
  };
}

// Publish event payload to current subscribers.
export function publishQuestionCreated(post: Post): void {
  const event = buildQuestionCreatedEvent(post);

  publishToBus(post.wikiId, event);

  for (const subscriber of subscribers.values()) {
    subscriber(event);
  }
}

export function publishAnswerCreated(answer: Answer, wikiId: string): void {
  const event = buildAnswerCreatedEvent(answer, wikiId);
  publishToBus(wikiId, event);
}

export function publishWikiCreated(wiki: Wiki): void {
  const event = buildWikiCreatedEvent(wiki);
  publishToBus(wiki.id, event);
}

// Build question created event payload for downstream use.
export function buildQuestionCreatedEvent(post: Post): QuestionCreatedEvent {
  return {
    eventType: "question.created",
    eventId: post.id,
    postId: post.id,
    wikiId: post.wikiId,
    header: post.header,
    content: post.content,
    poster: post.poster,
    createdAt: post.createdAt,
    answersCloseAt: post.answersCloseAt,
    tags: [`w/${post.wikiId}`],
    timestamp: post.createdAt
  };
}

// Build wiki created event payload for downstream use.
export function buildWikiCreatedEvent(wiki: Wiki): WikiCreatedEvent {
  return {
    eventType: "wiki.created",
    eventId: `wiki-${wiki.id}`,
    wikiId: wiki.id,
    wikiDisplayName: wiki.displayName,
    description: wiki.description,
    createdBy: wiki.createdBy,
    createdAt: wiki.createdAt,
    timestamp: wiki.createdAt
  };
}

// Build answer created event payload for downstream use.
export function buildAnswerCreatedEvent(answer: Answer, wikiId: string): AnswerCreatedEvent {
  return {
    eventType: "answer.created",
    eventId: `answer-${answer.id}`,
    answerId: answer.id,
    postId: answer.postId,
    wikiId,
    agentId: answer.agentId,
    agentName: answer.agentName,
    contentPreview: answer.content.slice(0, 220),
    createdAt: answer.createdAt,
    timestamp: answer.createdAt
  };
}
