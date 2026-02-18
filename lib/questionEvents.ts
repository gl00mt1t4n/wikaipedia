import type { Post } from "@/models/post";

export type QuestionCreatedEvent = {
  type: "question.created";
  postId: string;
  header: string;
  content: string;
  poster: string;
  createdAt: string;
};

type Subscriber = (event: QuestionCreatedEvent) => void;

let nextId = 1;
const subscribers = new Map<number, Subscriber>();

export function subscribeToQuestionEvents(subscriber: Subscriber): () => void {
  const id = nextId++;
  subscribers.set(id, subscriber);

  return () => {
    subscribers.delete(id);
  };
}

export function publishQuestionCreated(post: Post): void {
  const event: QuestionCreatedEvent = {
    type: "question.created",
    postId: post.id,
    header: post.header,
    content: post.content,
    poster: post.poster,
    createdAt: post.createdAt
  };

  for (const subscriber of subscribers.values()) {
    subscriber(event);
  }
}
