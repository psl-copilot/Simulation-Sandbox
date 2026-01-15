import type { LoggerService } from '@tazama-lf/frms-coe-lib';
import type { Configuration } from '../config';
import type { BootstrapResult, CreateRepoResponse } from '../interfaces/github.interfaces';

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
                auto_init: false,
            }),
        });

        if (!response.ok) {
            throw new Error(`Failed to create repository: ${await response.text()}`);
        }

        return response.json() as Promise<CreateRepoResponse>;
    }

    private async getTemplateCommitSha(): Promise<string> {
        const { GITHUB_TEMPLATE_OWNER, GITHUB_TEMPLATE_REPO, GITHUB_DEFAULT_BRANCH } = this.config;

        const response = await fetch(
            `${this.baseUrl}/repos/${GITHUB_TEMPLATE_OWNER}/${GITHUB_TEMPLATE_REPO}/git/ref/heads/${GITHUB_DEFAULT_BRANCH}`,
            { headers: this.headers }
        );

        if (!response.ok) {
            throw new Error(`Failed to get template commit SHA: ${await response.text()}`);
        }

        const data = (await response.json()) as { object: { sha: string } };
        return data.object.sha;
    }

    private async createBranchFromCommit(organization: string, repoName: string, sha: string): Promise<void> {
        const response = await fetch(`${this.baseUrl}/repos/${organization}/${repoName}/git/refs`, {
            method: 'POST',
            headers: this.headers,
            body: JSON.stringify({
                ref: `refs/heads/${this.config.GITHUB_DEFAULT_BRANCH}`,
                sha,
            }),
        });

        if (!response.ok) {
            throw new Error(`Failed to create branch: ${await response.text()}`);
        }
    }

    private async setDefaultBranch(organization: string, repoName: string): Promise<void> {
        const response = await fetch(`${this.baseUrl}/repos/${organization}/${repoName}`, {
            method: 'PATCH',
            headers: this.headers,
            body: JSON.stringify({ default_branch: this.config.GITHUB_DEFAULT_BRANCH }),
        });

        if (!response.ok) {
            throw new Error(`Failed to set default branch: ${await response.text()}`);
        }
    }

    async bootstrap(ruleId: string, ruleVersion: string, organization: string): Promise<BootstrapResult> {
        const repoName = `rule-${ruleId}`;

        try {
            this.logger.log(`Creating repository ${organization}/${repoName}`);
            const repo = await this.createRepository(repoName, organization);

            this.logger.log(`Creating ${this.config.GITHUB_DEFAULT_BRANCH} branch from template`);
            const templateSha = await this.getTemplateCommitSha();
            await this.createBranchFromCommit(organization, repoName, templateSha);

            this.logger.log(`Setting default branch to ${this.config.GITHUB_DEFAULT_BRANCH}`);
            await this.setDefaultBranch(organization, repoName);

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
