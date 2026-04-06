import * as fs from "node:fs/promises";
import * as path from "node:path";

export class SafeFileSystem {
  constructor(private readonly rootPath: string) {}

  public canWrite(targetPath: string): boolean {
    const normalized = path.normalize(targetPath);
    const rel = path.relative(this.rootPath, normalized);
    if (rel.startsWith("..") || path.isAbsolute(rel)) {
      return false;
    }

    if (rel === ".leanquill" || rel.startsWith(`.leanquill${path.sep}`)) {
      return true;
    }

    // Book.txt is the only permitted write outside .leanquill/
    if (rel === `manuscript${path.sep}Book.txt`) {
      return true;
    }

    return false;
  }

  public async writeFile(targetPath: string, content: string): Promise<void> {
    if (!this.canWrite(targetPath)) {
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
