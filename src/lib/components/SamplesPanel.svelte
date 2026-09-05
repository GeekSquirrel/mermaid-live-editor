<script lang="ts">
  import { Button } from '$/components/ui/button';
  import { getSampleDiagrams, type SampleExample } from '$/util/mermaid';
  import { inputState, updateCode } from '$lib/util/state.svelte';
  import { diagramState } from '$lib/util/diagramState.svelte';
  import { logEvent } from '$lib/util/stats';

  const extras: Record<string, SampleExample[]> = {
    Architecture: [
      {
        code: `---
config:
    theme: dark
---
architecture-beta
    group api(cloud)[API]

    service db(database)[Database] in api
    service disk1(disk)[Storage] in api
    service disk2(disk)[Storage] in api
    service server(server)[Server] in api

    db:L -- R:server
    disk1:T -- B:server
    disk2:T -- B:db`,
        isDefault: true,
        title: 'Cloud Architecture'
      }
    ],
    ZenUML: [
      {
        code: `zenuml
    title Order Service
    @Actor Client #FFEBE6
    @Boundary OrderController #0747A6
    @EC2 <<BFF>> OrderService #E3FCEF
    group BusinessService {
      @Lambda PurchaseService
      @AzureFunction InvoiceService
    }

    @Starter(Client)
    // \`POST /orders\`
    OrderController.post(payload) {
      OrderService.create(payload) {
        order = new Order(payload)
        if(order != null) {
          par {
            PurchaseService.createPO(order)
            InvoiceService.createInvoice(order)
          }
        }
      }
    }
`,
        isDefault: true,
        title: 'Order Service'
      }
    ]
  };

  const samples = { ...getSampleDiagrams(), ...extras };

  const normalizeCode = (code: string | undefined): string =>
    (code ?? '').replace(/\r\n/g, '\n').trim();

  const isCurrentSample = (exampleCode: string): boolean => {
    return normalizeCode(exampleCode) === normalizeCode(inputState.code);
  };

  const loadSampleDiagram = (diagramType: string, example: SampleExample): void => {
    updateCode(example.code, {
      resetPanZoom: true,
      updateDiagram: true
    });
    logEvent('loadSampleDiagram', { diagramType, exampleTitle: example.title });
    void diagramState.save({ silent: true });
  };

  const mainDiagrams = [
    'Flowchart',
    'Class',
    'Sequence',
    'Entity Relationship',
    'State',
    'Mindmap',
    'Architecture'
  ];

  const diagramOrder = [
    ...mainDiagrams.filter((key) => key in samples),
    ...Object.keys(samples)
      .filter((key) => !mainDiagrams.includes(key))
      .sort()
  ];
</script>

<div class="flex h-full flex-col gap-5 overflow-y-auto p-4">
  {#each diagramOrder as diagramType (diagramType)}
    {@const examples = samples[diagramType]}
    <div class="flex flex-col gap-2">
      <h3 class="text-xs font-semibold tracking-wider text-accent uppercase">
        {diagramType}
      </h3>
      <div class="flex flex-wrap gap-2">
        {#if examples.length === 1}
          {@const active = isCurrentSample(examples[0].code)}
          <Button
            variant={active ? 'accent' : 'secondary'}
            size="sm"
            class={[
              'h-7 px-2.5 text-xs font-medium transition-all',
              active && 'font-semibold shadow-sm ring-1 ring-accent'
            ]}
            onclick={() => loadSampleDiagram(diagramType, examples[0])}>
            Basic {diagramType}
          </Button>
        {:else}
          {#each examples as example (example.title)}
            {@const active = isCurrentSample(example.code)}
            <Button
              variant={active ? 'accent' : 'secondary'}
              size="sm"
              class={[
                'h-7 px-2.5 text-xs font-medium transition-all',
                active && 'font-semibold shadow-sm ring-1 ring-accent'
              ]}
              onclick={() => loadSampleDiagram(diagramType, example)}>
              {example.title}
            </Button>
          {/each}
        {/if}
      </div>
    </div>
  {/each}
</div>
