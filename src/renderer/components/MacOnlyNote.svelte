<script lang="ts">
  import { t } from '@shared/i18n/store.svelte';
</script>

<div class="mac-only-note" role="status">
  <p>{t().app.macOnly}</p>
</div>

<style>
  .mac-only-note {
    padding: 28px 18px;
    color: #5c564e;
    font-size: 14px;
    line-height: 1.45;
  }
</style>
