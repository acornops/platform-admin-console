const MAX_FILES = 16;
const MAX_FILE_BYTES = 32 * 1024;
const MAX_TOTAL_BYTES = 128 * 1024;
const PUBLIC_GIT_HOSTS = Object.freeze({
  github: "github.com",
  gitlab: "gitlab.com"
});

export class GitSkillImportError extends Error {
  constructor(message, code = "provider_failed") {
    super(message);
    this.name = "GitSkillImportError";
    this.code = code;
  }
}

export async function importSkillFromGit(input, fetchImpl = globalThis.fetch) {
  if (!input || !["github", "gitlab"].includes(input.provider)) {
    throw new GitSkillImportError("Choose GitHub or GitLab.", "invalid_provider");
  }
  if (typeof fetchImpl !== "function") {
    throw new GitSkillImportError("Git provider access is unavailable in this browser.", "provider_unavailable");
  }
  return input.provider === "gitlab"
    ? importFromGitLab(input, fetchImpl)
    : importFromGitHub(input, fetchImpl);
}

async function importFromGitHub(input, fetchImpl) {
  const parsed = parseGitHubRepository(input.repoUrl);
  const normalized = normalizeImportLocation(input, parsed);
  const repository = await gitJson(
    `https://api.github.com/repos/${encodeURIComponent(parsed.owner)}/${encodeURIComponent(parsed.repo)}`,
    fetchImpl
  );
  const ref = normalized.ref || trimmed(repository.default_branch);
  if (!ref) throw new GitSkillImportError("Unable to determine a Git ref for this repository.", "invalid_ref");

  const commit = await gitJson(
    `https://api.github.com/repos/${encodeURIComponent(parsed.owner)}/${encodeURIComponent(parsed.repo)}/commits/${encodeURIComponent(ref)}`,
    fetchImpl
  );
  const commitSha = trimmed(commit.sha);
  if (!/^[0-9a-f]{40}$/i.test(commitSha)) {
    throw new GitSkillImportError("GitHub did not return a valid pinned commit.", "invalid_ref");
  }

  const tree = await gitJson(
    `https://api.github.com/repos/${encodeURIComponent(parsed.owner)}/${encodeURIComponent(parsed.repo)}/git/trees/${encodeURIComponent(commitSha)}?recursive=1`,
    fetchImpl
  );
  if (tree.truncated) {
    throw new GitSkillImportError("GitHub returned a truncated repository tree. Choose a smaller skill subpath.", "invalid_subpath");
  }
  const entries = validateEntries(
    Array.isArray(tree.tree) ? tree.tree.filter((entry) => entry?.type === "blob") : [],
    normalized.subpath
  );
  const files = [];
  let totalBytes = 0;
  for (const entry of entries) {
    const blob = await gitJson(
      `https://api.github.com/repos/${encodeURIComponent(parsed.owner)}/${encodeURIComponent(parsed.repo)}/git/blobs/${encodeURIComponent(entry.sha)}`,
      fetchImpl
    );
    if (blob.encoding !== "base64" || typeof blob.content !== "string") {
      throw new GitSkillImportError(`GitHub returned unsupported content for ${entry.path}.`, "invalid_bundle");
    }
    totalBytes = appendFile(files, {
      path: relativePath(entry.path, normalized.subpath),
      content: decodeBase64Utf8(blob.content)
    }, totalBytes);
  }
  return {
    source: {
      type: "git",
      provider: "github",
      repoUrl: parsed.repoUrl,
      ref,
      ...(normalized.subpath ? { subpath: normalized.subpath } : {}),
      commitSha
    },
    files
  };
}

async function importFromGitLab(input, fetchImpl) {
  const parsed = parseGitLabRepository(input.repoUrl);
  const normalized = normalizeImportLocation(input, parsed);
  const projectId = encodeURIComponent(parsed.projectPath);
  const project = await gitJson(`https://gitlab.com/api/v4/projects/${projectId}`, fetchImpl);
  const ref = normalized.ref || trimmed(project.default_branch);
  if (!ref) throw new GitSkillImportError("Unable to determine a Git ref for this repository.", "invalid_ref");

  const commit = await gitJson(
    `https://gitlab.com/api/v4/projects/${projectId}/repository/commits/${encodeURIComponent(ref)}`,
    fetchImpl
  );
  const commitSha = trimmed(commit.id);
  if (!/^[0-9a-f]{40}$/i.test(commitSha)) {
    throw new GitSkillImportError("GitLab did not return a valid pinned commit.", "invalid_ref");
  }

  const treeUrl = new URL(`https://gitlab.com/api/v4/projects/${projectId}/repository/tree`);
  treeUrl.searchParams.set("ref", commitSha);
  treeUrl.searchParams.set("recursive", "true");
  treeUrl.searchParams.set("per_page", "100");
  if (normalized.subpath) treeUrl.searchParams.set("path", normalized.subpath);
  const tree = await gitLabPages(treeUrl, fetchImpl);
  const entries = validateEntries(
    tree.filter((entry) => entry?.type === "blob").map((entry) => ({
      ...entry,
      path: normalizeGitLabPath(entry.path, normalized.subpath)
    })),
    normalized.subpath
  );
  const files = [];
  let totalBytes = 0;
  for (const entry of entries) {
    const response = await gitFetch(
      `https://gitlab.com/api/v4/projects/${projectId}/repository/blobs/${encodeURIComponent(entry.id)}/raw`,
      fetchImpl,
      { Accept: "text/plain" }
    );
    if (!response.ok) throw gitResponseError(response);
    totalBytes = appendFile(files, {
      path: relativePath(entry.path, normalized.subpath),
      content: await response.text()
    }, totalBytes);
  }
  return {
    source: {
      type: "git",
      provider: "gitlab",
      repoUrl: parsed.repoUrl,
      ref,
      ...(normalized.subpath ? { subpath: normalized.subpath } : {}),
      commitSha
    },
    files
  };
}

export function parseGitHubRepository(rawUrl) {
  const parsed = publicRepositoryUrl(rawUrl, "github");
  const segments = decodedSegments(parsed);
  if (segments.length < 2 || (segments.length > 2 && segments[2] !== "tree")) {
    throw new GitSkillImportError("GitHub URL must point to a public repository or repository tree.", "invalid_repo_url");
  }
  const tree = segments[2] === "tree" ? segments.slice(3) : [];
  if (segments[2] === "tree" && tree.length === 0) {
    throw new GitSkillImportError("GitHub tree URL must include a ref.", "invalid_ref");
  }
  const repo = stripGitSuffix(segments[1]);
  return {
    owner: segments[0],
    repo,
    repoUrl: `https://github.com/${segments[0]}/${repo}`,
    embeddedSegments: tree
  };
}

export function parseGitLabRepository(rawUrl) {
  const parsed = publicRepositoryUrl(rawUrl, "gitlab");
  const segments = decodedSegments(parsed);
  const marker = segments.findIndex((segment, index) => segment === "-" && segments[index + 1] === "tree");
  const projectSegments = marker < 0 ? segments : segments.slice(0, marker);
  const tree = marker < 0 ? [] : segments.slice(marker + 2);
  if (!projectSegments.length) {
    throw new GitSkillImportError("GitLab URL must point to a public project.", "invalid_repo_url");
  }
  if (segments.includes("-") && marker < 0) {
    throw new GitSkillImportError("GitLab URL must point to a public project or repository tree.", "invalid_repo_url");
  }
  if (marker >= 0 && !tree.length) {
    throw new GitSkillImportError("GitLab tree URL must include a ref.", "invalid_ref");
  }
  projectSegments[projectSegments.length - 1] = stripGitSuffix(projectSegments.at(-1));
  return {
    projectPath: projectSegments.join("/"),
    repoUrl: `https://gitlab.com/${projectSegments.join("/")}`,
    embeddedSegments: tree
  };
}

function publicRepositoryUrl(rawUrl, provider) {
  let parsed;
  try {
    parsed = new URL(String(rawUrl || "").trim());
  } catch {
    throw new GitSkillImportError("Enter a valid HTTPS Git repository URL.", "invalid_repo_url");
  }
  if (parsed.protocol !== "https:"
    || parsed.hostname !== PUBLIC_GIT_HOSTS[provider]
    || parsed.username
    || parsed.password
    || parsed.search
    || parsed.hash) {
    throw new GitSkillImportError(`Platform defaults support public ${provider === "github" ? "GitHub" : "GitLab"} HTTPS URLs only.`, "invalid_repo_url");
  }
  return parsed;
}

function decodedSegments(url) {
  try {
    return url.pathname.split("/").filter(Boolean).map((segment) => decodeURIComponent(segment));
  } catch {
    throw new GitSkillImportError("Repository URL contains an invalid encoded path.", "invalid_repo_url");
  }
}

function normalizeImportLocation(input, parsed) {
  const explicitRef = trimmed(input.ref);
  const explicitSubpath = normalizeSubpath(input.subpath);
  const embedded = parsed.embeddedSegments || [];
  if (explicitRef && embedded.length) {
    const refSegments = explicitRef.split("/").filter(Boolean);
    const matchingRef = refSegments.every((segment, index) => embedded[index] === segment);
    if (!matchingRef) {
      throw new GitSkillImportError("Repository tree URL includes a different ref. Clear Ref or use a bare repository URL.", "invalid_ref");
    }
    const embeddedSubpath = embedded.slice(refSegments.length).join("/");
    if (explicitSubpath && embeddedSubpath && explicitSubpath !== embeddedSubpath) {
      throw new GitSkillImportError("Repository tree URL includes a different subpath. Clear Subpath or use a bare repository URL.", "invalid_subpath");
    }
    return { ref: explicitRef, subpath: explicitSubpath || embeddedSubpath };
  }
  return {
    ref: explicitRef || embedded[0] || "",
    subpath: explicitSubpath || embedded.slice(1).join("/")
  };
}

function normalizeSubpath(value) {
  const normalized = trimmed(value).replaceAll("\\", "/").replace(/^\/+|\/+$/g, "");
  if (!normalized) return "";
  const segments = normalized.split("/");
  if (segments.some((segment) => !segment || segment === "." || segment === "..")) {
    throw new GitSkillImportError("Skill subpath contains an invalid segment.", "invalid_subpath");
  }
  return normalized;
}

function validateEntries(entries, subpath) {
  const within = entries.filter((entry) => isWithin(entry.path, subpath));
  const markdown = within.filter((entry) => {
    const path = relativePath(entry.path, subpath);
    return path === "SKILL.md" || path.endsWith(".md");
  });
  if (!markdown.some((entry) => relativePath(entry.path, subpath) === "SKILL.md")) {
    throw new GitSkillImportError("Git import requires SKILL.md at the selected repository path.", "invalid_bundle");
  }
  if (markdown.length > MAX_FILES) {
    throw new GitSkillImportError(`Git import can include at most ${MAX_FILES} Markdown files.`, "invalid_bundle");
  }
  return markdown.sort((left, right) => {
    const leftPath = relativePath(left.path, subpath);
    const rightPath = relativePath(right.path, subpath);
    if (leftPath === "SKILL.md") return -1;
    if (rightPath === "SKILL.md") return 1;
    return leftPath.localeCompare(rightPath);
  });
}

function isWithin(path, subpath) {
  return !subpath || path === subpath || path.startsWith(`${subpath}/`);
}

function relativePath(path, subpath) {
  return subpath ? path.slice(subpath.length + 1) : path;
}

function normalizeGitLabPath(path, subpath) {
  return !subpath || isWithin(path, subpath) ? path : `${subpath}/${String(path).replace(/^\/+/, "")}`;
}

function appendFile(files, file, currentTotal) {
  const size = new TextEncoder().encode(file.content).byteLength;
  if (size > MAX_FILE_BYTES) {
    throw new GitSkillImportError(`Git import file "${file.path}" exceeds ${MAX_FILE_BYTES} bytes.`, "invalid_bundle");
  }
  if (currentTotal + size > MAX_TOTAL_BYTES) {
    throw new GitSkillImportError(`Git import exceeds ${MAX_TOTAL_BYTES} bytes.`, "invalid_bundle");
  }
  files.push(file);
  return currentTotal + size;
}

function decodeBase64Utf8(value) {
  const bytes = Uint8Array.from(globalThis.atob(value.replace(/\s/g, "")), (character) => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

async function gitJson(url, fetchImpl) {
  const response = await gitFetch(url, fetchImpl, { Accept: "application/json" });
  if (!response.ok) throw gitResponseError(response);
  try {
    return await response.json();
  } catch {
    throw new GitSkillImportError("Git provider returned an unexpected response.", "provider_failed");
  }
}

async function gitLabPages(initialUrl, fetchImpl) {
  const items = [];
  const url = new URL(initialUrl);
  for (let pageCount = 0; pageCount < 10; pageCount += 1) {
    const response = await gitFetch(url.toString(), fetchImpl, { Accept: "application/json" });
    if (!response.ok) throw gitResponseError(response);
    const page = await response.json().catch(() => null);
    if (!Array.isArray(page)) throw new GitSkillImportError("GitLab returned an unexpected tree response.", "provider_failed");
    items.push(...page);
    const nextPage = response.headers.get("x-next-page");
    if (!nextPage) return items;
    url.searchParams.set("page", nextPage);
  }
  throw new GitSkillImportError("GitLab returned too many repository-tree pages.", "invalid_bundle");
}

async function gitFetch(url, fetchImpl, headers) {
  try {
    return await fetchImpl(url, {
      method: "GET",
      headers,
      credentials: "omit",
      redirect: "error",
      referrerPolicy: "no-referrer",
      cache: "no-store"
    });
  } catch {
    throw new GitSkillImportError("Git provider could not be reached. Check browser access and try again.", "provider_unavailable");
  }
}

function gitResponseError(response) {
  if ([401, 403].includes(response.status)) return new GitSkillImportError("Git provider denied access. Platform defaults support public repositories only.", "access_denied");
  if (response.status === 404) return new GitSkillImportError("Repository, ref, or subpath was not found.", "not_found");
  if (response.status === 429) return new GitSkillImportError("Git provider rate limit reached. Wait and try again.", "rate_limited");
  if (response.status >= 500) return new GitSkillImportError("Git provider is temporarily unavailable.", "provider_unavailable");
  return new GitSkillImportError("Git provider request failed.", "provider_failed");
}

function stripGitSuffix(value) {
  return String(value || "").endsWith(".git") ? value.slice(0, -4) : String(value || "");
}

function trimmed(value) {
  return String(value || "").trim();
}
