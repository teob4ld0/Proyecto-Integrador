<script lang="ts">
  import '../app.css';
  let { children } = $props();
</script>

<div class="app-container">
  <main>
    {@render children()}
  </main>
</div>

<style>
  .app-container {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }
  main {
    flex: 1;
    display: flex;
    flex-direction: column;
  }
</style>
