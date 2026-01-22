import {
  bootstrapHandler,
  populateHandler,
  promoteHandler,
} from '../../src/services/github.logic.service';
import { FastifyRequest, FastifyReply } from 'fastify';

jest.mock('@tazama-lf/frms-coe-lib', () => ({
  LoggerService: jest.fn().mockImplementation(() => ({
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  })),
}));

jest.mock('../../src/index', () => {
  const mockLogger = {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  };

  return {
    configuration: {
      GITHUB_TEMPLATE_OWNER: 'template-owner',
      GITHUB_TEMPLATE_REPO: 'template-repo',
      GITHUB_DEFAULT_BRANCH: 'main',
    },
    loggerService: mockLogger,
  };
});

import { loggerService } from '../../src/index';

describe('GitHub Logic Service', () => {
  let request: FastifyRequest;
  let reply: Partial<FastifyReply>;

  beforeEach(() => {
    request = {
      body: {
        organization: 'test-org',
        ruleId: '123',
        ruleVersion: '1.0.0',
      },
      headers: {
        authorization: 'Bearer test-token',
      } as any,
    } as FastifyRequest;

    reply = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    } as Partial<FastifyReply>;

    global.fetch = jest.fn();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('bootstrapHandler', () => {
    it('should successfully bootstrap repository with template files', async () => {
      const mockRepoResponse = {
        ok: true,
        json: async () => ({ html_url: 'https://github.com/test-org/rule-123' }),
        text: async () => '',
      };

      const mockContentsResponse = {
        ok: true,
        json: async () => [],
      };

      const mockPackageGetResponse = {
        ok: true,
        json: async () => ({
          content: Buffer.from(JSON.stringify({ name: 'old-name', version: '0.0.1' })).toString(
            'base64'
          ),
          sha: 'abc123',
        }),
      };

      const mockPackagePutResponse = {
        ok: true,
        json: async () => ({}),
        text: async () => '',
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(mockRepoResponse)
        .mockResolvedValueOnce(mockContentsResponse)
        .mockResolvedValueOnce(mockPackageGetResponse)
        .mockResolvedValueOnce(mockPackagePutResponse);

      await bootstrapHandler(request, reply as FastifyReply);

      expect(reply.status).toHaveBeenCalledWith(200);
      expect(reply.send).toHaveBeenCalledWith({
        success: true,
        repoUrl: 'https://github.com/test-org/rule-123',
        message: 'Created test-org/rule-123 v1.0.0',
      });
    });

    it('should handle repository creation error', async () => {
      const mockErrorResponse = {
        ok: false,
        statusText: 'Repository creation failed',
        text: async () => 'Repository creation failed',
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce(mockErrorResponse);

      await bootstrapHandler(request, reply as FastifyReply);

      expect(reply.status).toHaveBeenCalledWith(500);
      expect(reply.send).toHaveBeenCalledWith({
        success: false,
        message: 'Repository creation failed',
      });
    });

    it('should handle template fetch error', async () => {
      const mockRepoResponse = {
        ok: true,
        json: async () => ({ html_url: 'https://github.com/test-org/rule-123' }),
        text: async () => '',
      };

      const mockContentsErrorResponse = {
        ok: false,
        statusText: 'Contents fetch failed',
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(mockRepoResponse)
        .mockResolvedValueOnce(mockContentsErrorResponse);

      await bootstrapHandler(request, reply as FastifyReply);

      expect(reply.status).toHaveBeenCalledWith(500);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
        })
      );
    });

    it('should handle directory recursion and package.json processing', async () => {
      const mockRepoResponse = {
        ok: true,
        json: async () => ({ html_url: 'https://github.com/test-org/rule-123' }),
        text: async () => '',
      };

      const mockContentsResponse = {
        ok: true,
        json: async () => [],
      };

      const mockPackageGetResponse = {
        ok: true,
        json: async () => ({
          content: Buffer.from(
            JSON.stringify({
              name: 'template-name',
              version: '0.0.1',
            })
          ).toString('base64'),
          sha: 'def456',
        }),
      };

      const mockPackagePutResponse = {
        ok: true,
        json: async () => ({}),
        text: async () => '',
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(mockRepoResponse)
        .mockResolvedValueOnce(mockContentsResponse)
        .mockResolvedValueOnce(mockPackageGetResponse)
        .mockResolvedValueOnce(mockPackagePutResponse);

      await bootstrapHandler(request, reply as FastifyReply);

      expect(reply.status).toHaveBeenCalledWith(200);
    });

    it('should handle missing authorization header', async () => {
      request.headers = {} as any;

      await bootstrapHandler(request, reply as FastifyReply);

      expect(reply.status).toHaveBeenCalledWith(500);
      expect(reply.send).toHaveBeenCalledWith({
        success: false,
        message: 'Missing Authorization header',
      });
    });

    it('should handle invalid authorization header format', async () => {
      request.headers = {
        authorization: 'InvalidFormat',
      } as any;

      await bootstrapHandler(request, reply as FastifyReply);

      expect(reply.status).toHaveBeenCalledWith(500);
      expect(reply.send).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid Authorization header format',
      });
    });

    it('should handle repository content wait timeout', async () => {
      const mockRepoResponse = {
        ok: true,
        json: async () => ({ html_url: 'https://github.com/test-org/rule-123' }),
        text: async () => '',
      };

      const mockContentsErrorResponse = {
        ok: false,
        status: 404,
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(mockRepoResponse)
        .mockResolvedValue(mockContentsErrorResponse);

      await bootstrapHandler(request, reply as FastifyReply);

      expect(reply.status).toHaveBeenCalledWith(500);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
        })
      );
    }, 20000);

    it('should handle repository content retry and succeed', async () => {
      const mockRepoResponse = {
        ok: true,
        json: async () => ({ html_url: 'https://github.com/test-org/rule-123' }),
        text: async () => '',
      };

      const mockContentsErrorResponse = {
        ok: false,
        status: 404,
      };

      const mockContentsSuccessResponse = {
        ok: true,
        json: async () => [],
      };

      const mockPackageGetResponse = {
        ok: true,
        json: async () => ({
          content: Buffer.from(JSON.stringify({ name: 'old-name', version: '0.0.1' })).toString(
            'base64'
          ),
          sha: 'abc123',
        }),
      };

      const mockPackagePutResponse = {
        ok: true,
        json: async () => ({}),
        text: async () => '',
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(mockRepoResponse) 
        .mockResolvedValueOnce(mockContentsErrorResponse) 
        .mockResolvedValueOnce(mockContentsErrorResponse) 
        .mockResolvedValueOnce(mockContentsSuccessResponse) 
        .mockResolvedValueOnce(mockPackageGetResponse) 
        .mockResolvedValueOnce(mockPackagePutResponse); 

      await bootstrapHandler(request, reply as FastifyReply);

      expect(reply.status).toHaveBeenCalledWith(200);
      expect(reply.send).toHaveBeenCalledWith({
        success: true,
        repoUrl: 'https://github.com/test-org/rule-123',
        message: 'Created test-org/rule-123 v1.0.0',
      });
    });

    it('should handle package.json get error', async () => {
      const mockRepoResponse = {
        ok: true,
        json: async () => ({ html_url: 'https://github.com/test-org/rule-123' }),
        text: async () => '',
      };

      const mockContentsResponse = {
        ok: true,
        json: async () => [],
      };

      const mockPackageGetError = {
        ok: false,
        status: 404,
        text: async () => 'Package.json not found',
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(mockRepoResponse)
        .mockResolvedValueOnce(mockContentsResponse)
        .mockResolvedValueOnce(mockPackageGetError);

      await bootstrapHandler(request, reply as FastifyReply);

      expect(reply.status).toHaveBeenCalledWith(500);
      expect(loggerService.error).toHaveBeenCalled();
    });

    it('should handle package.json update error', async () => {
      const mockRepoResponse = {
        ok: true,
        json: async () => ({ html_url: 'https://github.com/test-org/rule-123' }),
        text: async () => '',
      };

      const mockContentsResponse = {
        ok: true,
        json: async () => [],
      };

      const mockPackageGetResponse = {
        ok: true,
        json: async () => ({
          content: Buffer.from(JSON.stringify({ name: 'old-name', version: '0.0.1' })).toString(
            'base64'
          ),
          sha: 'abc123',
        }),
      };

      const mockPackagePutError = {
        ok: false,
        text: async () => 'Update failed',
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(mockRepoResponse)
        .mockResolvedValueOnce(mockContentsResponse)
        .mockResolvedValueOnce(mockPackageGetResponse)
        .mockResolvedValueOnce(mockPackagePutError);

      await bootstrapHandler(request, reply as FastifyReply);

      expect(reply.status).toHaveBeenCalledWith(500);
      expect(loggerService.error).toHaveBeenCalled();
    });
  });

  describe('populateHandler', () => {
    beforeEach(() => {
      request.body = {
        organization: 'test-org',
        ruleId: '123',
        ruleCode: Buffer.from('rule code').toString('base64'),
        testCode: Buffer.from('test code').toString('base64'),
      };
    });

    it('should successfully populate repository files', async () => {
      const mockGetRuleResponse = {
        ok: true,
        json: async () => ({ sha: 'rule-sha' }),
      };

      const mockGetTestResponse = {
        ok: true,
        json: async () => ({ sha: 'test-sha' }),
      };

      const mockPutResponse = {
        ok: true,
        json: async () => ({}),
        text: async () => '',
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(mockGetRuleResponse)
        .mockResolvedValueOnce(mockPutResponse)
        .mockResolvedValueOnce(mockGetTestResponse)
        .mockResolvedValueOnce(mockPutResponse);

      await populateHandler(request, reply as FastifyReply);

      expect(reply.status).toHaveBeenCalledWith(200);
      expect(reply.send).toHaveBeenCalledWith({
        success: true,
        message: 'Populated test-org/rule-123 on main',
      });
    });

    it('should handle non-Error exceptions', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce('Network error');

      await populateHandler(request, reply as FastifyReply);

      expect(reply.status).toHaveBeenCalledWith(500);
      expect(reply.send).toHaveBeenCalledWith({
        success: false,
        message: 'Network error',
      });
    });

    it('should handle content fetch failure and file creation failure', async () => {
      const mockRepoResponse = {
        ok: true,
        json: async () => ({ html_url: 'https://github.com/test-org/rule-123' }),
        text: async () => '',
      };

      const mockContentsResponse = {
        ok: true,
        json: async () => [],
      };

      const mockPackageErrorResponse = {
        ok: false,
        text: async () => 'Content fetch failed',
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(mockRepoResponse)
        .mockResolvedValueOnce(mockContentsResponse)
        .mockResolvedValueOnce(mockPackageErrorResponse);

      await bootstrapHandler(request, reply as FastifyReply);

      expect(reply.status).toHaveBeenCalledWith(500);
      expect(loggerService.error).toHaveBeenCalled();
    });

    it('should handle file creation failure', async () => {
      const mockRepoResponse = {
        ok: true,
        json: async () => ({ html_url: 'https://github.com/test-org/rule-123' }),
        text: async () => '',
      };

      const mockContentsResponse = {
        ok: true,
        json: async () => [],
      };

      const mockPackageGetResponse = {
        ok: true,
        json: async () => ({
          content: Buffer.from('{}').toString('base64'),
          sha: 'sha123',
        }),
      };

      const mockPackagePutError = {
        ok: false,
        text: async () => 'File creation failed',
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(mockRepoResponse)
        .mockResolvedValueOnce(mockContentsResponse)
        .mockResolvedValueOnce(mockPackageGetResponse)
        .mockResolvedValueOnce(mockPackagePutError);

      await bootstrapHandler(request, reply as FastifyReply);

      expect(reply.status).toHaveBeenCalledWith(500);
      expect(loggerService.error).toHaveBeenCalled();
    });

    it('should handle fetch errors in getFileSha', async () => {
      const mockNotFoundResponse = {
        ok: false,
        status: 404,
      };

      const mockCreateResponse = {
        ok: true,
        json: async () => ({}),
        text: async () => '',
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(mockNotFoundResponse)
        .mockResolvedValueOnce(mockCreateResponse)
        .mockResolvedValueOnce(mockNotFoundResponse)
        .mockResolvedValueOnce(mockCreateResponse);

      await populateHandler(request, reply as FastifyReply);

      expect(reply.status).toHaveBeenCalledWith(200);
    });

    it('should populate files when both rule and test files do not exist', async () => {
      const mockNotFoundResponse = {
        ok: false,
        status: 404,
      };

      const mockCreateResponse = {
        ok: true,
        json: async () => ({}),
        text: async () => '',
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(mockNotFoundResponse)
        .mockResolvedValueOnce(mockCreateResponse)
        .mockResolvedValueOnce(mockNotFoundResponse)
        .mockResolvedValueOnce(mockCreateResponse);

      await populateHandler(request, reply as FastifyReply);

      expect(reply.status).toHaveBeenCalledWith(200);
      expect(reply.send).toHaveBeenCalledWith({
        success: true,
        message: 'Populated test-org/rule-123 on main',
      });
    });

    it('should handle file already exists error during bootstrap', async () => {
      const mockRepoResponse = {
        ok: true,
        json: async () => ({ html_url: 'https://github.com/test-org/rule-123' }),
        text: async () => '',
      };

      const mockContentsResponse = {
        ok: true,
        json: async () => [],
      };

      const mockPackageGetResponse = {
        ok: true,
        json: async () => ({
          content: Buffer.from('{}').toString('base64'),
          sha: 'sha123',
        }),
      };

      const mockPackagePutResponse = {
        ok: true,
        json: async () => ({}),
        text: async () => '',
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(mockRepoResponse)
        .mockResolvedValueOnce(mockContentsResponse)
        .mockResolvedValueOnce(mockPackageGetResponse)
        .mockResolvedValueOnce(mockPackagePutResponse);

      await bootstrapHandler(request, reply as FastifyReply);

      expect(reply.status).toHaveBeenCalledWith(200);
    });

    it('should handle JSON parse error in file creation', async () => {
      const mockRepoResponse = {
        ok: true,
        json: async () => ({ html_url: 'https://github.com/test-org/rule-123' }),
        text: async () => '',
      };

      const mockContentsResponse = {
        ok: true,
        json: async () => [],
      };

      const mockPackageGetResponse = {
        ok: true,
        json: async () => ({
          content: Buffer.from('invalid json').toString('base64'),
          sha: 'sha123',
        }),
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(mockRepoResponse)
        .mockResolvedValueOnce(mockContentsResponse)
        .mockResolvedValueOnce(mockPackageGetResponse);

      await bootstrapHandler(request, reply as FastifyReply);

      expect(reply.status).toHaveBeenCalledWith(500);
      expect(loggerService.error).toHaveBeenCalled();
    });

    it('should handle error thrown during file processing', async () => {
      const mockRepoResponse = {
        ok: true,
        json: async () => ({ html_url: 'https://github.com/test-org/rule-123' }),
        text: async () => '',
      };

      const mockContentsResponse = {
        ok: true,
        json: async () => [],
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(mockRepoResponse)
        .mockResolvedValueOnce(mockContentsResponse)
        .mockRejectedValueOnce(new Error('Processing error'));

      await bootstrapHandler(request, reply as FastifyReply);

      expect(reply.status).toHaveBeenCalledWith(500);
    });

    it('should handle SHA mismatch with successful retry', async () => {
      const mockRepoResponse = {
        ok: true,
        json: async () => ({ html_url: 'https://github.com/test-org/rule-123' }),
        text: async () => '',
      };

      const mockContentsResponse = {
        ok: true,
        json: async () => [],
      };

      const mockPackageGetResponse = {
        ok: true,
        json: async () => ({
          content: Buffer.from('{}').toString('base64'),
          sha: 'sha123',
        }),
      };

      const mockPackagePutResponse = {
        ok: true,
        json: async () => ({}),
        text: async () => '',
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(mockRepoResponse)
        .mockResolvedValueOnce(mockContentsResponse)
        .mockResolvedValueOnce(mockPackageGetResponse)
        .mockResolvedValueOnce(mockPackagePutResponse);

      await bootstrapHandler(request, reply as FastifyReply);

      expect(reply.status).toHaveBeenCalledWith(200);
    });

    it('should handle SHA mismatch with failed retry', async () => {
      const mockRepoResponse = {
        ok: true,
        json: async () => ({ html_url: 'https://github.com/test-org/rule-123' }),
        text: async () => '',
      };

      const mockContentsResponse = {
        ok: true,
        json: async () => [],
      };

      const mockPackageGetResponse = {
        ok: true,
        json: async () => ({
          content: Buffer.from('{}').toString('base64'),
          sha: 'sha123',
        }),
      };

      const mockPackagePutResponse = {
        ok: true,
        json: async () => ({}),
        text: async () => '',
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(mockRepoResponse)
        .mockResolvedValueOnce(mockContentsResponse)
        .mockResolvedValueOnce(mockPackageGetResponse)
        .mockResolvedValueOnce(mockPackagePutResponse);

      await bootstrapHandler(request, reply as FastifyReply);

      expect(reply.status).toHaveBeenCalledWith(200);
    });

    it('should handle conflict with malformed JSON response', async () => {
      const mockRepoResponse = {
        ok: true,
        json: async () => ({ html_url: 'https://github.com/test-org/rule-123' }),
        text: async () => '',
      };

      const mockContentsResponse = {
        ok: true,
        json: async () => [],
      };

      const mockPackageGetResponse = {
        ok: true,
        json: async () => ({
          content: Buffer.from('{}').toString('base64'),
          sha: 'sha123',
        }),
      };

      const mockPackagePutResponse = {
        ok: true,
        json: async () => ({}),
        text: async () => '',
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(mockRepoResponse)
        .mockResolvedValueOnce(mockContentsResponse)
        .mockResolvedValueOnce(mockPackageGetResponse)
        .mockResolvedValueOnce(mockPackagePutResponse);

      await bootstrapHandler(request, reply as FastifyReply);

      expect(reply.status).toHaveBeenCalledWith(200);
    });

    it('should handle missing authorization header in populateHandler', async () => {
      request.headers = {} as any;

      await populateHandler(request, reply as FastifyReply);

      expect(reply.status).toHaveBeenCalledWith(500);
      expect(reply.send).toHaveBeenCalledWith({
        success: false,
        message: 'Missing Authorization header',
      });
    });

    it('should handle file update errors', async () => {
      const mockGetRuleResponse = {
        ok: true,
        json: async () => ({ sha: 'rule-sha' }),
      };

      const mockPutError = {
        ok: false,
        text: async () => 'Update failed',
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(mockGetRuleResponse)
        .mockResolvedValueOnce(mockPutError);

      await populateHandler(request, reply as FastifyReply);

      expect(reply.status).toHaveBeenCalledWith(500);
    });

    it('should handle test file update errors', async () => {
      const mockGetRuleResponse = {
        ok: true,
        json: async () => ({ sha: 'rule-sha' }),
      };

      const mockPutRuleSuccess = {
        ok: true,
        json: async () => ({}),
        text: async () => '',
      };

      const mockGetTestResponse = {
        ok: true,
        json: async () => ({ sha: 'test-sha' }),
      };

      const mockPutTestError = {
        ok: false,
        text: async () => 'Test update failed',
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(mockGetRuleResponse)
        .mockResolvedValueOnce(mockPutRuleSuccess)
        .mockResolvedValueOnce(mockGetTestResponse)
        .mockResolvedValueOnce(mockPutTestError);

      await populateHandler(request, reply as FastifyReply);

      expect(reply.status).toHaveBeenCalledWith(500);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringContaining('Test update failed'),
        })
      );
    });
  });

  describe('promoteHandler', () => {
    beforeEach(() => {
      request.body = {
        organization: 'test-org',
        ruleId: '123',
        branchName: 'feature-branch',
      };
    });

    it('should successfully promote branch', async () => {
      const mockGetStagingBranchResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          object: {
            sha: 'staging-sha',
          },
        }),
      };

      const mockCreateBranchResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({}),
        text: jest.fn().mockResolvedValue(''),
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(mockGetStagingBranchResponse) 
        .mockResolvedValueOnce(mockGetStagingBranchResponse) 
        .mockResolvedValueOnce(mockCreateBranchResponse); 

      await promoteHandler(request, reply as FastifyReply);

      expect(reply.status).toHaveBeenCalledWith(200);
      expect(reply.send).toHaveBeenCalledWith({
        success: true,
        message: 'Branch feature-branch created from staging',
      });
    });

    it('should handle missing authorization header in promoteHandler', async () => {
      request.headers = {} as any;

      await promoteHandler(request, reply as FastifyReply);

      expect(reply.status).toHaveBeenCalledWith(500);
      expect(reply.send).toHaveBeenCalledWith({
        success: false,
        message: 'Missing Authorization header',
      });
    });

    it('should handle branch fetch error', async () => {
      const mockGetBranchError = {
        ok: false,
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce(mockGetBranchError);

      await promoteHandler(request, reply as FastifyReply);

      expect(reply.status).toHaveBeenCalledWith(500);
    });

    it('should handle branch creation error', async () => {
      const mockGetStagingBranchResponse = {
        ok: true,
        json: async () => ({
          object: {
            sha: 'staging-sha',
          },
        }),
      };

      const mockCreateBranchError = {
        ok: false,
        text: async () => 'Failed to create branch',
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(mockGetStagingBranchResponse) 
        .mockResolvedValueOnce(mockGetStagingBranchResponse) 
        .mockResolvedValueOnce(mockCreateBranchError); 

      await promoteHandler(request, reply as FastifyReply);

      expect(reply.status).toHaveBeenCalledWith(500);
    });

    it('should handle fallback to default branch', async () => {
      const mockGetStagingBranchError = {
        ok: false,
      };

      const mockGetDefaultBranchResponse = {
        ok: true,
        json: async () => ({
          object: {
            sha: 'main-sha',
          },
        }),
      };

      const mockCreateBranchResponse = {
        ok: true,
        json: async () => ({}),
        text: async () => '',
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(mockGetStagingBranchError) 
        .mockResolvedValueOnce(mockGetDefaultBranchResponse) 
        .mockResolvedValueOnce(mockCreateBranchResponse); 

      await promoteHandler(request, reply as FastifyReply);

      expect(reply.status).toHaveBeenCalledWith(200);
      expect(reply.send).toHaveBeenCalledWith({
        success: true,
        message: 'Branch feature-branch created from main',
      });
    });

    it('should handle missing base branch error', async () => {
      const mockGetStagingBranchError = {
        ok: false,
      };

      const mockGetDefaultBranchError = {
        ok: false,
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(mockGetStagingBranchError)
        .mockResolvedValueOnce(mockGetDefaultBranchError);

      await promoteHandler(request, reply as FastifyReply);

      expect(reply.status).toHaveBeenCalledWith(500);
    });
  });
});
