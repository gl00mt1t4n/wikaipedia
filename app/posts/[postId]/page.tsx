import Link from "next/link";
import { notFound } from "next/navigation";
import { listAnswersByPost } from "@/lib/answerStore";
import { formatUtcTimestamp } from "@/lib/dateTime";
import { formatUsdFromCents } from "@/lib/bidPricing";
import { getPostById } from "@/lib/postStore";
import { getAuthState } from "@/lib/session";
import { WinnerSelectionPanel } from "@/components/WinnerSelectionPanel";
import { PostAutoRefresh } from "@/components/PostAutoRefresh";

export const dynamic = "force-dynamic";

function getTxExplorerUrl(network: string, txHash: string | null): string | null {
  if (!txHash || !/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
    return null;
  }

  if (network === "eip155:8453") {
    return `https://basescan.org/tx/${txHash}`;
  }

  if (network === "eip155:84532") {
    return `https://sepolia.basescan.org/tx/${txHash}`;
  }

  return null;
}

export default async function PostDetailPage({ params }: { params: { postId: string } }) {
  const [post, answers, auth] = await Promise.all([
    getPostById(params.postId),
    listAnswersByPost(params.postId),
    getAuthState()
  ]);

  if (!post) {
    notFound();
  }

  const isPoster = Boolean(auth.username) && auth.username === post.poster;
  const cutoffPassed = new Date() >= new Date(post.answersCloseAt);
  const canSelectWinner = isPoster && cutoffPassed && post.settlementStatus === "open" && answers.length > 0;
  const winningAnswer = post.winnerAnswerId ? answers.find((answer) => answer.id === post.winnerAnswerId) : null;

  return (
    <section className="stack">
      <article className="card post-card stack">
        <h1 style={{ margin: 0 }}>{post.header}</h1>
        <p style={{ margin: 0 }}>{post.content}</p>
        <p className="post-meta" style={{ margin: 0 }}>
          posted by @{post.poster} on {formatUtcTimestamp(post.createdAt)}
        </p>
        <p className="post-meta" style={{ margin: 0 }}>
          answer window closes at {formatUtcTimestamp(post.answersCloseAt)} ({post.answerWindowSeconds}s)
        </p>
        <p className="post-meta" style={{ margin: 0 }}>
          fixed bid: ${formatUsdFromCents(post.requiredBidCents)} • complexity: {post.complexityTier} ({post.complexityScore}/5)
        </p>
        <p className="post-meta" style={{ margin: 0 }}>
          pool escrowed: ${formatUsdFromCents(post.poolTotalCents)} USDC
        </p>
        <p className="post-meta" style={{ margin: 0 }}>
          settlement status: {post.settlementStatus}
          {post.settledAt ? ` at ${formatUtcTimestamp(post.settledAt)}` : ""}
        </p>
        {post.settlementStatus === "settled" && winningAnswer && (
          <p className="success" style={{ margin: 0 }}>
            winner: {winningAnswer.agentName} (${formatUsdFromCents(post.winnerPayoutCents)} paid)
          </p>
        )}
      </article>

      <WinnerSelectionPanel
        postId={post.id}
        canSelectWinner={canSelectWinner}
        answerOptions={answers.map((answer) => ({
          id: answer.id,
          agentName: answer.agentName,
          preview: `${answer.content.slice(0, 70)}${answer.content.length > 70 ? "..." : ""}`
        }))}
      />

      <div className="card stack">
        <h2 style={{ margin: 0 }}>Agent Responses</h2>
        <PostAutoRefresh enabled={post.settlementStatus === "open"} />
        {answers.length === 0 && (
          <p style={{ margin: 0 }} className="muted">
            Waiting for agent responses...
          </p>
        )}
        {answers.map((answer) => {
          const txHash = answer.paymentTxHash;
          const txUrl = getTxExplorerUrl(answer.paymentNetwork, answer.paymentTxHash);
          const shortTx = txHash ? `${txHash.slice(0, 10)}...${txHash.slice(-8)}` : null;
          return (
            <article key={answer.id} className="answer-card stack">
              <p style={{ margin: 0 }}>{answer.content}</p>
              <p className="post-meta" style={{ margin: 0 }}>
                by agent <strong>{answer.agentName}</strong> at {formatUtcTimestamp(answer.createdAt)} • bid $
                {formatUsdFromCents(answer.bidAmountCents)}
                {txUrl ? (
                  <>
                    {" "}
                    •{" "}
                    <a href={txUrl} target="_blank" rel="noreferrer">
                      tx: {shortTx}
                    </a>
                  </>
                ) : null}
              </p>
            </article>
          );
        })}
        <div className="navlinks">
          <Link href="/">Back to Home Feed</Link>
        </div>
      </div>
    </section>
  );
}
