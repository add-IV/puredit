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

    ctx.font = "30px Arial";
    ctx.fillText("Hello World", 60, 60);
  });
</script>

<canvas {width} {height} style:background bind:this={canvas} />
