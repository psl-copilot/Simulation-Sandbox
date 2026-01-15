import type { LoggerService } from '@tazama-lf/frms-coe-lib';
import type { Configuration } from '../config';
import type { BootstrapResult, CreateRepoResponse, GitHubFile, GitHubFileContent } from '../interfaces/github.interfaces';

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

    private async createRepository(name: string, organization: string): Promise<CreateRepoResponse> {
        const response = await fetch(`${this.baseUrl}/orgs/${organization}/repos`, {
            method: 'POST',
            headers: this.headers,
            body: JSON.stringify({
                name,
                private: true,
                auto_init: true,
            }),
        });

        if (!response.ok) {
            throw new Error(`Failed to create repository: ${await response.text()}`);
        }

        return response.json() as Promise<CreateRepoResponse>;
    }

    private async renameBranch(organization: string, repoName: string): Promise<void> {
        const response = await fetch(`${this.baseUrl}/repos/${organization}/${repoName}/branches/main/rename`, {
            method: 'POST',
            headers: this.headers,
            body: JSON.stringify({ new_name: this.config.GITHUB_DEFAULT_BRANCH }),
        });

        if (!response.ok) {
            throw new Error(`Failed to rename branch: ${await response.text()}`);
        }
    }

    private async deleteFile(organization: string, repoName: string, path: string): Promise<void> {
        const getResponse = await fetch(
            `${this.baseUrl}/repos/${organization}/${repoName}/contents/${path}?ref=${this.config.GITHUB_DEFAULT_BRANCH}`,
            { headers: this.headers }
        );

        if (!getResponse.ok) return;

        const { sha } = (await getResponse.json()) as { sha: string };

        await fetch(`${this.baseUrl}/repos/${organization}/${repoName}/contents/${path}`, {
            method: 'DELETE',
            headers: this.headers,
            body: JSON.stringify({
                message: `Remove ${path}`,
                sha,
                branch: this.config.GITHUB_DEFAULT_BRANCH,
            }),
        });
    }

    private async getTemplateFiles(path = ''): Promise<GitHubFile[]> {
        const { GITHUB_TEMPLATE_OWNER, GITHUB_TEMPLATE_REPO, GITHUB_DEFAULT_BRANCH } = this.config;

        const response = await fetch(
            `${this.baseUrl}/repos/${GITHUB_TEMPLATE_OWNER}/${GITHUB_TEMPLATE_REPO}/contents/${path}?ref=${GITHUB_DEFAULT_BRANCH}`,
            { headers: this.headers }
        );

        if (!response.ok) {
            throw new Error(`Failed to get template files: ${await response.text()}`);
        }

        return response.json() as Promise<GitHubFile[]>;
    }

    private async getFileContent(path: string): Promise<GitHubFileContent> {
        const { GITHUB_TEMPLATE_OWNER, GITHUB_TEMPLATE_REPO, GITHUB_DEFAULT_BRANCH } = this.config;

        const response = await fetch(
            `${this.baseUrl}/repos/${GITHUB_TEMPLATE_OWNER}/${GITHUB_TEMPLATE_REPO}/contents/${path}?ref=${GITHUB_DEFAULT_BRANCH}`,
            { headers: this.headers }
        );

        if (!response.ok) {
            throw new Error(`Failed to get file: ${await response.text()}`);
        }

        return response.json() as Promise<GitHubFileContent>;
    }

    private async createFile(organization: string, repoName: string, path: string, content: string): Promise<void> {
        const response = await fetch(`${this.baseUrl}/repos/${organization}/${repoName}/contents/${path}`, {
            method: 'PUT',
            headers: this.headers,
            body: JSON.stringify({
                message: `Add ${path}`,
                content,
                branch: this.config.GITHUB_DEFAULT_BRANCH,
            }),
        });

        if (!response.ok) {
            throw new Error(`Failed to create file ${path}: ${await response.text()}`);
        }
    }

    private async copyTemplateFiles(organization: string, repoName: string, path = ''): Promise<void> {
        const files = await this.getTemplateFiles(path);

        for (const file of files) {
            if (file.type === 'dir') {
                await this.copyTemplateFiles(organization, repoName, file.path);
            } else if (file.type === 'file') {
                const content = await this.getFileContent(file.path);
                await this.createFile(organization, repoName, file.path, content.content);
                this.logger.log(`Copied: ${file.path}`);
            }
        }
    }

    async bootstrap(ruleId: string, ruleVersion: string, organization: string): Promise<BootstrapResult> {
        const repoName = `rule-${ruleId}`;

        try {
            this.logger.log(`Creating repository ${organization}/${repoName}`);
            const repo = await this.createRepository(repoName, organization);

            if (this.config.GITHUB_DEFAULT_BRANCH !== 'main') {
                this.logger.log(`Renaming branch to ${this.config.GITHUB_DEFAULT_BRANCH}`);
                await this.renameBranch(organization, repoName);
            }

            this.logger.log(`Removing default README`);
            await this.deleteFile(organization, repoName, 'README.md');

            this.logger.log(`Copying template files from ${this.config.GITHUB_TEMPLATE_OWNER}/${this.config.GITHUB_TEMPLATE_REPO}`);
            await this.copyTemplateFiles(organization, repoName);

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
