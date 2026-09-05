<script lang="ts">
  import { t } from '$lib/i18n';
  import DataFreshness from './DataFreshness.svelte';
  import type { SourceResult } from '$lib/adapters/types';
  import type { CablecarStatus } from '$lib/adapters/cablecar';

  let { result }: { result: SourceResult<CablecarStatus> } = $props();
  const s = $derived(result.data);
</script>

<section class="card px-4 py-4" aria-labelledby="cablecar-heading">
  <h2 id="cablecar-heading" class="text-[13px] font-bold uppercase tracking-wide muted">
    {$t('cablecar.title')}
  </h2>

  {#if s}
    <div class="mt-2 flex items-center gap-3">
      <span
        class="shrink-0 w-10 h-10 rounded-full grid place-items-center text-white text-lg font-bold"
        style="background: {s.running
          ? 'var(--color-status-green)'
          : 'var(--color-status-neutral)'};"
        aria-hidden="true"
      >
        {s.running ? '●' : '○'}
      </span>
      <div>
        <p class="text-lg font-bold leading-tight">
          {s.inSeason ? (s.running ? $t('cablecar.running') : $t('cablecar.closed')) : $t('cablecar.closedSeason')}
        </p>
        {#if s.inSeason && s.from && s.to}
          <p class="text-[13px] muted">{$t('cablecar.todayHours', { from: s.from, to: s.to })}</p>
        {:else if s.nextSeasonStart}
          <p class="text-[13px] muted">{$t('cablecar.nextSeason', { date: s.nextSeasonStart })}</p>
        {/if}
      </div>
    </div>

    <!--
      Diese Kachel beruht auf einem gepflegten Fahrplan, nicht auf Messdaten.
      Der Hinweis darf nicht wegfallen, sonst liest sie sich wie ein Live-Status.
    -->
    <p class="mt-3 text-[12px] leading-snug muted">
      {$t('cablecar.noLiveStatus')} {$t('cablecar.noWaitingTime')}
    </p>

    <a
      class="mt-2 inline-flex tap items-center text-[13px] font-semibold underline decoration-dotted underline-offset-2"
      href={s.operatorUrl}
      target="_blank"
      rel="noopener noreferrer"
    >
      {$t('cablecar.operatorLink')}
    </a>
  {:else}
    <p class="mt-2 text-[13px] muted">{$t('common.noData')}</p>
  {/if}

  <div class="mt-3">
    <DataFreshness {result} compact />
  </div>
</section>
