import type { BootstrapBody, PopulateBody } from '../schemas';
import type { GitHubFile } from '../interfaces';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { configuration, loggerService } from '../index';

const getGitHubApiConfig = (): { api: string; headers: Record<string, string> } => ({
  api: 'https://api.github.com',
  headers: {
    Authorization: `Bearer ${configuration.GITHUB_TOKEN}`,
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
    const { ruleId, ruleVersion, organization } = request.body as BootstrapBody;
    const { api, headers } = getGitHubApiConfig();
    const repo = getRepoName(ruleId);
    const branch = configuration.GITHUB_DEFAULT_BRANCH;

    const createRes = await fetch(`${api}/orgs/${organization}/repos`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: repo,
        private: false,
        default_branch: branch,
      }),
    });
    if (!createRes.ok) throw new Error(await createRes.text());
    const { html_url: htmlUrl } = (await createRes.json()) as { html_url: string };

    loggerService.log(`Created: ${organization}/${repo}`);
    await copyTemplateFiles(organization, repo, ruleVersion);

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
    const { organization, ruleId, ruleCode, testCode } = request.body as PopulateBody;
    const { api, headers } = getGitHubApiConfig();
    const repo = getRepoName(ruleId);
    const branch = configuration.GITHUB_DEFAULT_BRANCH;
    const rulePath = 'src/rule.ts';
    const testPath = '__tests__/unit/rule.test.ts';

    const ruleFile = await getFileSha(organization, repo, rulePath, branch);
    await fetch(`${api}/repos/${organization}/${repo}/contents/${rulePath}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        message: `Update ${rulePath}`,
        content: ruleCode,
        branch,
        ...(ruleFile && { sha: ruleFile }),
      }),
    });
    loggerService.log(`Created: ${rulePath}`);

    const testFile = await getFileSha(organization, repo, testPath, branch);
    await fetch(`${api}/repos/${organization}/${repo}/contents/${testPath}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        message: `Update ${testPath}`,
        content: testCode,
        branch,
        ...(testFile && { sha: testFile }),
      }),
    });
    loggerService.log(`Created: ${testPath}`);

    reply.status(200).send({ success: true, message: `Populated ${organization}/${repo}` });
  } catch (error) {
    handleError(error, reply);
  }
};

async function copyTemplateFiles(
  org: string,
  repo: string,
  ruleVersion: string,
  path = ''
): Promise<void> {
  const { api, headers } = getGitHubApiConfig();
  const {
    GITHUB_TEMPLATE_OWNER: owner,
    GITHUB_TEMPLATE_REPO: tmpl,
    GITHUB_DEFAULT_BRANCH: branch,
  } = configuration;

  const res = await fetch(`${api}/repos/${owner}/${tmpl}/contents/${path}?ref=${branch}`, {
    headers,
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch template contents: ${await res.text()}`);
  }
  const files = (await res.json()) as GitHubFile[];

  const directoryPromises = files
    .filter((file) => file.type === 'dir')
    .map(async (file) => {
      await copyTemplateFiles(org, repo, ruleVersion, file.path);
    });

  await Promise.all(directoryPromises);

  const fileList = files.filter((file) => file.type === 'file');

  await fileList.reduce(async (previousPromise, file) => {
    await previousPromise;

    try {
      const contentRes = await fetch(
        `${api}/repos/${owner}/${tmpl}/contents/${file.path}?ref=${branch}`,
        { headers }
      );

      if (!contentRes.ok) {
        const errorText = await contentRes.text();
        throw new Error(`Failed to fetch content for ${file.path}: ${errorText}`);
      }

      const { content } = (await contentRes.json()) as { content: string };

      let processedContent = content;
      if (file.path === 'package.json') {
        const packageContent = Buffer.from(content, 'base64').toString();
        const updatedContent = packageContent
          .replaceAll('@org_name/repoName', `@${org}/${repo}`)
          .replaceAll('$version', ruleVersion);
        processedContent = Buffer.from(updatedContent).toString('base64');
      }

      const existingFileRes = await fetch(`${api}/repos/${org}/${repo}/contents/${file.path}`, {
        headers,
      });

      let sha: string | undefined;
      if (existingFileRes.ok) {
        const { sha: fileSha } = (await existingFileRes.json()) as { sha: string };
        sha = fileSha;
      }

      const createBody: {
        message: string;
        content: string;
        branch: string;
        sha?: string;
      } = {
        message: `Add ${file.path}`,
        content: processedContent,
        branch,
      };

      if (sha) {
        createBody.sha = sha;
      }

      const createRes = await fetch(`${api}/repos/${org}/${repo}/contents/${file.path}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(createBody),
      });

      if (!createRes.ok) {
        const errorText = await createRes.text();
        const errorData = JSON.parse(errorText) as { message?: string };

        if (createRes.status === 409 && errorData.message?.includes('reference already exists')) {
          loggerService.log(`File already exists, skipping: ${file.path}`);
          return;
        }

        throw new Error(`Failed to create file ${file.path}: ${errorText}`);
      }

      loggerService.log(`Added: ${file.path}`);
    } catch (error) {
      if (error instanceof Error && error.message.includes('reference already exists')) {
        loggerService.log(`File already exists, skipping: ${file.path}`);
        return;
      }
      throw error;
    }
  }, Promise.resolve());
}

async function getFileSha(
  org: string,
  repo: string,
  path: string,
  branch: string
): Promise<string | undefined> {
  const { api, headers } = getGitHubApiConfig();
  try {
    const res = await fetch(`${api}/repos/${org}/${repo}/contents/${path}?ref=${branch}`, {
      headers,
    });
    if (!res.ok) return undefined;
    const { sha } = (await res.json()) as { sha: string };
    return sha;
  } catch {
    return undefined;
  }
}
