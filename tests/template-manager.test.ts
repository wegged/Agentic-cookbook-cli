import * as path from 'path';
import * as fs from 'fs-extra';
import { TemplateManager } from '../src/core/template-manager';

describe('TemplateManager', () => {
  const testCacheDir = path.join(__dirname, '.test-cache');
  const testRepoUrl = 'file:///home/user/Agentic-cookbook-cli/example-templates';
  let manager: TemplateManager;

  beforeEach(() => {
    manager = new TemplateManager(testCacheDir);
  });

  afterEach(async () => {
    // Clean up test cache
    if (await fs.pathExists(testCacheDir)) {
      await fs.remove(testCacheDir);
    }
  });

  describe('getRepoPath', () => {
    it('should generate path without branch', () => {
      const repoPath = manager.getRepoPath('https://github.com/user/repo.git');

      expect(repoPath).toContain('repo');
      expect(repoPath).not.toContain('main');
    });

    it('should generate path with branch', () => {
      const repoPath = manager.getRepoPath(
        'https://github.com/user/repo.git',
        'main'
      );

      expect(repoPath).toContain('repo');
      expect(repoPath).toContain('main');
    });

    it('should sanitize branch names', () => {
      const repoPath = manager.getRepoPath(
        'https://github.com/user/repo.git',
        'feature/test-branch'
      );

      expect(repoPath).toContain('feature-test-branch');
      expect(repoPath).not.toContain('feature/test-branch');
    });

    it('should handle file:// protocol', () => {
      const repoPath = manager.getRepoPath('file:///path/to/repo');

      expect(repoPath).toContain('repo');
    });
  });

  describe('git operations', () => {
    it('should clone repository on first sync', async () => {
      await manager.syncRepository(testRepoUrl, 'main');

      const repoPath = manager.getRepoPath(testRepoUrl, 'main');
      expect(await fs.pathExists(repoPath)).toBe(true);
      expect(await fs.pathExists(path.join(repoPath, '.git'))).toBe(true);
    }, 30000);

    it('should pull updates on subsequent sync', async () => {
      // First sync - clone
      await manager.syncRepository(testRepoUrl, 'main');

      // Second sync - pull
      await manager.syncRepository(testRepoUrl, 'main');

      const repoPath = manager.getRepoPath(testRepoUrl, 'main');
      expect(await fs.pathExists(repoPath)).toBe(true);
    }, 30000);

    it('should handle multiple branches', async () => {
      await manager.syncRepository(testRepoUrl, 'main');
      await manager.syncRepository(testRepoUrl, 'experimental');

      const mainPath = manager.getRepoPath(testRepoUrl, 'main');
      const expPath = manager.getRepoPath(testRepoUrl, 'experimental');

      expect(await fs.pathExists(mainPath)).toBe(true);
      expect(await fs.pathExists(expPath)).toBe(true);
      expect(mainPath).not.toBe(expPath);
    }, 30000);
  });

  describe('readTemplate', () => {
    beforeEach(async () => {
      await manager.syncRepository(testRepoUrl, 'main');
    }, 30000);

    it('should read template file from repository', async () => {
      const content = await manager.readTemplate(
        testRepoUrl,
        'backend/api/AGENTS.md',
        'main'
      );

      expect(content).toBeTruthy();
      expect(content).toContain('# Agent Instructions');
    }, 30000);

    it('should read from correct branch', async () => {
      await manager.syncRepository(testRepoUrl, 'experimental');

      const content = await manager.readTemplate(
        testRepoUrl,
        'backend/graphql/AGENTS.md',
        'experimental'
      );

      expect(content).toContain('GraphQL-Specific Best Practices');
    }, 30000);

    it('should throw error for non-existent file', async () => {
      await expect(
        manager.readTemplate(
          testRepoUrl,
          'non-existent/file.md',
          'main'
        )
      ).rejects.toThrow();
    }, 30000);
  });

  describe('cache management', () => {
    it('should create cache for repository', async () => {
      await manager.syncRepository(testRepoUrl, 'main');

      const repoPath = manager.getRepoPath(testRepoUrl, 'main');
      expect(await fs.pathExists(repoPath)).toBe(true);
      expect(await fs.pathExists(path.join(repoPath, '.git'))).toBe(true);
    }, 30000);

    it('should isolate branches in cache', async () => {
      await manager.syncRepository(testRepoUrl, 'main');
      await manager.syncRepository(testRepoUrl, 'experimental');

      const mainPath = manager.getRepoPath(testRepoUrl, 'main');
      const expPath = manager.getRepoPath(testRepoUrl, 'experimental');

      // Both should exist
      expect(await fs.pathExists(mainPath)).toBe(true);
      expect(await fs.pathExists(expPath)).toBe(true);

      // They should be different paths
      expect(mainPath).not.toBe(expPath);
    }, 30000);
  });
});
