"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  MessageSquare,
  X,
  Send,
  CornerDownRight,
  CheckCircle2,
  Circle,
  Trash2,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/ui/user-avatar";
import { toast } from "sonner";

interface CommentAuthor {
  id: string;
  name: string;
  avatarUrl: string | null;
}

interface Comment {
  id: string;
  content: string;
  parentId: string | null;
  resolved: boolean;
  createdAt: string;
  updatedAt: string;
  author: CommentAuthor;
  replies?: Comment[];
}

interface CommentsPanelProps {
  documentId: string;
  currentUserId: string;
  onClose: () => void;
}

function timeAgo(date: string): string {
  const seconds = Math.floor(
    (Date.now() - new Date(date).getTime()) / 1000
  );
  if (seconds < 60) return "à l'instant";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `il y a ${days} j`;
  return new Date(date).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
  });
}

function Avatar({ author }: { author: CommentAuthor }) {
  return <UserAvatar email={author.name} avatarUrl={author.avatarUrl} size={28} />;
}

function CommentInput({
  onSubmit,
  placeholder,
  autoFocus,
}: {
  onSubmit: (content: string) => Promise<void>;
  placeholder: string;
  autoFocus?: boolean;
}) {
  const [value, setValue] = useState("");
  const [sending, setSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  async function handleSubmit() {
    if (!value.trim() || sending) return;
    setSending(true);
    await onSubmit(value.trim());
    setValue("");
    setSending(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  return (
    <div className="flex gap-2 items-end">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoFocus={autoFocus}
        rows={1}
        className="flex-1 resize-none px-3 py-2 text-sm border border-input bg-background rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
      />
      <Button
        size="icon-xs"
        onClick={handleSubmit}
        disabled={!value.trim() || sending}
        className="shrink-0 h-8 w-8"
      >
        {sending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Send className="h-3.5 w-3.5" />
        )}
      </Button>
    </div>
  );
}

function CommentThread({
  comment,
  currentUserId,
  documentId,
  onRefresh,
}: {
  comment: Comment;
  currentUserId: string;
  documentId: string;
  onRefresh: () => void;
}) {
  const [showReply, setShowReply] = useState(false);

  async function handleReply(content: string) {
    const res = await fetch(`/api/documents/${documentId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, parentId: comment.id }),
    });
    if (res.ok) {
      setShowReply(false);
      onRefresh();
    } else {
      toast.error("Erreur lors de l'envoi");
    }
  }

  async function handleToggleResolved() {
    const res = await fetch(`/api/documents/${documentId}/comments`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        commentId: comment.id,
        resolved: !comment.resolved,
      }),
    });
    if (res.ok) onRefresh();
  }

  async function handleDelete(commentId: string) {
    const res = await fetch(`/api/documents/${documentId}/comments`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ commentId }),
    });
    if (res.ok) onRefresh();
    else toast.error("Erreur lors de la suppression");
  }

  return (
    <div
      className={`rounded-lg border border-border p-3 space-y-3 ${
        comment.resolved ? "opacity-60" : ""
      }`}
    >
      {/* Main comment */}
      <div className="flex gap-2">
        <Avatar author={comment.author} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm font-medium truncate">
                {comment.author.name}
              </span>
              <span className="text-xs text-muted-foreground shrink-0">
                {timeAgo(comment.createdAt)}
              </span>
            </div>
            <div className="flex items-center gap-0.5 shrink-0">
              <button
                onClick={handleToggleResolved}
                title={comment.resolved ? "Rouvrir" : "Résoudre"}
                className="p-1 rounded hover:bg-muted text-muted-foreground transition-colors"
              >
                {comment.resolved ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                ) : (
                  <Circle className="h-3.5 w-3.5" />
                )}
              </button>
              {comment.author.id === currentUserId && (
                <button
                  onClick={() => handleDelete(comment.id)}
                  title="Supprimer"
                  className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-destructive transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
          <p className="text-sm mt-1 whitespace-pre-wrap">{comment.content}</p>
        </div>
      </div>

      {/* Replies */}
      {comment.replies && comment.replies.length > 0 && (
        <div className="ml-4 pl-4 border-l-2 border-border space-y-2">
          {comment.replies.map((reply) => (
            <div key={reply.id} className="flex gap-2">
              <Avatar author={reply.author} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm font-medium truncate">
                      {reply.author.name}
                    </span>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {timeAgo(reply.createdAt)}
                    </span>
                  </div>
                  {reply.author.id === currentUserId && (
                    <button
                      onClick={() => handleDelete(reply.id)}
                      title="Supprimer"
                      className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
                <p className="text-sm mt-0.5 whitespace-pre-wrap">
                  {reply.content}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reply input */}
      {!comment.resolved && (
        <>
          {showReply ? (
            <div className="ml-4">
              <CommentInput
                onSubmit={handleReply}
                placeholder="Répondre..."
                autoFocus
              />
            </div>
          ) : (
            <button
              onClick={() => setShowReply(true)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground ml-4 transition-colors"
            >
              <CornerDownRight className="h-3 w-3" />
              Répondre
            </button>
          )}
        </>
      )}
    </div>
  );
}

export function CommentsPanel({
  documentId,
  currentUserId,
  onClose,
}: CommentsPanelProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showResolved, setShowResolved] = useState(false);

  const loadComments = useCallback(async () => {
    try {
      const res = await fetch(`/api/documents/${documentId}/comments`);
      if (res.ok) {
        const data = await res.json();
        setComments(data);
      }
    } catch {
      // Ignore
    } finally {
      setLoading(false);
    }
  }, [documentId]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  async function handleNewComment(content: string) {
    const res = await fetch(`/api/documents/${documentId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    if (res.ok) {
      loadComments();
    } else {
      toast.error("Erreur lors de l'envoi du commentaire");
    }
  }

  const openComments = comments.filter((c) => !c.resolved);
  const resolvedComments = comments.filter((c) => c.resolved);
  const displayedComments = showResolved ? comments : openComments;

  return (
    <div className="w-80 border-l border-border bg-card flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2 text-sm font-medium">
          <MessageSquare className="h-4 w-4" />
          Commentaires
          {openComments.length > 0 && (
            <span className="bg-primary/10 text-primary px-1.5 rounded-full text-[10px]">
              {openComments.length}
            </span>
          )}
        </div>
        <Button variant="ghost" size="icon-xs" onClick={onClose} title="Fermer">
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Toggle résolu */}
      {resolvedComments.length > 0 && (
        <div className="px-4 py-2 border-b border-border">
          <button
            onClick={() => setShowResolved(!showResolved)}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {showResolved
              ? "Masquer les résolus"
              : `Afficher ${resolvedComments.length} résolu${resolvedComments.length > 1 ? "s" : ""}`}
          </button>
        </div>
      )}

      {/* Comments list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {loading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {!loading && comments.length === 0 && (
          <div className="text-center space-y-2 py-8">
            <MessageSquare className="h-8 w-8 text-muted-foreground mx-auto" />
            <p className="text-sm text-muted-foreground">
              Aucun commentaire
            </p>
            <p className="text-xs text-muted-foreground">
              Ajoutez un commentaire ci-dessous
            </p>
          </div>
        )}

        {!loading &&
          displayedComments.map((comment) => (
            <CommentThread
              key={comment.id}
              comment={comment}
              currentUserId={currentUserId}
              documentId={documentId}
              onRefresh={loadComments}
            />
          ))}
      </div>

      {/* New comment input */}
      <div className="p-3 border-t border-border">
        <CommentInput
          onSubmit={handleNewComment}
          placeholder="Ajouter un commentaire..."
        />
      </div>
    </div>
  );
}
