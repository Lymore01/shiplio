import fs from "fs-extra";
import path from "path";
import { create } from "tar";
import ignore from "ignore";
import os from "os";

export async function createArchive(): Promise<string> {
  const root = process.cwd();
  const tempDir = os.tmpdir();
  const archiveName = `shiplio-${Date.now()}.tar.gz`;
  const archivePath = path.join(tempDir, archiveName);

  const ig = ignore();

  const ignoreFilePath = path.join(root, ".shiplioignore");
  if (await fs.pathExists(ignoreFilePath)) {
    const ignoreFileContent = await fs.readFile(ignoreFilePath, "utf-8");
    ig.add(ignoreFileContent);
  }

  ig.add([".shiplio", ".git", "node_modules", archiveName]);

  await create(
    {
      gzip: true,
      file: archivePath,
      cwd: root,
      filter: (filePath) => {
        const relativePath = path.relative(root, path.join(root, filePath));
        if (!relativePath) return true;
        return !ig.ignores(relativePath);
      },
    },
    ["."]
  );

  return archivePath;
}
