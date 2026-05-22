import { promises as fs } from "fs";
import path from "path";

const WORKSPACES_PATH =
  process.env.WORKSPACES_PATH || path.join(process.cwd(), "workspaces");

function assertSafePath(resolvedPath: string): void {
  const normalizedBase = path.resolve(WORKSPACES_PATH);
  const normalizedTarget = path.resolve(resolvedPath);
  if (!normalizedTarget.startsWith(normalizedBase + path.sep) && normalizedTarget !== normalizedBase) {
    throw new Error("Chemin interdit : tentative de traversée de répertoire");
  }
}

export function getWorkspacePath(spaceGitRepoPath: string): string {
  const result = path.join(WORKSPACES_PATH, spaceGitRepoPath);
  assertSafePath(result);
  return result;
}

export function getDocumentPath(
  spaceGitRepoPath: string,
  filePath: string
): string {
  const result = path.join(WORKSPACES_PATH, spaceGitRepoPath, filePath);
  assertSafePath(result);
  return result;
}

export async function readDocument(
  spaceGitRepoPath: string,
  filePath: string
): Promise<string> {
  const fullPath = getDocumentPath(spaceGitRepoPath, filePath);
  return fs.readFile(fullPath, "utf-8");
}

export async function writeDocument(
  spaceGitRepoPath: string,
  filePath: string,
  content: string
): Promise<void> {
  const fullPath = getDocumentPath(spaceGitRepoPath, filePath);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, content, "utf-8");
}

export async function deleteDocument(
  spaceGitRepoPath: string,
  filePath: string
): Promise<void> {
  const fullPath = getDocumentPath(spaceGitRepoPath, filePath);
  await fs.unlink(fullPath);
}

export async function ensureWorkspaceDir(
  spaceGitRepoPath: string
): Promise<string> {
  const dir = getWorkspacePath(spaceGitRepoPath);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

export async function listFiles(
  spaceGitRepoPath: string,
  subPath = ""
): Promise<string[]> {
  const dir = path.join(getWorkspacePath(spaceGitRepoPath), subPath);
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    return entries
      .filter((e) => !e.name.startsWith("."))
      .map((e) => (e.isDirectory() ? `${e.name}/` : e.name));
  } catch {
    return [];
  }
}
