import type { BootstrapBody, PopulateBody, PromoteBody, FetchLatestTestReportBody } from '../schemas';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { configuration, loggerService,  } from '../index';
import { setTimeout as sleep } from 'node:timers/promises';

interface PackageJson {
  name?: string;
  version?: string;
  [key: string]: unknown;
}
interface GitHubCommit {
  sha: string;
  commit: {
    message: string;
    tree: {
      sha: string;
    };
  };
}

interface GitHubNewCommit {
  sha: string;
}

function getGitHubTokenFromRequest(request: FastifyRequest): string {
  const authHeader = request.headers.authorization;

  if (!authHeader) {
    throw new Error('Missing Authorization header');
  }

  const [scheme, token] = authHeader.split(' ');

  if (scheme !== 'Bearer' || !token) {
    throw new Error('Invalid Authorization header format');
  }

  return token;
}


const getGitHubApiConfig = (token: string): { api: string; headers: Record<string, string> } => ({
  api: 'https://api.github.com',
  headers: {
    Authorization: `token ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  },
});

const getRepoName = (ruleId: string): string => `rule-${ruleId}`;

const handleError = (error: unknown, reply: FastifyReply): void => {
  const message = error instanceof Error ? error.message : String(error);
  loggerService.error(message);
  reply.status(500).send({ success: false, message });
};

export const bootstrapHandler = async (
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> => {
  try {
    const token = getGitHubTokenFromRequest(request);
    const { api, headers } = getGitHubApiConfig(token);

    const { ruleId, ruleVersion, organization } = request.body as BootstrapBody;
    const repo = getRepoName(ruleId);

    const createRes = await fetch(
      `${api}/repos/${configuration.GITHUB_TEMPLATE_OWNER}/${configuration.GITHUB_TEMPLATE_REPO}/generate`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          owner: organization,
          name: repo,
          private: false,
          include_all_branches: false,
        }),
      }
    );

    if (!createRes.ok) {
      throw new Error(await createRes.text());
    }

    const { html_url: htmlUrl } = (await createRes.json()) as {
      html_url: string;
    };

    await waitForRepoContent(organization, repo, headers);
    await copyTemplateFiles(organization, ruleId, ruleVersion, headers);
    loggerService.log(`Created: ${organization}/${repo}`);

    reply.status(200).send({
      success: true,
      repoUrl: htmlUrl,
      message: `Created ${organization}/${repo} v${ruleVersion}`,
    });
  } catch (error) {
    handleError(error, reply);
  }
};

export const populateHandler = async (
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> => {
  try {
    const token = getGitHubTokenFromRequest(request);
    const { api, headers } = getGitHubApiConfig(token);

    const { organization, ruleId, ruleCode, testCode } = request.body as PopulateBody;

    const repo = getRepoName(ruleId);
    const branch = configuration.GITHUB_DEFAULT_BRANCH;

    const rulePath = 'src/rule.ts';
    const testPath = '__tests__/unit/rule.test.ts';

    const ruleFileSha = await getFileSha(organization, repo, rulePath, branch, headers);

    const ruleRes = await fetch(`${api}/repos/${organization}/${repo}/contents/${rulePath}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        message: `Update ${rulePath}`,
        content: ruleCode,
        branch,
        ...(ruleFileSha && { sha: ruleFileSha }),
      }),
    });

    if (!ruleRes.ok) {
      throw new Error(`Rule update failed: ${await ruleRes.text()}`);
    }

    const testFileSha = await getFileSha(organization, repo, testPath, branch, headers);

    const testRes = await fetch(`${api}/repos/${organization}/${repo}/contents/${testPath}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        message: `Update ${testPath}`,
        content: testCode,
        branch,
        ...(testFileSha && { sha: testFileSha }),
      }),
    });

    if (!testRes.ok) {
      throw new Error(`Test update failed: ${await testRes.text()}`);
    }

    reply.status(200).send({
      success: true,
      message: `Populated ${organization}/${repo} on ${branch}`,
    });
  } catch (error) {
    handleError(error, reply);
  }
};

export const promoteHandler = async (
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> => {
  try {
    const token = getGitHubTokenFromRequest(request);
    const { api, headers } = getGitHubApiConfig(token);

    const { organization, ruleId, branchName } = request.body as PromoteBody;

    const repo = getRepoName(ruleId);

    const baseBranch = (await getBranchSha(organization, repo, 'staging', headers))
      ? 'staging'
      : configuration.GITHUB_DEFAULT_BRANCH;

    const baseSha = await getBranchSha(organization, repo, baseBranch, headers);

    if (!baseSha) {
      throw new Error(`Base branch "${baseBranch}" not found`);
    }

    const existingBranchSha = await getBranchSha(organization, repo, branchName, headers);

    if (existingBranchSha) {
      const newCommitMessage = `Sync ${branchName} with latest commit from ${baseBranch}`;

      const latestCommitRes = await fetch(
        `${api}/repos/${organization}/${repo}/commits/${baseSha}`,
        { headers }
      );

      if (!latestCommitRes.ok) {
        throw new Error(`Failed to fetch the latest commit from the base branch: ${await latestCommitRes.text()}`);
      }

      const latestCommit = await latestCommitRes.json();
      const treeSha = (latestCommit as GitHubCommit).commit.tree.sha;

      const newCommitRes = await fetch(`${api}/repos/${organization}/${repo}/git/commits`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          message: newCommitMessage,
          tree: treeSha, 
          parents: [existingBranchSha],
        }),
      });

      if (!newCommitRes.ok) {
        throw new Error(`Failed to create commit: ${await newCommitRes.text()}`);
      }

      const newCommit = await newCommitRes.json();
      const newCommitSha = (newCommit as GitHubNewCommit).sha;

      const updateRes = await fetch(`${api}/repos/${organization}/${repo}/git/refs/heads/${branchName}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          sha: newCommitSha,
        }),
      });

      if (!updateRes.ok) {
        throw new Error(`Failed to update branch reference: ${await updateRes.text()}`);
      }

      loggerService.log(`Synchronized branch ${branchName} with the latest commit from ${baseBranch} in ${organization}/${repo}`);
    } else {
      const createRes = await fetch(`${api}/repos/${organization}/${repo}/git/refs`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          ref: `refs/heads/${branchName}`,
          sha: baseSha,
        }),
      });

      if (!createRes.ok) {
        throw new Error(await createRes.text());
      }

      loggerService.log(`Created branch ${branchName} from ${baseBranch} in ${organization}/${repo}`);
    }

    reply.status(200).send({
      success: true,
      message: `Branch ${branchName} is synchronized with ${baseBranch}`,
    });
  } catch (error) {
    handleError(error, reply);
  }
};

export const fetchLatestTestReportHandler = async (
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> => {
  try {
    const token = getGitHubTokenFromRequest(request);
    const { api, headers } = getGitHubApiConfig(token);

    const { organization, ruleId, branchName } = request.body as FetchLatestTestReportBody;
    const repo = getRepoName(ruleId);

    const branch = branchName || configuration.GITHUB_DEFAULT_BRANCH;

    const sha = await getBranchSha(organization, repo, branch, headers);

    if (!sha) {
      throw new Error(`Could not find the branch reference or commit SHA for ${organization}/${repo}`);
    }

    const filePath = 'reports/unit-tests/latest/index.html';

    const fileRes = await fetch(`${api}/repos/${organization}/${repo}/contents/${filePath}?ref=${sha}`, {
      headers,
    });

    if (!fileRes.ok) {
      if (fileRes.status === 404) {
        return await reply.status(404).send({
          success: false,
          message: `The test report at path "${filePath}" does not exist in ${organization}/${repo} on branch "${branchName}"`,
        });
      } else {
        throw new Error(`Failed to fetch file: ${await fileRes.text()}`);
      }
    }

    const fileData = (await fileRes.json()) as { content: string; encoding: string };

    if (fileData.encoding !== 'base64') {
      throw new Error('Expected file content to be base64 encoded.');
    }

    const htmlContent = Buffer.from(fileData.content, 'base64').toString('utf8');

    reply.header('Content-Type', 'text/html').send(htmlContent);
  } catch (error) {
    handleError(error, reply);
  }
};

async function copyTemplateFiles(
  organization: string,
  ruleId: string,
  ruleVersion: string,
  headers: Record<string, string>
): Promise<void> {
  const repo = getRepoName(ruleId);
  const branch = configuration.GITHUB_DEFAULT_BRANCH;
  const api = 'https://api.github.com';
  const packagePath = 'package.json';

  const getRes = await fetch(
    `${api}/repos/${organization}/${repo}/contents/${packagePath}?ref=${branch}`,
    { headers }
  );

  if (!getRes.ok) {
    throw new Error(`Failed to fetch package.json: ${await getRes.text()}`);
  }

  const pkgData = (await getRes.json()) as {
    content: string;
    sha: string;
  };

  const decoded = Buffer.from(pkgData.content, 'base64').toString('utf8');
  const pkg = JSON.parse(decoded) as PackageJson;

  pkg.name = `@${organization}/${repo}`;
  pkg.version = ruleVersion;

  const updatedContent = Buffer.from(JSON.stringify(pkg, null, 2)).toString('base64');

  const putRes = await fetch(`${api}/repos/${organization}/${repo}/contents/${packagePath}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({
      message: `Update package.json for ${repo}`,
      content: updatedContent,
      sha: pkgData.sha,
      branch,
    }),
  });

  if (!putRes.ok) {
    throw new Error(`Failed to update package.json: ${await putRes.text()}`);
  }

  loggerService.log(`Updated package.json for ${organization}/${repo}`);
}

async function waitForRepoContent(
  organization: string,
  repo: string,
  headers: Record<string, string>,
  retries = 15,
  delayMs = 1000
): Promise<void> {
  const api = 'https://api.github.com';

  const res = await fetch(`${api}/repos/${organization}/${repo}/contents`, { headers });

  if (res.ok) {
    return;
  }

  if (retries <= 0) {
    throw new Error('Timed out waiting for repository contents');
  }

  await sleep(delayMs);

  await waitForRepoContent(organization, repo, headers, retries - 1, delayMs);
}

async function getFileSha(
  org: string,
  repo: string,
  path: string,
  branch: string,
  headers: Record<string, string>
): Promise<string | undefined> {
  const res = await fetch(
    `https://api.github.com/repos/${org}/${repo}/contents/${path}?ref=${branch}`,
    { headers }
  );

  if (!res.ok) return undefined;

  const { sha } = (await res.json()) as { sha: string };
  return sha;
}

async function getBranchSha(
  org: string,
  repo: string,
  branch: string,
  headers: Record<string, string>
): Promise<string | undefined> {
  const res = await fetch(`https://api.github.com/repos/${org}/${repo}/git/ref/heads/${branch}`, {
    headers,
  });

  if (!res.ok) return undefined;

  const data = (await res.json()) as { object: { sha: string } };
  return data.object.sha;
}
