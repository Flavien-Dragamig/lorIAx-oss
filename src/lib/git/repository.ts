import git from "isomorphic-git";
import { promises as fs } from "fs";
import { getWorkspacePath } from "@/lib/storage/filesystem";

export async function initRepository(spaceGitRepoPath: string): Promise<void> {
  const dir = getWorkspacePath(spaceGitRepoPath);
  await fs.mkdir(dir, { recursive: true });
  await git.init({ fs, dir });

  // Commit initial vide
  await fs.writeFile(
    `${dir}/.gitkeep`,
    "# Espace LorIAx\n",
    "utf-8"
  );
  await git.add({ fs, dir, filepath: ".gitkeep" });
  await git.commit({
    fs,
    dir,
    message: "Initialisation de l'espace",
    author: { name: "LorIAx", email: "system@loriax.local" },
  });
}

export async function commitFile(
  spaceGitRepoPath: string,
  filePath: string,
  message: string,
  authorName: string,
  authorEmail: string
): Promise<string> {
  const dir = getWorkspacePath(spaceGitRepoPath);
  await git.add({ fs, dir, filepath: filePath });
  const sha = await git.commit({
    fs,
    dir,
    message,
    author: { name: authorName, email: authorEmail },
  });
  return sha;
}

export async function getFileHistory(
  spaceGitRepoPath: string,
  filePath: string,
  maxCount = 50
): Promise<
  Array<{
    sha: string;
    message: string;
    authorName: string;
    authorEmail: string;
    timestamp: number;
  }>
> {
  const dir = getWorkspacePath(spaceGitRepoPath);
  const commits = await git.log({ fs, dir, depth: maxCount, filepath: filePath });

  return commits.map((c) => ({
    sha: c.oid,
    message: c.commit.message,
    authorName: c.commit.author.name,
    authorEmail: c.commit.author.email,
    timestamp: c.commit.author.timestamp,
  }));
}

export async function getFileAtCommit(
  spaceGitRepoPath: string,
  filePath: string,
  sha: string
): Promise<string> {
  const dir = getWorkspacePath(spaceGitRepoPath);
  const { blob } = await git.readBlob({
    fs,
    dir,
    oid: sha,
    filepath: filePath,
  });
  return new TextDecoder().decode(blob);
}
