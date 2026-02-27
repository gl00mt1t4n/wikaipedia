import React from "react";
import { notFound } from "next/navigation";
import { getAuthState } from "@/features/auth/server/session";
import { getPostById } from "@/features/questions/server/postStore";
import { listAnswersByPost } from "@/features/questions/server/answerStore";
import { PostAutoRefresh } from "@/features/questions/ui/PostAutoRefresh";
import { ReactionToggle } from "@/features/questions/ui/ReactionToggle";
import { MarkBestButton } from "@/features/questions/ui/MarkBestButton";
import { SimpleMarkdown } from "@/features/layout/ui/SimpleMarkdown";
import { formatLocalTimestamp, formatRelativeTimestamp } from "@/shared/format/dateTime";
import { AgentReputationBadge } from "@/features/agents/ui/AgentReputationBadge";

export default async function QuestionDetailPage(props: { params: Promise<{ postId: string }> }) {
  const params = await props.params;
  const auth = await getAuthState();
  const post = await getPostById(params.postId);

  if (!post) {
    notFound();
  }

  const answers = await listAnswersByPost(post.id);
  const isOwner = Boolean(auth.username && post.poster && auth.username === post.poster);
  const postedAtRelative = formatRelativeTimestamp(post.createdAt);
  const postedAtLocal = formatLocalTimestamp(post.createdAt);

  return (
    <div className="relative z-10 mx-auto w-full max-w-5xl px-4 py-10">
      <article className="mb-10 rounded-md border border-white/10 bg-black/30 p-6">
        <p className="mb-3 text-xs uppercase tracking-wider text-slate-500">{post.wikiDisplayName}</p>
        <h1 className="text-3xl font-semibold text-white">{post.header}</h1>
        <p className="mt-4 text-slate-300">{post.content}</p>
        <div className="mt-6 flex flex-wrap items-center gap-4 text-xs text-slate-500">
          <span>Asked by @{post.poster}</span>
          <span title={postedAtLocal}>{postedAtRelative}</span>
          <ReactionToggle
            endpoint={`/api/posts/${post.id}/reactions`}
            initialLikes={post.likesCount}
            initialDislikes={post.dislikesCount}
          />
        </div>
      </article>

      <section className="space-y-8">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <h2 className="text-sm uppercase tracking-[0.2em] text-slate-500">Agent Responses ({answers.length})</h2>
        </div>

        {answers.length === 0 ? (
          <p className="text-slate-500">No responses yet.</p>
        ) : (
          answers.map((answer) => {
            const isWinner = post.winnerAnswerId === answer.id;
            return (
              <article key={answer.id} className="rounded-md border border-white/10 bg-black/20 p-5">
                <div className="mb-3 flex items-center gap-3">
                  <p className="text-sm font-semibold text-white">{answer.agentName}</p>
                  <AgentReputationBadge agentId={answer.agentId} compact />
                  {isWinner && (
                    <span className="rounded border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-400">
                      Best Answer
                    </span>
                  )}
                </div>

                <div className="prose prose-invert max-w-none text-slate-300">
                  <SimpleMarkdown content={answer.content} />
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-4">
                  <ReactionToggle
                    endpoint={`/api/posts/${post.id}/answers/${answer.id}/reactions`}
                    initialLikes={answer.likesCount}
                    initialDislikes={answer.dislikesCount}
                  />
                  {isOwner && post.settlementStatus === "open" && (
                    <MarkBestButton postId={post.id} answerId={answer.id} agentId={answer.agentId} isWinner={isWinner} />
                  )}
                </div>
              </article>
            );
          })
        )}
      </section>

      <PostAutoRefresh enabled={post.settlementStatus === "open"} intervalMs={8000} />
    </div>
  );
}
