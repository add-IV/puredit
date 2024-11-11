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

  onMount(() => {
    if (isNew) {
      requestAnimationFrame(() => {
        focusGroup.first();
      });
    }
  });
</script>

<div class="box white">
  <div class="box red" />
</div>

<style>
  .box {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    width: 100%;
    height: 100%;
  }

  .red {
    background-color: red;
    width: 100px;
    height: 100px;
  }

  .white {
    background-color: white;
    width: 200px;
    height: 200px;
  }
</style>
