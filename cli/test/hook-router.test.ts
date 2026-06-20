import { describe, expect, it } from '@jest/globals';
import {
  buildBlockMessage,
  classifyRoute,
  hasCanonicalQuickPhrase,
  isGuardedPath,
  isGuardedWriteTool,
} from '../hooks/dag-flow-guard.mjs';

describe('hook router', () => {
  describe('hasCanonicalQuickPhrase', () => {
    it.each(['Fix bug', 'Hotfix', 'Hot-patch', 'Quick mode'])('matches %s', (phrase) => {
      expect(hasCanonicalQuickPhrase(`Please ${phrase} in auth`)).toBe(true);
    });

    it('rejects paraphrases', () => {
      expect(hasCanonicalQuickPhrase('patch this regression')).toBe(false);
      expect(hasCanonicalQuickPhrase("it's just a small bug")).toBe(false);
    });
  });

  describe('classifyRoute', () => {
    it('routes canonical phrases to Quick Mode', () => {
      expect(classifyRoute('Fix bug: /login returns 500')).toBe('quick');
      expect(classifyRoute('Hotfix auth timeout')).toBe('quick');
    });

    it('routes hotfix-shaped prompts with 1–2 files and symptom to Quick Mode', () => {
      expect(
        classifyRoute('src/routes/auth.js fails with ReferenceError on line 3'),
      ).toBe('quick');
      expect(
        classifyRoute('src/a.js and lib/b.js crash with TypeError'),
      ).toBe('quick');
    });

    it('biases ambiguous or feature-shaped prompts to Specify', () => {
      expect(classifyRoute('patch this regression in src/auth.js')).toBe('specify');
      expect(classifyRoute('Implement new login endpoint in src/api/auth.ts')).toBe('specify');
      expect(
        classifyRoute('src/a.js lib/b.js api/c.js fail with error'),
      ).toBe('specify');
      expect(classifyRoute('Add a new feature for OAuth in src/auth.js')).toBe('specify');
    });
  });

  describe('buildBlockMessage', () => {
    it('embeds Quick Mode guidance', () => {
      const msg = buildBlockMessage('src/routes/auth.js', 'Fix bug: 500 on login');
      expect(msg).toContain('Quick Mode (hotfix)');
      expect(msg).toContain('references/quick-mode.md');
    });

    it('embeds Specify guidance', () => {
      const msg = buildBlockMessage('src/routes/auth.js', 'Implement user profile API');
      expect(msg).toContain('Specify (feature)');
      expect(msg).toContain('references/specify.md');
    });

    it('includes dag-flow continuation hint', () => {
      const msg = buildBlockMessage('src/x.js', 'Fix bug');
      expect(msg).toContain('Já no dag-flow?');
      expect(msg).toContain('run_dag.sh');
    });
  });
});

describe('hook guard paths', () => {
  it('detects guarded write tools', () => {
    expect(isGuardedWriteTool('Write')).toBe(true);
    expect(isGuardedWriteTool('StrReplace')).toBe(true);
    expect(isGuardedWriteTool('Read')).toBe(false);
  });

  it('detects guarded directory prefixes', () => {
    expect(isGuardedPath('src/routes/auth.js')).toBe(true);
    expect(isGuardedPath('lib/utils.ts')).toBe(true);
    expect(isGuardedPath('api/handler.go')).toBe(true);
    expect(isGuardedPath('test/api.test.js')).toBe(true);
    expect(isGuardedPath('docs/readme.md')).toBe(false);
    expect(isGuardedPath('.specs/staging/foo.json')).toBe(false);
  });
});
