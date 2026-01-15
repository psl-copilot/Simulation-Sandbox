export interface GitHubFile {
  name: string;
  path: string;
  sha: string;
  type: 'file' | 'dir';
}

export interface CreateRepoResponse {
  html_url: string;
}

export interface BootstrapResult {
  success: boolean;
  repoUrl?: string;
  message: string;
}

export interface BootstrapBody {
  ruleId: string;
  ruleVersion: string;
  organization: string;
}

export interface GitHubFileContent {
  content: string;
  encoding: string;
}

export interface GitHubFileSha {
  sha: string;
}
