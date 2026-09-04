<script lang="ts">
  import { Button } from '$/components/ui/button';
  import { TID } from '$/constants';
  import type { DocumentationConfig } from '$/types';
  import { env } from '$/util/env';
  import { standardizeDiagramType } from '$/util/mermaid';
  import { validatedState } from '$/util/state.svelte';
  import BookIcon from '~icons/material-symbols/book-2-outline-rounded';

  const docURLBase = env.docsUrl;
  const docMap = {
    architecture: {
      code: '/syntax/architecture.html'
    },
    block: {
      code: '/syntax/block.html'
    },
    c4: {
      code: '/syntax/c4.html'
    },
    class: {
      code: '/syntax/classDiagram.html'
    },
    er: {
      code: '/syntax/entityRelationshipDiagram.html'
    },
    flowchart: {
      code: '/syntax/flowchart.html'
    },
    gantt: {
      code: '/syntax/gantt.html'
    },
    gitGraph: {
      code: '/syntax/gitgraph.html'
    },
    journey: {
      code: '/syntax/userJourney.html'
    },
    kanban: {
      code: '/syntax/kanban.html'
    },
    mindmap: {
      code: '/syntax/mindmap.html'
    },
    packet: {
      code: '/syntax/packet.html'
    },
    pie: {
      code: '/syntax/pie.html'
    },
    quadrantChart: {
      code: '/syntax/quadrantChart.html'
    },
    requirement: {
      code: '/syntax/requirementDiagram.html'
    },
    sankey: {
      code: '/syntax/sankey.html'
    },
    sequence: {
      code: '/syntax/sequenceDiagram.html'
    },
    stateDiagram: {
      code: '/syntax/stateDiagram.html'
    },
    timeline: {
      code: '/syntax/timeline.html'
    },
    treemap: {
      code: '/syntax/treemap.html'
    },
    xychart: {
      code: '/syntax/xyChart.html'
    },
    zenuml: {
      code: '/syntax/zenuml.html'
    }
  } as const satisfies DocumentationConfig;

  const doc = $derived.by(() => {
    const { diagramType } = validatedState.current;
    if (!diagramType) {
      return { key: '', url: docURLBase };
    }
    const key = standardizeDiagramType(diagramType);
    const docConfig: { code: string } = docMap[key as keyof typeof docMap] ?? {
      code: ''
    };
    const url = docURLBase + (docConfig.code ?? '');
    return { key, url };
  });
</script>

<Button
  variant="ghost"
  data-testid={TID.diagramDocumentationButton}
  href={doc.url}
  target="_blank"
  title="View documentation for {doc.key.replace('Diagram', '')} diagram">
  <BookIcon />
  Docs
</Button>
