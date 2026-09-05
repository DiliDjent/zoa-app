<script lang="ts">
  import { t, fmtTime } from '$lib/i18n';
  import type { SourceResult } from '$lib/adapters/types';

  /**
   * Zeigt Alter, Zustand und Herkunft eines Werts.
   * Jeder Datenpunkt in der App traegt diese Zeile - so ist immer sichtbar,
   * wie alt eine Zahl ist und woher sie kommt.
   */
  let { result, compact = false }: { result: SourceResult<unknown>; compact?: boolean } =
    $props();

  const ageMinutes = $derived(
    result.fetchedAt ? Math.max(0, Math.round((Date.now() - result.fetchedAt.getTime()) / 60000)) : null
  );

  const ageLabel = $derived(
    ageMinutes === null
      ? '–'
      : ageMinutes < 1
        ? $t('common.justNow')
        : ageMinutes < 90
          ? $t('common.updatedAgo', { minutes: ageMinutes })
          : $t('common.updated', { time: $fmtTime(result.fetchedAt!, true) })
  );
</script>

<div class="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] muted">
  {#if result.state === 'cached'}
    <span
      class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-semibold"
      style="background: var(--color-status-amber-soft); color: var(--ink);"
    >
      <span aria-hidden="true">⚠</span>{$t('common.offline')}
    </span>
  {:else if result.state === 'unavailable'}
    <span
      class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-semibold"
      style="background: var(--color-status-red-soft); color: var(--ink);"
    >
      {$t('common.noData')}
    </span>
  {/if}

  <span>{ageLabel}</span>

  {#if !compact}
    <span aria-hidden="true">·</span>
    <a
      class="underline decoration-dotted underline-offset-2"
      href={result.source.url}
      target="_blank"
      rel="noopener noreferrer"
    >
      {$t(result.source.labelKey)}
    </a>
  {/if}
</div>

{#if result.state === 'cached'}
  <p class="text-[11px] muted mt-1">{$t('common.offlineHint')}</p>
{/if}
