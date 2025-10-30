import { PathResolver } from '../src/core/path-resolver';

describe('PathResolver', () => {
  describe('resolvePath', () => {
    it('should resolve single variable in path', () => {
      const resolver = new PathResolver({ appName: 'test-service' });
      const result = resolver.resolvePath('src/{{appName}}/AGENTS.md');

      expect(result.original).toBe('src/{{appName}}/AGENTS.md');
      expect(result.resolved).toBe('src/test-service/AGENTS.md');
      expect(result.variables).toEqual(['appName']);
    });

    it('should resolve multiple variables in path', () => {
      const resolver = new PathResolver({
        appName: 'payment-service',
        version: 'v2',
      });
      const result = resolver.resolvePath('src/{{appName}}/{{version}}/api.ts');

      expect(result.resolved).toBe('src/payment-service/v2/api.ts');
      expect(result.variables).toEqual(['appName', 'version']);
    });

    it('should resolve path with no variables', () => {
      const resolver = new PathResolver({ appName: 'test' });
      const result = resolver.resolvePath('src/api/AGENTS.md');

      expect(result.resolved).toBe('src/api/AGENTS.md');
      expect(result.variables).toEqual([]);
    });

    it('should throw error for missing variable', () => {
      const resolver = new PathResolver({ appName: 'test' });

      expect(() => {
        resolver.resolvePath('src/{{namespace}}/AGENTS.md');
      }).toThrow('Missing variable: namespace');
    });

    it('should handle complex variable names', () => {
      const resolver = new PathResolver({
        appName: 'test-service',
        apiVersion: 'v2',
      });
      const result = resolver.resolvePath('src/{{appName}}/{{apiVersion}}/');

      expect(result.resolved).toBe('src/test-service/v2/');
      expect(result.variables).toEqual(['appName', 'apiVersion']);
    });

    it('should handle empty string variables', () => {
      const resolver = new PathResolver({ appName: '' });
      const result = resolver.resolvePath('src/{{appName}}/test.md');

      expect(result.resolved).toBe('src//test.md');
    });
  });

  describe('extractVariables', () => {
    it('should extract single variable', () => {
      const resolver = new PathResolver({});
      const variables = resolver.extractVariables('src/{{appName}}/test.md');

      expect(variables).toEqual(['appName']);
    });

    it('should extract multiple variables', () => {
      const resolver = new PathResolver({});
      const variables = resolver.extractVariables(
        'src/{{appName}}/{{version}}/{{module}}.ts'
      );

      expect(variables).toEqual(['appName', 'version', 'module']);
    });

    it('should return empty array when no variables', () => {
      const resolver = new PathResolver({});
      const variables = resolver.extractVariables('src/api/test.md');

      expect(variables).toEqual([]);
    });

    it('should handle duplicate variables', () => {
      const resolver = new PathResolver({});
      const variables = resolver.extractVariables(
        'src/{{appName}}/{{appName}}.md'
      );

      expect(variables).toEqual(['appName', 'appName']);
    });
  });

  describe('validateVariables', () => {
    it('should return empty array when all variables exist', () => {
      const resolver = new PathResolver({ appName: 'test', version: 'v1' });
      const missing = resolver.validateVariables(['appName', 'version']);

      expect(missing).toEqual([]);
    });

    it('should return missing variable names', () => {
      const resolver = new PathResolver({ appName: 'test' });
      const missing = resolver.validateVariables(['appName', 'version']);

      expect(missing).toEqual(['version']);
    });

    it('should return multiple missing variables', () => {
      const resolver = new PathResolver({ appName: 'test' });
      const missing = resolver.validateVariables(['appName', 'version', 'namespace']);

      expect(missing).toEqual(['version', 'namespace']);
    });

    it('should return empty array for empty variable list', () => {
      const resolver = new PathResolver({});
      const missing = resolver.validateVariables([]);

      expect(missing).toEqual([]);
    });
  });

  describe('hasVariables', () => {
    it('should detect variables in path', () => {
      const resolver = new PathResolver({});

      expect(resolver.hasVariables('src/{{appName}}/test.md')).toBe(true);
      expect(resolver.hasVariables('src/{{appName}}/{{version}}')).toBe(true);
    });

    it('should return false when no variables', () => {
      const resolver = new PathResolver({});

      expect(resolver.hasVariables('src/api/test.md')).toBe(false);
    });

    it('should handle edge cases', () => {
      const resolver = new PathResolver({});

      expect(resolver.hasVariables('')).toBe(false);
      expect(resolver.hasVariables('{{}')).toBe(false);
      expect(resolver.hasVariables('{ {var} }')).toBe(false);
    });
  });

  describe('updateVariables', () => {
    it('should update existing variables', () => {
      const resolver = new PathResolver({ appName: 'old' });
      resolver.updateVariables({ appName: 'new' });

      const result = resolver.resolvePath('{{appName}}');
      expect(result.resolved).toBe('new');
    });

    it('should add new variables', () => {
      const resolver = new PathResolver({ appName: 'test' });
      resolver.updateVariables({ version: 'v1' });

      const result = resolver.resolvePath('{{appName}}/{{version}}');
      expect(result.resolved).toBe('test/v1');
    });

    it('should merge with existing variables', () => {
      const resolver = new PathResolver({ appName: 'test', version: 'v1' });
      resolver.updateVariables({ version: 'v2', namespace: 'com.test' });

      const vars = resolver.getVariables();
      expect(vars).toEqual({
        appName: 'test',
        version: 'v2',
        namespace: 'com.test',
      });
    });
  });

  describe('getVariables', () => {
    it('should return copy of current variables', () => {
      const resolver = new PathResolver({ appName: 'test', version: 'v1' });
      const vars = resolver.getVariables();

      expect(vars).toEqual({ appName: 'test', version: 'v1' });

      // Modifying returned object shouldn't affect resolver
      vars.appName = 'modified';
      const result = resolver.resolvePath('{{appName}}');
      expect(result.resolved).toBe('test');
    });

    it('should return empty object when no variables', () => {
      const resolver = new PathResolver({});
      const vars = resolver.getVariables();

      expect(vars).toEqual({});
    });
  });
});
