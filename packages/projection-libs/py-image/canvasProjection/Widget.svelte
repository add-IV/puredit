<script lang="ts">
  import type { EditorState } from "@codemirror/state";
  import type { EditorView } from "@codemirror/view";
  import type { Match } from "@puredit/parser";
  import type { FocusGroup } from "@puredit/projections";
  import { onMount } from "svelte";
  import { ContextInformation } from "@puredit/projections";

  export let isNew: boolean;
  // svelte-ignore unused-export-let
  export let focusGroup: FocusGroup;
  // svelte-ignore unused-export-let
  export let state: EditorState;
  // svelte-ignore unused-export-let
  export let view: EditorView | null;
  // svelte-ignore unused-export-let
  export let match: Match;
  // svelte-ignore unused-export-let
  export let context: ContextInformation;

  export let width = 300;
  export let height = 100;
  export let color = "#333";
  export let background = "#fff";

  let canvas;

  onMount(() => {
    let ctx = canvas.getContext("2d");

    let welcome_string = match.argsToAstNodeMap.str.text.slice(1, -1);

    ctx.font = "30px Arial";
    ctx.fillText(welcome_string, 65, 60);
    for (let i = 0; i < 3; i++) {
      ctx.strokeRect(10 + i * 10, 20 + i * 10, 30, 30);
      ctx.strokeRect(230 + i * 10, 20 + i * 10, 30, 30);
    }
  });
</script>

<canvas {width} {height} style:background bind:this={canvas} />
