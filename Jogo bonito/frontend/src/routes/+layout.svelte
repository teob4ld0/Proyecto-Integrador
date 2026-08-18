<script lang="ts">
  import '../app.css';
  let { children } = $props();
</script>

<div class="app-container">
  {@render children()}
</div>

<style>
  .app-container {
    width: 100%;
    height: 100vh;
    height: 100dvh;
    display: flex;
    overflow: hidden;
  }
</style>
