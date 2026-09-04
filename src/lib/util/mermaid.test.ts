import { describe, expect, it } from 'vitest';
import { getSampleDiagrams } from './mermaid';

describe('getSampleDiagrams', () => {
  const samples = getSampleDiagrams();

  it('should return at least one example per diagram', () => {
    expect(Object.keys(samples).length).toBeGreaterThan(0);
    for (const [name, examples] of Object.entries(samples)) {
      expect(examples.length, `${name} should have at least one example`).toBeGreaterThan(0);
      for (const example of examples) {
        expect(example.title, `${name} has an example without a title`).toBeTruthy();
        expect(example.code, `${name} example "${example.title}" has no code`).toBeTruthy();
      }
    }
  });

  it('should list the default example first', () => {
    for (const [name, examples] of Object.entries(samples)) {
      expect(examples[0].isDefault, `${name} should have its default example first`).toBe(true);
    }
  });

  it('should render zenuml then flowchart then zenuml without errors and isolate styles', async () => {
    const svgProto = window.SVGElement.prototype as unknown as { getBBox?: () => DOMRect };
    if (!svgProto.getBBox) {
      svgProto.getBBox = () =>
        ({
          bottom: 100,
          height: 100,
          left: 0,
          right: 100,
          toJSON: () => ({}),
          top: 0,
          width: 100,
          x: 0,
          y: 0
        }) as DOMRect;
    }
    const { render, defaultMermaidConfig } = await import('./mermaid');
    const zenumlCode = `zenuml\n  title Order Service\n  Client->Server: request`;
    const flowchartCode = `graph TD\n  A --> B`;

    const r1 = await render(defaultMermaidConfig, zenumlCode, 'zenuml-1');
    expect(r1.svg).toBeTruthy();

    // Verify render() automatically scoped ZenUML variables away from :root
    const anyRootBackground = Array.from(document.querySelectorAll('style')).some(
      (s) => s.textContent && /:root\s*\{[^}]*--background:\s*#282a36/.test(s.textContent)
    );
    expect(anyRootBackground).toBe(false);

    const zenumlHasScopedBackground = Array.from(document.querySelectorAll('style')).some(
      (s) => s.textContent && /\.zenuml\s*\{[^}]*--background:\s*#282a36/.test(s.textContent)
    );
    expect(zenumlHasScopedBackground).toBe(true);

    const r2 = await render(defaultMermaidConfig, flowchartCode, 'flowchart-1');
    expect(r2.svg).toBeTruthy();

    const r3 = await render(defaultMermaidConfig, zenumlCode, 'zenuml-2');
    expect(r3.svg).toBeTruthy();
  }, 30000);
});
