import { constants } from 'node:fs';
import { copyFile, lstat, mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const archiveDirectory = path.resolve(scriptDirectory, '../../archive/technical-notes');
const outputDirectory = path.resolve(scriptDirectory, '../out');

async function statIfPresent(filename) {
  try {
    return await lstat(filename);
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

async function requireDirectory(directory) {
  const stat = await statIfPresent(directory);
  if (!stat || stat.isSymbolicLink() || !stat.isDirectory()) {
    throw new Error(`Expected a directory, not a symbolic link: ${directory}`);
  }
}

async function collectFiles(directory, relative = '') {
  const entries = await readdir(directory, { withFileTypes: true });
  entries.sort((left, right) => left.name.localeCompare(right.name));
  const directories = [];
  const files = [];
  for (const entry of entries) {
    if (entry.name === '.DS_Store') continue;
    const name = path.join(relative, entry.name);
    const filename = path.join(directory, entry.name);
    const stat = await lstat(filename);
    if (stat.isSymbolicLink()) {
      throw new Error(`Archive contains a symbolic link: ${name}`);
    }
    if (stat.isDirectory()) {
      directories.push(name);
      const nested = await collectFiles(filename, name);
      directories.push(...nested.directories);
      files.push(...nested.files);
    } else if (stat.isFile()) {
      files.push(name);
    } else {
      throw new Error(`Archive contains an unsupported file type: ${name}`);
    }
  }
  return { directories, files };
}

async function main() {
  await requireDirectory(archiveDirectory);
  await requireDirectory(outputDirectory);
  const { directories, files } = await collectFiles(archiveDirectory);

  // Check the complete merge before writing anything. Existing directories may
  // be shared with the current site; existing files must never be replaced.
  for (const relative of directories) {
    const stat = await statIfPresent(path.join(outputDirectory, relative));
    if (stat && (stat.isSymbolicLink() || !stat.isDirectory())) {
      throw new Error(`Archive directory conflicts with export: ${relative}`);
    }
  }
  for (const relative of files) {
    if (await statIfPresent(path.join(outputDirectory, relative))) {
      throw new Error(`Archive file conflicts with export: ${relative}`);
    }
  }

  for (const relative of directories) {
    const destination = path.join(outputDirectory, relative);
    try {
      await mkdir(destination);
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
    }
    await requireDirectory(destination);
  }
  for (const relative of files) {
    await copyFile(
      path.join(archiveDirectory, relative),
      path.join(outputDirectory, relative),
      constants.COPYFILE_EXCL,
    );
  }
  console.log(`Copied ${files.length} archive files into ${outputDirectory}`);
}

main().catch((error) => {
  console.error(`Archive export failed: ${error.message}`);
  process.exitCode = 1;
});
