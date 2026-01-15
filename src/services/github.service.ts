import type { LoggerService } from '@tazama-lf/frms-coe-lib';
import type { Configuration } from '../config';
import type {
  GitHubFile,
  GitHubFileContent,
  GitHubFileSha,
  CreateRepoResponse,
  BootstrapResult,
} from '../interfaces/github.interfaces';

export class GitHubService {
  private readonly baseUrl = 'https://api.github.com';
  private readonly headers: Record<string, string>;

  constructor(
    private readonly config: Configuration,
    private readonly logger: LoggerService
  ) {
    this.headers = {
      Authorization: `Bearer ${this.config.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    };
  }

  private async createRepository(name: string, org: string): Promise<CreateRepoResponse> {
    const response = await fetch(`${this.baseUrl}/orgs/${org}/repos`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({ name, private: false, auto_init: true }),
    });

    if (!response.ok) {
      throw new Error(`Failed to create repository: ${await response.text()}`);
    }

    return response.json() as Promise<CreateRepoResponse>;
  }

  private async renameBranch(name: string, org: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/repos/${org}/${name}/branches/main/rename`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({ new_name: this.config.GITHUB_DEFAULT_BRANCH }),
    });

    if (!response.ok) {
      throw new Error(`Failed to rename branch: ${await response.text()}`);
    }
  }

  private async deleteReadme(name: string, org: string): Promise<void> {
    const getResponse = await fetch(`${this.baseUrl}/repos/${org}/${name}/contents/README.md`, {
      method: 'GET',
      headers: this.headers,
    });

    if (!getResponse.ok) return;

    const { sha } = (await getResponse.json()) as GitHubFileSha;

    await fetch(`${this.baseUrl}/repos/${org}/${name}/contents/README.md`, {
      method: 'DELETE',
      headers: this.headers,
      body: JSON.stringify({ message: 'Remove README', sha }),
    });
  }

  private async getTemplateFiles(path = ''): Promise<GitHubFile[]> {
    const { GITHUB_TEMPLATE_OWNER, GITHUB_TEMPLATE_REPO } = this.config;
    const response = await fetch(
      `${this.baseUrl}/repos/${GITHUB_TEMPLATE_OWNER}/${GITHUB_TEMPLATE_REPO}/contents/${path}`,
      { method: 'GET', headers: this.headers }
    );

    if (!response.ok) {
      throw new Error(`Failed to get template files: ${await response.text()}`);
    }

    return response.json() as Promise<GitHubFile[]>;
  }

  private async getFileContent(path: string): Promise<string> {
    const { GITHUB_TEMPLATE_OWNER, GITHUB_TEMPLATE_REPO } = this.config;
    const response = await fetch(
      `${this.baseUrl}/repos/${GITHUB_TEMPLATE_OWNER}/${GITHUB_TEMPLATE_REPO}/contents/${path}`,
      { method: 'GET', headers: this.headers }
    );

    if (!response.ok) {
      throw new Error(`Failed to get file: ${await response.text()}`);
    }

    const { content } = (await response.json()) as GitHubFileContent;
    return Buffer.from(content, 'base64').toString('utf-8');
  }

  private async createFile(name: string, org: string, path: string, content: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/repos/${org}/${name}/contents/${path}`, {
      method: 'PUT',
      headers: this.headers,
      body: JSON.stringify({
        message: `Add ${path}`,
        content: Buffer.from(content).toString('base64'),
        branch: this.config.GITHUB_DEFAULT_BRANCH,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to create file ${path}: ${await response.text()}`);
    }
  }

  private async copyTemplateFiles(name: string, org: string, path = ''): Promise<void> {
    const files = await this.getTemplateFiles(path);

    for (const file of files) {
      if (file.type === 'dir') {
        await this.copyTemplateFiles(name, org, file.path);
      } else {
        const content = await this.getFileContent(file.path);
        await this.createFile(name, org, file.path, content);
        this.logger.log(`Copied: ${file.path}`);
      }
    }
  }

  async bootstrap(ruleId: string, ruleVersion: string, organization: string): Promise<BootstrapResult> {
    const repoName = ruleId;

    try {
      this.logger.log(`Creating ${organization}/${repoName}`);
      const repo = await this.createRepository(repoName, organization);

      if (this.config.GITHUB_DEFAULT_BRANCH !== 'main') {
        this.logger.log(`Renaming branch to ${this.config.GITHUB_DEFAULT_BRANCH}`);
        await this.renameBranch(repoName, organization);
      }

      await this.deleteReadme(repoName, organization);

      this.logger.log('Copying template files');
      await this.copyTemplateFiles(repoName, organization);

      return {
        success: true,
        repoUrl: repo.html_url,
        message: `Created ${organization}/${repoName} v${ruleVersion}`,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(msg);
      return { success: false, message: msg };
    }
  }
}
