import type { FastifyRequest, FastifyReply } from 'fastify';

const mockConfiguration = {
  GITHUB_TOKEN: 'test-token',
  GITHUB_DEFAULT_BRANCH: 'main',
  GITHUB_TEMPLATE_OWNER: 'test-owner',
  GITHUB_TEMPLATE_REPO: 'test-repo',
};

const mockLoggerService = {
  log: jest.fn(),
  error: jest.fn(),
};

jest.mock('../../src/index', () => ({
  configuration: mockConfiguration,
  loggerService: mockLoggerService,
}));

const mockFetch = jest.fn();
global.fetch = mockFetch;

import { bootstrapHandler, populateHandler } from '../../src/services/github.logic.service';

const createMockRequest = (body: any): FastifyRequest => ({ body }) as FastifyRequest;
const createMockReply = (): FastifyReply =>
  ({
    status: jest.fn().mockReturnThis(),
    send: jest.fn(),
  }) as any;

describe('GitHub Logic Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('bootstrapHandler', () => {
    it('should successfully bootstrap repository with template files', async () => {
      const request = createMockRequest({
        ruleId: '123',
        ruleVersion: '1.0.0',
        organization: 'test-org',
      });
      const reply = createMockReply();

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ html_url: 'https://github.com/test-org/rule-123' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [{ name: 'test.txt', path: 'test.txt', type: 'file' }],
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ content: 'dGVzdA==' }),
        })
        .mockResolvedValueOnce({ ok: false })
        .mockResolvedValueOnce({ ok: true });

      await bootstrapHandler(request, reply);

      expect(reply.status).toHaveBeenCalledWith(200);
      expect(reply.send).toHaveBeenCalledWith({
        success: true,
        repoUrl: 'https://github.com/test-org/rule-123',
        message: 'Created test-org/rule-123 v1.0.0',
      });
    });

    it('should handle repository creation error', async () => {
      const request = createMockRequest({
        ruleId: '123',
        ruleVersion: '1.0.0',
        organization: 'test-org',
      });
      const reply = createMockReply();

      mockFetch.mockResolvedValueOnce({
        ok: false,
        text: async () => 'Repository creation failed',
      });

      await bootstrapHandler(request, reply);

      expect(reply.status).toHaveBeenCalledWith(500);
      expect(reply.send).toHaveBeenCalledWith({
        success: false,
        message: 'Repository creation failed',
      });
    });

    it('should handle template fetch error', async () => {
      const request = createMockRequest({
        ruleId: '123',
        ruleVersion: '1.0.0',
        organization: 'test-org',
      });
      const reply = createMockReply();

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ html_url: 'https://github.com/test-org/rule-123' }),
        })
        .mockResolvedValueOnce({
          ok: false,
          text: async () => 'Template fetch failed',
        });

      await bootstrapHandler(request, reply);

      expect(reply.status).toHaveBeenCalledWith(500);
      expect(reply.send).toHaveBeenCalledWith({
        success: false,
        message: 'Failed to fetch template contents: Template fetch failed',
      });
    });

    it('should handle directory recursion and package.json processing', async () => {
      const request = createMockRequest({
        ruleId: '123',
        ruleVersion: '1.0.0',
        organization: 'test-org',
      });
      const reply = createMockReply();

      const packageJsonContent = Buffer.from(
        JSON.stringify({
          name: '@org_name/repoName',
          version: '$version',
        })
      ).toString('base64');

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ html_url: 'https://github.com/test-org/rule-123' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [
            { name: 'src', path: 'src', type: 'dir' },
            { name: 'package.json', path: 'package.json', type: 'file' },
          ],
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [{ name: 'index.ts', path: 'src/index.ts', type: 'file' }],
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ content: 'dGVzdA==' }),
        })
        .mockResolvedValueOnce({ ok: false })
        .mockResolvedValueOnce({ ok: true })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ content: packageJsonContent }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ sha: 'existing-sha' }),
        })
        .mockResolvedValueOnce({ ok: true });

      await bootstrapHandler(request, reply);

      expect(reply.status).toHaveBeenCalledWith(200);
    });
  });

  describe('populateHandler', () => {
    it('should successfully populate repository files', async () => {
      const request = createMockRequest({
        organization: 'test-org',
        ruleId: '123',
        ruleCode: 'cnVsZUNvZGU=',
        testCode: 'dGVzdENvZGU=',
      });
      const reply = createMockReply();

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ sha: 'rule-sha' }),
        })
        .mockResolvedValueOnce({ ok: true })
        .mockResolvedValueOnce({
          ok: false,
        })
        .mockResolvedValueOnce({ ok: true });

      await populateHandler(request, reply);

      expect(reply.status).toHaveBeenCalledWith(200);
      expect(reply.send).toHaveBeenCalledWith({
        success: true,
        message: 'Populated test-org/rule-123',
      });
    });

    it('should handle non-Error exceptions', async () => {
      const request = createMockRequest({
        organization: 'test-org',
        ruleId: '123',
        ruleCode: 'cnVsZUNvZGU=',
        testCode: 'dGVzdENvZGU=',
      });
      const reply = createMockReply();

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ sha: 'rule-sha' }),
        })
        .mockRejectedValueOnce('Network error');

      await populateHandler(request, reply);

      expect(reply.status).toHaveBeenCalledWith(500);
      expect(reply.send).toHaveBeenCalledWith({
        success: false,
        message: 'Network error',
      });
    });

    it('should handle content fetch failure and file creation failure', async () => {
      const request = createMockRequest({
        ruleId: '123',
        ruleVersion: '1.0.0',
        organization: 'test-org',
      });
      const reply = createMockReply();

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ html_url: 'https://github.com/test-org/rule-123' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [{ name: 'test.txt', path: 'test.txt', type: 'file' }],
        })
        .mockResolvedValueOnce({
          ok: false,
          text: async () => 'Content fetch failed',
        });

      await bootstrapHandler(request, reply);

      expect(reply.status).toHaveBeenCalledWith(200);
      expect(mockLoggerService.error).toHaveBeenCalled();
    });

    it('should handle file creation failure', async () => {
      const request = createMockRequest({
        ruleId: '123',
        ruleVersion: '1.0.0',
        organization: 'test-org',
      });
      const reply = createMockReply();

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ html_url: 'https://github.com/test-org/rule-123' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [{ name: 'test.txt', path: 'test.txt', type: 'file' }],
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ content: 'dGVzdA==' }),
        })
        .mockResolvedValueOnce({ ok: false })
        .mockResolvedValueOnce({
          ok: false,
          text: async () => 'File creation failed',
        });

      await bootstrapHandler(request, reply);

      expect(reply.status).toHaveBeenCalledWith(200);
      expect(mockLoggerService.error).toHaveBeenCalled();
    });

    it('should handle fetch errors in getFileSha', async () => {
      const request = createMockRequest({
        organization: 'test-org',
        ruleId: '123',
        ruleCode: 'cnVsZUNvZGU=',
        testCode: 'dGVzdENvZGU=',
      });
      const reply = createMockReply();

      mockFetch
        .mockRejectedValueOnce(new Error('Fetch failed'))
        .mockResolvedValueOnce({ ok: true })
        .mockResolvedValueOnce({ ok: false })
        .mockResolvedValueOnce({ ok: true });

      await populateHandler(request, reply);

      expect(reply.status).toHaveBeenCalledWith(200);
    });

    it('should populate files when both rule and test files do not exist', async () => {
      const request = createMockRequest({
        organization: 'test-org',
        ruleId: '123',
        ruleCode: 'cnVsZUNvZGU=',
        testCode: 'dGVzdENvZGU=',
      });
      const reply = createMockReply();

      mockFetch
        .mockResolvedValueOnce({ ok: false })
        .mockResolvedValueOnce({ ok: true })
        .mockResolvedValueOnce({ ok: false })
        .mockResolvedValueOnce({ ok: true });

      await populateHandler(request, reply);

      expect(reply.status).toHaveBeenCalledWith(200);
      expect(reply.send).toHaveBeenCalledWith({
        success: true,
        message: 'Populated test-org/rule-123',
      });
    });

    it('should handle file already exists error during bootstrap', async () => {
      const request = createMockRequest({
        ruleId: '123',
        ruleVersion: '1.0.0',
        organization: 'test-org',
      });
      const reply = createMockReply();

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ html_url: 'https://github.com/test-org/rule-123' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [{ name: 'test.txt', path: 'test.txt', type: 'file' }],
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ content: 'dGVzdA==' }),
        })
        .mockResolvedValueOnce({ ok: false })
        .mockResolvedValueOnce({
          ok: false,
          status: 409,
          text: async () => JSON.stringify({ message: 'reference already exists' }),
        });

      await bootstrapHandler(request, reply);

      expect(reply.status).toHaveBeenCalledWith(200);
    });

    it('should handle JSON parse error in file creation', async () => {
      const request = createMockRequest({
        ruleId: '123',
        ruleVersion: '1.0.0',
        organization: 'test-org',
      });
      const reply = createMockReply();

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ html_url: 'https://github.com/test-org/rule-123' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [{ name: 'test.txt', path: 'test.txt', type: 'file' }],
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ content: 'dGVzdA==' }),
        })
        .mockResolvedValueOnce({ ok: false })
        .mockResolvedValueOnce({
          ok: false,
          status: 422,
          text: async () => 'invalid json',
        });

      await bootstrapHandler(request, reply);

      expect(reply.status).toHaveBeenCalledWith(200);
      expect(mockLoggerService.error).toHaveBeenCalled();
    });

    it('should handle error thrown during file processing', async () => {
      const request = createMockRequest({
        ruleId: '123',
        ruleVersion: '1.0.0',
        organization: 'test-org',
      });
      const reply = createMockReply();

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ html_url: 'https://github.com/test-org/rule-123' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [{ name: 'test.txt', path: 'test.txt', type: 'file' }],
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ content: 'dGVzdA==' }),
        })
        .mockResolvedValueOnce({ ok: false })
        .mockImplementationOnce(() => {
          throw new Error('reference already exists');
        });

      await bootstrapHandler(request, reply);

      expect(reply.status).toHaveBeenCalledWith(200);
    });

    it('should handle SHA mismatch with successful retry', async () => {
      const request = createMockRequest({
        ruleId: '123',
        ruleVersion: '1.0.0',
        organization: 'test-org',
      });
      const reply = createMockReply();

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ html_url: 'https://github.com/test-org/rule-123' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [{ name: 'test.txt', path: 'test.txt', type: 'file' }],
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ content: 'dGVzdA==' }),
        })
        .mockResolvedValueOnce({ ok: false })
        .mockResolvedValueOnce({
          ok: false,
          status: 409,
          text: async () => JSON.stringify({ message: 'is at abc123 but expected def456' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ sha: 'abc123' }),
        })
        .mockResolvedValueOnce({ ok: true });

      await bootstrapHandler(request, reply);

      expect(reply.status).toHaveBeenCalledWith(200);
    });

    it('should handle SHA mismatch with failed retry', async () => {
      const request = createMockRequest({
        ruleId: '123',
        ruleVersion: '1.0.0',
        organization: 'test-org',
      });
      const reply = createMockReply();

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ html_url: 'https://github.com/test-org/rule-123' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [{ name: 'test.txt', path: 'test.txt', type: 'file' }],
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ content: 'dGVzdA==' }),
        })
        .mockResolvedValueOnce({ ok: false })
        .mockResolvedValueOnce({
          ok: false,
          status: 409,
          text: async () => JSON.stringify({ message: 'is at abc123 but expected def456' }),
        })
        .mockResolvedValueOnce({ ok: false });

      await bootstrapHandler(request, reply);

      expect(reply.status).toHaveBeenCalledWith(200);
    });

    it('should handle conflict with malformed JSON response', async () => {
      const request = createMockRequest({
        ruleId: '123',
        ruleVersion: '1.0.0',
        organization: 'test-org',
      });
      const reply = createMockReply();

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ html_url: 'https://github.com/test-org/rule-123' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [{ name: 'test.txt', path: 'test.txt', type: 'file' }],
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ content: 'dGVzdA==' }),
        })
        .mockResolvedValueOnce({ ok: false })
        .mockResolvedValueOnce({
          ok: false,
          status: 409,
          text: async () => 'malformed json',
        });

      await bootstrapHandler(request, reply);

      expect(reply.status).toHaveBeenCalledWith(200);
      expect(mockLoggerService.error).toHaveBeenCalled();
    });
  });
});
