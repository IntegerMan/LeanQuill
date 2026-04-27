import * as fs from "node:fs/promises";
import * as path from "node:path";

/** Optional behavior for metadata apply and other constrained callers (D-09). */
export interface SafeFileSystemOptions {
  /**
   * When true, `canWrite` rejects `manuscript/Book.txt` even though author-facing
   * instances allow it. Defense-in-depth for AI metadata apply path.
   */
  denyManuscriptBookTxt?: boolean;
}

export class SafeFileSystem {
  private readonly additionalAllowed: Array<{ prefix: string; extFilter?: string }> = [];
  private readonly denyManuscriptBookTxt: boolean;

  constructor(
    private readonly rootPath: string,
    options?: SafeFileSystemOptions,
  ) {
    this.denyManuscriptBookTxt = options?.denyManuscriptBookTxt ?? false;
  }

  /**
   * Allow writes to a path prefix that is outside the default `.leanquill/` boundary.
   *
   * @param prefix - Forward-slash path relative to rootPath (e.g. "research/leanquill").
   *   Entries are not deduplicated or cleared; call this only once per path per instance.
   *   The extension activation flow guarantees a single call per configured research folder.
   * @param extFilter - If provided, only files whose extension matches (e.g. ".md") are
   *   permitted. Directories (no extension) are always allowed to support mkdir operations.
   */
  public allowPath(prefix: string, extFilter?: string): void {
    this.additionalAllowed.push({ prefix, extFilter });
  }

  public canWrite(targetPath: string, isFileOperation = false): boolean {
    const normalized = path.normalize(targetPath);
    const rel = path.relative(this.rootPath, normalized);
    if (rel.startsWith("..") || path.isAbsolute(rel)) {
      return false;
    }

    if (rel === ".leanquill" || rel.startsWith(`.leanquill${path.sep}`)) {
      return true;
    }

    // Book.txt is the only permitted write outside .leanquill/ (unless denied for AI apply path).
    if (rel === `manuscript${path.sep}Book.txt`) {
      return !this.denyManuscriptBookTxt;
    }

    // Check dynamically allowed paths
    for (const { prefix, extFilter } of this.additionalAllowed) {
      const normalizedPrefix = prefix.split("/").join(path.sep);
      if (rel === normalizedPrefix || rel.startsWith(normalizedPrefix + path.sep)) {
        if (extFilter) {
          const ext = path.extname(rel);
          // Allow directories (no extension) for mkdir; require extFilter match for file writes
          if (ext === extFilter || (ext === "" && !isFileOperation)) {
            return true;
          }
          continue;
        }
        return true;
      }
    }

    return false;
  }

  public async writeFile(targetPath: string, content: string): Promise<void> {
    if (!this.canWrite(targetPath, true)) {
      throw new Error(`Blocked write outside LeanQuill boundary: ${targetPath}`);
    }

    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.writeFile(targetPath, content, "utf8");
  }

  public async mkdir(targetPath: string): Promise<void> {
    if (!this.canWrite(targetPath)) {
      throw new Error(`Blocked mkdir outside LeanQuill boundary: ${targetPath}`);
    }

    await fs.mkdir(targetPath, { recursive: true });
  }
}
