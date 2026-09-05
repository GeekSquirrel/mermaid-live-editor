<script lang="ts">
  import type { EditorProps } from '$/types';
  import { validatedState } from '$/util/state.svelte';
  import { markdown } from '@codemirror/lang-markdown';
  import { yamlFrontmatter } from '@codemirror/lang-yaml';
  import { Compartment, EditorState } from '@codemirror/state';
  import { EditorView } from '@codemirror/view';
  import { vsCodeDark } from '@fsegurai/codemirror-theme-vscode-dark';
  import { vsCodeLight } from '@fsegurai/codemirror-theme-vscode-light';
  import { basicSetup } from 'codemirror';
  import { mode } from 'mode-watcher';
  import { diagramState } from '$lib/util/diagramState.svelte';
  import { onMount } from 'svelte';

  let editorView: EditorView | undefined;
  let editorContainer: HTMLDivElement;
  // Deliberately not $state: the sync effect below both reads and writes it,
  // so a reactive currentText would make every keystroke re-run the effect
  // against the not-yet-revalidated state and revert the user's input.
  let currentText = '';
  const themeCompartment = new Compartment();

  const { onUpdate }: EditorProps = $props();

  $effect(() => {
    editorView?.dispatch({
      effects: themeCompartment.reconfigure(mode.current === 'dark' ? vsCodeDark : vsCodeLight)
    });
  });

  onMount(() => {
    editorView = new EditorView({
      state: EditorState.create({
        doc: currentText,
        extensions: [
          basicSetup,
          yamlFrontmatter({ content: markdown() }),
          themeCompartment.of([]),
          EditorView.domEventHandlers({
            blur() {
              if (diagramState.hasChanges) {
                void diagramState.save();
              }
            }
          }),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              const newText = update.state.doc.toString();
              if (currentText === newText) {
                return;
              }
              currentText = newText;
              onUpdate(newText);
            }
          }),
          EditorView.theme({
            '& .cm-activeLineGutter': {
              backgroundColor: 'var(--muted)',
              color: 'var(--foreground)'
            },
            '& .cm-gutterElement': {
              color: 'inherit'
            },
            '& .cm-gutters': {
              backgroundColor: 'var(--background)',
              borderRight: '1px solid var(--border)',
              color: 'var(--muted-foreground)'
            },
            '&.cm-editor': {
              height: '100%'
            },
            '&.cm-focused': {
              outline: 'none'
            },
            '&.cm-scroller': {
              overflow: 'auto'
            }
          })
        ]
      }),
      parent: editorContainer
    });

    return () => {
      editorView?.destroy();
    };
  });

  $effect(() => {
    const { code } = validatedState.current;
    if (currentText === code || !editorView) {
      return;
    }
    currentText = code;
    editorView.dispatch({
      changes: {
        from: 0,
        to: editorView.state.doc.length,
        insert: code
      }
    });
  });
</script>

<div bind:this={editorContainer} class="size-full"></div>
