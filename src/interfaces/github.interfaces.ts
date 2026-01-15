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
