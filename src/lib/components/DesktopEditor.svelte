<script lang="ts">
  import type { EditorProps } from '$/types';
  import { validatedState } from '$/util/state.svelte';
  import { initEditor } from '$lib/util/monacoExtra';
  import { errorDebug } from '$lib/util/util';
  import { mode } from 'mode-watcher';
  import * as monaco from 'monaco-editor';
  import monacoEditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
  import { projectState } from '$lib/util/projectState.svelte';
  import { onMount } from 'svelte';

  const { onUpdate }: EditorProps = $props();

  let divElement: HTMLDivElement | undefined = $state();
  let editor: monaco.editor.IStandaloneCodeEditor | undefined;
  let editorOptions = {
    glyphMargin: false,
    lineNumbersMinChars: 4,
    minimap: {
      enabled: false
    },
    overviewRulerLanes: 0,
    scrollbar: {
      horizontal: 'auto',
      horizontalScrollbarSize: 8,
      useShadows: false,
      vertical: 'auto',
      verticalScrollbarSize: 8
    }
  } satisfies monaco.editor.IStandaloneEditorConstructionOptions;
  let currentText = '';
  let isUpdatingFromState = false;

  const applyEditorTheme = (currentMode: typeof mode.current) => {
    if (!editor) return;
    monaco.editor.setTheme(`mermaid${currentMode === 'dark' ? '-dark' : ''}`);
    divElement?.classList.toggle('mermaid-dark', currentMode === 'dark');
  };

  $effect(() => {
    applyEditorTheme(mode.current);
  });

  const mermaidModel = monaco.editor.createModel(
    '',
    'mermaid',
    monaco.Uri.parse('internal://mermaid.mmd')
  );

  onMount(() => {
    self.MonacoEnvironment = {
      getWorker() {
        return new monacoEditorWorker();
      }
    };

    if (!divElement) {
      throw new Error('divEl is undefined');
    }

    initEditor(monaco);
    errorDebug();
    editor = monaco.editor.create(divElement, editorOptions);
    editor.setModel(mermaidModel);

    editor.onDidChangeModelContent(({ isFlush }) => {
      const newText = editor?.getValue();
      if (newText === undefined || currentText === newText || isFlush || isUpdatingFromState) {
        return;
      }
      currentText = newText;
      onUpdate(currentText);
    });

    editor.onDidBlurEditorText(() => {
      if (projectState.hasChanges) {
        void projectState.save();
      }
    });

    applyEditorTheme(mode.current);

    const resizeObserver = new ResizeObserver((entries) => {
      editor?.layout({
        height: entries[0].contentRect.height,
        width: entries[0].contentRect.width
      });
    });

    if (divElement.parentElement) {
      resizeObserver.observe(divElement);
    }

    return () => {
      resizeObserver.disconnect();
      mermaidModel.dispose();
      editor?.dispose();
    };
  });

  $effect(() => {
    const { errorMarkers, code } = validatedState.current;
    if (!editor) {
      return;
    }

    // Update editor text if it's different
    if (code !== currentText) {
      isUpdatingFromState = true;
      try {
        editor.setScrollTop(0);
        editor.pushUndoStop();
        editor.executeEdits('updateCode', [
          {
            range: mermaidModel.getFullModelRange(),
            text: code
          }
        ]);
        editor.pushUndoStop();
        currentText = code;
      } finally {
        isUpdatingFromState = false;
      }
    }

    // Display/clear errors
    monaco.editor.setModelMarkers(mermaidModel, 'mermaid', errorMarkers);
  });
</script>

<div class="relative h-full grow overflow-hidden">
  <div bind:this={divElement} id="editor" class="h-full w-full"></div>
</div>

<style>
  :global(.monaco-editor .monaco-scrollable-element > .scrollbar) {
    background: transparent !important;
  }
  :global(.monaco-editor .monaco-scrollable-element > .scrollbar > .slider) {
    background: var(--muted-foreground) !important;
    border-radius: 9999px !important;
    opacity: 0.35;
    transition: opacity 0.2s ease;
  }
  :global(.monaco-editor .monaco-scrollable-element > .scrollbar > .slider:hover),
  :global(.monaco-editor .monaco-scrollable-element > .scrollbar > .slider.active) {
    opacity: 0.65;
  }
</style>
