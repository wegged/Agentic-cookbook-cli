import { TemplateMerger } from '../src/core/merger';

describe('TemplateMerger', () => {
  const delimiter = '<!-- PROJECT_SPECIFIC -->';

  describe('hasDelimiter', () => {
    it('should detect delimiter in content', () => {
      const merger = new TemplateMerger(delimiter);
      const content = `# Template\n\n${delimiter}\n\nProject content`;

      expect(merger.hasDelimiter(content)).toBe(true);
    });

    it('should return false when delimiter not present', () => {
      const merger = new TemplateMerger(delimiter);
      const content = '# Template\n\nNo delimiter here';

      expect(merger.hasDelimiter(content)).toBe(false);
    });

    it('should handle empty content', () => {
      const merger = new TemplateMerger(delimiter);

      expect(merger.hasDelimiter('')).toBe(false);
    });
  });

  describe('ensureDelimiter', () => {
    it('should add delimiter if not present', () => {
      const merger = new TemplateMerger(delimiter);
      const content = '# Template\n\nContent here';
      const result = merger.ensureDelimiter(content);

      expect(result).toContain(delimiter);
      expect(result).toBe(`${content}\n\n${delimiter}\n\n`);
    });

    it('should not add delimiter if already present', () => {
      const merger = new TemplateMerger(delimiter);
      const content = `# Template\n\n${delimiter}\n\nProject content`;
      const result = merger.ensureDelimiter(content);

      expect(result).toBe(content);
      expect(result.match(new RegExp(delimiter, 'g'))?.length).toBe(1);
    });

    it('should handle empty content', () => {
      const merger = new TemplateMerger(delimiter);
      const result = merger.ensureDelimiter('');

      expect(result).toBe(`\n\n${delimiter}\n\n`);
    });
  });

  describe('getDelimiter', () => {
    it('should return configured delimiter', () => {
      const customDelimiter = '<!-- CUSTOM -->';
      const merger = new TemplateMerger(customDelimiter);

      expect(merger.getDelimiter()).toBe(customDelimiter);
    });
  });

  describe('merge', () => {
    describe('with preserve-project strategy', () => {
      it('should preserve existing project section with delimiter', () => {
        const merger = new TemplateMerger(delimiter);
        const newTemplate = `# New Template\n\nUpdated template content\n\n${delimiter}\n`;
        const existingFile = `# Old Template\n\nOld template content\n\n${delimiter}\n\nProject specific content`;

        const result = merger.merge(newTemplate, existingFile, 'preserve-project');

        expect(result.content).toContain('# New Template');
        expect(result.content).toContain('Updated template content');
        expect(result.content).toContain('Project specific content');
        expect(result.content).not.toContain('# Old Template');
        expect(result.content).not.toContain('Old template content');
        expect(result.hasConflict).toBe(false);
      });

      it('should treat entire file as project content when no delimiter in existing', () => {
        const merger = new TemplateMerger(delimiter);
        const newTemplate = `# New Template\n\nNew content\n\n${delimiter}\n`;
        const existingFile = '# Old content without delimiter';

        const result = merger.merge(newTemplate, existingFile, 'preserve-project');

        expect(result.content).toContain('# New Template');
        expect(result.content).toContain('# Old content without delimiter');
        expect(result.content).toContain(delimiter);
        expect(result.hasConflict).toBe(false);
      });

      it('should handle empty existing file', () => {
        const merger = new TemplateMerger(delimiter);
        const newTemplate = `# New Template\n\n${delimiter}\n`;

        const result = merger.merge(newTemplate, '', 'preserve-project');

        expect(result.content).toContain('# New Template');
        expect(result.content).toContain(delimiter);
        expect(result.hasConflict).toBe(false);
      });

      it('should preserve project section with multiple paragraphs', () => {
        const merger = new TemplateMerger(delimiter);
        const projectContent = 'First paragraph\n\nSecond paragraph\n\nThird paragraph';
        const newTemplate = `# New\n\n${delimiter}\n`;
        const existingFile = `# Old\n\n${delimiter}\n\n${projectContent}`;

        const result = merger.merge(newTemplate, existingFile, 'preserve-project');

        expect(result.content).toContain(projectContent);
        expect(result.hasConflict).toBe(false);
      });
    });
  });

  describe('getTemplateSection', () => {
    it('should extract template section before delimiter', () => {
      const merger = new TemplateMerger(delimiter);
      const content = `# Template\n\nTemplate content\n\n${delimiter}\n\nProject content`;

      const result = merger.getTemplateSection(content);

      expect(result).toBe('# Template\n\nTemplate content');
      expect(result).not.toContain('Project content');
    });

    it('should return full content when no delimiter', () => {
      const merger = new TemplateMerger(delimiter);
      const content = '# Template\n\nNo delimiter';

      const result = merger.getTemplateSection(content);

      expect(result).toBe('# Template\n\nNo delimiter');
    });
  });

  describe('getProjectSection', () => {
    it('should extract project section after delimiter', () => {
      const merger = new TemplateMerger(delimiter);
      const content = `# Template\n\n${delimiter}\n\nProject specific content`;

      const result = merger.getProjectSection(content);

      expect(result).toBe('Project specific content');
      expect(result).not.toContain('# Template');
    });

    it('should return empty string when no delimiter', () => {
      const merger = new TemplateMerger(delimiter);
      const content = '# Template\n\nNo delimiter';

      const result = merger.getProjectSection(content);

      expect(result).toBe('');
    });

    it('should return empty string when nothing after delimiter', () => {
      const merger = new TemplateMerger(delimiter);
      const content = `# Template\n\n${delimiter}\n\n`;

      const result = merger.getProjectSection(content);

      expect(result).toBe('');
    });
  });

  describe('hasChanges', () => {
    it('should detect differences in content', () => {
      const merger = new TemplateMerger(delimiter);
      const content1 = '# Template\n\nContent 1';
      const content2 = '# Template\n\nContent 2';

      expect(merger.hasChanges(content1, content2)).toBe(true);
    });

    it('should return false for identical content', () => {
      const merger = new TemplateMerger(delimiter);
      const content = '# Template\n\nContent';

      expect(merger.hasChanges(content, content)).toBe(false);
    });

    it('should normalize whitespace', () => {
      const merger = new TemplateMerger(delimiter);
      const content1 = '# Template\n\n  Content  \n\n';
      const content2 = '#  Template   Content';

      expect(merger.hasChanges(content1, content2)).toBe(false);
    });

    it('should handle empty content', () => {
      const merger = new TemplateMerger(delimiter);

      expect(merger.hasChanges('', '')).toBe(false);
      expect(merger.hasChanges('content', '')).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle very long content', () => {
      const merger = new TemplateMerger(delimiter);
      const longContent = 'x'.repeat(100000);
      const newTemplate = `# New\n\n${delimiter}\n`;
      const existingFile = `# Old\n\n${delimiter}\n\n${longContent}`;

      const result = merger.merge(newTemplate, existingFile, 'preserve-project');

      expect(result.content).toContain(longContent);
    });

    it('should handle special characters in content', () => {
      const merger = new TemplateMerger(delimiter);
      const specialContent = '```typescript\nconst x = /regex$/;\n```\n\n$variable {{template}}';
      const newTemplate = `# New\n\n${delimiter}\n`;
      const existingFile = `# Old\n\n${delimiter}\n\n${specialContent}`;

      const result = merger.merge(newTemplate, existingFile, 'preserve-project');

      expect(result.content).toContain(specialContent);
    });

    it('should handle unicode characters', () => {
      const merger = new TemplateMerger(delimiter);
      const unicodeContent = '中文 • 日本語 • 한국어 • العربية • עברית';
      const newTemplate = `# New\n\n${delimiter}\n`;
      const existingFile = `# Old\n\n${delimiter}\n\n${unicodeContent}`;

      const result = merger.merge(newTemplate, existingFile, 'preserve-project');

      expect(result.content).toContain(unicodeContent);
    });

    it('should handle multiple delimiters (use first)', () => {
      const merger = new TemplateMerger(delimiter);
      const newTemplate = `# New\n\n${delimiter}\n`;
      const existingFile = `# Old\n\n${delimiter}\n\nContent1\n\n${delimiter}\n\nContent2`;

      const result = merger.merge(newTemplate, existingFile, 'preserve-project');

      // Everything after first delimiter is treated as project content
      expect(result.content).toContain(`Content1\n\n${delimiter}\n\nContent2`);
    });
  });
});
