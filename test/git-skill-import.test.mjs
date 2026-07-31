import assert from "node:assert/strict";
import test from "node:test";
import {
  GitSkillImportError,
  importSkillFromGit,
  parseGitHubRepository,
  parseGitLabRepository
} from "../src/lib/git-skill-import.js";

const commitSha = "0123456789abcdef0123456789abcdef01234567";

test("parses only public GitHub and GitLab repository URLs", () => {
  assert.deepEqual(parseGitHubRepository("https://github.com/acornops/skills/tree/main/skills/triage"), {
    owner: "acornops",
    repo: "skills",
    repoUrl: "https://github.com/acornops/skills",
    embeddedSegments: ["main", "skills", "triage"]
  });
  assert.deepEqual(parseGitLabRepository("https://gitlab.com/acornops/skills/-/tree/main/skills/triage"), {
    projectPath: "acornops/skills",
    repoUrl: "https://gitlab.com/acornops/skills",
    embeddedSegments: ["main", "skills", "triage"]
  });
  for (const url of ["http://github.com/acornops/skills", "https://git.internal/acornops/skills", "https://user:secret@github.com/acornops/skills"]) {
    assert.throws(() => parseGitHubRepository(url), GitSkillImportError);
  }
});

test("imports a pinned GitHub Markdown snapshot without browser credentials", async () => {
  const requests = [];
  const fetchImpl = async (url, init) => {
    requests.push({ url: String(url), init });
    if (String(url).endsWith("/repos/acornops/skills")) return json({ default_branch: "main" });
    if (String(url).includes("/commits/main")) return json({ sha: commitSha });
    if (String(url).includes("/git/trees/")) {
      return json({ tree: [
        { path: "skills/triage/SKILL.md", type: "blob", sha: "skill-blob" },
        { path: "skills/triage/guide.md", type: "blob", sha: "guide-blob" },
        { path: "skills/triage/script.sh", type: "blob", sha: "ignored" }
      ] });
    }
    if (String(url).endsWith("/git/blobs/skill-blob")) return json({ encoding: "base64", content: base64("name: Incident triage") });
    if (String(url).endsWith("/git/blobs/guide-blob")) return json({ encoding: "base64", content: base64("# Guide") });
    return new Response("", { status: 404 });
  };
  const imported = await importSkillFromGit({
    provider: "github",
    repoUrl: "https://github.com/acornops/skills",
    ref: "main",
    subpath: "skills/triage"
  }, fetchImpl);

  assert.deepEqual(imported.source, {
    type: "git",
    provider: "github",
    repoUrl: "https://github.com/acornops/skills",
    ref: "main",
    subpath: "skills/triage",
    commitSha
  });
  assert.deepEqual(imported.files, [
    { path: "SKILL.md", content: "name: Incident triage" },
    { path: "guide.md", content: "# Guide" }
  ]);
  for (const request of requests) {
    assert.equal(request.init.credentials, "omit");
    assert.equal(request.init.redirect, "error");
    assert.equal(request.init.referrerPolicy, "no-referrer");
    assert.equal(request.init.cache, "no-store");
  }
});

test("imports a pinned public GitLab snapshot", async () => {
  const fetchImpl = async (url) => {
    const value = String(url);
    if (value === "https://gitlab.com/api/v4/projects/acornops%2Fskills") return json({ default_branch: "main" });
    if (value.includes("/repository/commits/main")) return json({ id: commitSha });
    if (value.includes("/repository/tree")) {
      return json([{ path: "SKILL.md", type: "blob", id: "skill-blob" }], { "x-next-page": "" });
    }
    if (value.endsWith("/repository/blobs/skill-blob/raw")) return new Response("name: GitLab skill", { status: 200 });
    return new Response("", { status: 404 });
  };
  const imported = await importSkillFromGit({
    provider: "gitlab",
    repoUrl: "https://gitlab.com/acornops/skills",
    ref: "",
    subpath: ""
  }, fetchImpl);
  assert.equal(imported.source.commitSha, commitSha);
  assert.equal(imported.source.ref, "main");
  assert.deepEqual(imported.files, [{ path: "SKILL.md", content: "name: GitLab skill" }]);
});

test("rejects imports without a root SKILL.md", async () => {
  const fetchImpl = async (url) => {
    if (String(url).endsWith("/repos/acornops/skills")) return json({ default_branch: "main" });
    if (String(url).includes("/commits/main")) return json({ sha: commitSha });
    return json({ tree: [{ path: "README.md", type: "blob", sha: "readme" }] });
  };
  await assert.rejects(
    importSkillFromGit({ provider: "github", repoUrl: "https://github.com/acornops/skills", ref: "main" }, fetchImpl),
    (error) => error instanceof GitSkillImportError && error.code === "invalid_bundle"
  );
});

function json(value, headers = {}) {
  return new Response(JSON.stringify(value), { status: 200, headers: { "content-type": "application/json", ...headers } });
}

function base64(value) {
  return Buffer.from(value, "utf8").toString("base64");
}
