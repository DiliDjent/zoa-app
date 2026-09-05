<script lang="ts">
  import { t } from '$lib/i18n';
  import DataFreshness from './DataFreshness.svelte';
  import type { SourceResult } from '$lib/adapters/types';
  import type { RoadStatus } from '$lib/adapters/traffic';

  let { result }: { result: SourceResult<RoadStatus> } = $props();

  const status = $derived(result.data);

  /**
   * Farbe und Form werden gemeinsam gesetzt. Die Ampel ist nie nur farbig:
   * sie traegt immer auch ein Zeichen und ein Wort, damit sie ohne
   * Farbunterscheidung lesbar bleibt.
   */
  const view = $derived.by(() => {
    const s = status?.state ?? 'unknown';
    switch (s) {
      case 'open':
        return { color: 'var(--color-status-green)', soft: 'var(--color-status-green-soft)', mark: '●', label: $t('road.open') };
      case 'closed':
        return { color: 'var(--color-status-red)', soft: 'var(--color-status-red-soft)', mark: '■', label: $t('road.closed') };
      case 'restricted':
        return { color: 'var(--color-status-amber)', soft: 'var(--color-status-amber-soft)', mark: '▲', label: $t('road.restricted') };
      default:
        return { color: 'var(--color-status-neutral)', soft: 'var(--surface-sunken)', mark: '?', label: $t('road.unknown') };
    }
  });

  const timeLine = $derived.by(() => {
    if (!status) return null;
    if (!status.seasonActive) return $t('road.seasonInactive');
    const next = status.nextChange;
    if (!next) return null;
    if (next.kind === 'opens') return $t('road.closedUntil', { time: next.time });
    // Nach Ende des Sperrfensters greift die Sperre erst am Folgetag - sonst
    // stuende am Abend "offen bis 09:00 Uhr", was in die Irre fuehrt.
    return next.tomorrow
      ? $t('road.nextClosureTomorrow', { time: next.time })
      : $t('road.openUntil', { time: next.time });
  });
</script>

<section class="card overflow-hidden" aria-labelledby="road-heading">
  <div class="px-4 pt-4 pb-3">
    <h2 id="road-heading" class="text-[13px] font-bold uppercase tracking-wide muted">
      {$t('road.title')}
    </h2>
    <p class="text-[12px] muted mt-0.5">{$t('road.subtitle')}</p>
  </div>

  <!-- Statusfläche: groß genug, um sie im Vorbeigehen zu lesen -->
  <div
    class="px-4 py-6 flex items-center gap-4"
    style="background: {view.soft};"
    role="status"
    aria-label={$t('a11y.statusOf', { status: view.label })}
  >
    <span
      class="shrink-0 w-16 h-16 rounded-full grid place-items-center text-white text-2xl font-bold"
      style="background: {view.color};"
      aria-hidden="true"
    >
      {view.mark}
    </span>
    <div class="min-w-0">
      <p class="text-3xl font-extrabold leading-none tracking-tight">{view.label}</p>
      {#if timeLine}
        <p class="text-sm font-semibold mt-1.5">{timeLine}</p>
      {/if}
      {#if status?.dailyClosure && status.seasonActive}
        <p class="text-[12px] muted mt-1">
          {$t('road.dailyClosure', { from: status.dailyClosure.from, to: status.dailyClosure.to })}
        </p>
      {/if}
    </div>
  </div>

  <div class="px-4 py-3 space-y-3">
    {#if status?.earlyClosurePossible && status.seasonActive}
      <!--
        Der wichtigste Vorbehalt: "offen" ist keine Zusage. Steht so wörtlich
        in der amtlichen Meldung und darf deshalb nicht wegfallen.
      -->
      <p
        class="text-[13px] leading-snug rounded-lg px-3 py-2"
        style="background: var(--color-status-amber-soft);"
      >
        <strong>{$t('road.earlyClosureWarning', { time: status.dailyClosure?.from ?? '09:00' })}</strong>
      </p>
      <p class="text-[12px] muted">{$t('road.liveCheckHint')}</p>
    {/if}

    {#if status?.notice}
      <details class="text-[13px]">
        <summary class="tap flex items-center cursor-pointer font-semibold select-none">
          {$t('common.source')}: {$t('sources.trafficBulletin')}
        </summary>
        <p class="mt-2 leading-snug muted">{status.notice.text}</p>
        {#if status.validFrom}
          <p class="mt-1 text-[12px] muted">
            {$t('road.validFrom', { from: status.validFrom, to: status.validTo ?? '–' })}
          </p>
        {/if}
      </details>
    {/if}

    {#if status && status.otherNotices.length > 0}
      <details class="text-[13px]">
        <summary class="tap flex items-center cursor-pointer font-semibold select-none">
          {$t('road.otherNotices')} ({status.otherNotices.length})
        </summary>
        <ul class="mt-2 space-y-2">
          {#each status.otherNotices as n}
            <li class="rounded-lg px-3 py-2" style="background: var(--surface-sunken);">
              <p class="font-semibold text-[12px]">{n.streetName} <span class="muted">{n.streetNr}</span></p>
              <p class="text-[12px] muted leading-snug mt-0.5">{n.text}</p>
            </li>
          {/each}
        </ul>
      </details>
    {/if}

    <DataFreshness {result} />
  </div>
</section>
