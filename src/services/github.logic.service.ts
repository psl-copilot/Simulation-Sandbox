import type { LoggerService } from '@tazama-lf/frms-coe-lib';
import type { Configuration } from '../config';
import type { BootstrapResponse, PopulateResponse } from '../schemas';
import type { GitHubFile } from '../interfaces';

export class GitHubService {
    private readonly api = 'https://api.github.com';
    private readonly headers: Record<string, string>;
    private readonly placeholder = 'rule-901';

    constructor(private readonly config: Configuration, private readonly logger: LoggerService) {
        this.headers = {
            Authorization: `Bearer ${config.GITHUB_TOKEN}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
        };
    }

    private async request<T>(url: string, options?: RequestInit): Promise<T> {
        const res = await fetch(url, { headers: this.headers, ...options });
        if (!res.ok) throw new Error(await res.text());
        return res.json() as Promise<T>;
    }

    private async copyFiles(org: string, repo: string, ruleId: string, path = ''): Promise<void> {
        const { GITHUB_TEMPLATE_OWNER: owner, GITHUB_TEMPLATE_REPO: tmpl, GITHUB_DEFAULT_BRANCH: branch } = this.config;
        const files = await this.request<GitHubFile[]>(`${this.api}/repos/${owner}/${tmpl}/contents/${path}?ref=${branch}`);

        for (const file of files) {
            if (file.type === 'dir') {
                await this.copyFiles(org, repo, ruleId, file.path);
                continue;
            }

            const { content } = await this.request<{ content: string }>(
                `${this.api}/repos/${owner}/${tmpl}/contents/${file.path}?ref=${branch}`
            );
            
            const targetPath = file.path.replace(this.placeholder, `rule-${ruleId}`);
            const needsReplace = ['package.json', 'package-lock.json', 'src/index.ts'].includes(file.path) || file.path.includes(this.placeholder);
            
            const fileContent = needsReplace
                ? Buffer.from(
                    Buffer.from(content, 'base64')
                        .toString()
                        .replace(new RegExp(this.placeholder, 'g'), `rule-${ruleId}`)
                        .replace(/tazama-lf/g, org)
                  ).toString('base64')
                : content;

            await this.request(`${this.api}/repos/${org}/${repo}/contents/${targetPath}`, {
                method: 'PUT',
                body: JSON.stringify({ message: `Add ${targetPath}`, content: fileContent, branch }),
            });
            
            this.logger.log(`Copied: ${file.path}`);
        }
    }

    async bootstrap(ruleId: string, ruleVersion: string, org: string): Promise<BootstrapResponse> {
        const repo = `rule-${ruleId}`;
        const branch = this.config.GITHUB_DEFAULT_BRANCH;
        
        try {
            const { html_url } = await this.request<{ html_url: string }>(
                `${this.api}/orgs/${org}/repos`,
                { method: 'POST', body: JSON.stringify({ name: repo, private: true }) }
            );
            this.logger.log(`Created: ${org}/${repo}`);
            
            await this.copyFiles(org, repo, ruleId);
            
            await this.request(`${this.api}/repos/${org}/${repo}`, {
                method: 'PATCH',
                body: JSON.stringify({ default_branch: branch }),
            });
            
            return { success: true, repoUrl: html_url, message: `Created ${org}/${repo} v${ruleVersion}` };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logger.error(message);
            return { success: false, message };
        }
    }

    async populate(org: string, ruleId: string, ruleCode: string, testCode: string): Promise<PopulateResponse> {
        const repo = `rule-${ruleId}`;
        const branch = this.config.GITHUB_DEFAULT_BRANCH;

        try {
            const rulePath = `src/rule-${ruleId}.ts`;
            const testPath = `__tests__/unit/rule.test.ts`;

            const ruleFile = await this.getFileSha(org, repo, rulePath, branch);
            await this.request(`${this.api}/repos/${org}/${repo}/contents/${rulePath}`, {
                method: 'PUT',
                body: JSON.stringify({
                    message: `Update ${rulePath}`,
                    content: ruleCode,
                    branch,
                    ...(ruleFile && { sha: ruleFile }),
                }),
            });
            this.logger.log(`Updated: ${rulePath}`);

            const testFile = await this.getFileSha(org, repo, testPath, branch);
            await this.request(`${this.api}/repos/${org}/${repo}/contents/${testPath}`, {
                method: 'PUT',
                body: JSON.stringify({
                    message: `Update ${testPath}`,
                    content: testCode,
                    branch,
                    ...(testFile && { sha: testFile }),
                }),
            });
            this.logger.log(`Updated: ${testPath}`);

            return { success: true, message: `Populated ${org}/${repo}` };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logger.error(message);
            return { success: false, message };
        }
    }

    private async getFileSha(org: string, repo: string, path: string, branch: string): Promise<string | undefined> {
        try {
            const res = await fetch(`${this.api}/repos/${org}/${repo}/contents/${path}?ref=${branch}`, { headers: this.headers });
            if (!res.ok) return undefined;
            const { sha } = await res.json() as { sha: string };
            return sha;
        } catch {
            return undefined;
        }
    }
}
