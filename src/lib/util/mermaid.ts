import { diagramData } from '@mermaid-js/examples';
import elkLayouts from '@mermaid-js/layout-elk';
import tidyTreeLayouts from '@mermaid-js/layout-tidy-tree';
import zenuml from '@mermaid-js/mermaid-zenuml';
import type { MermaidConfig, RenderResult } from 'mermaid';
import mermaid from 'mermaid';

mermaid.registerLayoutLoaders([...elkLayouts, ...tidyTreeLayouts]);
const init = mermaid.registerExternalDiagrams([zenuml]);

/**
 * ZenUML's bundled CSS contains an unlayered `:root { --background: #282a36; --border: #585b74; ... }`
 * block intended for its dark theme. When injected into the document, this unlayered rule overrides
 * the editor's own CSS variables on `:root` (both in light and dark mode), causing the page background
 * and borders to change color unexpectedly.
 *
 * This function scopes ZenUML's injected root variables to `.zenuml`, preserving ZenUML's internal
 * diagram styling while preventing contamination of the application root.
 */
export const sanitizeZenUMLStyles = (): void => {
  if (typeof document === 'undefined') {
    return;
  }
  const styles = document.querySelectorAll('style');
  for (const style of styles) {
    if (style.textContent && style.textContent.includes('--background: #282a36')) {
      style.textContent = style.textContent.replace(/:root\s*\{/g, '.zenuml {');
    }
  }
};

if (typeof window !== 'undefined' && typeof MutationObserver !== 'undefined') {
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (
          node instanceof HTMLStyleElement &&
          node.textContent?.includes('--background: #282a36')
        ) {
          node.textContent = node.textContent.replace(/:root\s*\{/g, '.zenuml {');
        }
      }
    }
  });

  if (document.head) {
    observer.observe(document.head, { childList: true, subtree: true });
  } else if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
      if (document.head) {
        observer.observe(document.head, { childList: true, subtree: true });
      }
    });
  }
}

export const render = async (
  config: MermaidConfig,
  code: string,
  id: string
): Promise<RenderResult> => {
  await init;
  sanitizeZenUMLStyles();

  // Should be able to call this multiple times without any issues.
  mermaid.initialize(config);
  const result = await mermaid.render(id, code);
  sanitizeZenUMLStyles();
  return result;
};

export const parse = async (code: string) => {
  return await mermaid.parse(code);
};

/**
 * @see https://mermaid.js.org/config/schema-docs/config.html
 */
export const defaultMermaidConfig = mermaid.mermaidAPI.defaultConfig ?? {};

export const standardizeDiagramType = (diagramType: string) => {
  switch (diagramType) {
    case 'class':
    case 'classDiagram': {
      return 'classDiagram';
    }
    case 'graph':
    case 'flowchart':
    case 'flowchart-elk':
    case 'flowchart-v2': {
      return 'flowchart';
    }
    default: {
      return diagramType;
    }
  }
};

type DiagramDefinition = (typeof diagramData)[number];

export type SampleExample = DiagramDefinition['examples'][number];

const isValidDiagram = (diagram: DiagramDefinition): diagram is Required<DiagramDefinition> => {
  return Boolean(diagram.name && diagram.examples && diagram.examples.length > 0);
};

export const getSampleDiagrams = (): Record<string, SampleExample[]> => {
  const samples: Record<string, SampleExample[]> = {};
  for (const diagram of diagramData.filter((d) => isValidDiagram(d))) {
    // The default example comes first, so it is loaded when clicking the
    // diagram name and shown at the top of the example dropdown.
    samples[diagram.name.replace(/ (Diagram|Chart|Graph)/, '')] = [...diagram.examples].sort(
      (a, b) => Number(b.isDefault ?? false) - Number(a.isDefault ?? false)
    );
  }
  return samples;
};
