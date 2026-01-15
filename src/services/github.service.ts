import type { LoggerService } from '@tazama-lf/frms-coe-lib';
import type { Configuration } from '../config';
import type { BootstrapResult, CreateRepoResponse, GitHubFile, GitHubFileContent } from '../interfaces/github.interfaces';

export class GitHubService {
    private readonly baseUrl = 'https://api.github.com';
    private readonly headers: Record<string, string>;
    private readonly templateRuleId = 'rule-901';

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

    private async getMainBranchSha(organization: string, repoName: string): Promise<string> {
        const response = await fetch(
            `${this.baseUrl}/repos/${organization}/${repoName}/git/ref/heads/main`,
            { headers: this.headers }
        );

        if (!response.ok) {
            throw new Error(`Failed to get main branch SHA: ${await response.text()}`);
        }

        const data = (await response.json()) as { object: { sha: string } };
        return data.object.sha;
    }

    private async createBranch(organization: string, repoName: string, sha: string): Promise<void> {
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

    private shouldSkipFile(path: string): boolean {
        if (path === '__tests__' || path.startsWith('__tests__/')) return true;
        if (path === 'README.md') return true;
        if (path === `src/${this.templateRuleId}.ts`) return true;
        return false;
    }

    private replaceRuleId(content: string, newRuleId: string, organization: string): string {
        const decoded = Buffer.from(content, 'base64').toString('utf-8');
        const replaced = decoded
            .replace(new RegExp(this.templateRuleId, 'g'), `rule-${newRuleId}`)
            .replace(/tazama-lf\/rule-901/g, `${organization}/rule-${newRuleId}`)
            .replace(/@tazama-lf\/rule-901/g, `@${organization}/rule-${newRuleId}`);
        return Buffer.from(replaced).toString('base64');
    }

    private updatePackageJson(content: string, ruleId: string, ruleVersion: string, organization: string): string {
        const decoded = Buffer.from(content, 'base64').toString('utf-8');
        const pkg = JSON.parse(decoded);

        pkg.name = `@${organization}/rule-${ruleId}`;
        pkg.version = ruleVersion;
        pkg.description = `Rule ${ruleId}`;
        pkg.repository.url = `git+https://github.com/${organization}/rule-${ruleId}.git`;
        pkg.bugs.url = `https://github.com/${organization}/rule-${ruleId}/issues`;
        pkg.homepage = `https://github.com/${organization}/rule-${ruleId}#readme`;
        pkg.publishConfig = {
            [`@${organization}:registry`]: 'https://npm.pkg.github.com/',
            access: 'public',
        };

        return Buffer.from(JSON.stringify(pkg, null, 2)).toString('base64');
    }

    private getTargetPath(originalPath: string, newRuleId: string): string {
        if (originalPath === `src/${this.templateRuleId}.ts`) {
            return `src/rule-${newRuleId}.ts`;
        }
        return originalPath;
    }

    private needsRuleIdReplacement(path: string): boolean {
        return path === 'src/index.ts' || path === 'package-lock.json';
    }

    private async copyTemplateFiles(
        organization: string,
        repoName: string,
        ruleId: string,
        ruleVersion: string,
        path = ''
    ): Promise<void> {
        const files = await this.getTemplateFiles(path);

        for (const file of files) {
            if (this.shouldSkipFile(file.path)) {
                this.logger.log(`Skipped: ${file.path}`);
                continue;
            }

            if (file.type === 'dir') {
                await this.copyTemplateFiles(organization, repoName, ruleId, ruleVersion, file.path);
            } else if (file.type === 'file') {
                const content = await this.getFileContent(file.path);
                let fileContent = content.content;
                let targetPath = this.getTargetPath(file.path, ruleId);

                if (file.name === 'package.json') {
                    fileContent = this.updatePackageJson(fileContent, ruleId, ruleVersion, organization);
                } else if (this.needsRuleIdReplacement(file.path)) {
                    fileContent = this.replaceRuleId(fileContent, ruleId, organization);
                }

                await this.createFile(organization, repoName, targetPath, fileContent);
                this.logger.log(`Copied: ${file.path} -> ${targetPath}`);
            }
        }
    }

    async bootstrap(ruleId: string, ruleVersion: string, organization: string): Promise<BootstrapResult> {
        const repoName = `rule-${ruleId}`;

        try {
            this.logger.log(`Creating repository ${organization}/${repoName}`);
            const repo = await this.createRepository(repoName, organization);

            if (this.config.GITHUB_DEFAULT_BRANCH !== 'main') {
                this.logger.log(`Creating ${this.config.GITHUB_DEFAULT_BRANCH} branch`);
                const mainSha = await this.getMainBranchSha(organization, repoName);
                await this.createBranch(organization, repoName, mainSha);
                await this.setDefaultBranch(organization, repoName);
            }

            this.logger.log(`Copying template files from ${this.config.GITHUB_TEMPLATE_OWNER}/${this.config.GITHUB_TEMPLATE_REPO}`);
            await this.copyTemplateFiles(organization, repoName, ruleId, ruleVersion);

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
