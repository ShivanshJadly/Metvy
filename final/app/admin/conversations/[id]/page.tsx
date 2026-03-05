// app/admin/conversations/[id]/page.tsx
import { ArrowLeft, FileText } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Streamdown } from "streamdown";
import { getConversationDetails } from "@/app/admin/conversations/actions";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { generateHashedPassword } from "@/lib/db/utils";

export default async function ConversationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  try {
    const conversation = await getConversationDetails(id);

    return (
      <div className="mx-auto flex max-w-6xl flex-col gap-6 p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button asChild size="icon" variant="ghost">
              <Link href="/admin/conversations">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div>
              <h1 className="font-bold text-3xl">{conversation.chatTitle}</h1>
              <p className="text-muted-foreground">Conversation Details</p>
            </div>
          </div>
        </div>

        {/* User Info Card */}
        <Card className="p-6">
          <h2 className="mb-4 font-semibold text-xl">User Information</h2>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div>
              <p className="text-muted-foreground text-sm">Name</p>
              <p className="font-medium">{conversation.userName}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-sm">Email</p>
              <p className="font-medium">{conversation.userEmail}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-sm">Phone</p>
              <p className="font-medium">{conversation.userPhone || "N/A"}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-sm">Created At</p>
              <p className="font-medium">
                {new Date(conversation.chatCreatedAt).toLocaleDateString()}
              </p>
            </div>
          </div>
        </Card>

        {/* Messages */}
        <div className="space-y-4">
          <h2 className="font-semibold text-xl">Messages</h2>

          {conversation.messages.map((msg) => (
            <Card className="p-6" key={msg.id}>
              <div className="flex items-start gap-4">
                <Avatar>
                  <AvatarFallback>
                    {msg.role === "user" ? "U" : "AI"}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 space-y-3">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={msg.role === "user" ? "default" : "secondary"}
                    >
                      {msg.role === "user" ? "User" : "Assistant"}
                    </Badge>
                    <span className="text-muted-foreground text-sm">
                      {new Date(msg.createdAt).toLocaleString()}
                    </span>
                  </div>

                  {msg.parentQuestion && (
                    <div className="rounded-md border-primary border-l-2 bg-muted p-3">
                      <p className="mb-1 text-muted-foreground text-xs">
                        In response to:
                      </p>
                      <p className="text-sm">{msg.parentQuestion}</p>
                    </div>
                  )}

                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <Streamdown>{msg.content}</Streamdown>
                  </div>

                  {/* Resume Cards with Links to Upload Page */}
                  {msg.resumes && msg.resumes.length > 0 && (
                    <div className="mt-4">
                      <div className="mb-3 flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <h3 className="font-semibold text-sm">
                          Returned Resumes ({msg.resumes.length})
                        </h3>
                      </div>
                      <div className="grid gap-3">
                        {msg.resumes.map((resume) => (
                          <Link
                            className="block"
                            href={`/upload?resumeId=${resume.resumeId}`}
                            key={resume.resumeId}
                          >
                            <Card className="cursor-pointer border-2 p-4 transition-colors hover:border-primary hover:bg-muted/50">
                              <div className="flex items-start justify-between gap-4">
                                <div className="min-w-0 flex-1">
                                  <div className="mb-2 flex items-center gap-2">
                                    <p className="font-semibold text-sm">
                                      {resume.firstName} {resume.lastName}
                                    </p>
                                    <Badge
                                      className="font-mono text-xs"
                                      variant="secondary"
                                    >
                                      {resume.resumeId.slice(0, 8)}
                                    </Badge>
                                  </div>

                                  <p className="mb-2 text-muted-foreground text-sm">
                                    {resume.email}
                                  </p>

                                  <div className="flex flex-wrap gap-2 text-xs">
                                    {resume.totalYearsExperience && (
                                      <Badge variant="outline">
                                        {resume.totalYearsExperience} years exp
                                      </Badge>
                                    )}
                                    {resume.keyDomains
                                      ?.slice(0, 3)
                                      .map((domain) => (
                                        <Badge
                                          className="bg-blue-50 dark:bg-blue-950"
                                          key={domain}
                                          variant="outline"
                                        >
                                          {domain}
                                        </Badge>
                                      ))}
                                  </div>

                                  {(resume.skills?.length ?? 0) > 0 && (
                                    <div className="mt-2 flex flex-wrap gap-1">
                                      {resume.skills
                                        ?.slice(0, 5)
                                        .map((skill) => (
                                          <Badge
                                            className="text-xs"
                                            key={skill}
                                            variant="secondary"
                                          >
                                            {skill}
                                          </Badge>
                                        ))}
                                      {(resume.skills?.length ?? 0) > 5 && (
                                        <Badge
                                          className="text-xs"
                                          variant="secondary"
                                        >
                                          +{(resume.skills?.length ?? 0) - 5}{" "}
                                          more
                                        </Badge>
                                      )}
                                    </div>
                                  )}
                                </div>

                                <Button
                                  className="shrink-0"
                                  size="sm"
                                  variant="ghost"
                                >
                                  View in Upload Page →
                                </Button>
                              </div>
                            </Card>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Similarity Scores */}
                  {msg.similarityScores && msg.similarityScores.length > 0 && (
                    <details className="text-muted-foreground text-xs">
                      <summary className="cursor-pointer hover:text-foreground">
                        View Similarity Scores
                      </summary>
                      <div className="mt-2 ml-4 space-y-1">
                        {msg.similarityScores.map((score, idx) => (
                          <div
                            className="flex items-center gap-2"
                            key={generateHashedPassword(idx.toString())}
                          >
                            <span className="font-mono">
                              {score.resumeId.slice(0, 8)}
                            </span>
                            <span>→</span>
                            <span className="font-semibold">
                              {(score.score * 100).toFixed(1)}%
                            </span>
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  } catch (error) {
    console.error("Error fetching conversation details:", error);
    notFound();
  }
}
